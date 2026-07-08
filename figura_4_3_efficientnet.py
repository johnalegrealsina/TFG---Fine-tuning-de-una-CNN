"""
figura_4_3_efficientnet.py
==========================
Reentrena EfficientNetB0 con EL MISMO pipeline que `compare_models.py`
(seed=42, Rescaling 1/255 + Rescaling(255) interno de EfficientNet,
EarlyStopping sobre val_auc con restore_best_weights) y produce:

  - results/efficientnetb0/history_efficientnetb0.json   (historial completo)
  - results/efficientnetb0/figura_4_3_efficientnetb0.png  (perdida + exactitud)

y por pantalla los numeros de convergencia para el comentario de la memoria.

Pensado para ejecutarse en Colab. Uso:
    python figura_4_3_efficientnet.py --data_dir /content/data
o, dentro de un notebook, ajusta DATA_DIR abajo y ejecuta main().

Las curvas deberian coincidir con las del EfficientNetB0 original porque el
seed y el pipeline son identicos a compare_models.py (salvo no-determinismo
propio de la GPU, que solo introduce diferencias menores).
"""
import argparse
import json
import os
import random

import numpy as np
import tensorflow as tf

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SEED = 42


def set_seed(s: int = SEED) -> None:
    os.environ["PYTHONHASHSEED"] = str(s)
    random.seed(s)
    np.random.seed(s)
    tf.random.set_seed(s)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data_dir", default="data")
    p.add_argument("--img_size", type=int, default=224)
    p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--epochs_head", type=int, default=10)
    p.add_argument("--epochs_finetune", type=int, default=20)
    p.add_argument("--output_dir", default="results/efficientnetb0")
    return p.parse_args()


def build_datasets(data_dir, img_size, batch_size):
    """Identico a compare_models.py: imagenes en [0, 1] (Rescaling 1/255)."""
    norm = tf.keras.layers.Rescaling(1.0 / 255)

    def prep(split, shuffle):
        ds = tf.keras.utils.image_dataset_from_directory(
            os.path.join(data_dir, split),
            image_size=(img_size, img_size), batch_size=batch_size,
            shuffle=shuffle, seed=SEED, label_mode="binary")
        ds = ds.map(lambda x, y: (norm(x), y),
                    num_parallel_calls=tf.data.AUTOTUNE)
        return ds.prefetch(tf.data.AUTOTUNE)

    return prep("train", True), prep("val", False)


def build_model(img_size):
    """EfficientNetB0 con rescale_255=True (deshace el /255 antes del backbone)."""
    inp = tf.keras.Input((img_size, img_size, 3))
    x = tf.keras.layers.Rescaling(255.0)(inp)          # [0,1] -> [0,255]
    backbone = tf.keras.applications.EfficientNetB0(
        include_top=False, weights="imagenet", input_tensor=x)
    backbone.trainable = False
    out = tf.keras.layers.GlobalAveragePooling2D()(backbone.output)
    out = tf.keras.layers.BatchNormalization()(out)
    out = tf.keras.layers.Dropout(0.3)(out)
    out = tf.keras.layers.Dense(1, activation="sigmoid")(out)
    return tf.keras.Model(inputs=inp, outputs=out, name="EfficientNetB0"), backbone


def compile_model(model, lr):
    model.compile(optimizer=tf.keras.optimizers.Adam(lr),
                  loss="binary_crossentropy",
                  metrics=["accuracy", tf.keras.metrics.AUC(name="auc")])


def get_callbacks(ckpt, patience):
    return [
        tf.keras.callbacks.ModelCheckpoint(
            ckpt, monitor="val_auc", mode="max", save_best_only=True, verbose=0),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_auc", mode="max", patience=patience,
            restore_best_weights=True, verbose=1),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7, verbose=0),
    ]


