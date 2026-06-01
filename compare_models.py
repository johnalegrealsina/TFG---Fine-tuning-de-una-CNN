"""
compare_models.py  –  Compara ConvNeXtTiny, ResNet50 y EfficientNetB0 bajo las mismas condiciones.
Uso: python compare_models.py --data_dir data --output_dir results/comparison
"""
import argparse, os, csv, time, random, numpy as np, tensorflow as tf
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from sklearn.metrics import (classification_report, roc_auc_score, f1_score,
                             precision_score, recall_score, accuracy_score,
                             confusion_matrix, ConfusionMatrixDisplay)

SEED = 42
def set_seed(s=SEED):
    os.environ["PYTHONHASHSEED"]=str(s); random.seed(s); np.random.seed(s); tf.random.set_seed(s)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data_dir",        default="data")
    p.add_argument("--img_size",        type=int, default=224)
    p.add_argument("--batch_size",      type=int, default=32)
    p.add_argument("--epochs_head",     type=int, default=10)
    p.add_argument("--epochs_finetune", type=int, default=20)
    p.add_argument("--output_dir",      default="results/comparison")
    return p.parse_args()

BACKBONE_CONFIGS = {
    "ConvNeXtTiny":  {"class": tf.keras.applications.ConvNeXtTiny,  "rescale_255": False, "preprocess": None,                                          "finetune_from": -30},
    "ResNet50":      {"class": tf.keras.applications.ResNet50,       "rescale_255": False, "preprocess": tf.keras.applications.resnet.preprocess_input,  "finetune_from": -20},
    "EfficientNetB0":{"class": tf.keras.applications.EfficientNetB0, "rescale_255": True,  "preprocess": None,                                           "finetune_from": -30},
}

def build_datasets(data_dir, img_size, batch_size):
    norm = tf.keras.layers.Rescaling(1./255)
    def prep(split, shuffle):
        ds = tf.keras.utils.image_dataset_from_directory(os.path.join(data_dir,split),
             image_size=(img_size,img_size), batch_size=batch_size, shuffle=shuffle, seed=SEED, label_mode="binary")
        ds = ds.map(lambda x,y:(norm(x),y), num_parallel_calls=tf.data.AUTOTUNE)
        return ds.prefetch(tf.data.AUTOTUNE)
    train_ds=prep("train",True); val_ds=prep("val",False); test_ds=prep("test",False)
    return train_ds, val_ds, test_ds, train_ds.class_names

def build_model(name, img_size):
    cfg = BACKBONE_CONFIGS[name]
    inp = tf.keras.Input((img_size,img_size,3)); x = inp
    if cfg["rescale_255"]: x = tf.keras.layers.Rescaling(255.0)(x)
    if cfg["preprocess"] is not None: x = tf.keras.layers.Lambda(cfg["preprocess"])(x)
    backbone = cfg["class"](include_top=False, weights="imagenet", input_tensor=x)
    backbone.trainable = False
    out = tf.keras.layers.GlobalAveragePooling2D()(backbone.output)
    out = tf.keras.layers.BatchNormalization()(out)
    out = tf.keras.layers.Dropout(0.3)(out)
    out = tf.keras.layers.Dense(1, activation="sigmoid")(out)
    return tf.keras.Model(inputs=inp, outputs=out, name=name), backbone

def compile_model(model, lr):
    model.compile(optimizer=tf.keras.optimizers.Adam(lr), loss="binary_crossentropy",
                  metrics=["accuracy", tf.keras.metrics.AUC(name="auc")])

