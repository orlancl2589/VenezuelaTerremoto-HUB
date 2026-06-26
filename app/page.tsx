"use client";

import { useState, useRef, useEffect } from "react";
import type { PersonResult, SourceStatus } from "./api/search/route";

const PLATFORM_COLORS: Record<string, string> = {
  venezuelatebusca: "bg-blue-100 text-blue-800",
  venezuelareporta: "bg-purple-100 text-purple-800",
  desaparecidos: "bg-orange-100 text-orange-800",
};

const PLATFORM_URLS: Record<string, string> = {
  venezuelatebusca: "https://venezuelatebusca.com",
  venezuelareporta: "https://venezuelareporta.org",
  desaparecidos: "https://desaparecidosterremotovenezuela.com",
};

type Stats = {
  total: number;
  found: number;
  missing: number;
  lastScraped: string | null;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<"all" | "missing" | "found">("all");
  const [searched, setSearched] = useState("");
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const stickyInputRef = useRef<HTMLInputElement>(null);

  const isHero = results === null && !loading;

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  async function search() {
    const q = query.trim();
    if (!q || q.length < 2) return;
    setLoading(true);
    setResults(null);
    setSources([]);
    setActiveFilter("all");
    setActiveStatus("all");
    setSearched(q);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSources(data.sources ?? []);
      setLastScraped(data.lastScraped ?? null);
      setFromCache(data.fromCache ?? false);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") search();
  }

  function resetToHome() {
    setResults(null);
    setQuery("");
    setSources([]);
    setSearched("");
    setActiveFilter("all");
    setActiveStatus("all");
  }

  const filtered =
    results?.filter(
      (r) =>
        (activeFilter === "all" || r.platform === activeFilter) &&
        (activeStatus === "all" || r.status === activeStatus)
    ) ?? [];

  const missingCount = results?.filter((r) => r.status === "missing").length ?? 0;
  const foundCount = results?.filter((r) => r.status === "found").length ?? 0;

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    return `hace ${Math.floor(hrs / 24)} días`;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-[#002664] text-white">
        <div className="h-1 bg-[#CF142B]" />
        <div className="h-1 bg-[#F4C300]" />
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="VE Hub" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Hub de Búsqueda — Terremoto Venezuela 2026
              </h1>
              <p className="text-blue-200 text-xs mt-0.5">
                Busca en todas las plataformas de registro simultáneamente
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero — visible before first search */}
      {isHero && (
        <div className="bg-[#002664] text-white pb-10 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 pt-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">
                Base de datos centralizada · {stats ? stats.total.toLocaleString("es-VE") : "…"} registros
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
                Busca a tus seres queridos
              </h2>
              <p className="text-blue-200 text-sm sm:text-base max-w-md mx-auto">
                Concentramos los registros de múltiples plataformas en un solo lugar
              </p>
            </div>

            {/* Hero search bar */}
            <div className="flex gap-2 bg-white rounded-2xl p-2 shadow-2xl shadow-black/40 mb-8">
              <input
                ref={heroInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nombre, apellido o cédula…"
                className="flex-1 text-gray-900 text-base sm:text-lg px-4 py-3 rounded-xl outline-none placeholder:text-gray-400 bg-transparent"
                autoFocus
              />
              <button
                onClick={search}
                disabled={query.trim().length < 2}
                className="bg-[#CF142B] hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors text-base shrink-0"
              >
                Buscar
              </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stats ? stats.total.toLocaleString("es-VE") : <span className="animate-pulse">…</span>}
                </p>
                <p className="text-blue-200 text-xs mt-1 leading-tight">Registros centralizados</p>
              </div>
              <div className="bg-red-900/40 border border-red-700/40 rounded-xl p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stats ? stats.missing.toLocaleString("es-VE") : <span className="animate-pulse">…</span>}
                </p>
                <p className="text-red-200 text-xs mt-1 leading-tight">Aún desaparecidos</p>
              </div>
              <div className="bg-green-900/40 border border-green-700/40 rounded-xl p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stats ? stats.found.toLocaleString("es-VE") : <span className="animate-pulse">…</span>}
                </p>
                <p className="text-green-200 text-xs mt-1 leading-tight">Localizados</p>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-white leading-tight">
                  {stats?.lastScraped ? relativeTime(stats.lastScraped) : <span className="animate-pulse">…</span>}
                </p>
                <p className="text-blue-200 text-xs mt-1 leading-tight">Última actualización</p>
                {stats?.lastScraped && (
                  <p className="text-white/40 text-xs mt-0.5">
                    {new Date(stats.lastScraped).toLocaleString("es-VE", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map section — visible on hero state */}
      {isHero && (
        <section className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                Mapa de Daños Estructurales
              </h2>
              <a
                href="https://terremotovenezuela.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#002664] border border-[#002664] rounded-full px-3 py-1 hover:bg-[#002664] hover:text-white transition-colors"
              >
                Abrir sitio completo ↗
              </a>
            </div>
            {/* overflow:hidden + negative margin-top recorta la barra de búsqueda y filtros del sitio externo */}
            <div
              className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
              style={{ height: "540px" }}
            >
              <iframe
                src="https://terremotovenezuela.com"
                scrolling="no"
                style={{ width: "100%", height: "730px", marginTop: "-190px", border: "none", overflow: "hidden" }}
                title="Mapa de Daños Estructurales"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">
              Fuente:{" "}
              <a
                href="https://terremotovenezuela.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                terremotovenezuela.com
              </a>
            </p>
          </div>
        </section>
      )}

      {/* Sticky search bar — visible after search or during loading */}
      <div className={`bg-white border-b shadow-sm sticky top-0 z-10 ${isHero ? "hidden" : ""}`}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-center">
            <button
              onClick={resetToHome}
              title="Volver al inicio"
              className="shrink-0 hover:opacity-70 transition-opacity"
            >
              <img src="/logo.png" alt="Inicio" className="h-8 w-8 object-contain" />
            </button>
            <input
              ref={stickyInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nombre, cédula o apellido..."
              className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-2.5 text-base text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#002664] transition-colors"
            />
            <button
              onClick={search}
              disabled={loading || query.trim().length < 2}
              className="bg-[#CF142B] hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-4">Consultando plataformas…</div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border rounded-xl p-4 flex gap-4 animate-pulse">
                <div className="w-14 h-14 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results !== null && !loading && (
          <>
            {/* Summary + source filters */}
            <div className="mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-gray-900">{results.length}</span>{" "}
                    resultados para <span className="font-semibold">"{searched}"</span>
                  </p>
                  {lastScraped && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fromCache ? "📦 Base de datos" : "🌐 Búsqueda en vivo"} ·{" "}
                      Actualizado{" "}
                      {new Date(lastScraped).toLocaleString("es-VE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>

                {/* Source status */}
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <span
                      key={s.platform}
                      className={`text-xs px-2 py-1 rounded-full ${
                        s.error
                          ? "bg-red-100 text-red-600"
                          : s.count === 0
                          ? "bg-gray-100 text-gray-500"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {s.platformName}: {s.error ? "error" : `${s.count}`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Filter chips */}
              {results.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  {/* Status filter */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setActiveStatus("all")}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${activeStatus === "all" ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
                    >
                      Todos <span className="opacity-60">({results.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveStatus("missing")}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${activeStatus === "missing" ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-300 hover:border-red-400"}`}
                    >
                      Desaparecidos <span className="opacity-60">({missingCount})</span>
                    </button>
                    <button
                      onClick={() => setActiveStatus("found")}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${activeStatus === "found" ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-300 hover:border-green-400"}`}
                    >
                      Localizados <span className="opacity-60">({foundCount})</span>
                    </button>
                  </div>

                  {/* Platform filter */}
                  <div className="flex gap-2 flex-wrap">
                    <FilterChip
                      label="Todas las fuentes"
                      count={results.length}
                      active={activeFilter === "all"}
                      onClick={() => setActiveFilter("all")}
                    />
                    {sources
                      .filter((s) => s.count > 0)
                      .map((s) => (
                        <FilterChip
                          key={s.platform}
                          label={s.platformName}
                          count={s.count}
                          active={activeFilter === s.platform}
                          onClick={() => setActiveFilter(s.platform)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* No results */}
            {results.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-3xl mb-3">😔</p>
                <p className="font-medium text-gray-700">
                  No se encontraron registros para "{searched}"
                </p>
                <p className="text-sm mt-1 mb-5">
                  Intenta con otro nombre, apellido o cédula
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {sources.map((s) => (
                    <a
                      key={s.platform}
                      href={`${PLATFORM_URLS[s.platform]}${
                        s.platform === "venezuelareporta"
                          ? `/buscar?q=${encodeURIComponent(searched)}`
                          : `/?q=${encodeURIComponent(searched)}`
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
                    >
                      Buscar en {s.platformName} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Result cards */}
            <div className="space-y-3">
              {filtered.map((r) => (
                <ResultCard key={`${r.platform}-${r.id}`} result={r} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Emergency footer */}
      <footer className="border-t bg-white mt-8">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Contactos de emergencia Venezuela
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "CANTV (fijo)", num: "171" },
              { label: "Movilnet", num: "*1" },
              { label: "Digitel", num: "112" },
              { label: "Movistar", num: "911" },
              { label: "Cruz Roja VE", num: "0212-862-8740" },
              { label: "Rescarven", num: "0212-905-9800" },
            ].map((e) => (
              <div key={e.label}>
                <p className="text-xs text-gray-400">{e.label}</p>
                <a href={`tel:${e.num}`} className="font-bold text-[#002664] hover:underline">
                  {e.num}
                </a>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-5">
            Este hub no almacena datos personales ni está afiliado a ninguna
            plataforma listada. Solo facilita la búsqueda durante la emergencia.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-[#002664] text-white border-[#002664]"
          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
      }`}
    >
      {label}{" "}
      <span className={active ? "opacity-70" : "text-gray-400"}>({count})</span>
    </button>
  );
}

function ResultCard({ result }: { result: PersonResult }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white border rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {result.photoUrl && !imgError ? (
          <img
            src={result.photoUrl}
            alt={result.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-2xl">👤</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 leading-tight">{result.name}</h3>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              result.status === "found"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.status === "found" ? "Localizada" : "Desaparecida"}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-500">
          {result.age && <span>{result.age} años</span>}
          {result.location && (
            <span className="truncate max-w-[200px]">📍 {result.location}</span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              PLATFORM_COLORS[result.platform] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {result.platformName}
          </span>
          <a
            href={result.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#002664] font-medium hover:underline"
          >
            Ver detalle →
          </a>
        </div>
      </div>
    </div>
  );
}
