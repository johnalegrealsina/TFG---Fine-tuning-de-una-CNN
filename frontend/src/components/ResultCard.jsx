import ConfidenceBar from "./ConfidenceBar.jsx";

/**
 * Tarjeta con el resultado de la clasificacion.
 * @param {object} result   - respuesta del backend.
 * @param {string|null} previewUrl - imagen analizada.
 * @param {() => void} onReset - "Analizar otra imagen".
 */
export default function ResultCard({ result, previewUrl, onReset }) {
  const isRotten = result.clase === "rotten";

  const accent = isRotten
    ? {
        ring: "ring-rotten/30",
        glow: "shadow-[0_20px_60px_-25px_rgba(186,26,26,0.45)]",
        text: "text-rotten",
        label: "PODRIDA",
        icon: "warning",
        chip: "bg-rotten-container text-rotten",
      }
    : {
        ring: "ring-fresh/30",
        glow: "shadow-[0_20px_60px_-25px_rgba(46,125,70,0.45)]",
        text: "text-fresh",
        label: "FRESCA",
        icon: "eco",
        chip: "bg-fresh-container text-fresh-on",
      };

  return (
    <div
      className={`glass-card animate-fade-in-up rounded-xl p-6 ring-1 ${accent.ring} ${accent.glow}`}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch">
        {/* Imagen analizada */}
        {previewUrl && (
          <div className="w-full overflow-hidden rounded-lg ring-1 ring-outline-variant/50 sm:w-44 sm:shrink-0">
            <img
              src={previewUrl}
              alt="Imagen analizada"
              className="h-44 w-full bg-surface-container object-cover"
            />
          </div>
        )}

        {/* Resultado */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-center gap-3">
            <span
              className={`material-symbols-outlined animate-pop text-5xl leading-none ${accent.text}`}
            >
              {accent.icon}
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">
                Resultado
              </p>
              <h2 className={`font-serif text-3xl font-semibold tracking-tight ${accent.text}`}>
                {accent.label}
              </h2>
            </div>
          </div>

          {result.producto && (
            <span
              className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium ${accent.chip}`}
            >
              {result.producto}
            </span>
          )}

          <div className="mt-5">
            <ConfidenceBar value={result.confianza} isRotten={isRotten} />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-on-surface-variant/80">
            {result.modelo && (
              <span>
                Modelo:{" "}
                <span className="font-medium text-on-surface">{result.modelo}</span>
              </span>
            )}
            <span>
              P(podrida):{" "}
              <span className="font-medium text-on-surface">
                {(result.probabilidad_rotten * 100).toFixed(1)}%
              </span>
            </span>
            <span>
              Inferencia:{" "}
              <span className="font-medium text-on-surface">
                {result.tiempo_inferencia_ms.toFixed(0)} ms
              </span>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-6 py-3 font-semibold text-primary transition hover:bg-surface-container"
      >
        <span className="material-symbols-outlined text-[20px]">refresh</span>
        Analizar otra imagen
      </button>
    </div>
  );
}
