/**
 * Vista "Proceso": muestra paso a paso lo que hace la IA con la ultima imagen
 * analizada (datos reales devueltos por el backend en result.proceso).
 *
 * @param {object|null} result - ultima prediccion (con .proceso).
 * @param {string|null} previewUrl - imagen original subida.
 */
export default function ProcessView({ result, previewUrl }) {
  if (!result || !result.proceso) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest/50 px-6 py-16 text-center">
        <span className="material-symbols-outlined mb-3 text-5xl text-secondary">
          biotech
        </span>
        <p className="text-on-surface-variant">Aún no hay nada que mostrar.</p>
        <p className="mt-1 text-sm text-on-surface-variant/60">
          Analiza una imagen en la pestaña{" "}
          <span className="text-primary">Analizar</span> y aquí verás, paso a
          paso, lo que hace la red neuronal.
        </p>
      </div>
    );
  }

  const { proceso, modelo, clase } = result;
  const isRotten = clase === "rotten";
  const pct = result.confianza;
  const t = proceso.tiempos_ms;

  return (
    <div className="animate-fade-in">
      {/* Encabezado con imagen original y la que 've' el modelo */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Figure
          src={previewUrl}
          caption={`Tu imagen · ${proceso.dimensiones_original[0]}×${proceso.dimensiones_original[1]}`}
        />
        <Figure
          src={proceso.imagen_224_base64}
          caption="Lo que ve el modelo · 224×224"
        />
      </div>

      {/* Línea de tiempo de pasos */}
      <ol className="relative ml-3 border-l border-outline-variant/60">
        {proceso.pasos.map((p, i) => {
          const last = i === proceso.pasos.length - 1;
          return (
            <li key={p.n} className="mb-5 ml-6">
              <span
                className={[
                  "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-4 ring-background",
                  last
                    ? isRotten
                      ? "bg-rotten text-white"
                      : "bg-fresh text-white"
                    : "bg-surface-container-high text-on-surface-variant",
                ].join(" ")}
              >
                {p.n}
              </span>
              <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-on-surface">{p.titulo}</h4>
                  <code
                    className={[
                      "rounded-md px-2 py-0.5 text-xs font-semibold",
                      last
                        ? isRotten
                          ? "bg-rotten-container text-rotten"
                          : "bg-fresh-container text-fresh-on"
                        : "bg-surface-container-high text-on-surface-variant",
                    ].join(" ")}
                  >
                    {p.valor}
                  </code>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant/80">{p.detalle}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Resumen final */}
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Modelo" value={modelo} />
        <Stat
          label="Resultado"
          value={isRotten ? "Podrida" : "Fresca"}
          accent={isRotten ? "text-rotten" : "text-fresh"}
        />
        <Stat label="Confianza" value={`${pct.toFixed(1)}%`} />
        <Stat label="Tiempo total" value={`${t.total.toFixed(0)} ms`} />
      </div>
      <p className="mt-3 text-center text-xs text-on-surface-variant/60">
        Desglose: preprocesado {t.preprocesado.toFixed(1)} ms · inferencia{" "}
        {t.inferencia.toFixed(1)} ms
      </p>
    </div>
  );
}

function Figure({ src, caption }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container">
      {src ? (
        <img src={src} alt={caption} className="h-40 w-full object-contain" />
      ) : (
        <div className="flex h-40 items-center justify-center text-on-surface-variant/40">
          sin imagen
        </div>
      )}
      <figcaption className="border-t border-outline-variant/50 px-3 py-1.5 text-center text-xs text-on-surface-variant/70">
        {caption}
      </figcaption>
    </figure>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest/70 px-3 py-2 text-center">
      <div className="text-xs text-on-surface-variant/60">{label}</div>
      <div className={`truncate text-sm font-semibold ${accent || "text-on-surface"}`}>
        {value}
      </div>
    </div>
  );
}
