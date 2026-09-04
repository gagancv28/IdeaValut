// src/components/discovery/StartupGrid.jsx
import { Search, Sparkles, TrendingUp, RefreshCw } from "lucide-react";
import StartupCard from "./StartupCard";

export default function StartupGrid({ startups, searchQuery, setSearchQuery, sortBy, setSortBy, onConnect }) {
  const spotlightStartups = startups.filter((s) => s.tier === "Spotlight");
  const restStartups = startups.filter((s) => s.tier !== "Spotlight");

  return (
    <div className="flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-3" />
          <input
            type="text"
            placeholder="Search startups, industries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-10 pr-4"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-theme-3 whitespace-nowrap">Sort by:</span>
          {["Latest", "Minimum Investment", "Stage"].map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`sort-pill ${sortBy === s ? "active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* No results */}
      {startups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-theme-card border border-theme-1 flex items-center justify-center mb-4">
            <RefreshCw className="w-7 h-7 text-theme-3" />
          </div>
          <h3 className="text-lg font-semibold text-theme-2 mb-1">No startups found</h3>
          <p className="text-sm text-theme-3">Try adjusting your filters or search query</p>
        </div>
      )}

      {/* Spotlight Section */}
      {spotlightStartups.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.15)" }}>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold tracking-wider uppercase text-indigo-600">
                Spotlight Listings
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {spotlightStartups.map((s) => (
              <StartupCard key={s.id} startup={s} onConnect={onConnect} />
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      {restStartups.length > 0 && (
        <div>
          {spotlightStartups.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-card border" style={{ borderColor: 'var(--border-1)' }}>
                <TrendingUp className="w-3.5 h-3.5 text-theme-3" />
                <span className="text-xs font-semibold tracking-wider uppercase text-theme-3">
                  All Listings
                </span>
              </div>
              <div className="h-px flex-1 bg-slate-700/50" />
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4">
            {restStartups.map((s) => (
              <StartupCard key={s.id} startup={s} onConnect={onConnect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
