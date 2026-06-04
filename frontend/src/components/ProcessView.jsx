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
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
        <div className="mb-3 text-4xl">🔬</div>
        <p className="text-white/70">Aún no hay nada que mostrar.</p>
        <p className="mt-1 text-sm text-white/40">
          Analiza una imagen en la pestaña <span className="text-white/70">Analizar</span>{" "}
          y aquí verás, paso a paso, lo que hace la red neuronal.
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
      <ol className="relative ml-3 border-l border-white/10">
        {proceso.pasos.map((p, i) => {
          const last = i === proceso.pasos.length - 1;
          return (
            <li key={p.n} className="mb-5 ml-6">
              <span
                className={[
                  "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-4 ring-[#070a07]",
                  last
                    ? isRotten
                      ? "bg-rotten text-black"
                      : "bg-fresh text-black"
                    : "bg-white/15 text-white/80",
                ].join(" ")}
              >
                {p.n}
              </span>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-white/90">{p.titulo}</h4>
                  <code
                    className={[
                      "rounded-md px-2 py-0.5 text-xs font-semibold",
                      last
                        ? isRotten
                          ? "bg-rotten/15 text-rotten-glow"
                          : "bg-fresh/15 text-fresh-glow"
                        : "bg-white/10 text-white/80",
                    ].join(" ")}
                  >
                    {p.valor}
                  </code>
                </div>
                <p className="mt-1 text-sm text-white/50">{p.detalle}</p>
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
          accent={isRotten ? "text-rotten-glow" : "text-fresh-glow"}
        />
        <Stat label="Confianza" value={`${pct.toFixed(1)}%`} />
        <Stat label="Tiempo total" value={`${t.total.toFixed(0)} ms`} />
      </div>
      <p className="mt-3 text-center text-xs text-white/40">
        Desglose: preprocesado {t.preprocesado.toFixed(1)} ms · inferencia{" "}
        {t.inferencia.toFixed(1)} ms
      </p>
    </div>
  );
}

function Figure({ src, caption }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      {src ? (
        <img src={src} alt={caption} className="h-40 w-full object-contain" />
      ) : (
        <div className="flex h-40 items-center justify-center text-white/30">sin imagen</div>
      )}
      <figcaption className="border-t border-white/10 px-3 py-1.5 text-center text-xs text-white/50">
        {caption}
      </figcaption>
    </figure>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`truncate text-sm font-semibold ${accent || "text-white/90"}`}>
        {value}
      </div>
    </div>
  );
}
