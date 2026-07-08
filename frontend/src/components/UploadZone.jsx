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
          "wood-texture group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all",
          file ? "cursor-default" : "cursor-pointer",
          dragging
            ? "scale-[1.01] border-secondary bg-secondary-fixed/20"
            : "border-outline-variant hover:border-secondary",
        ].join(" ")}
      >
        {previewUrl ? (
          <div className="w-full">
            <div className="mx-auto max-w-sm overflow-hidden rounded-lg ring-1 ring-outline-variant/50">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="max-h-72 w-full bg-surface-container object-contain"
              />
            </div>
            <p className="mt-3 truncate text-sm text-on-surface-variant">
              {file?.name}{" "}
              <span className="text-on-surface-variant/60">
                ({(file?.size / 1024).toFixed(0)} KB)
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-300 group-hover:scale-110">
              <span className="material-symbols-outlined text-4xl text-secondary">
                photo_camera
              </span>
            </div>
            <div className="space-y-1">
              <p className="font-serif text-2xl text-primary">Sube tus fotografías</p>
              <p className="text-sm text-on-surface-variant">
                Arrastra los archivos aquí o haz clic para seleccionar
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Chip>JPG</Chip>
              <Chip>PNG</Chip>
              <Chip>WEBP</Chip>
              <Chip>Máx. 10MB</Chip>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!file || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-semibold text-primary-fixed shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant/50 disabled:shadow-none"
        >
          {loading ? (
            <>
              <Spinner /> Analizando…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              Comprobar
            </>
          )}
        </button>

        {/* Boton de camara (visible sobre todo en movil) */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-5 py-3.5 font-medium text-on-surface-variant transition hover:bg-surface-container disabled:opacity-40 sm:hidden"
        >
          <span className="material-symbols-outlined text-[20px]">photo_camera</span>
          Cámara
        </button>

        {file && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-5 py-3.5 font-medium text-on-surface-variant transition hover:bg-surface-container disabled:opacity-40"
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest/60 px-3 py-1 text-xs font-semibold text-outline">
      {children}
    </span>
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
