// src/components/discovery/StartupCard.jsx
// Cleaned up version: removed star icon, filtered duplicate tags, conditionally render sections to avoid empty states.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Users, TrendingUp, ExternalLink, IndianRupee } from "lucide-react";
import { TIER_COLORS } from "../../data/mockData";
import ContactModal from "./ContactModal";
import { getApiBaseUrl } from "../../utils/apiConfig";

export default function StartupCard({ startup, onConnect }) {
  const navigate = useNavigate();
  const { 
    name, 
    logoInitials, 
    logoColor, 
    pitch, 
    industry, 
    stage, 
    location, 
    tier,
    minTicket, 
    verified, 
    traction, 
    tags 
  } = startup;

  const targetId = startup.id || startup.userId;

  const handleCardClick = () => {
    if (targetId) {
      // Record click & view events in background
      fetch(`${getApiBaseUrl()}/api/startups/${targetId}/click`, { method: "POST" }).catch(() => {});
      fetch(`${getApiBaseUrl()}/api/startups/${targetId}/view`, { method: "POST" }).catch(() => {});
      navigate(`/startup/${targetId}`);
    }
  };

  const rawTier = startup.tier || startup.plan_type || startup.planType || startup.subscription_plan || "Basic";
  const normalizedTierStr = String(rawTier).trim().toLowerCase();
  
  let cleanTier = "Basic";
  if (normalizedTierStr === "verified pro" || normalizedTierStr === "verified_pro" || normalizedTierStr === "verified") {
    cleanTier = "Verified Pro";
  } else if (normalizedTierStr === "spotlight") {
    cleanTier = "Spotlight";
  }

  const tierStyle = TIER_COLORS[cleanTier] || TIER_COLORS["Basic"];
  const isSpotlight = cleanTier === "Spotlight";
  const isVerifiedPro = cleanTier === "Verified Pro";

  // Filter duplicate tags using a Set
  const uniqueTags = Array.from(new Set(tags || []));

  // Determine if meta data is valid and present
  const hasLocation = location && location.trim() !== "" && location !== "N/A" && location !== "0";
  const hasTeam = startup.team && startup.team !== 0 && startup.team !== "0" && startup.team !== "N/A";
  const hasTraction = traction && traction.trim() !== "" && traction !== "N/A" && traction !== "0";

  return (
    <div
      onClick={handleCardClick}
      className={`startup-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-900 dark:text-white cursor-pointer hover:scale-[1.015] hover:border-indigo-500/50 hover:shadow-xl transition-all duration-300 ${
        isSpotlight
          ? "border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] spotlight"
          : ""
      } group relative overflow-hidden`}
    >
      {/* Glow top border line */}
      <div className="card-glow-overlay" />

      {/* Featured Top Ribbon */}
      {isSpotlight && (
        <div className="absolute top-0 right-0 z-10 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-lg shadow-sm">
          Featured
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start gap-3.5 mb-4">
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-lg overflow-hidden border border-slate-100 dark:border-slate-800"
          style={{
            background: (startup.logoUrl || startup.logo_url) ? 'transparent' : `linear-gradient(135deg, ${logoColor || "#4f46e5"}dd, ${logoColor || "#4f46e5"}88)`,
            boxShadow: `0 4px 15px ${(logoColor || "#4f46e5")}30`,
          }}
        >
          {(startup.logoUrl || startup.logo_url) ? (
            <img src={startup.logoUrl || startup.logo_url} alt={name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            logoInitials || (name ? name.substring(0, 2).toUpperCase() : "IV")
          )}
        </div>

        {/* Name & Verified Badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight transition-colors">
              {name}
            </h3>
            {cleanTier === "Spotlight" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 dark:text-amber-400 tracking-wider uppercase">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  className="w-5 h-5 drop-shadow-sm flex-shrink-0"
                >
                  <title>Spotlight Featured</title>
                  <defs>
                    <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="50%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01-.622-.636z"
                    fill="url(#gold-grad)"
                  />
                  <path
                    d="M8 3.8 L9.3 6.6 L12.3 6.9 L10.1 9 L10.7 12 L8 10.5 L5.3 12 L5.9 9 L3.7 6.9 L6.7 6.6 Z"
                    fill="#ffffff"
                  />
                </svg>
                <span>SPOTLIGHT</span>
              </span>
            ) : cleanTier === "Verified Pro" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  className="w-5 h-5 drop-shadow-sm flex-shrink-0"
                >
                  <title>Verified Company</title>
                  <defs>
                    <linearGradient id="verified-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="50%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01-.622-.636z"
                    fill="url(#verified-grad)"
                  />
                  <path
                    d="M4.5 8.5 L6.75 10.75 L11.5 6"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>VERIFIED PRO</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                <span>BASIC</span>
              </span>
            )}
          </div>

          {/* Tier badge */}
          <span
            className={`inline-flex items-center gap-1 mt-1 text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
              isSpotlight
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                : isVerifiedPro
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            {isSpotlight ? "★ Spotlight" : isVerifiedPro ? "✓ Verified Pro" : "Basic"}
          </span>
        </div>
      </div>

      {/* Pitch / Description */}
      {pitch && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 line-clamp-2">
          {pitch}
        </p>
      )}

      {/* Tags */}
      {(industry || stage || uniqueTags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {industry && (
            <span className="tag tag-industry bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
              <span className="w-1.5 h-1.5 rounded-full inline-block bg-slate-400 dark:bg-slate-400" />
              {industry}
            </span>
          )}
          {stage && (
            <span className="tag tag-stage bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {stage}
            </span>
          )}
          {uniqueTags.slice(0, 2).map((tag) => (
            <span key={tag} className="tag tag-industry text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta Info */}
      {(hasLocation || hasTeam || hasTraction) && (
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mb-4 flex-wrap">
          {hasLocation && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {location}
            </span>
          )}
          {hasTeam && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {startup.team} people
            </span>
          )}
          {hasTraction && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {traction}
            </span>
          )}
        </div>
      )}

      {/* Metric Bar */}
      <div className="metric-bar flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
        <div className="metric-item">
          <span className="metric-label flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <IndianRupee className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Min. Investment
          </span>
          <span className="metric-value font-bold text-indigo-600 dark:text-indigo-400 text-sm">
            {minTicket || "₹1,00,000"}
          </span>
        </div>
        <button
          className="metric-action cursor-pointer px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 font-semibold text-xs transition-all flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();

            // Track outbound click if not founder self-clicking
            const currentUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
            const currentUserId = currentUser?.userId || currentUser?.id;
            if (!currentUserId || !startup.userId || currentUserId !== startup.userId) {
              fetch(`${getApiBaseUrl()}/api/startups/${targetId}/click`, { method: "POST" }).catch(() => {});
            }

            if (onConnect) onConnect(startup);
          }}
        >
          Connect
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
