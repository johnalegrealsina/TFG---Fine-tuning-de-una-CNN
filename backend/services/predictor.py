"""
predictor.py  -  Carga de modelos e inferencia para Fruty (multi-modelo).

Fruty puede servir los TRES modelos entrenados en `compare_models.py`:
EfficientNetB0, ConvNeXtTiny y ResNet50. Los `.keras` viven en `backend/model/`.

PREPROCESADO (clave). Los tres modelos se entrenaron con un pipeline que divide
la imagen entre 255 (`Rescaling(1./255)`), de modo que TODOS esperan la entrada
en rango [0, 1]. Cada modelo lleva DENTRO su propio preprocesado especifico
(Rescaling/Normalization de EfficientNet, normalizacion de ConvNeXt o
`resnet.preprocess_input`), por lo que en inferencia basta con entregar la
imagen en [0, 1] (dividida entre 255). Aplicar `efficientnet.preprocess_input`
romperia las predicciones. Ver README para el detalle.

Carga PEREZOSA: los modelos pesan bastante (ConvNeXt ~245 MB, ResNet ~166 MB),
asi que solo se cargan en memoria la primera vez que se usan y quedan cacheados.
"""

import os
import io
import time
import base64
import logging
import threading

# Silenciar logs verbosos de TensorFlow ANTES de importarlo.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import numpy as np
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger("fruty.predictor")

# --- Configuracion ---------------------------------------------------------
MODEL_DIR = os.environ.get(
    "MODEL_DIR", os.path.join(os.path.dirname(__file__), "..", "model")
)
IMG_SIZE = int(os.environ.get("IMG_SIZE", "224"))
THRESHOLD = float(os.environ.get("THRESHOLD", "0.5"))
PREPROCESS = os.environ.get("PREPROCESS", "rescale").lower()
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "EfficientNetB0")

# Orden de clases del entrenamiento (alfabetico): 0 = fresh, 1 = rotten.
# La salida sigmoide es la probabilidad de la clase 1 => P(rotten).
CLASS_NAMES = ["fresh", "rotten"]

# Registro de modelos disponibles. Las metricas provienen de
# `results/comparison/comparison_results.csv` (evaluacion en test).
MODELS_REGISTRY = {
    "EfficientNetB0": {
        "archivo": "EfficientNetB0_best.keras",
        "arquitectura": "EfficientNetB0",
        "descripcion": "Red eficiente de Google. Modelo de produccion de Fruty.",
        "preprocesado_interno": "Rescaling(255) + normalizacion ImageNet (integrada)",
        "metricas": {
            "accuracy": 0.9843, "auc": 0.9985, "recall_rotten": 0.9814,
            "f1_macro": 0.9842, "params_M": 4.06,
        },
    },
}


class ModelNotLoadedError(RuntimeError):
    """No hay ningun modelo disponible para inferir."""


class UnknownModelError(ValueError):
    """Se ha solicitado un modelo que no existe en el registro."""


