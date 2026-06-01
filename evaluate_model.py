"""
evaluate_model.py  –  Evaluacion completa en test para Fruty.
Uso: python evaluate_model.py --model_path saved_models/fruty_convnexttiny.keras --test_dir data/test
"""
import argparse, os, csv, numpy as np, tensorflow as tf
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from sklearn.metrics import (classification_report, confusion_matrix, roc_curve, auc,
                             accuracy_score, f1_score, precision_score, recall_score,
                             ConfusionMatrixDisplay)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model_path",  required=True)
    p.add_argument("--test_dir",    required=True)
    p.add_argument("--img_size",    type=int, default=224)
    p.add_argument("--batch_size",  type=int, default=32)
    p.add_argument("--output_dir",  default="results/evaluation")
    return p.parse_args()

def load_test_dataset(test_dir, img_size, batch_size):
    norm = tf.keras.layers.Rescaling(1./255)
    ds = tf.keras.utils.image_dataset_from_directory(test_dir, image_size=(img_size,img_size),
         batch_size=batch_size, shuffle=False, label_mode="binary")
    class_names = ds.class_names
    ds = ds.map(lambda x,y: (norm(x),y), num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    return ds, class_names

def get_predictions(model, dataset):
    y_true, y_prob = [], []
    for images, labels in dataset:
        preds = model.predict(images, verbose=0)
        y_prob.extend(preds.flatten()); y_true.extend(labels.numpy().flatten())
    return np.array(y_true, dtype=int), np.array(y_prob, dtype=float)

def plot_confusion_matrix(y_true, y_pred, class_names, output_dir):
    cm = confusion_matrix(y_true, y_pred); cm_norm = cm.astype(float)/cm.sum(axis=1, keepdims=True)
    fig, axes = plt.subplots(1,2,figsize=(12,5))
    for ax,matrix,title,fmt in zip(axes,[cm,cm_norm],["Conteo","Normalizada"],["d",".2f"]):
        ConfusionMatrixDisplay(confusion_matrix=matrix, display_labels=class_names).plot(ax=ax,colorbar=False,cmap="Blues",values_format=fmt)
        ax.set_title(f"Matriz de Confusion ({title})", fontsize=13)
    plt.tight_layout(); fig.savefig(os.path.join(output_dir,"confusion_matrix.png"),dpi=150,bbox_inches="tight"); plt.close(fig)
    print(f"[OK] confusion_matrix.png guardada")

def plot_roc_curve(y_true, y_prob, output_dir):
    fpr, tpr, _ = roc_curve(y_true, y_prob); roc_auc = auc(fpr, tpr)
    fig, ax = plt.subplots(figsize=(7,6))
    ax.plot(fpr, tpr, lw=2, label=f"AUC = {roc_auc:.4f}"); ax.plot([0,1],[0,1],"k--",lw=1)
    ax.set_xlabel("FPR"); ax.set_ylabel("TPR"); ax.set_title("Curva ROC – Fruty"); ax.legend(); ax.grid(alpha=0.3)
    fig.savefig(os.path.join(output_dir,"roc_curve.png"),dpi=150,bbox_inches="tight"); plt.close(fig)
    print(f"[OK] roc_curve.png  AUC={roc_auc:.4f}"); return roc_auc

def analyze_errors(test_dir, y_true, y_pred, y_prob, class_names, output_dir, top_n=20):
    all_paths = []
    for cls in sorted(os.listdir(test_dir)):
        cls_dir = os.path.join(test_dir, cls)
        if not os.path.isdir(cls_dir): continue
        for fname in sorted(os.listdir(cls_dir)):
            if fname.lower().endswith((".jpg",".jpeg",".png",".bmp",".webp")):
                all_paths.append(os.path.join(cls, fname))
    errors = [(all_paths[i],int(y_true[i]),int(y_pred[i]),float(y_prob[i]))
              for i in range(min(len(all_paths),len(y_true))) if y_true[i]!=y_pred[i]]
    errors.sort(key=lambda x: abs(x[3]-0.5), reverse=True)
    csv_path = os.path.join(output_dir,"error_analysis.csv")
    with open(csv_path,"w",newline="",encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["ruta","etiqueta_real","clase_real","prediccion","clase_pred","probabilidad"])
        for row in errors[:top_n]:
            p,tl,pl,prob = row
            w.writerow([p,tl,class_names[tl],pl,class_names[pl],f"{prob:.4f}"])
    print(f"[OK] error_analysis.csv  ({len(errors)} errores totales)")

def main():
    args = parse_args(); os.makedirs(args.output_dir, exist_ok=True)
    print(f"\nCargando modelo: {args.model_path}")
    model = tf.keras.models.load_model(args.model_path)
    test_ds, class_names = load_test_dataset(args.test_dir, args.img_size, args.batch_size)
    print(f"Clases: {class_names}")
    print("Generando predicciones...")
    y_true, y_prob = get_predictions(model, test_ds); y_pred = (y_prob>=0.5).astype(int)
    print("\n--- Classification Report ---")
    report = classification_report(y_true, y_pred, target_names=class_names, digits=4)
    print(report)
    with open(os.path.join(args.output_dir,"classification_report.txt"),"w",encoding="utf-8") as f: f.write(report)
    roc_auc = plot_roc_curve(y_true, y_prob, args.output_dir)
    plot_confusion_matrix(y_true, y_pred, class_names, args.output_dir)
    analyze_errors(args.test_dir, y_true, y_pred, y_prob, class_names, args.output_dir)
    rotten_idx = class_names.index("rotten") if "rotten" in class_names else 1
    summary = {"accuracy": accuracy_score(y_true,y_pred),
               "precision_rotten": precision_score(y_true,y_pred,pos_label=rotten_idx,zero_division=0),
               "recall_rotten":    recall_score(y_true,y_pred,pos_label=rotten_idx,zero_division=0),
               "f1_macro": f1_score(y_true,y_pred,average="macro"), "auc": roc_auc}
    print("\n--- Metricas finales ---")
    for k,v in summary.items(): print(f"  {k:<25}: {v:.4f}")
    with open(os.path.join(args.output_dir,"metrics_summary.csv"),"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=summary.keys()); w.writeheader(); w.writerow({k:f"{v:.4f}" for k,v in summary.items()})
    print(f"\n[OK] Resultados en {args.output_dir}/")

if __name__ == "__main__":
    main()
