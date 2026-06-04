# Fruty 🍏 — Clasificación de frutas y verduras (fresca vs. podrida)

TFG · Fine-tuning de una CNN. Aplicación web full-stack que clasifica fotos de
frutas y verduras como **frescas** o **podridas**. Puedes elegir entre los
**3 modelos** entrenados con Keras/TensorFlow (**EfficientNetB0**, ConvNeXtTiny
y ResNet50) y ver, en una pestaña aparte, **el proceso de la IA paso a paso**.

```
[Usuario] → [React + Vite + Tailwind] → [FastAPI] → [Modelo Keras]
                                            ↓
                              { clase, confianza, probabilidad_rotten,
                                tiempo_inferencia_ms }
```

---

## Estructura del repositorio

```
.
├── backend/                 # API FastAPI + inferencia (multi-modelo)
│   ├── main.py
│   ├── services/predictor.py
│   ├── model/               # ← coloca aquí los 3 .keras
│   ├── requirements.txt
│   ├── Dockerfile
│   └── test_main.http       # peticiones de prueba (REST Client)
├── frontend/                # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx           # pestañas Analizar / Proceso
│   │   ├── components/{UploadZone,ResultCard,ConfidenceBar,
│   │   │               ModelSelector,ProcessView}.jsx
│   │   └── services/api.js
│   └── Dockerfile
├── docker-compose.yml
├── train_fruty.py           # scripts de entrenamiento/eval (modelo ya entrenado)
├── compare_models.py        # ← genera EfficientNetB0_best.keras
└── evaluate_model.py
```

---

## Requisito previo: los modelos

Fruty puede servir los **tres modelos** comparados en `compare_models.py`. El
backend los busca en `backend/model/`:

```
backend/model/EfficientNetB0_best.keras   (~29 MB)   ← modelo por defecto
backend/model/ConvNeXtTiny_best.keras      (~245 MB)
backend/model/ResNet50_best.keras          (~166 MB)
```

Están **excluidos de git** (`.gitignore`, regla `*.keras`). Cópialos desde
`results/comparison/` antes de arrancar. Solo es **obligatorio** el modelo por
defecto (EfficientNetB0); los otros dos son opcionales y, si faltan, aparecen
deshabilitados en el selector. Cada modelo se carga en memoria la **primera vez
que se usa** (carga perezosa), no al arrancar.

> **Métricas reales** (test, de `comparison_results.csv`):
>
> | Modelo | Accuracy | AUC | Recall podridas | Params |
> |--------|----------|-----|-----------------|--------|
> | EfficientNetB0 | 98.43 % | 99.85 % | 98.14 % | 4.06 M |
> | ConvNeXtTiny | 89.41 % | 96.03 % | 86.97 % | 27.82 M |
> | ResNet50 | 84.99 % | 95.65 % | 96.95 % | 23.6 M |

> ⚠️ **Nota importante sobre el preprocesado.** El enunciado mencionaba
> `efficientnet.preprocess_input`, pero **este modelo NO debe usarlo**. Según
> `compare_models.py`, el modelo fue entrenado recibiendo imágenes en rango
> **[0, 1]** (el pipeline aplica `Rescaling(1./255)`) y la primera capa del
> modelo es `Rescaling(255.0)` con la normalización de EfficientNet incluida
> dentro del backbone. Por eso el backend divide la imagen entre 255
> (`PREPROCESS=rescale`, por defecto). Aplicar `preprocess_input` rompería las
> predicciones. Es configurable con la variable `PREPROCESS` por si se sirve
> otro modelo. Ver [backend/services/predictor.py](backend/services/predictor.py).

---

## Opción A — Levantar en local (sin Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt          # macOS: cambia tensorflow-cpu por tensorflow
uvicorn main:app --reload --port 8000
```

TensorFlow tarda unos segundos en cargar; verás en el log
`=> Modelo cargado correctamente. API lista.` cuando esté listo.
Documentación interactiva en <http://localhost:8000/docs>.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173>. La URL del backend se toma de
`VITE_API_URL` (por defecto `http://localhost:8000`, ya configurada en
`frontend/.env`).

---

## Opción B — Docker Compose

