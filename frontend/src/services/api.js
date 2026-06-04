// Capa de acceso al backend de Fruty.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TIMEOUT_MS = 60_000; // 60 s (cargar un modelo grande la 1ª vez puede tardar)

/**
 * Envia una imagen al backend y devuelve la prediccion + detalles del proceso.
 * @param {File} file - archivo de imagen.
 * @param {string} [model] - id del modelo (EfficientNetB0 | ConvNeXtTiny | ResNet50).
 */
export async function classifyImage(file, model) {
  const formData = new FormData();
  formData.append("image", file);
  if (model) formData.append("model", model);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}/predict`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("El servidor tardo demasiado en responder (timeout).");
    }
    throw new Error("No se pudo conectar con el servidor. ¿Esta el backend activo?");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let detail = `Error en la prediccion (HTTP ${res.status}).`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail);
  }

  return res.json();
}

/** Lista de modelos disponibles con sus metricas y estado. */
export async function getModels() {
  const res = await fetch(`${API_URL}/models`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de modelos.");
  return res.json();
}

/** Fuerza la carga de un modelo en memoria (para 'calentarlo'). */
export async function loadModel(id) {
  const res = await fetch(`${API_URL}/models/${id}/load`, { method: "POST" });
  if (!res.ok) {
    let detail = `No se pudo cargar el modelo ${id}.`;
    try {
      const d = await res.json();
      if (d?.detail) detail = d.detail;
    } catch {
      /* sin JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Comprueba la salud del backend. */
export async function getHealth() {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error("El backend no responde.");
  return res.json();
}
