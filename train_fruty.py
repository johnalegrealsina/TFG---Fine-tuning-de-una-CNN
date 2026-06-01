"""
train_fruty.py  –  Entrenamiento Fruty con ConvNeXtTiny en 2 fases.
Uso: python train_fruty.py --data_dir data --epochs_head 10 --epochs_finetune 20
"""
import argparse, os, random, numpy as np, tensorflow as tf
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

SEED = 42
def set_seed(s=SEED):
    os.environ["PYTHONHASHSEED"] = str(s)
    random.seed(s); np.random.seed(s); tf.random.set_seed(s)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data_dir",        default="data")
    p.add_argument("--img_size",        type=int, default=224)
    p.add_argument("--batch_size",      type=int, default=32)
    p.add_argument("--epochs_head",     type=int, default=10)
    p.add_argument("--epochs_finetune", type=int, default=20)
    p.add_argument("--output_dir",      default="saved_models")
    p.add_argument("--results_dir",     default="results/convnexttiny")
    return p.parse_args()

def build_datasets(data_dir, img_size, batch_size):
    norm = tf.keras.layers.Rescaling(1./255)
    def load(split, shuffle):
        ds = tf.keras.utils.image_dataset_from_directory(
            os.path.join(data_dir, split), image_size=(img_size,img_size),
            batch_size=batch_size, shuffle=shuffle, seed=SEED, label_mode="binary")
        class_names = ds.class_names
        ds = ds.map(lambda x,y: (norm(x),y), num_parallel_calls=tf.data.AUTOTUNE)
        return ds.prefetch(tf.data.AUTOTUNE), class_names
    train_ds, class_names = load("train", True)
    val_ds, _ = load("val", False)
    test_ds, _ = load("test", False)
    return train_ds, val_ds, test_ds, class_names

def build_model(img_size):
    aug = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.15),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomContrast(0.1),
    ], name="augmentation")
    inp = tf.keras.Input(shape=(img_size,img_size,3))
    x = aug(inp)
    backbone = tf.keras.applications.ConvNeXtTiny(include_top=False, weights="imagenet", input_tensor=x)
    backbone.trainable = False
    out = tf.keras.layers.GlobalAveragePooling2D()(backbone.output)
    out = tf.keras.layers.BatchNormalization()(out)
    out = tf.keras.layers.Dropout(0.4)(out)
    out = tf.keras.layers.Dense(128, activation="relu")(out)
    out = tf.keras.layers.Dropout(0.2)(out)
    out = tf.keras.layers.Dense(1, activation="sigmoid")(out)
    return tf.keras.Model(inputs=inp, outputs=out, name="Fruty_ConvNeXtTiny"), backbone

def make_callbacks(ckpt_path, patience=5):
    return [
        tf.keras.callbacks.ModelCheckpoint(ckpt_path, monitor="val_auc", mode="max", save_best_only=True, verbose=1),
        tf.keras.callbacks.EarlyStopping(monitor="val_auc", mode="max", patience=patience, restore_best_weights=True, verbose=1),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7, verbose=1),
    ]

def plot_history(h1, h2, results_dir):
    def cat(k): return h1.history.get(k,[]) + h2.history.get(k,[])
    n1 = len(h1.history.get("loss",[])); epochs = list(range(1, len(cat("loss"))+1))
    fig, axes = plt.subplots(1,3,figsize=(16,5))
    for ax,(tk,vk,title) in zip(axes,[("loss","val_loss","Loss"),("accuracy","val_accuracy","Accuracy"),("auc","val_auc","AUC")]):
        ax.plot(epochs, cat(tk), label="Train"); ax.plot(epochs, cat(vk), label="Val")
        ax.axvline(n1+0.5, color="red", linestyle="--", alpha=0.7, label="Fine-tune")
        ax.set_title(title); ax.legend(); ax.grid(alpha=0.3)
    plt.tight_layout(); fig.savefig(os.path.join(results_dir,"training_history.png"), dpi=150, bbox_inches="tight"); plt.close(fig)
    print(f"[OK] Historial guardado en {results_dir}/training_history.png")

def main():
    args = parse_args(); set_seed()
    os.makedirs(args.output_dir, exist_ok=True); os.makedirs(args.results_dir, exist_ok=True)
    ckpt = os.path.join(args.output_dir, "fruty_convnexttiny.keras")
    train_ds, val_ds, test_ds, class_names = build_datasets(args.data_dir, args.img_size, args.batch_size)
    print(f"Clases: {class_names}")
    model, backbone = build_model(args.img_size)
    print("\n--- FASE 1: cabeza ---")
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="binary_crossentropy",
                  metrics=["accuracy", tf.keras.metrics.AUC(name="auc")])
    h1 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_head, callbacks=make_callbacks(ckpt, 4), verbose=1)
    print("\n--- FASE 2: fine-tuning ---")
    backbone.trainable = True
    for layer in backbone.layers[:-30]: layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="binary_crossentropy",
                  metrics=["accuracy", tf.keras.metrics.AUC(name="auc")])
    h2 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune, callbacks=make_callbacks(ckpt, 6), verbose=1)
    loss, acc, auc = model.evaluate(test_ds, verbose=0)
    print(f"\nTest  Loss={loss:.4f}  Acc={acc:.4f}  AUC={auc:.4f}")
    print(f"Modelo guardado en {ckpt}")
    plot_history(h1, h2, args.results_dir)

if __name__ == "__main__":
    main()
