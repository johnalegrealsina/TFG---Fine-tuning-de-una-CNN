// Capa de acceso a la "IA". Antes hablaba con el backend FastAPI; ahora la
// inferencia corre en el propio navegador con TensorFlow.js (ver inference.js).
// Se mantienen las mismas funciones y formas de respuesta para no tocar la UI.

import {
  classify,
  loadModel as warmModel,
  isModelLoaded,
  MODEL_META,
} from "./inference.js";

function modelEntry() {
  return {
    ...MODEL_META,
    disponible: true,
    cargado: isModelLoaded(),
    error: null,
  };
}

/**
 * Clasifica una imagen (fresh / rotten) en el navegador.
 * @param {File} file - archivo de imagen.
 * @param {string} [_model] - ignorado (solo hay un modelo en el cliente).
 */
export async function classifyImage(file, _model) {
  try {
    return await classify(file);
  } catch (err) {
    throw new Error(
      err?.message || "No se pudo analizar la imagen en el navegador."
    );
  }
}

/** Lista de modelos disponibles (estatica; un unico modelo en el cliente). */
export async function getModels() {
  return { default: MODEL_META.id, modelos: [modelEntry()] };
}

/** "Calienta" el modelo cargandolo en memoria. */
export async function loadModel(_id) {
  await warmModel();
  return modelEntry();
}

/** Salud del "servicio" (siempre ok; todo es local). */
export async function getHealth() {
  return { status: "ok", model_loaded: isModelLoaded() };
}
