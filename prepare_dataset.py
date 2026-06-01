"""
prepare_dataset.py
Organiza un dataset de frutas en train/val/test para Fruty.
Detecta clases por nombre de carpeta: "fresh" -> fresh, "rot" -> rotten.
"""
import argparse, os, random, shutil, math, csv
from collections import defaultdict
from pathlib import Path

SEED = 42

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--source_dir",  required=True)
    p.add_argument("--output_dir",  default="data")
    p.add_argument("--train_ratio", type=float, default=0.70)
    p.add_argument("--val_ratio",   type=float, default=0.15)
    p.add_argument("--seed",        type=int,   default=42)
    p.add_argument("--extensions",  nargs="+",  default=["jpg","jpeg","png","bmp","webp"])
    return p.parse_args()

def label_from_name(name):
    n = name.lower()
    if "fresh" in n: return "fresh"
    if "rot"   in n: return "rotten"
    return None

def collect_images(source_dir, exts):
    images = defaultdict(list)
    for entry in Path(source_dir).rglob("*"):
        if not entry.is_file(): continue
        if entry.suffix.lower().lstrip(".") not in exts: continue
        for part in entry.parts:
            lbl = label_from_name(part)
            if lbl:
                images[lbl].append(entry)
                break
    return dict(images)

def split_list(items, train_r, val_r, seed):
    rng = random.Random(seed)
    s = items[:]
    rng.shuffle(s)
    n = len(s)
    n_train = math.floor(n * train_r)
    n_val   = math.floor(n * val_r)
    return s[:n_train], s[n_train:n_train+n_val], s[n_train+n_val:]

def transfer(src, dst_dir):
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    counter = 1
    while dst.exists():
        dst = dst_dir / f"{src.stem}_{counter}{src.suffix}"
        counter += 1
    shutil.copy2(src, dst)

def main():
    args = parse_args()
    exts = set(args.extensions)
    assert args.train_ratio + args.val_ratio < 1.0
    print(f"\nEscaneando {args.source_dir} ...")
    images = collect_images(args.source_dir, exts)
    for lbl, paths in images.items():
        print(f"  {lbl}: {len(paths)} imagenes")
    split_counts = {s: {} for s in ("train","val","test")}
    for label, paths in images.items():
        train, val, test = split_list(paths, args.train_ratio, args.val_ratio, args.seed)
        for split_name, subset in [("train",train),("val",val),("test",test)]:
            dst_dir = Path(args.output_dir) / split_name / label
            for src in subset:
                transfer(src, dst_dir)
            split_counts[split_name][label] = len(subset)
            print(f"  -> {split_name}/{label}: {len(subset)}")
    print("\nResumen:")
    for s in ("train","val","test"):
        f = split_counts[s].get("fresh",0)
        r = split_counts[s].get("rotten",0)
        print(f"  {s:5} | fresh={f:5} | rotten={r:5} | total={f+r:5}")
    # Alerta desbalance
    totals = {l: sum(split_counts[s].get(l,0) for s in split_counts) for l in ("fresh","rotten")}
    total_all = sum(totals.values())
    if total_all:
        ratio_min = min(totals.values()) / total_all
        if ratio_min < 0.35:
            print(f"\nAVISO DESBALANCE: ratio minoritaria={ratio_min:.2f}")
    print(f"\nDataset listo en {args.output_dir}/")
    print(f"Siguiente paso: python train_fruty.py --data_dir {args.output_dir}")

if __name__ == "__main__":
    main()
