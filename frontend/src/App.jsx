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
    <div className="app-bg min-h-screen font-sans text-on-surface">
      {/* TopAppBar */}
      <header className="sticky top-0 z-50 border-b border-outline-variant/40 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-primary">
              nutrition
            </span>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-primary">
              AlimentoPuro
            </h1>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <span className="font-serif text-[18px] text-primary">Detector</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 py-14 text-center sm:py-16">
          <h2 className="font-serif text-4xl font-semibold leading-tight text-primary sm:text-5xl">
            Detector de calidad del alimento
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Sube una foto de tu fruta o verdura y nuestra visión artificial te
            dirá si está{" "}
            <span className="font-semibold text-fresh">fresca</span> o{" "}
            <span className="font-semibold text-rotten">podrida</span>.
          </p>
        </section>

        {/* Zona funcional */}
        <div className="mx-auto max-w-2xl px-4 pb-8">
          {/* Pestañas */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex rounded-xl border border-outline-variant/60 bg-surface-container-lowest/70 p-1">
              <TabButton active={tab === "analizar"} onClick={() => setTab("analizar")}>
                <span className="material-symbols-outlined text-[20px]">search</span>
                Analizar
              </TabButton>
              <TabButton active={tab === "proceso"} onClick={() => setTab("proceso")}>
                <span className="material-symbols-outlined text-[20px]">biotech</span>
                Proceso {result && <Dot />}
              </TabButton>
            </div>
          </div>

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
                <div className="animate-fade-in mt-5 flex items-start gap-3 rounded-xl border border-rotten/30 bg-rotten-container px-4 py-3 text-sm text-rotten">
                  <span className="material-symbols-outlined text-rotten">error</span>
                  <p>{error}</p>
                </div>
              )}

              {history.length > 0 && (
                <section className="mt-10">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
                    Historial de la sesión
                  </h3>
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li
                        key={h.ts}
                        className="flex items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest/70 px-3 py-2"
                      >
                        {h.thumb && (
                          <img
                            src={h.thumb}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-outline-variant/40"
                          />
                        )}
                        <span
                          className={`material-symbols-outlined ${
                            h.clase === "rotten" ? "text-rotten" : "text-fresh"
                          }`}
                        >
                          {h.clase === "rotten" ? "warning" : "eco"}
                        </span>
                        <span className="font-semibold text-on-surface">
                          {h.clase === "rotten" ? "Podrida" : "Fresca"}
                        </span>
                        {h.modelo && (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                            {h.modelo}
                          </span>
                        )}
                        <span className="ml-auto text-sm text-on-surface-variant/80">
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

          <p className="mx-auto mt-8 max-w-md text-center text-sm italic leading-tight text-on-surface-variant/70">
            Esta web funciona con inteligencia artificial; sus resultados deben
            considerarse orientativos y no decisorios.
          </p>
        </div>

        {/* Productos de entrenamiento */}
        <section className="border-t border-outline-variant/40 px-4 py-12">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Entrenado con productos como
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TOP_PRODUCTS.map(([icon, name]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-lowest/60 px-3 py-1 text-sm text-on-surface-variant"
              >
                <span>{icon}</span> {name}
              </span>
            ))}
          </div>
        </section>

      </main>
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
        active
          ? "bg-primary-container text-primary-fixed shadow-sm"
          : "text-on-surface-variant hover:text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Dot() {
  return (
    <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
  );
}
