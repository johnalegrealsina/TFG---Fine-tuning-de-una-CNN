import { useEffect, useRef, useState } from "react";
import UploadZone from "./components/UploadZone.jsx";
import ResultCard from "./components/ResultCard.jsx";
import ModelSelector from "./components/ModelSelector.jsx";
import ProcessView from "./components/ProcessView.jsx";
import { classifyImage, getModels, loadModel } from "./services/api.js";

const TOP_PRODUCTS = [
  ["🍎", "Manzana"], ["🍌", "Plátano"], ["🥒", "Pepino"], ["🥕", "Zanahoria"],
  ["🍇", "Uva"], ["🥭", "Mango"], ["🍊", "Naranja"], ["🍓", "Fresa"],
  ["🍅", "Tomate"], ["🥔", "Patata"],
];

const STORAGE_KEY = "fruty_model";

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "EfficientNetB0"
  );
  const [warming, setWarming] = useState(false);
  const [tab, setTab] = useState("analizar"); // "analizar" | "proceso"

  const objectUrlRef = useRef(null);

  // Cargar la lista de modelos al inicio.
  useEffect(() => {
    getModels()
      .then((data) => {
        setModels(data.modelos);
        // Si el modelo guardado no existe/no esta disponible, usar el default.
        const saved = localStorage.getItem(STORAGE_KEY);
        const ok = data.modelos.find((m) => m.id === saved && m.disponible);
        if (!ok) setSelectedModel(data.default);
      })
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function markLoaded(id) {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, cargado: true } : m)));
  }

  async function handleSelectModel(id) {
    if (id === selectedModel || loading) return;
    setSelectedModel(id);
    localStorage.setItem(STORAGE_KEY, id);
    setError(null);
    // "Calentar" el modelo si aun no esta cargado, para que la 1ª inferencia
    // no tenga que esperar a cargarlo (ConvNeXt/ResNet pesan bastante).
    const m = models.find((x) => x.id === id);
    if (m && !m.cargado && m.disponible) {
      setWarming(true);
      try {
        await loadModel(id);
        markLoaded(id);
      } catch (err) {
        setError(err.message);
      } finally {
        setWarming(false);
      }
    }
  }

  function handleSelect(selected) {
    setError(null);
    setResult(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(selected);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setFile(selected);
  }

  function handleClear() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await classifyImage(file, selectedModel);
      setResult(data);
      if (data.modelo) markLoaded(data.modelo);
      setHistory((prev) =>
        [{ ...data, thumb: previewUrl, ts: Date.now() }, ...prev].slice(0, 5)
      );
    } catch (err) {
      setError(err.message || "Ha ocurrido un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:py-12">
        {/* Cabecera */}
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-fresh-glow to-fresh bg-clip-text text-transparent">
              Fruty
            </span>{" "}
            🍏
          </h1>
          <p className="mt-2 text-white/60">
            Sube una foto de tu fruta o verdura y descubre si está{" "}
            <span className="text-fresh-glow">fresca</span> o{" "}
            <span className="text-rotten-glow">podrida</span>.
          </p>
        </header>

        {/* Pestañas */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <TabButton active={tab === "analizar"} onClick={() => setTab("analizar")}>
              🔍 Analizar
            </TabButton>
            <TabButton active={tab === "proceso"} onClick={() => setTab("proceso")}>
              🔬 Proceso {result && <Dot />}
            </TabButton>
          </div>
        </div>

        <main className="flex-1">
          {tab === "analizar" ? (
            <>
              <ModelSelector
                models={models}
                selected={selectedModel}
                onSelect={handleSelectModel}
                warming={warming}
                disabled={loading}
              />

              {result ? (
                <ResultCard
                  result={result}
                  previewUrl={previewUrl}
                  onReset={handleReset}
                />
              ) : (
                <UploadZone
                  file={file}
                  previewUrl={previewUrl}
                  onSelect={handleSelect}
                  onError={setError}
                  onAnalyze={handleAnalyze}
                  onClear={handleClear}
                  loading={loading}
                />
              )}

              {error && (
                <div className="animate-fade-in mt-5 flex items-start gap-3 rounded-xl border border-rotten/30 bg-rotten/10 px-4 py-3 text-sm text-rotten-glow">
                  <span className="text-lg leading-none">⛔</span>
                  <p>{error}</p>
                </div>
              )}

              {history.length > 0 && (
                <section className="mt-10">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
                    Historial de la sesión
                  </h3>
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li
                        key={h.ts}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        {h.thumb && (
                          <img
                            src={h.thumb}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                          />
                        )}
                        <span className={`text-lg ${h.clase === "rotten" ? "text-rotten-glow" : "text-fresh-glow"}`}>
                          {h.clase === "rotten" ? "⚠️" : "✅"}
                        </span>
                        <span className="font-semibold">
                          {h.clase === "rotten" ? "Podrida" : "Fresca"}
                        </span>
                        {h.modelo && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">
                            {h.modelo}
                          </span>
                        )}
                        <span className="ml-auto text-sm text-white/50">
                          {h.confianza.toFixed(1)}% · {h.tiempo_inferencia_ms.toFixed(0)} ms
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <ProcessView result={result} previewUrl={previewUrl} />
          )}
        </main>

        {/* Pie */}
        <footer className="mt-12 border-t border-white/10 pt-6 text-center">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/40">
            Entrenado con productos como
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TOP_PRODUCTS.map(([icon, name]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/70"
              >
                <span>{icon}</span> {name}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition",
        active ? "bg-fresh text-black" : "text-white/60 hover:text-white/90",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Dot() {
  return <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />;
}
