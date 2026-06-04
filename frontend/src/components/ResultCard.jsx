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
        ring: "ring-rotten/40",
        glow: "shadow-[0_0_60px_-15px_rgba(239,68,68,0.6)]",
        text: "text-rotten-glow",
        label: "PODRIDA",
        icon: "⚠️",
        chip: "bg-rotten/15 text-rotten-glow",
      }
    : {
        ring: "ring-fresh/40",
        glow: "shadow-[0_0_60px_-15px_rgba(34,197,94,0.6)]",
        text: "text-fresh-glow",
        label: "FRESCA",
        icon: "✅",
        chip: "bg-fresh/15 text-fresh-glow",
      };

  return (
    <div
      className={`animate-fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] p-6 ring-1 backdrop-blur ${accent.ring} ${accent.glow}`}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch">
        {/* Imagen analizada */}
        {previewUrl && (
          <div className="w-full overflow-hidden rounded-2xl ring-1 ring-white/10 sm:w-44 sm:shrink-0">
            <img
              src={previewUrl}
              alt="Imagen analizada"
              className="h-44 w-full bg-black/40 object-cover"
            />
          </div>
        )}

        {/* Resultado */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-center gap-3">
            <span className="animate-pop text-5xl leading-none">{accent.icon}</span>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Resultado
              </p>
              <h2 className={`text-3xl font-black tracking-tight ${accent.text}`}>
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

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/50">
            {result.modelo && (
              <span>
                Modelo:{" "}
                <span className="font-medium text-white/80">{result.modelo}</span>
              </span>
            )}
            <span>
              P(podrida):{" "}
              <span className="font-medium text-white/80">
                {(result.probabilidad_rotten * 100).toFixed(1)}%
              </span>
            </span>
            <span>
              Inferencia:{" "}
              <span className="font-medium text-white/80">
                {result.tiempo_inferencia_ms.toFixed(0)} ms
              </span>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white/90 transition hover:bg-white/10"
      >
        ↻ Analizar otra imagen
      </button>
    </div>
  );
}
