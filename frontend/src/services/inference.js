// Inferencia en el NAVEGADOR con TensorFlow.js.
//
// Sustituye al backend FastAPI: carga el modelo EfficientNetB0 convertido a
// TF.js (servido como estatico en /model), preprocesa la imagen igual que en
// el entrenamiento (redimension 224x224 + division entre 255) y devuelve el
// mismo objeto de resultado que devolvia la API, incluida la vista "proceso".

import * as tf from "@tensorflow/tfjs";

const IMG_SIZE = 224;
const THRESHOLD = 0.5;
const MODEL_URL = `${import.meta.env.BASE_URL}model/model.json`;

// Metadatos del modelo (antes venian de GET /models del backend). Metricas
// tomadas de la evaluacion en test (results/comparison/comparison_results.csv).
export const MODEL_META = {
  id: "EfficientNetB0",
  arquitectura: "EfficientNetB0",
  descripcion: "Red eficiente de Google. Modelo de produccion de Fruty.",
  preprocesado_interno: "Rescaling(255) + normalizacion ImageNet (integrada)",
  metricas: {
    accuracy: 0.9843,
    auc: 0.9985,
    recall_rotten: 0.9814,
    f1_macro: 0.9842,
    params_M: 4.06,
  },
  input_shape: [IMG_SIZE, IMG_SIZE, 3],
  umbral: THRESHOLD,
  clases: ["fresh", "rotten"],
};

let _model = null;
let _loadingPromise = null;

export function isModelLoaded() {
  return _model !== null;
}

/** Carga (una sola vez) el modelo TF.js y lo "calienta". */
export async function loadModel() {
  if (_model) return _model;
  if (!_loadingPromise) {
    _loadingPromise = (async () => {
      // El converter puede producir un LayersModel o un GraphModel; probamos
      // el primero y, si falla, el segundo.
      let model;
      try {
        model = await tf.loadLayersModel(MODEL_URL);
      } catch {
        model = await tf.loadGraphModel(MODEL_URL);
      }
      // Calentamiento: la primera inferencia compila los shaders de WebGL.
      const warm = tf.tidy(() =>
        model.predict(tf.zeros([1, IMG_SIZE, IMG_SIZE, 3]))
      );
      await warm.data();
      warm.dispose();
      _model = model;
      return model;
    })().finally(() => {
      _loadingPromise = null;
    });
  }
  return _loadingPromise;
}

/** Carga un File de imagen en un HTMLImageElement. */
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo decodificar la imagen."));
    };
    img.src = url;
  });
}

/** Miniatura 224x224 (lo que "ve" el modelo tras redimensionar). */
function thumb224DataUrl(img) {
  const canvas = document.createElement("canvas");
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Clasifica una imagen y devuelve resultado + detalles del proceso,
 * con la MISMA forma que devolvia el backend.
 * @param {File} file
 */
export async function classify(file) {
  const model = await loadModel();
  const { img, url } = await loadImageElement(file);

  try {
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    // --- Preprocesado: redimension bilineal + /255 (rango [0,1]) ---
    const t0 = performance.now();
    const batch = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(img); // [h, w, 3] uint8
      const resized = tf.image.resizeBilinear(pixels, [IMG_SIZE, IMG_SIZE]);
      return resized.div(255).expandDims(0); // [1, 224, 224, 3] en [0,1]
    });
    const tPre = performance.now() - t0;

    // --- Inferencia ---
    const t1 = performance.now();
    const output = model.predict(batch);
    const data = await output.data();
    const tInf = performance.now() - t1;

    tf.dispose([batch, output]);

    let probRotten = data[0];
    probRotten = Math.max(0, Math.min(1, probRotten));

    const isRotten = probRotten > THRESHOLD;
    const clase = isRotten ? "rotten" : "fresh";
    const confianza = (isRotten ? probRotten : 1 - probRotten) * 100;

    const meta = MODEL_META;
    const proceso = {
      dimensiones_original: [origW, origH],
      imagen_224_base64: thumb224DataUrl(img),
      tiempos_ms: {
        preprocesado: round(tPre, 2),
        inferencia: round(tInf, 2),
        total: round(tPre + tInf, 2),
      },
      pasos: [
        {
          n: 1,
          titulo: "Imagen original",
          detalle: "La foto que has subido, en color (RGB).",
          valor: `${origW}×${origH} px`,
        },
        {
          n: 2,
          titulo: "Redimension",
          detalle: "Escalado bilineal al tamano de entrada del modelo.",
          valor: `${IMG_SIZE}×${IMG_SIZE} px`,
        },
        {
          n: 3,
          titulo: "Normalizacion",
          detalle: "Pixeles a float32 divididos entre 255.",
          valor: "rango [0, 1]",
        },
        {
          n: 4,
          titulo: "Modelo (CNN)",
          detalle: `${meta.arquitectura} · ${meta.metricas.params_M}M parametros. Dentro: ${meta.preprocesado_interno}.`,
          valor: meta.id,
        },
        {
          n: 5,
          titulo: "Salida sigmoide",
          detalle: "Un unico valor: probabilidad de que este podrida.",
          valor: `P(podrida) = ${probRotten.toFixed(4)}`,
        },
        {
          n: 6,
          titulo: "Decision",
          detalle: `Umbral ${THRESHOLD}: si P(podrida) > ${THRESHOLD} => PODRIDA, si no => FRESCA.`,
          valor: isRotten ? "PODRIDA" : "FRESCA",
        },
      ],
    };

    return {
      clase,
      confianza: round(confianza, 2),
      probabilidad_rotten: round(probRotten, 6),
      tiempo_inferencia_ms: round(tInf, 2),
      modelo: meta.id,
      proceso,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function round(x, n) {
  const f = 10 ** n;
  return Math.round(x * f) / f;
}