```bash
# Asegúrate de tener backend/model/EfficientNetB0_best.keras
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend:  <http://localhost:8000>

El modelo se monta como volumen de solo lectura (`./backend/model`), por lo que
no hace falta reconstruir la imagen al cambiarlo.

---

## API

### `POST /predict`

`multipart/form-data` con el campo `image` y, opcionalmente, `model`
(`EfficientNetB0` | `ConvNeXtTiny` | `ResNet50`; por defecto EfficientNetB0).

**200 OK**
```json
{
  "clase": "fresh",
  "confianza": 98.88,
  "probabilidad_rotten": 0.01116,
  "tiempo_inferencia_ms": 84.12,
  "modelo": "EfficientNetB0",
  "proceso": {
    "dimensiones_original": [812, 610],
    "imagen_224_base64": "data:image/jpeg;base64,...",
    "tiempos_ms": { "preprocesado": 3.1, "inferencia": 84.1, "total": 87.2 },
    "pasos": [ { "n": 1, "titulo": "Imagen original", "detalle": "...", "valor": "812×610 px" }, ... ]
  }
}
```

El bloque `proceso` alimenta la pestaña **Proceso** del frontend (paso a paso).

| Código | Significado |
|-------|-------------|
| 200 | Predicción correcta |
| 422 | Archivo no válido, vacío, > 10 MB, o `model` desconocido |
| 500 | Error del modelo durante la inferencia |
| 503 | Modelo no disponible (falta el `.keras`) |

### `GET /models`
Lista de modelos con métricas, disponibilidad y si están cargados en memoria.
```json
{
  "default": "EfficientNetB0",
  "modelos": [
    { "id": "EfficientNetB0", "arquitectura": "EfficientNetB0",
      "descripcion": "...", "metricas": { "accuracy": 0.9843, "auc": 0.9985, ... },
      "disponible": true, "cargado": true }, ...
  ]
}
```

### `POST /models/{id}/load`
Fuerza la carga de un modelo en memoria (el frontend lo usa para "calentar" el
modelo al seleccionarlo). Devuelve los metadatos del modelo.

### `GET /health`
```json
{ "status": "ok", "model_loaded": true,
  "modelos_cargados": ["EfficientNetB0"],
  "modelos_disponibles": ["EfficientNetB0", "ConvNeXtTiny", "ResNet50"] }
```

### `GET /model-info?model=<id>`
Metadatos de un modelo concreto (por defecto, el modelo por defecto).

### Probar la API

Usa [backend/test_main.http](backend/test_main.http) con la extensión
**REST Client** de VS Code, o `curl`:

```bash
curl -F "image=@ruta/a/tu/imagen.jpg" http://localhost:8000/predict
```

---

## Configuración (variables de entorno del backend)

Copia `backend/.env.example` a `backend/.env` (todas son opcionales):

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `MODEL_PATH` | `./model/EfficientNetB0_best.keras` | Ruta al modelo |
| `PREPROCESS` | `rescale` | `rescale` (÷255), `efficientnet` o `raw` |
| `IMG_SIZE` | `224` | Tamaño de entrada |
| `THRESHOLD` | `0.5` | Umbral (>umbral ⇒ rotten) |
| `MAX_IMAGE_BYTES` | `10485760` | Tamaño máximo (10 MB) |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Orígenes permitidos |

---

## Funcionalidades del frontend

- **Selector de modelo**: elige entre los 3 modelos (con sus métricas) y se
  "calienta" en memoria al seleccionarlo.
- **Pestaña «Proceso»**: muestra paso a paso lo que hace la red con tu imagen
  (original → 224×224 → normalización [0,1] → modelo → sigmoide → decisión),
  incluida la miniatura de "lo que ve el modelo" y el desglose de tiempos.
- Drag & drop **o** clic para seleccionar, con previsualización.
- Botón de **cámara** en móvil (`capture="environment"`).
- Validación de tipo y tamaño antes de enviar; timeout de 60 s.
- Tarjeta de resultado con icono, etiqueta FRESCA/PODRIDA, modelo usado,
  **barra de confianza animada** y tiempo de inferencia.
- Historial de las últimas 5 predicciones de la sesión.
- Tema oscuro responsive (verde = fresca, rojo = podrida).

---

## Notas

- Los modelos son **binarios** (sigmoid, un solo valor = P(rotten)); no
  identifican el tipo de producto (manzana, plátano…).
- **Preprocesado único para los 3 modelos**: aunque cada `.keras` lleva dentro
  un preprocesado distinto (EfficientNet/ConvNeXt/ResNet), todos se entrenaron
  recibiendo la imagen en **[0,1]**, así que el backend siempre divide entre 255.
- **ResNet50** guarda una capa `Lambda(resnet.preprocess_input)` que Keras 3 no
  sabe deserializar sola; el backend la carga con `safe_mode=False` y
  `custom_objects` (ver [predictor.py](backend/services/predictor.py)).
- **Memoria**: cargar los 3 modelos a la vez consume bastante RAM
  (ConvNeXt ~245 MB + ResNet ~166 MB + TF). La carga es perezosa para no pagar
  ese coste hasta que se usan.
- En producción con hardware limitado, considera convertir a `tf.lite` para
  reducir latencia.
