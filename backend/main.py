"""
main.py  -  API FastAPI de Fruty (clasificacion fresh / rotten, multi-modelo).

Arranque:
    cd backend
    uvicorn main:app --reload --port 8000

El modelo por defecto se precarga al arrancar; el resto se cargan la primera
vez que se piden (carga perezosa).
"""

import os
import logging
from contextlib import asynccontextmanager

# Cargar variables de entorno desde .env ANTES de importar el predictor,
# que lee su configuracion en tiempo de import.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv es opcional
    pass

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from services.predictor import (
    predictor,
    ModelNotLoadedError,
    UnknownModelError,
    MODELS_REGISTRY,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
logger = logging.getLogger("fruty.api")

# --- Configuracion ---------------------------------------------------------
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
}

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Precarga el modelo por defecto al arrancar."""
    logger.info("Iniciando Fruty API...")
    available = [m for m in MODELS_REGISTRY if predictor.file_exists(m)]
    missing = [m for m in MODELS_REGISTRY if not predictor.file_exists(m)]
    logger.info("Modelos disponibles: %s", ", ".join(available) or "ninguno")
    if missing:
        logger.warning("Modelos sin fichero .keras: %s", ", ".join(missing))
    predictor.preload_default()
    yield
    logger.info("Apagando Fruty API.")


app = FastAPI(
    title="Fruty API",
    description="Clasificacion de frutas y verduras: fresca o podrida (multi-modelo).",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Endpoints -------------------------------------------------------------
@app.get("/")
def root():
    return {
        "app": "Fruty API",
        "version": "2.0.0",
        "endpoints": ["/health", "/predict", "/models", "/model-info", "/docs"],
    }


@app.get("/health")
def health():
    """Salud del servicio y estado de los modelos."""
    loaded = [m for m in MODELS_REGISTRY if predictor.is_loaded(m)]
    return {
        "status": "ok",
        "model_loaded": len(loaded) > 0,
        "modelos_cargados": loaded,
        "modelos_disponibles": [
            m for m in MODELS_REGISTRY if predictor.file_exists(m)
        ],
    }


@app.get("/models")
def models():
    """Lista de modelos con metricas y estado de carga."""
    return predictor.list_models()


@app.get("/model-info")
def model_info(model: str | None = None):
    """Metadatos de un modelo (por defecto, el modelo por defecto)."""
    try:
        model_id = predictor.resolve(model)
    except UnknownModelError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return predictor.model_entry(model_id)


@app.post("/models/{model_id}/load")
def load_model(model_id: str):
    """Fuerza la carga de un modelo en memoria (para 'calentarlo')."""
    try:
        predictor.load(model_id)
    except UnknownModelError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return predictor.model_entry(model_id)


@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    model: str | None = Form(None),
):
    """Clasifica una imagen como 'fresh' o 'rotten' con el modelo elegido.

    Form-data: `image` (archivo) y, opcionalmente, `model` (id del modelo).
    """
    # 1) Validar tipo de contenido.
    content_type = (image.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Tipo de archivo no soportado: '{image.content_type}'. "
                "Usa JPEG, PNG, WEBP o GIF."
            ),
        )

    # 2) Leer y validar tamano.
    contents = await image.read()
    if len(contents) == 0:
        raise HTTPException(status_code=422, detail="El archivo esta vacio.")
    if len(contents) > MAX_IMAGE_BYTES:
        mb = MAX_IMAGE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=422,
            detail=f"La imagen supera el tamano maximo permitido ({mb:.0f} MB).",
        )

    # 3) Inferencia (UnknownModelError es ValueError => 422).
    try:
        result = predictor.predict(contents, model)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # fallo del modelo -> 500.
        logger.exception("Fallo durante la inferencia.")
        raise HTTPException(
            status_code=500, detail=f"Error del modelo: {exc}"
        ) from exc

    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=False,
    )