def get_callbacks(name, output_dir, patience=5):
    ckpt = os.path.join(output_dir, f"{name}_best.keras")
    return [tf.keras.callbacks.ModelCheckpoint(ckpt,monitor="val_auc",mode="max",save_best_only=True,verbose=0),
            tf.keras.callbacks.EarlyStopping(monitor="val_auc",mode="max",patience=patience,restore_best_weights=True,verbose=1),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss",factor=0.5,patience=3,min_lr=1e-7,verbose=0)]

def get_predictions(model, dataset):
    y_true, y_prob = [], []
    for images, labels in dataset:
        preds = model.predict(images, verbose=0)
        y_prob.extend(preds.flatten()); y_true.extend(labels.numpy().flatten())
    return np.array(y_true,dtype=int), np.array(y_prob,dtype=float)

def compute_metrics(y_true, y_prob, class_names):
    y_pred = (y_prob>=0.5).astype(int)
    ri = class_names.index("rotten") if "rotten" in class_names else 1
    return {"accuracy": round(accuracy_score(y_true,y_pred),4),
            "precision_macro": round(precision_score(y_true,y_pred,average="macro",zero_division=0),4),
            "recall_macro":    round(recall_score(y_true,y_pred,average="macro",zero_division=0),4),
            "f1_macro":        round(f1_score(y_true,y_pred,average="macro"),4),
            "recall_rotten":   round(recall_score(y_true,y_pred,pos_label=ri,zero_division=0),4),
            "precision_rotten":round(precision_score(y_true,y_pred,pos_label=ri,zero_division=0),4),
            "auc":             round(roc_auc_score(y_true,y_prob),4)}

def plot_comparison_bar(results, output_dir):
    metrics = ["accuracy","recall_rotten","f1_macro","auc"]
    model_names = list(results.keys()); x = np.arange(len(metrics)); width = 0.25
    fig, ax = plt.subplots(figsize=(11,6))
    for i,name in enumerate(model_names):
        ax.bar(x+i*width, [results[name][m] for m in metrics], width, label=name)
    ax.set_xticks(x+width); ax.set_xticklabels(["Accuracy","Recall Rotten","F1 Macro","AUC"],fontsize=11)
    ax.set_ylim(0,1.05); ax.set_ylabel("Valor"); ax.set_title("Comparacion de modelos – Fruty"); ax.legend(); ax.grid(axis="y",alpha=0.3)
    plt.tight_layout(); fig.savefig(os.path.join(output_dir,"comparison_bar.png"),dpi=150,bbox_inches="tight"); plt.close(fig)
    print(f"[OK] comparison_bar.png guardada")

def main():
    args = parse_args(); set_seed(); os.makedirs(args.output_dir, exist_ok=True)
    print(f"\nFruty – Comparacion de modelos (seed={SEED})\n")
    train_ds, val_ds, test_ds, class_names = build_datasets(args.data_dir, args.img_size, args.batch_size)
    print(f"Clases: {class_names}\n")
    all_results = {}
    for model_name in BACKBONE_CONFIGS:
        print(f"\n{'='*60}\n  Modelo: {model_name}\n{'='*60}")
        set_seed(); model, backbone = build_model(model_name, args.img_size)
        print(f"\n[Fase 1] cabeza ({args.epochs_head} epocas)")
        compile_model(model, 1e-3); t0 = time.time()
        h1 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_head,
                       callbacks=get_callbacks(model_name, args.output_dir, 4), verbose=1)
        ff = BACKBONE_CONFIGS[model_name]["finetune_from"]
        print(f"\n[Fase 2] fine-tuning (ultimas {abs(ff)} capas, {args.epochs_finetune} epocas)")
        backbone.trainable = True
        for layer in backbone.layers[:ff]: layer.trainable = False
        compile_model(model, 1e-5)
        h2 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune,
                       callbacks=get_callbacks(model_name, args.output_dir, 6), verbose=1)
        elapsed = time.time() - t0
        print(f"\n[Evaluacion en Test] {model_name}")
        y_true, y_prob = get_predictions(model, test_ds); y_pred = (y_prob>=0.5).astype(int)
        metrics = compute_metrics(y_true, y_prob, class_names)
        metrics["training_time_s"] = round(elapsed,1); metrics["params_M"] = round(model.count_params()/1e6,2)
        all_results[model_name] = metrics
        print(classification_report(y_true, y_pred, target_names=class_names, digits=4))
        # CM individual
        cm = confusion_matrix(y_true, y_pred)
        fig,ax = plt.subplots(figsize=(6,5))
        ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=class_names).plot(ax=ax,colorbar=False,cmap="Blues")
        ax.set_title(f"CM – {model_name}"); plt.tight_layout()
        fig.savefig(os.path.join(args.output_dir,f"{model_name}_cm.png"),dpi=150,bbox_inches="tight"); plt.close(fig)
    # Tabla final
    print(f"\n{'='*70}\n  TABLA COMPARATIVA FINAL\n{'='*70}")
    col_keys = ["accuracy","recall_rotten","f1_macro","auc","training_time_s","params_M"]
    print(f"{'Model':<18}" + "".join(f"{k:>16}" for k in col_keys))
    print("-"*110)
    for name,m in all_results.items():
        print(f"{name:<18}" + "".join(f"{m[k]:>16}" for k in col_keys))
    csv_path = os.path.join(args.output_dir,"comparison_results.csv")
    with open(csv_path,"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["model"]+col_keys); w.writeheader()
        for name,m in all_results.items(): w.writerow({"model":name}|{k:m[k] for k in col_keys})
    print(f"\n[OK] comparison_results.csv guardado")
    plot_comparison_bar(all_results, args.output_dir)
    best = max(all_results, key=lambda n: all_results[n]["auc"])
    print(f"\nMejor modelo por AUC: {best}  (AUC={all_results[best]['auc']:.4f})")

if __name__ == "__main__":
    main()