def plot_figura_4_3(h1, h2, out_path):
    """Figura de 2 paneles: perdida y exactitud, con frontera de fine-tuning."""
    def cat(k):
        return h1.history.get(k, []) + h2.history.get(k, [])

    acc, val_acc = cat("accuracy"), cat("val_accuracy")
    loss, val_loss = cat("loss"), cat("val_loss")
    epocas = range(1, len(acc) + 1)
    fin_fase1 = len(h1.history["accuracy"])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    ax1.plot(epocas, loss, "o-", label="Entrenamiento")
    ax1.plot(epocas, val_loss, "s-", label="Validación")
    ax1.axvline(fin_fase1 + 0.5, ls="--", color="gray", alpha=0.7,
                label="Inicio fine-tuning")
    ax1.set_title("Pérdida (binary cross-entropy)")
    ax1.set_xlabel("Época"); ax1.set_ylabel("Pérdida")
    ax1.legend(); ax1.grid(alpha=0.3)

    ax2.plot(epocas, acc, "o-", label="Entrenamiento")
    ax2.plot(epocas, val_acc, "s-", label="Validación")
    ax2.axvline(fin_fase1 + 0.5, ls="--", color="gray", alpha=0.7,
                label="Inicio fine-tuning")
    ax2.set_title("Exactitud (accuracy)")
    ax2.set_xlabel("Época"); ax2.set_ylabel("Exactitud")
    ax2.legend(); ax2.grid(alpha=0.3)

    plt.tight_layout()
    fig.savefig(out_path, dpi=200, bbox_inches="tight")
    plt.close(fig)


def report_convergencia(h1, h2):
    def cat(k):
        return h1.history.get(k, []) + h2.history.get(k, [])

    acc, val_acc = cat("accuracy"), cat("val_accuracy")
    loss, val_loss = cat("loss"), cat("val_loss")
    val_auc = cat("val_auc")
    total = len(acc)
    fin_fase1 = len(h1.history["accuracy"])

    print("\n" + "=" * 60)
    print("  NUMEROS PARA EL COMENTARIO DE CONVERGENCIA (Figura 4.3)")
    print("=" * 60)
    print(f"Epocas totales        : {total} "
          f"(fase 1: {fin_fase1}, fase 2: {total - fin_fase1})")
    print(f"Minima val_loss       : {min(val_loss):.4f} "
          f"(epoca {val_loss.index(min(val_loss)) + 1})")
    print(f"Mejor val_accuracy    : {max(val_acc) * 100:.2f}% "
          f"(epoca {val_acc.index(max(val_acc)) + 1})")
    if val_auc:
        ep_auc = val_auc.index(max(val_auc)) + 1
        print(f"Mejor val_auc (EarlyStopping, pesos restaurados): "
              f"{max(val_auc):.4f} (epoca {ep_auc})")
    print(f"Acc/val_acc finales   : {acc[-1] * 100:.2f}% / {val_acc[-1] * 100:.2f}%")
    print("=" * 60)


def main():
    args = parse_args()
    set_seed()
    os.makedirs(args.output_dir, exist_ok=True)
    ckpt = os.path.join(args.output_dir, "EfficientNetB0_best.keras")

    train_ds, val_ds = build_datasets(args.data_dir, args.img_size, args.batch_size)

    set_seed()  # mismo punto de partida que en compare_models.py
    model, backbone = build_model(args.img_size)

    print("\n--- FASE 1: cabeza ---")
    compile_model(model, 1e-3)
    h1 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_head,
                   callbacks=get_callbacks(ckpt, 4), verbose=1)

    print("\n--- FASE 2: fine-tuning (ultimas 30 capas) ---")
    backbone.trainable = True
    for layer in backbone.layers[:-30]:
        layer.trainable = False
    compile_model(model, 1e-5)
    h2 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune,
                   callbacks=get_callbacks(ckpt, 6), verbose=1)

    # Guardar historial (para no volver a perderlo nunca).
    hist_path = os.path.join(args.output_dir, "history_efficientnetb0.json")
    with open(hist_path, "w", encoding="utf-8") as f:
        json.dump({"fase1": h1.history, "fase2": h2.history}, f)
    print(f"\n[OK] Historial -> {hist_path}")

    # Figura 4.3
    fig_path = os.path.join(args.output_dir, "figura_4_3_efficientnetb0.png")
    plot_figura_4_3(h1, h2, fig_path)
    print(f"[OK] Figura    -> {fig_path}")

    report_convergencia(h1, h2)


if __name__ == "__main__":
    main()
