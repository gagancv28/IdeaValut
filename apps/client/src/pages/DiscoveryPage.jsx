import { useState, useMemo, useEffect } from "react";
import FilterSidebar from "../components/discovery/FilterSidebar";
import StartupGrid from "../components/discovery/StartupGrid";
import ContactModal from "../components/discovery/ContactModal";
import { Zap, Users, TrendingUp, Building2, SlidersHorizontal, X } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function DiscoveryPage() {
  const [dbStartups, setDbStartups] = useState([]);
  const [activeContactStartup, setActiveContactStartup] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [filters, setFilters] = useState({
    listingTypes: [],
    industries: [],
    stages: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Latest");
  const [activeMetric, setActiveMetric] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchListings = async () => {
    try {
      setLoadingData(true);
      const res = await fetch(`${getApiBaseUrl()}/api/startups?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Discover Page Data (fresh):', data);
        if (data.startups) {
          setDbStartups(data.startups);
        }
      }
    } catch (err) {
      console.error("Failed to fetch startups for Discover page:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchListings();
    
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchListings();
      }
    };

    window.addEventListener("startups-updated", fetchListings);
    window.addEventListener("focus", fetchListings);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("startups-updated", fetchListings);
      window.removeEventListener("focus", fetchListings);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const handleFilterChange = (key, values) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  };

  const handleClearAll = () => {
    setFilters({ listingTypes: [], industries: [], stages: [] });
    setSearchQuery("");
  };

  const filteredStartups = useMemo(() => {
    let result = [...dbStartups];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.pitch || "").toLowerCase().includes(q) ||
          (s.industry || "").toLowerCase().includes(q) ||
          (s.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters.listingTypes.length > 0) {
      const listingTypes = [...filters.listingTypes];
      if (listingTypes.includes("Verified Pro") && !listingTypes.includes("Spotlight")) {
        listingTypes.push("Spotlight");
      }
      result = result.filter((s) => {
        const rawTier = s.tier || s.plan_type || s.planType || s.subscription_plan || "Basic";
        const normalized = String(rawTier).trim().toLowerCase();
        let cleanTier = "Basic";
        if (normalized === "verified pro" || normalized === "verified_pro" || normalized === "verified") {
          cleanTier = "Verified Pro";
        } else if (normalized === "spotlight") {
          cleanTier = "Spotlight";
        }
        return listingTypes.includes(cleanTier);
      });
    }

    if (filters.industries.length > 0) {
      result = result.filter((s) => filters.industries.includes(s.industry));
    }

    if (filters.stages.length > 0) {
      result = result.filter((s) => filters.stages.includes(s.stage));
    }

    if (sortBy === "Minimum Investment") {
      const parseAmt = (v) => parseFloat((v || "0").replace(/[^0-9.]/g, "")) || 0;
      result.sort((a, b) => parseAmt(b.minTicket) - parseAmt(a.minTicket));
    } else if (sortBy === "Stage") {
      const stageOrder = { Idea: 0, Prototype: 1, "Early Revenue": 2, Scaling: 3 };
      result.sort((a, b) => (stageOrder[a.stage] ?? 4) - (stageOrder[b.stage] ?? 4));
    }

    result.sort((a, b) => {
      const aTier = a.tier || a.plan_type || a.planType || "Basic";
      const bTier = b.tier || b.plan_type || b.planType || "Basic";
      const isASpotlight = String(aTier).toLowerCase().includes("spotlight");
      const isBSpotlight = String(bTier).toLowerCase().includes("spotlight");
      if (isASpotlight && !isBSpotlight) return -1;
      if (!isASpotlight && isBSpotlight) return 1;
      return 0;
    });

    return result;
  }, [filters, searchQuery, sortBy, dbStartups]);

  // Bulk Search Impression Tracker Effect
  useEffect(() => {
    if (!filteredStartups || filteredStartups.length === 0) return;

    const currentUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    const currentUserId = currentUser?.userId || currentUser?.id;

    // Filter out the logged-in founder's own startup ID to prevent self-inflation
    const targetStartups = filteredStartups.filter(
      (s) => !currentUserId || !s.userId || s.userId !== currentUserId
    );

    const visibleIds = targetStartups.map((s) => s.id || s.userId).filter(Boolean);
    if (visibleIds.length === 0) return;

    const recordImpressions = async () => {
      try {
        console.log(`[Impression Tracker] Recording search impressions for ${visibleIds.length} visible startups...`);
        await fetch(`${getApiBaseUrl()}/api/startups/impressions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: visibleIds })
        });
      } catch (err) {
        console.error("[Impression Tracker] Failed to record search impressions:", err);
      }
    };

    recordImpressions();
  }, [filteredStartups]);

  const activityTicker = useMemo(() => {
    const defaultTicker = [
      "📈 Investor Priya just viewed a FinTech startup pitch",
      "✅ SecureDocs completed another verified compliance review",
      "💬 New founder listing added to the live directory now",
    ];
    dbStartups.forEach((s) => {
      defaultTicker.unshift(`🚀 ${s.name} entered the marketplace with a fresh listing`);
    });
    return defaultTicker;
  }, [dbStartups]);

  const handleMetricClick = (label) => {
    setActiveMetric(label);
    if (label === "Verified Founders") {
      setFilters((prev) => ({
        ...prev,
        listingTypes: prev.listingTypes.includes("Verified Pro")
          ? prev.listingTypes
          : [...prev.listingTypes, "Verified Pro"],
      }));
    }
  };

  const parseAmtVal = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const clean = parseFloat(value.toString().replace(/[^0-9.]/g, ""));
    return isNaN(clean) ? 0 : clean;
  };

  const formatFunding = (amount) => {
    if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
    if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const activeStartups = dbStartups.length;
  const verifiedFounders = dbStartups.filter((s) => s.verified).length;
  const totalFundingSought = dbStartups.reduce((sum, s) => sum + parseAmtVal(s.minTicket), 0);

  const stats = [
    { label: "Active Startups", value: activeStartups, icon: Building2 },
    { label: "Verified Founders", value: verifiedFounders, icon: Users },
    { label: "Total Funding Sought", value: formatFunding(totalFundingSought), icon: TrendingUp },
    { label: "Zero Brokerage", value: "100%", icon: Zap },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Hero Banner */}
      <div
        className="relative border-b py-8 sm:py-12 overflow-hidden"
        style={{ background: "var(--bg-hero)", borderColor: "var(--border-1)" }}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-12" />
        <div
          className="absolute -top-28 -right-24 w-80 h-80 rounded-full blur-3xl opacity-8"
          style={{ background: "var(--brand)" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-3 hero-status-pill">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em]">Live Directory</span>
            </div>
            <h1
              className="text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-3 max-w-4xl"
              style={{ color: "var(--text-1)" }}
            >
              Discover World's{" "}
              <span className="hero-highlight inline-flex items-center tracking-tight">
                Most Promising
              </span>
              <br />
              Early-Stage Startups
            </h1>
            <p className="text-xs sm:text-base max-w-xl" style={{ color: "var(--text-2)" }}>
              Zero brokerage. Direct founder access. Invest in the next big idea — before the crowd.
            </p>
          </div>

          {/* Live Activity Ticker */}
          <div className="w-full mt-4 sm:mt-6 mb-5 overflow-hidden rounded-2xl sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center h-10 sm:h-12">
            <div className="flex items-center gap-1.5 px-3 sm:px-5 h-full font-extrabold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-r border-slate-200 dark:border-slate-800 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE
            </div>
            <div className="flex-1 overflow-hidden relative py-2">
              <div className="ticker-items inline-flex gap-6 sm:gap-8 whitespace-nowrap animate-ticker">
                {[...activityTicker, ...activityTicker].map((item, index) => (
                  <span key={index} className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-500 font-bold">•</span>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleMetricClick(label)}
                className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-3 rounded-2xl px-3 py-3 sm:px-4 backdrop-blur-sm transition-all duration-300 border hover:-translate-y-1 hover:shadow-xl"
                style={{
                  cursor: "pointer",
                  borderColor: activeMetric === label ? "var(--brand)" : "var(--border-1)",
                  backgroundColor:
                    activeMetric === label ? "rgba(79,70,229,0.12)" : "var(--bg-elevated)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(79,70,229,0.12)",
                    border: "1px solid rgba(79,70,229,0.2)",
                  }}
                >
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold text-theme-1 truncate">{value}</div>
                  <div className="text-[10px] sm:text-xs text-theme-3 truncate">{label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Filter Toggle */}
        <button
          className="lg:hidden flex items-center gap-2 mb-4 px-4 py-2 rounded-xl text-sm"
          onClick={() => setSidebarOpen(true)}
          style={{
            border: "1px solid var(--border-1)",
            color: "var(--text-2)",
            backgroundColor: "var(--bg-input)",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {filters.listingTypes.length + filters.industries.length + filters.stages.length > 0 && (
            <span
              className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: "#4f46e5" }}
            >
              {filters.listingTypes.length + filters.industries.length + filters.stages.length}
            </span>
          )}
        </button>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div
              className="relative w-80 p-4 overflow-y-auto"
              style={{ backgroundColor: "var(--bg-card)", borderRight: "1px solid var(--border-1)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-theme-1">Filters</h2>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5 text-theme-3" />
                </button>
              </div>
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearAll={handleClearAll}
                totalCount={dbStartups.length}
                filteredCount={filteredStartups.length}
              />
            </div>
          </div>
        )}

        <div className="flex gap-7">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearAll}
              totalCount={dbStartups.length}
              filteredCount={filteredStartups.length}
            />
          </div>

          {/* Content */}
          {loadingData ? (
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3 text-theme-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading live listings...</span>
              </div>
            </div>
          ) : (
            <StartupGrid
              startups={filteredStartups}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onConnect={setActiveContactStartup}
            />
          )}
        </div>
      </div>
      {activeContactStartup && (
        <ContactModal
          startup={activeContactStartup}
          onClose={() => setActiveContactStartup(null)}
        />
      )}
    </div>
  );
}
