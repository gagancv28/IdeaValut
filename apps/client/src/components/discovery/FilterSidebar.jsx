// src/components/discovery/FilterSidebar.jsx
import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import { INDUSTRIES, STAGES, LISTING_TYPES } from "../../data/mockData";

function FilterSection({ title, items, selected, onChange }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="filter-section-divider border-b pb-5 mb-5">
      <button
        className="flex items-center justify-between w-full mb-3 group"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="filter-label-header text-sm font-bold uppercase tracking-wider">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        ) : (
          <ChevronDown className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
      {open && (
        <div className="space-y-2.5">
          {items.map((item) => (
            <label
              key={item}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                className="custom-checkbox accent-indigo-600 w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                checked={selected.includes(item)}
                onChange={() => onChange(item)}
              />
              <span
                className={`filter-label-item text-sm transition-colors duration-150 font-medium${selected.includes(item) ? ' active' : ''}`}
              >
                {item}
              </span>
              {/* Spotlight premium badge */}
              {title === "Listing Type" && item === "Spotlight" && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded font-bold text-white bg-indigo-600 shadow-sm">
                  ★
                </span>
              )}
              {/* Hint: Verified Pro includes Spotlight */}
              {title === "Listing Type" && item === "Verified Pro" && (
                <span
                  className="ml-auto text-xs px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600 border border-indigo-200"
                  title="Also shows Spotlight listings"
                >
                  +Spotlight
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterSidebar({ filters, onFilterChange, onClearAll, totalCount, filteredCount }) {
  const hasActiveFilters =
    filters.listingTypes.length > 0 ||
    filters.industries.length > 0 ||
    filters.stages.length > 0;

  const toggle = (key, value) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFilterChange(key, updated);
  };

  return (
    <aside className="sticky top-20 h-fit">
      {/* Sidebar panel — bg-gray-50 text-slate-800 default, dark:bg-slate-900 dark:text-slate-200 */}
      <div className="filter-sidebar-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 border border-indigo-200">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold filter-label-header">Filters</h2>
              <p className="text-xs opacity-60 font-medium">
                {filteredCount}/{totalCount} startups
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs opacity-60 hover:text-red-500 font-medium transition-colors duration-150 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="filter-section-divider flex flex-wrap gap-1.5 mb-4 pb-4 border-b">
            {[...filters.listingTypes, ...filters.industries, ...filters.stages].map((f) => (
              <span
                key={f}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 font-medium"
              >
                {f}
                <button
                  onClick={() => {
                    const key = filters.listingTypes.includes(f)
                      ? "listingTypes"
                      : filters.industries.includes(f)
                      ? "industries"
                      : "stages";
                    toggle(key, f);
                  }}
                  className="hover:text-red-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <FilterSection
          title="Listing Type"
          items={LISTING_TYPES}
          selected={filters.listingTypes}
          onChange={(v) => toggle("listingTypes", v)}
        />
        <FilterSection
          title="Industry"
          items={INDUSTRIES}
          selected={filters.industries}
          onChange={(v) => toggle("industries", v)}
        />
        <FilterSection
          title="Startup Stage"
          items={STAGES}
          selected={filters.stages}
          onChange={(v) => toggle("stages", v)}
        />

        {/* Results Summary */}
        <div className="filter-section-divider mt-2 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-60 font-medium">Showing</span>
            <span className="text-sm font-bold text-indigo-500">
              {filteredCount} startups
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-600 to-indigo-500"
              style={{
                width: `${totalCount > 0 ? (filteredCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
