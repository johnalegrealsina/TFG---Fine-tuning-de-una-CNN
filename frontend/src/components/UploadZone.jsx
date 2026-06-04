import { useRef, useState } from "react";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Zona de carga con drag & drop, seleccion por clic, captura de camara
 * y previsualizacion de la imagen.
 *
 * @param {File|null}  file        - archivo seleccionado.
 * @param {string|null} previewUrl - URL del objeto para la previsualizacion.
 * @param {(file: File) => void} onSelect - se llama con un archivo valido.
 * @param {(msg: string) => void} onError - se llama con un mensaje de error.
 * @param {() => void} onAnalyze   - lanza el analisis.
 * @param {() => void} onClear     - limpia la seleccion.
 * @param {boolean} loading        - true mientras se espera al backend.
 */
export default function UploadZone({
  file,
  previewUrl,
  onSelect,
  onError,
  onAnalyze,
  onClear,
  loading,
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);

  function validateAndSelect(selected) {
    if (!selected) return;
    if (!ACCEPTED.includes(selected.type)) {
      onError("Formato no valido. Sube una imagen JPEG, PNG, WEBP o GIF.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      onError("La imagen supera el limite de 10 MB.");
      return;
    }
    onSelect(selected);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (loading) return;
    const dropped = e.dataTransfer.files?.[0];
    validateAndSelect(dropped);
  }

  return (
    <div className="w-full">
      {/* Inputs ocultos: galeria y camara */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => validateAndSelect(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => validateAndSelect(e.target.files?.[0])}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && !loading && inputRef.current?.click()}
        className={[
          "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition-all",
          file ? "cursor-default" : "cursor-pointer",
          dragging
            ? "border-fresh bg-fresh/10 scale-[1.01]"
            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.07]",
        ].join(" ")}
      >
        {previewUrl ? (
          <div className="w-full">
            <div className="mx-auto max-w-sm overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="max-h-72 w-full object-contain bg-black/40"
              />
            </div>
            <p className="mt-3 truncate text-sm text-white/50">
              {file?.name}{" "}
              <span className="text-white/30">
                ({(file?.size / 1024).toFixed(0)} KB)
              </span>
            </p>
          </div>
        ) : (
          <div className="py-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-fresh/15 text-3xl">
              📷
            </div>
            <p className="text-lg font-medium text-white/90">
              Arrastra una imagen aqui
            </p>
            <p className="mt-1 text-sm text-white/50">
              o haz clic para seleccionar un archivo
            </p>
            <p className="mt-3 text-xs text-white/30">
              JPEG · PNG · WEBP · GIF · máx. 10 MB
            </p>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!file || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-fresh px-6 py-3 font-semibold text-black transition hover:bg-fresh-glow disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          {loading ? (
            <>
              <Spinner /> Analizando…
            </>
          ) : (
            <>🔍 Analizar</>
          )}
        </button>

        {/* Boton de camara (visible sobre todo en movil) */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
          className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40 sm:hidden"
        >
          📸 Cámara
        </button>

        {file && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-current"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