class Predictor:
    """Gestiona los modelos Keras con carga perezosa y cacheo."""

    def __init__(self) -> None:
        self._models: dict[str, object] = {}          # id -> modelo keras cargado
        self._load_errors: dict[str, str] = {}        # id -> ultimo error de carga
        self._lock = threading.Lock()
        self._tf = None

    # -- Carga --------------------------------------------------------------
    def _model_path(self, model_id: str) -> str:
        cfg = MODELS_REGISTRY[model_id]
        return os.path.abspath(os.path.join(MODEL_DIR, cfg["archivo"]))

    def file_exists(self, model_id: str) -> bool:
        return os.path.exists(self._model_path(model_id))

    def is_loaded(self, model_id: str) -> bool:
        return model_id in self._models

    def resolve(self, model_id: str | None) -> str:
        """Devuelve un id de modelo valido (o el por defecto)."""
        if not model_id:
            return DEFAULT_MODEL
        if model_id not in MODELS_REGISTRY:
            raise UnknownModelError(
                f"Modelo desconocido: {model_id!r}. "
                f"Disponibles: {', '.join(MODELS_REGISTRY)}"
            )
        return model_id

    def load(self, model_id: str) -> object:
        """Carga (si hace falta) y devuelve el modelo. Lanza si no se puede."""
        model_id = self.resolve(model_id)
        if model_id in self._models:
            return self._models[model_id]

        with self._lock:
            # Re-comprobar dentro del lock (otra peticion pudo cargarlo).
            if model_id in self._models:
                return self._models[model_id]

            path = self._model_path(model_id)
            if not os.path.exists(path):
                msg = f"No se encontro el modelo en: {path}"
                self._load_errors[model_id] = msg
                logger.error(msg)
                raise ModelNotLoadedError(msg)

            try:
                if self._tf is None:
                    logger.info("Cargando TensorFlow... (puede tardar unos segundos)")
                    import tensorflow as tf
                    self._tf = tf
                logger.info("Cargando modelo %s desde %s ...", model_id, path)
                t0 = time.perf_counter()

                # Algunos modelos (ResNet50) guardan una capa Lambda que envuelve
                # `preprocess_input`. Keras 3 no la localiza al cargar, asi que se
                # la inyectamos via custom_objects y desactivamos el modo seguro.
                load_kwargs = {"compile": False}
                pre_mod = MODELS_REGISTRY[model_id].get("preprocess_module")
                if pre_mod:
                    import importlib
                    mod = importlib.import_module(
                        f"tensorflow.keras.applications.{pre_mod}"
                    )
                    load_kwargs["safe_mode"] = False
                    load_kwargs["custom_objects"] = {
                        "preprocess_input": mod.preprocess_input
                    }

                model = self._tf.keras.models.load_model(path, **load_kwargs)
                dt = time.perf_counter() - t0
                # Calentamiento (la primera inferencia compila el grafo).
                model.predict(
                    np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=np.float32), verbose=0
                )
                self._models[model_id] = model
                self._load_errors.pop(model_id, None)
                logger.info("Modelo %s listo en %.2fs.", model_id, dt)
                return model
            except ModelNotLoadedError:
                raise
            except Exception as exc:  # pragma: no cover - depende del entorno
                msg = f"Error al cargar {model_id}: {exc}"
                self._load_errors[model_id] = msg
                logger.exception(msg)
                raise ModelNotLoadedError(msg) from exc

    def preload_default(self) -> None:
        """Intenta cargar el modelo por defecto al arrancar (no critico)."""
        try:
            self.load(DEFAULT_MODEL)
        except Exception:
            logger.warning("No se pudo precargar el modelo por defecto.")

    # -- Preprocesado -------------------------------------------------------
    def _decode(self, image_bytes: bytes) -> Image.Image:
        try:
            return Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ValueError(f"No se pudo decodificar la imagen: {exc}") from exc

    def _preprocess(self, img: Image.Image) -> np.ndarray:
        resized = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
        arr = np.asarray(resized, dtype=np.float32)  # [0, 255]
        if PREPROCESS == "rescale":
            arr = arr / 255.0                          # [0, 1]  (= entrenamiento)
        elif PREPROCESS == "efficientnet":
            from tensorflow.keras.applications.efficientnet import preprocess_input
            arr = preprocess_input(arr)
        elif PREPROCESS == "raw":
            pass
        else:
            raise ValueError(f"PREPROCESS desconocido: {PREPROCESS!r}")
        return np.expand_dims(arr, axis=0)

    @staticmethod
    def _thumb_data_url(img: Image.Image) -> str:
        """Miniatura 224x224 (lo que 've' el modelo tras redimensionar)."""
        thumb = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
        buf = io.BytesIO()
        thumb.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    # -- Inferencia ---------------------------------------------------------
    def predict(self, image_bytes: bytes, model_id: str | None = None) -> dict:
        """Clasifica una imagen y devuelve resultado + detalles del proceso.

        Lanza ValueError (=>422), UnknownModelError (=>422),
        ModelNotLoadedError (=>503) o Exception generica (=>500).
        """
        model_id = self.resolve(model_id)
        model = self.load(model_id)  # carga perezosa

        img = self._decode(image_bytes)
        orig_w, orig_h = img.size

        t0 = time.perf_counter()
        batch = self._preprocess(img)
        t_pre = (time.perf_counter() - t0) * 1000.0

        t1 = time.perf_counter()
        preds = model.predict(batch, verbose=0)
        t_inf = (time.perf_counter() - t1) * 1000.0

        prob_rotten = float(np.asarray(preds).reshape(-1)[0])
        prob_rotten = max(0.0, min(1.0, prob_rotten))

        is_rotten = prob_rotten > THRESHOLD
        clase = "rotten" if is_rotten else "fresh"
        confianza = (prob_rotten if is_rotten else 1.0 - prob_rotten) * 100.0

        cfg = MODELS_REGISTRY[model_id]
        params_m = cfg["metricas"]["params_M"]

        proceso = {
            "dimensiones_original": [orig_w, orig_h],
            "imagen_224_base64": self._thumb_data_url(img),
            "tiempos_ms": {
                "preprocesado": round(t_pre, 2),
                "inferencia": round(t_inf, 2),
                "total": round(t_pre + t_inf, 2),
            },
            "pasos": [
                {
                    "n": 1, "titulo": "Imagen original",
                    "detalle": "La foto que has subido, en color (RGB).",
                    "valor": f"{orig_w}×{orig_h} px",
                },
                {
                    "n": 2, "titulo": "Redimension",
                    "detalle": "Escalado bilineal al tamano de entrada del modelo.",
                    "valor": f"{IMG_SIZE}×{IMG_SIZE} px",
                },
                {
                    "n": 3, "titulo": "Normalizacion",
                    "detalle": "Pixeles a float32 divididos entre 255.",
                    "valor": "rango [0, 1]",
                },
                {
                    "n": 4, "titulo": "Modelo (CNN)",
                    "detalle": f"{cfg['arquitectura']} · {params_m}M parametros. "
                               f"Dentro: {cfg['preprocesado_interno']}.",
                    "valor": model_id,
                },
                {
                    "n": 5, "titulo": "Salida sigmoide",
                    "detalle": "Un unico valor: probabilidad de que este podrida.",
                    "valor": f"P(podrida) = {prob_rotten:.4f}",
                },
                {
                    "n": 6, "titulo": "Decision",
                    "detalle": f"Umbral {THRESHOLD}: si P(podrida) > {THRESHOLD} "
                               f"=> PODRIDA, si no => FRESCA.",
                    "valor": "PODRIDA" if is_rotten else "FRESCA",
                },
            ],
        }

        return {
            "clase": clase,
            "confianza": round(confianza, 2),
            "probabilidad_rotten": round(prob_rotten, 6),
            "tiempo_inferencia_ms": round(t_inf, 2),
            "modelo": model_id,
            "proceso": proceso,
        }

    # -- Metadatos ----------------------------------------------------------
    def model_entry(self, model_id: str) -> dict:
        """Metadatos de un modelo para la API."""
        cfg = MODELS_REGISTRY[model_id]
        return {
            "id": model_id,
            "arquitectura": cfg["arquitectura"],
            "descripcion": cfg["descripcion"],
            "metricas": cfg["metricas"],
            "input_shape": [IMG_SIZE, IMG_SIZE, 3],
            "umbral": THRESHOLD,
            "clases": CLASS_NAMES,
            "disponible": self.file_exists(model_id),
            "cargado": self.is_loaded(model_id),
            "error": self._load_errors.get(model_id),
        }

    def list_models(self) -> dict:
        return {
            "default": DEFAULT_MODEL,
            "modelos": [self.model_entry(m) for m in MODELS_REGISTRY],
        }

    @property
    def any_available(self) -> bool:
        return any(self.file_exists(m) for m in MODELS_REGISTRY)


# Instancia unica compartida por toda la aplicacion.
predictor = Predictor()
