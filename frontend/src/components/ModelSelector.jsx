/**
 * Selector de modelo (segmented control). Muestra las metricas del modelo
 * elegido y si esta cargado en memoria.
 *
 * @param {Array} models       - lista de modelos (de GET /models).
 * @param {string} selected    - id del modelo seleccionado.
 * @param {(id:string)=>void} onSelect
 * @param {boolean} warming     - true mientras se "calienta" el modelo.
 * @param {boolean} disabled
 */
export default function ModelSelector({
  models,
  selected,
  onSelect,
  warming,
  disabled,
}) {
  if (!models?.length) return null;
  const current = models.find((m) => m.id === selected) || models[0];
  const single = models.length === 1;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-on-surface-variant">
          {single ? `Modelo de IA · ${current.arquitectura}` : "Modelo de IA"}
        </span>
        {warming ? (
          <span className="flex items-center gap-1.5 text-xs text-secondary">
            <Spinner /> cargando modelo…
          </span>
        ) : current?.cargado ? (
          <span className="flex items-center gap-1 text-xs text-fresh">
            <span className="h-2 w-2 rounded-full bg-fresh" /> en memoria
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
            <span className="h-2 w-2 rounded-full border border-outline" /> se
            cargará al usarlo
          </span>
        )}
      </div>

      {!single && (
        <div className="grid grid-cols-3 gap-2">
          {models.map((m) => {
            const isSel = m.id === selected;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled || !m.disponible}
                onClick={() => onSelect(m.id)}
                title={m.disponible ? m.descripcion : "Modelo no disponible"}
                className={[
                  "rounded-xl border px-3 py-2.5 text-center transition",
                  isSel
                    ? "border-primary-container bg-primary-fixed text-primary shadow-sm"
                    : "border-outline-variant/60 bg-surface-container-lowest/70 text-on-surface-variant hover:bg-surface-container",
                  !m.disponible && "cursor-not-allowed opacity-40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="truncate text-sm font-semibold">{m.arquitectura}</div>
                <div
                  className={`mt-0.5 text-xs ${
                    isSel ? "text-on-primary-container" : "text-on-surface-variant/70"
                  }`}
                >
                  {(m.metricas.accuracy * 100).toFixed(1)}% acc
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Metricas del modelo seleccionado */}
      <div className={`glass-card rounded-xl px-3 py-2.5 ${single ? "" : "mt-3"}`}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant/70">
          <Metric label="Accuracy" value={`${(current.metricas.accuracy * 100).toFixed(2)}%`} />
          <Metric label="AUC" value={`${(current.metricas.auc * 100).toFixed(2)}%`} />
          <Metric label="Recall podridas" value={`${(current.metricas.recall_rotten * 100).toFixed(1)}%`} />
          <Metric label="Parámetros" value={`${current.metricas.params_M}M`} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <span>
      {label}: <span className="font-semibold text-on-surface">{value}</span>
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
