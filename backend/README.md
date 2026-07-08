---
title: Fruty Backend
emoji: 🍎
colorFrom: green
colorTo: red
sdk: docker
app_port: 8000
pinned: false
---

# Fruty Backend (FastAPI + TensorFlow)

API de clasificación **fresca / podrida** de frutas y verduras.
Sirve el modelo EfficientNetB0 (fine-tuning del TFG) mediante FastAPI.

## Endpoints

- `GET /health` — estado del servicio y del modelo.
- `GET /models` — modelos disponibles con sus métricas.
- `POST /predict` — clasifica una imagen (`multipart/form-data`, campo `image`).
- `GET /docs` — documentación interactiva (Swagger).

## Configuración (variables de entorno)

- `CORS_ORIGINS` — orígenes permitidos, separados por comas
  (p. ej. la URL del frontend en Vercel).
- `PREPROCESS` — `rescale` (por defecto; imagen ÷255, igual que en el entrenamiento).
- `THRESHOLD` — umbral de decisión (0.5 por defecto).

El contenedor escucha en el puerto **8000** (`app_port`).
