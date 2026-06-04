import { useEffect, useState } from "react";

/**
 * Barra de confianza animada (0-100%).
 * @param {number} value  - porcentaje de confianza (0-100).
 * @param {boolean} isRotten - true si la clase es "rotten" (color rojo).
 */
export default function ConfidenceBar({ value, isRotten }) {
  const [width, setWidth] = useState(0);
  const pct = Math.max(0, Math.min(100, value));

  // Animar de 0 hasta el valor real tras el montaje.
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const barColor = isRotten
    ? "bg-gradient-to-r from-rotten to-rotten-glow"
    : "bg-gradient-to-r from-fresh to-fresh-glow";

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-white/60">Confianza</span>
        <span className="font-semibold tabular-nums text-white/90">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barColor} transition-[width] duration-1000 ease-out`}
          style={{ width: `${width}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
