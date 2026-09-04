// src/pages/StartupDetails.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  MapPin, 
  Users, 
  TrendingUp, 
  ExternalLink, 
  IndianRupee, 
  FileText, 
  Mail, 
  User, 
  Globe, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Download 
} from "lucide-react";
import { TIER_COLORS } from "../data/mockData";
import ContactModal from "../components/discovery/ContactModal";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function StartupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [startup, setStartup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeContactStartup, setActiveContactStartup] = useState(null);

  useEffect(() => {
    const fetchStartupDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${getApiBaseUrl()}/api/startups/${id}?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        if (!res.ok) {
          throw new Error("Startup listing not found or removed.");
        }
        const data = await res.json();
        if (data.startup) {
          setStartup(data.startup);
        } else {
          throw new Error("No startup data returned.");
        }
      } catch (err) {
        console.error("Error fetching startup profile:", err);
        setError(err.message || "Failed to load startup details.");
      } finally {
        setLoading(false);
      }
    };

    fetchStartupDetails();
  }, [id]);

  // View Tracker Effect: Fire profile_views increment for all page views
  useEffect(() => {
    if (!startup || !id) return;

    const recordView = async () => {
      try {
        console.log(`[View Tracker] Incrementing profile view for startup ID ${id}...`);
        await fetch(`${getApiBaseUrl()}/api/startups/${id}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("[View Tracker] Error recording profile view:", err);
      }
    };

    recordView();
  }, [startup, id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Back navigation skeleton */}
        <div className="w-36 h-6 bg-slate-200 rounded-md animate-pulse mb-8" />

        {/* Header skeleton */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 animate-pulse mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-slate-200 shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="w-48 h-7 bg-slate-200 rounded-md" />
              <div className="w-72 h-4 bg-slate-100 rounded-md" />
              <div className="flex gap-2">
                <div className="w-20 h-6 bg-slate-100 rounded-full" />
                <div className="w-24 h-6 bg-slate-100 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 bg-white border border-gray-200 rounded-2xl p-6 animate-pulse space-y-3">
              <div className="w-32 h-5 bg-slate-200 rounded" />
              <div className="w-full h-4 bg-slate-100 rounded" />
              <div className="w-5/6 h-4 bg-slate-100 rounded" />
              <div className="w-3/4 h-4 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-64 bg-white border border-gray-200 rounded-2xl p-6 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !startup) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </button>
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
          <h2 className="text-xl font-bold text-slate-100 mb-2">Startup Profile Not Found</h2>
          <p className="text-slate-400 mb-6">{error || "The requested startup profile could not be loaded."}</p>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
          >
            Explore Directory
          </button>
        </div>
      </div>
    );
  }

  const {
    companyName,
    name,
    founderName,
    email,
    website,
    pitch,
    industry,
    stage,
    minTicket,
    fundingAsk,
    description,
    tier,
    verified,
    contactEmail,
    contactPhone,
    additionalContacts,
    documentUrls,
    location,
    teamSize,
    team,
    traction,
    tags
  } = startup;

  const displayName = companyName || name || "Startup";
  const cleanTier = tier === "Verified" ? "Verified Pro" : (tier || "Basic");
  const tierStyle = TIER_COLORS[cleanTier] || TIER_COLORS["Basic"];
  const isSpotlight = cleanTier === "Spotlight";
  const isVerifiedPro = cleanTier === "Verified Pro";

  const logoInitials = displayName.substring(0, 2).toUpperCase();
  const uniqueTags = Array.from(new Set(tags || []));

  const displayMinInvestment = minTicket || fundingAsk || "₹1,00,000";
  const hasLocation = location && location.trim() !== "" && location !== "N/A" && location !== "0";
  const displayTeam = team || (teamSize && teamSize !== "0" && teamSize !== "N/A" ? teamSize : null);
  const hasTraction = traction && traction.trim() !== "" && traction !== "N/A" && traction !== "0";

  const handleConnectClick = async () => {
    // Check currently authenticated user
    const currentUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    const currentUserId = currentUser?.userId || currentUser?.id;

    // Prevent Self-Clicks / Double tracking for startup owner
    if (!currentUserId || !startup.userId || currentUserId !== startup.userId) {
      try {
        console.log(`[Click Tracker] Incrementing outbound click for startup ID ${id}...`);
        await fetch(`${getApiBaseUrl()}/api/startups/${id}/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("[Click Tracker] Error recording click event:", err);
      }
    } else {
      console.log("[Click Tracker] Founder testing own Connect button — click increment skipped.");
    }

    setActiveContactStartup(startup);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Navigation Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </button>
      </div>

      {/* Header Profile Section */}
      <div 
        className={`p-6 sm:p-8 rounded-2xl bg-white border ${
          isSpotlight 
            ? "border-amber-400/60 shadow-[0_0_25px_rgba(251,191,36,0.08)]" 
            : "border-gray-200"
        } mb-8 relative overflow-hidden shadow-sm`}
      >
        {/* Top ribbon for Spotlight */}
        {isSpotlight && (
          <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md">
            ★ Spotlight Listing
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start gap-6 relative z-10">
          {/* Logo Badge */}
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-extrabold text-2xl text-white shrink-0 shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800"
            style={{
              background: (startup.logoUrl || startup.logo_url) ? 'transparent' : `linear-gradient(135deg, #4f46e5dd, #6366f188)`,
              boxShadow: `0 8px 25px rgba(79, 70, 229, 0.35)`,
            }}
          >
            {(startup.logoUrl || startup.logo_url) ? (
              <img src={startup.logoUrl || startup.logo_url} alt={displayName} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              logoInitials
            )}
          </div>

          {/* Startup Information Header */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {displayName}
              </h1>

              {/* Tier Badges */}
              {isSpotlight ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Spotlight
                </span>
              ) : isVerifiedPro ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Pro
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200">
                  Basic
                </span>
              )}
            </div>

            {/* Pitch tagline */}
            {pitch && (
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed mb-4">
                {pitch}
              </p>
            )}

            {/* Tag Pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {industry && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {industry}
                </span>
              )}
              {stage && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Stage: {stage}
                </span>
              )}
              {uniqueTags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-gray-200">
                  #{tag}
                </span>
              ))}

              {/* External Website Link */}
              {website && (
                <a
                  href={website.startsWith("http") ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleConnectClick}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-500 font-medium ml-auto transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2-Column Section: About & Documents */}
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Description */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-gray-100">
              About {displayName}
            </h2>
            <div className="prose max-w-none text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
              {description || "No detailed description provided yet for this startup."}
            </div>
          </div>

          {/* Public Pitch Deck Documents Section */}
          {(() => {
            const parseDocList = (val) => {
              if (Array.isArray(val)) return val.flatMap(parseDocList).filter(Boolean);
              if (!val || typeof val !== 'string') return [];
              const trimmed = val.trim();
              if (trimmed.startsWith('[')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (Array.isArray(parsed)) return parsed.filter(Boolean);
                } catch (e) {}
              }
              return trimmed.split(',').map(s => s.trim()).filter(Boolean);
            };

            const rawPublic = [
              startup.publicDocumentUrls,
              startup.publicDocumentUrl,
              startup.public_document_url
            ];
            const publicPitchDecks = Array.from(new Set(rawPublic.flatMap(parseDocList).filter(u => typeof u === 'string' && u.startsWith('http'))));

            if (publicPitchDecks.length === 0) return null;

            return (
              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Public Pitch Deck Documents ({publicPitchDecks.length})
                </h2>
                <div className="space-y-3">
                  {publicPitchDecks.map((url, idx) => {
                    const fileName = url.split("/").pop()?.split("?")[0] || `Pitch_Deck_Part_${idx + 1}`;
                    const labelName = publicPitchDecks.length > 1 ? `Pitch Deck Part ${idx + 1}` : `${displayName} Pitch Deck`;

                    return (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-gray-200">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {labelName}
                            </p>
                            <p className="text-xs text-slate-500 truncate" title={fileName}>{fileName}</p>
                          </div>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                        >
                          View {publicPitchDecks.length > 1 ? `Part ${idx + 1}` : 'Pitch Deck'} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Sidebar Section: Metrics & Direct Contact */}
        <div className="space-y-6">
          {/* Key Deal Metrics Card */}
          <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Investment Overview
            </h3>

            <div className="space-y-4">
              {/* Minimum Investment */}
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-indigo-500" />
                  Minimum Investment
                </span>
                <span className="text-xl font-extrabold text-indigo-600">
                  {displayMinInvestment}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Direct investment terms available</p>
              </div>

              {/* Industry & Stage */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-gray-200">
                  <span className="text-[11px] text-slate-400 block mb-0.5">Industry</span>
                  <span className="text-sm font-semibold text-slate-800 truncate block">
                    {industry || "Technology"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-gray-200">
                  <span className="text-[11px] text-slate-400 block mb-0.5">Development Stage</span>
                  <span className="text-sm font-semibold text-slate-800 truncate block">
                    {stage || "Early Stage"}
                  </span>
                </div>
              </div>

              {/* Location, Team, Traction */}
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                {hasLocation && (
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Location
                    </span>
                    <span className="font-semibold text-slate-800">{location}</span>
                  </div>
                )}
                {displayTeam && (
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Team Size
                    </span>
                    <span className="font-semibold text-slate-800">{displayTeam} members</span>
                  </div>
                )}
                {hasTraction && (
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      Traction
                    </span>
                    <span className="font-semibold text-slate-800">{traction}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Connect Action */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={handleConnectClick}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                Connect with Founder
              </button>
            </div>
          </div>

          {/* Founder Contact Info */}
          {(founderName || email || contactEmail) && (
            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Founder Contact
              </h3>

              <div className="space-y-3">
                {founderName && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-slate-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Founder Name</p>
                      <p className="text-sm font-semibold text-slate-900">{founderName}</p>
                    </div>
                  </div>
                )}
                {(contactEmail || email) && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-slate-500 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs text-slate-400">Direct Email</p>
                      <a 
                        href={`mailto:${contactEmail || email}`} 
                        onClick={handleConnectClick}
                        className="text-sm font-semibold text-indigo-600 hover:underline truncate block"
                      >
                        {contactEmail || email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Modal */}
      {activeContactStartup && (
        <ContactModal
          startup={activeContactStartup}
          onClose={() => setActiveContactStartup(null)}
        />
      )}
    </div>
  );
}
