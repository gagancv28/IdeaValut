// src/pages/OnboardingPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signupFounder } from "../services/api";
import {
  CheckCircle2, Star, Zap, Shield, Upload, ChevronRight, ChevronDown,
  Building2, FileText, IndianRupee, ArrowRight, Sparkles, Users, Target, TrendingUp,
  MapPin, Globe, Loader2, Lock, AlertCircle, UserCheck, Clock
} from "lucide-react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { useRazorpayCheckout } from "../hooks/useRazorpayCheckout";

// Dynamic geo-pricing will be loaded from state inside OnboardingPage component

// Map plan id → pricing key
const PLAN_PRICE_KEY = { basic: "basic", verified: "verified", spotlight: "spotlight" };

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 89,
    period: "6 months",
    badge: null,
    description: "Get your startup listed and visible to investors browsing the directory.",
    color: "#94a3b8",
    features: [
      "Standard directory listing",
      "Company profile page",
      "Basic analytics dashboard",
      "1 pitch deck upload (PDF)",
      "Listed for 180 days",
      "Email support",
    ],
    notIncluded: ["Verified badge", "Priority placement", "Spotlight pin"],
  },
  {
    id: "verified",
    name: "Verified Pro",
    price: 249,
    period: "6 months",
    badge: "Most Popular",
    description: "Stand out with a verified badge after manual document review by our team.",
    color: "#deff9a",
    features: [
      "Everything in Basic",
      "Manual document verification",
      "Official ✓ Verified badge on listing",
      "Priority placement in feed",
      "3 document uploads",
      "Listed for 180 days",
      "Dedicated onboarding call",
      "Investor inquiry notifications",
    ],
    notIncluded: ["Spotlight pin"],
  },
  {
    id: "spotlight",
    name: "Spotlight",
    price: 449,
    period: "6 months",
    badge: "Premium",
    description: "Be pinned to the very top of the feed with a glowing spotlight card.",
    color: "#fbbf24",
    features: [
      "Everything in Verified Pro",
      "Pinned to top of discovery feed",
      "Glowing spotlight card design",
      "⭐ Spotlight ribbon on card",
      "Featured in weekly investor digest",
      "Unlimited document uploads",
      "Listed for 180 days",
      "Priority investor matching",
      "Dedicated account manager",
    ],
    notIncluded: [],
  },
];

function PricingCard({ plan, selected, onSelect, displayPrice, currencySymbol, period, geoStatus, isDisabled }) {
  // Light mode only — fixed color palette for high contrast
  let themeColor = plan.color;
  if (plan.id === "basic") {
    themeColor = "#475569"; // slate-600
  } else if (plan.id === "verified") {
    themeColor = "#16a34a"; // green-600
  } else if (plan.id === "spotlight") {
    themeColor = "#b45309"; // amber-700
  }

  const isFeatured = plan.id === "verified";
  const isPremium = plan.id === "spotlight";
  const isLoading = geoStatus === "loading";

  // Determine button styles
  let btnBackground = "transparent";
  let btnTextColor = isDisabled ? "#94a3b8" : themeColor;
  let btnBorderColor = isDisabled ? "#cbd5e1" : themeColor;
  let btnShadow = "none";

  if (!isDisabled && (selected === plan.id || isFeatured)) {
    btnBackground = plan.color; // solid brand color background
    btnTextColor = "#0f172a"; // dark text for good contrast on solid color
    btnBorderColor = plan.color;
    btnShadow = selected === plan.id ? `0 4px 12px ${plan.color}40` : "none";
  }

  return (
    <div
      className={`pricing-card transition-all duration-300 ${isFeatured ? "featured" : ""} ${
        isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
      onClick={() => !isDisabled && onSelect(plan.id)}
      style={{
        outline: !isDisabled && selected === plan.id ? `2px solid ${themeColor}` : "none",
        outlineOffset: "2px",
      }}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1"
          style={{ background: plan.color }}
        >
          {isFeatured && <Star className="w-3 h-3" />}
          {isPremium && <Sparkles className="w-3 h-3" />}
          {plan.badge}
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-6">
        <h3
          className="text-xl font-bold mb-1"
          style={{ color: themeColor }}
        >
          {plan.name}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div
          className="flex items-baseline gap-1 transition-opacity duration-500"
          style={{ opacity: isLoading ? 0.4 : 1 }}
        >
          {isLoading ? (
            /* Shimmer skeleton while fetching geo */
            <div className="flex items-center gap-2">
              <Loader2
                className="w-5 h-5 animate-spin"
                style={{ color: themeColor }}
              />
              <div
                className="h-10 w-24 rounded-lg shimmer"
                style={{ opacity: 0.5 }}
              />
            </div>
          ) : (
            <>
              <span className="text-xs sm:text-sm font-medium text-slate-500">
                {currencySymbol}
              </span>
              <span
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 transition-all duration-500"
                key={displayPrice}   /* re-mount triggers CSS transition */
                style={{ animation: "fadeInUp 0.4s ease" }}
              >
                {displayPrice}
              </span>
              <span className="text-xs sm:text-sm text-slate-500 ml-1">/ {plan.period || period}</span>
            </>
          )}
        </div>
        <p className="text-xs text-slate-600 mt-1">No recurring fees. Zero hidden charges.</p>
      </div>

      {/* CTA */}
      <button
        className="w-full py-3 rounded-xl font-semibold text-sm mb-6 flex items-center justify-center gap-2 transition-all duration-200"
        disabled={isDisabled}
        style={{
          background: btnBackground,
          color: btnTextColor,
          border: `1.5px solid ${btnBorderColor}`,
          boxShadow: btnShadow,
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && selected !== plan.id && !isFeatured) {
            e.currentTarget.style.background = `${themeColor}15`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && selected !== plan.id && !isFeatured) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        {isDisabled ? (
          <>🔒 Paused</>
        ) : selected === plan.id ? (
          <><CheckCircle2 className="w-4 h-4" />Selected</>
        ) : (
          <>Get Started<ArrowRight className="w-4 h-4" /></>
        )}
      </button>

      {/* Features */}
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
            <CheckCircle2
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: themeColor }}
            />
            {f}
          </li>
        ))}
        {plan.notIncluded.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400 line-through">
            <div className="w-4 h-4 flex-shrink-0 mt-0.5 rounded-full border border-slate-300 flex items-center justify-center">
              <span className="text-xs">−</span>
            </div>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreRegistrationQueryForm() {
  const [qName, setQName] = useState("");
  const [qEmail, setQEmail] = useState("");
  const [qMsg, setQMsg] = useState("");
  const [submittingQuery, setSubmittingQuery] = useState(false);
  const [querySuccess, setQuerySuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!qName || !qEmail || !qMsg) return;
    setSubmittingQuery(true);
    setSubmitError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/pre-reg-queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: qName, email: qEmail, message: qMsg })
      });
      if (res.ok) {
        setQuerySuccess(true);
        setQName("");
        setQEmail("");
        setQMsg("");
        
        // Notify admin dashboard to refresh badges instantly
        window.dispatchEvent(new Event("admin-badges-updated"));
      } else {
        const errData = await res.json().catch(() => ({}));
        setSubmitError(errData.error || "Failed to submit query. Please try again later.");
      }
    } catch (err) {
      console.error("PreRegistrationQueryForm submit network connection error:", err);
      setSubmitError("Network connection refused. Please check if the server is running at port 3001.");
    } finally {
      setSubmittingQuery(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-slate-50 border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm mb-16">
      <h3 className="text-lg font-bold text-slate-900 mb-2">Have questions before applying?</h3>
      <p className="text-xs text-slate-500 mb-6">Drop us a line and our administrative team will get back to you shortly.</p>
      
      {querySuccess ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold p-4 rounded-xl flex flex-col gap-2 items-center text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          <span>Query submitted successfully! You can now continue with your registration below.</span>
          <button 
            type="button"
            onClick={() => setQuerySuccess(false)}
            className="text-[10px] underline mt-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            Submit another question
          </button>
        </div>
      ) : (
        <form onSubmit={handleQuerySubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-700 tracking-wider uppercase mb-1.5">Your Name</label>
              <input
                type="text"
                required
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="e.g. Rahul Dev"
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none w-full focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-700 tracking-wider uppercase mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={qEmail}
                onChange={(e) => setQEmail(e.target.value)}
                placeholder="e.g. rahul@example.com"
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none w-full focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-700 tracking-wider uppercase mb-1.5">Message / Question</label>
            <textarea
              required
              rows={3}
              value={qMsg}
              onChange={(e) => setQMsg(e.target.value)}
              placeholder="Ask anything about verification tiers, pricing or requirements..."
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none w-full resize-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button
            type="submit"
            disabled={submittingQuery}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {submittingQuery ? "Submitting..." : "Submit Inquiry"}
          </button>
          {submitError && (
            <p className="text-rose-500 text-[11px] font-bold text-center mt-3 animate-pulse">
              ⚠️ {submitError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function OnboardingPage({ user, onOpenSignup, onOpenLogin }) {
  const navigate = useNavigate();

  // ── Auth state ───────────────────────────────────────────────────────────────
  const isLoggedIn = !!user;

  // ── Form state ───────────────────────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState("verified");
  const [formData, setFormData] = useState({
    companyName: "",
    founderName: "",
    email: "",
    password: "",
    pitch: "",
    industry: "",
    industryOther: "",
    stage: "",
    fundingAsk: "",
    description: "",
    website: "",
    location: "",
    teamSize: "",
    traction: "",
    tagsString: "",
    contactEmail: "",
    contactPhone: "",
    additionalContacts: [],
    documentUrl: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [validated, setValidated] = useState(false);
  
  const { handleCheckout, isProcessing } = useRazorpayCheckout();

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [checkingSubmission, setCheckingSubmission] = useState(() => !!user?.userId);
  // Local maintenance mode state — fetched from platform-settings alongside pricing data
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  useEffect(() => {
    const checkUserSubmission = async () => {
      if (!user?.userId) {
        setCheckingSubmission(false);
        return;
      }
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/startups/${user.userId}`);
        if (res.ok) {
          const responseData = await res.json();
          if (responseData.startup) {
            setHasSubmitted(true);
          }
        }
      } catch (err) {
        console.error("Error checking user submission:", err);
      } finally {
        setCheckingSubmission(false);
      }
    };
    checkUserSubmission();
  }, [user]);

  // ── Submission state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isWhyUsOpen, setIsWhyUsOpen] = useState(false);

  // Sync form data fields when the user state changes (e.g. signup success)
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        email: user.email || prev.email,
        companyName: user.companyName || prev.companyName,
      }));
    }
  }, [user]);

  // Log In button — navigate straight to dashboard (existing session)


  // ── Geo-pricing state ───────────────────────────────────────────────────────
  const [currency, setCurrency] = useState("USD");
  // geoStatus: 'loading' | 'india' | 'global' | 'denied'
  const [geoStatus, setGeoStatus] = useState("loading");
  const [geoData, setGeoData]     = useState(null); // { city, country }

  const [pricingData, setPricingData] = useState({
    IN: {
      symbol: "₹",
      locale: "en-IN",
      label: "India (INR)",
      flag: "🇮🇳",
      period: "6 months",
      basic: { amount: 2499, display: "₹2,499" },
      verified: { amount: 9999, display: "₹9,999" },
      spotlight: { amount: 24999, display: "₹24,999" },
    },
    USD: {
      symbol: "$",
      locale: "en-US",
      label: "Global (USD)",
      flag: "🌐",
      period: "6 months",
      basic: { amount: 49, display: "$49" },
      verified: { amount: 149, display: "$149" },
      spotlight: { amount: 300, display: "$300" },
    }
  });

  const activePricing = currency === "INR" ? pricingData.IN : pricingData.USD;
  const selectedPricing = activePricing[PLAN_PRICE_KEY[selectedPlan]];

  useEffect(() => {
    const loadDynamicPricing = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/platform-settings`);
        if (res.ok) {
          const data = await res.json();
          setPricingData({
            IN: {
              symbol: "₹",
              locale: "en-IN",
              label: "India (INR)",
              flag: "🇮🇳",
              period: "6 months",
              basic: { amount: parseInt(String(data?.basic_price_inr || "2499").replace(/[^0-9]/g, ""), 10) || 2499, display: data?.basic_price_inr || "₹2,499" },
              verified: { amount: parseInt(String(data?.pro_price_inr || "9999").replace(/[^0-9]/g, ""), 10) || 9999, display: data?.pro_price_inr || "₹9,999" },
              spotlight: { amount: parseInt(String(data?.spotlight_price_inr || "24999").replace(/[^0-9]/g, ""), 10) || 24999, display: data?.spotlight_price_inr || "₹24,999" },
            },
            USD: {
              symbol: "$",
              locale: "en-US",
              label: "Global (USD)",
              flag: "🌐",
              period: "6 months",
              basic: { amount: parseInt(String(data?.basic_price_usd || "49").replace(/[^0-9]/g, ""), 10) || 49, display: data?.basic_price_usd || "$49" },
              verified: { amount: parseInt(String(data?.pro_price_usd || "149").replace(/[^0-9]/g, ""), 10) || 149, display: data?.pro_price_usd || "$149" },
              spotlight: { amount: parseInt(String(data?.spotlight_price_usd || "300").replace(/[^0-9]/g, ""), 10) || 300, display: data?.spotlight_price_usd || "$300" },
            }
          });
          // Also read maintenance_mode from the same response
          setIsMaintenanceMode(!!data?.maintenance_mode);
        }
      } catch (err) {
        console.warn("Could not load dynamic onboarding prices:", err);
      }
    };
    loadDynamicPricing();
  }, []);

  useEffect(() => {
    // IP-based geo detection — works over HTTP (no browser permission needed)
    const detectByIp = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (!res.ok) throw new Error("ipapi failed");
        const data = await res.json();
        const countryCode = data.country_code;
        const countryName = data.country_name || "";
        if (countryCode === "IN") {
          setCurrency("INR");
          setGeoStatus("india");
          setGeoData({ country: countryName });
        } else {
          setCurrency("USD");
          setGeoStatus("global");
          setGeoData({ country: countryName });
        }
      } catch {
        // Default to INR if all detection fails
        setCurrency("INR");
        setGeoStatus("india");
        setGeoData({ country: "India" });
      }
    };

    // Always try browser GPS first — on local network HTTP, Android Chrome still prompts.
    // Fall back to IP detection if denied or unavailable.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (!res.ok) throw new Error("geocoder failed");
            const data = await res.json();
            const countryCode = data.countryCode;
            const countryName = data.countryName;
            if (countryCode === "IN") {
              setCurrency("INR");
              setGeoStatus("india");
              setGeoData({ country: countryName });
            } else {
              setCurrency("USD");
              setGeoStatus("global");
              setGeoData({ country: countryName });
            }
          } catch {
            // Reverse geocode failed — fall back to IP
            detectByIp();
          }
        },
        () => {
          // User denied GPS or it timed out — fall back to IP
          detectByIp();
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      // Geolocation API not available
      detectByIp();
    }
  }, []);

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addAdditionalContact = () => {
    setFormData((prev) => ({
      ...prev,
      additionalContacts: [...(prev.additionalContacts || []), { label: "LinkedIn", value: "" }]
    }));
  };

  const handleAdditionalContactChange = (index, field, value) => {
    setFormData((prev) => {
      const list = [...(prev.additionalContacts || [])];
      list[index][field] = value;
      return { ...prev, additionalContacts: list };
    });
  };

  const removeAdditionalContact = (index) => {
    setFormData((prev) => {
      const list = [...(prev.additionalContacts || [])];
      list.splice(index, 1);
      return { ...prev, additionalContacts: list };
    });
  };

  const validateContacts = () => {
    const hasEmail = !!formData.contactEmail?.trim();
    const hasPhone = !!formData.contactPhone?.trim();
    const hasAdditional = (formData.additionalContacts || []).some((c) => !!c.value?.trim());
    return hasEmail || hasPhone || hasAdditional;
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidated(true);
    setSubmitError("");
    setIsSubmitting(true);

    if (!validateContacts()) {
      setSubmitError("Please provide at least one contact method so investors can reach you.");
      setIsSubmitting(false);
      return;
    }

    try {
      // If the user registered via the modal we already have their credentials
      // stored in sessionStorage; re-use them so we don't need to ask again.
      const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");

      if (!session?.userId) {
        // Shouldn't normally reach here (form is locked behind auth)
        // but as a safety net, attempt signup with whatever we have.
        await signupFounder({
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
        });
      }

      let docUrl = "";
      if (uploadedFiles.length > 0) {
        const file = uploadedFiles[0];
        const base64Promise = new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = (error) => reject(error);
        });

        const fileBase64 = await base64Promise;
        const uploadRes = await fetch(`${getApiBaseUrl()}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileBase64,
            mimeType: file.type,
            userId: session?.userId || "anonymous"
          })
        });
        
        const rawUploadText = await uploadRes.text();
        let uploadData = {};
        try {
          uploadData = JSON.parse(rawUploadText);
        } catch {
          console.error("[Onboarding] Server upload non-JSON raw response:", rawUploadText);
        }
        if (uploadRes.ok && uploadData.url) {
          docUrl = uploadData.url;
        }
      }

      console.log("[Onboarding] Submitting startup payload:", {
        name: formData.companyName,
        founderName: formData.founderName,
        email: formData.email,
        website: formData.website,
        pitch: formData.pitch,
        industry: formData.industry === "Other" ? formData.industryOther : formData.industry,
        stage: formData.stage,
        minTicket: formData.fundingAsk,
        description: formData.description,
        userId: session?.userId,
        docUrl
      });

      // Save details to backend
      const res = await fetch(`${getApiBaseUrl()}/api/startups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.companyName,
          company_name: formData.companyName,
          companyName: formData.companyName,
          founderName: formData.founderName,
          email: formData.email,
          website: formData.website,
          pitch: formData.pitch,
          industry: formData.industry === "Other" ? formData.industryOther : formData.industry,
          stage: formData.stage,
          minTicket: formData.fundingAsk,
          description: formData.description,
          location: formData.location,
          teamSize: formData.teamSize,
          traction: formData.traction,
          tags: formData.tagsString,
          userId: session?.userId,
          documentUrl: docUrl,
          documentUrls: docUrl ? [docUrl] : [],
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          additionalContacts: formData.additionalContacts || [],
          contactInfo: {
            email: formData.contactEmail,
            phone: formData.contactPhone,
            additional: formData.additionalContacts || []
          }
        }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        console.error("Supabase Insert Error:", responseData.error || responseData.details, responseData);
        throw new Error(responseData.error || responseData.dbError || "Failed to submit startup details to server.");
      }

      console.log("[Onboarding] Submission succeeded:", responseData);

      // Save details to sessionStorage
      // Parse comma-separated tags into array for preview rendering
      const parsedTags = (formData.tagsString || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const savedData = {
        ...formData,
        tags: parsedTags,
        team: parseInt(formData.teamSize, 10) || 0,
        tier: selectedPlan === "verified" ? "Verified Pro" : selectedPlan === "spotlight" ? "Spotlight" : "Basic",
      };

      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify(savedData));
      sessionStorage.setItem("ideavault_has_profile", "true");

      // Application submitted successfully
      setSubmitted(true);
    } catch (err) {
      console.error("Supabase Insert Error:", err.message, err);
      setSubmitError(err.message);
      alert(`Submission Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const planInfo = PLANS.find((p) => p.id === selectedPlan);
    const priceDisplay = activePricing[PLAN_PRICE_KEY[selectedPlan]]?.display || planInfo?.price;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <div className="text-center max-w-md mx-auto px-4 space-y-6 animate-in fade-in-50 zoom-in-95 duration-200">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-2 border"
            style={{ background: "rgba(79,70,229,0.12)", borderColor: "rgba(79,70,229,0.3)" }}
          >
            <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Onboarding Details Saved!</h2>
            <p className="text-sm text-slate-400 mt-2">
              Activate visibility for <span className="font-semibold text-indigo-600">{formData.companyName || "your listing"}</span> in the directory.
            </p>
          </div>

          {/* Pending Approval / Payment Box */}
          {selectedPlan === "basic" ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-400">Subscription Plan</span>
                <span className="text-sm font-bold text-slate-100 uppercase tracking-wide">{planInfo?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-400">Visibility Status</span>
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-full uppercase">Free Plan</span>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("startups-updated"));
                    navigate("/dashboard");
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer transform active:scale-95"
                >
                  Go to Founder Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-left space-y-4 shadow-xl">
              <div className="flex items-center gap-3 text-amber-600">
                <Clock className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-amber-500 uppercase tracking-wide">Pending Admin Approval</h3>
                  <p className="text-xs text-amber-400 mt-1 leading-relaxed">
                    Your profile is pending admin approval. You will be able to complete payment once approved.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("startups-updated"));
                    navigate("/dashboard");
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md"
                >
                  Go to Founder Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Hero */}
      <div
        className="relative border-b py-8 sm:py-14 overflow-hidden"
        style={{ background: "var(--bg-onboard-hero)", borderColor: "var(--border-1)" }}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-8"
          style={{ background: "#4f46e5" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4"
            style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(79,70,229,0.35)", backdropFilter: "blur(4px)" }}>
            <Zap className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} />
            <span className="text-[10px] sm:text-xs font-bold tracking-wide" style={{ color: "#3730a3" }}>
              ZERO BROKERAGE PLATFORM
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-3">
            Get Your Startup in Front of{" "}
            <span style={{ color: "#4f46e5" }} className="glow-text">Real Investors</span>
          </h1>
          <p className="text-slate-800 text-sm sm:text-lg mb-5 max-w-2xl mx-auto font-medium">
            IdeaVault is the premier zero-brokerage startup directory. Flat fee. Direct contact.
            No middlemen, no commissions, no catch.
          </p>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-slate-700 font-medium">
            {[
              { icon: Shield, text: "Manual document verification" },
              { icon: Zap, text: "Listed within 48 hours" },
              { icon: UserCheck, text: "Verified Investor Network" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Single Interactive Sparkling "Why List with Us?" Dropdown Banner ───── */}
      <div className="max-w-3xl mx-auto w-full mb-6 sm:mb-12 mt-4 sm:mt-8 px-4">
        {/* Clickable Header */}
        <div
          onClick={() => setIsWhyUsOpen((prev) => !prev)}
          className={`bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl p-4 sm:p-5 cursor-pointer flex justify-between items-center transition-all shadow-sm ${
            isWhyUsOpen ? "rounded-b-none border-b-indigo-100" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-2 w-full">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 animate-pulse shrink-0" />
            <span className="text-base sm:text-xl font-bold text-indigo-800 animate-pulse tracking-tight">
              ✨ Why List with Us? ✨
            </span>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 animate-pulse shrink-0" />
          </div>
          <div className="p-1 rounded-lg bg-indigo-100/70 text-indigo-700 shrink-0">
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-300 ${
                isWhyUsOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </div>
        </div>

        {/* Expanded Details Content */}
        {isWhyUsOpen && (
          <div className="bg-white border border-slate-200 rounded-b-xl p-6 mt-[-10px] shadow-md animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Benefit 1 */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">
                    Zero Brokerage & Direct Access
                  </h4>
                  <p className="text-slate-600 text-sm">
                    0% equity, 0% commission. Direct line to verified investors.
                  </p>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">
                    Attract Top Talent
                  </h4>
                  <p className="text-slate-600 text-sm">
                    Connect with university students, developers, and future interns.
                  </p>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">
                    Micro-Angels & Crowdfunding
                  </h4>
                  <p className="text-slate-600 text-sm">
                    Grassroots funding from tech enthusiasts and early backers.
                  </p>
                </div>
              </div>

              {/* Benefit 4 */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">
                    Early Adopters & B2B
                  </h4>
                  <p className="text-slate-600 text-sm">
                    Find beta testers and strategic partnerships with other founders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Choose Your Listing Plan
          </h2>
          <p className="text-slate-600">
            One-time payment. No subscriptions. No surprises.
          </p>
        </div>

        {/* ── Geo-Pricing Indicator Banner ──────────────────────────────────── */}
        <div
          className="flex items-center justify-center mb-8 transition-all duration-700"
          style={{
            opacity: geoStatus === "loading" ? 0 : 1,
            transform: geoStatus === "loading" ? "translateY(-6px)" : "translateY(0)",
          }}
        >
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              background:
                geoStatus === "india"
                  ? "rgba(79,70,229,0.08)"
                  : "rgba(148,163,184,0.08)",
              border:
                geoStatus === "india"
                  ? "1px solid rgba(79,70,229,0.25)"
                  : "1px solid rgba(148,163,184,0.2)",
              color: geoStatus === "india" ? "#4f46e5" : "#94a3b8",
            }}
          >
            {geoStatus === "loading" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Detecting your location…</span>
              </>
            ) : geoStatus === "india" ? (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  🇮🇳 Pricing localized for India (INR)
                  {geoData?.country ? ` · Detected: ${geoData.country}` : ""}
                </span>
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ background: "rgba(79,70,229,0.15)", color: "#4f46e5" }}
                >
                  Local Rates
                </span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>
                  🌐 Global pricing applied (USD)
                  {geoData?.country ? ` · Detected: ${geoData.country}` : " · Location unavailable — showing default"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Maintenance Mode Banner — shown only on this page when submissions are paused */}
        {isMaintenanceMode && (
          <div className="mb-8 flex items-start gap-4 p-5 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm animate-in fade-in duration-300">
            <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-lg">
              🚧
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 mb-0.5">Submissions Temporarily Paused</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                Startup submissions are temporarily paused for scheduled system maintenance. Browsing the directory is unaffected. Please check back shortly.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-20">
          {PLANS.map((plan) => {
            const priceKey = PLAN_PRICE_KEY[plan.id];
            const priceEntry = activePricing[priceKey];
            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan}
                onSelect={setSelectedPlan}
                displayPrice={priceEntry?.display ?? "—"}
                currencySymbol={activePricing.symbol}
                period={activePricing.period}
                geoStatus={geoStatus}
                isDisabled={isMaintenanceMode}
              />
            );
          })}
        </div>

        {checkingSubmission ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : hasSubmitted ? (
          /* Full-screen backdrop modal — fixed so it always centers regardless of scroll position */
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 sm:p-10 text-center shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col items-center gap-5 sm:gap-6 animate-in zoom-in-95 duration-200 my-auto">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 mb-2">You have already submitted a startup!</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Your startup directory listing is currently active or under review. You can track performance metrics, manage verification documents, and view investor inquiries on your dashboard.
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                Go to Dashboard
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Pre-Registration Query Box */}
            <PreRegistrationQueryForm />

            {/* Submission Form — only rendered when user is logged in */}
            <div className="max-w-3xl mx-auto">

          {/* Not logged in — show a clean gate card instead of the full form */}
          {!isLoggedIn ? (
            <div className="flex justify-center px-2 py-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center border border-gray-200 animate-in fade-in-50 zoom-in-95 duration-200">
                {/* Icon */}
                <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <Lock className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                  A Verified Account is Required to Continue
                </h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  List your startup with IdeaVault. Register now to fill out the form and have our team review your application manually, or log in to your existing account.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={onOpenSignup}
                    className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-indigo-600/15 cursor-pointer"
                  >
                    Register for an Account
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-gray-200 font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Log In
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
          <div className="text-center mb-6 sm:mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Submit Your Startup
            </h2>
            <p className="text-slate-500 text-sm">
              Fill out the form below. Our team reviews every application manually.
            </p>
          </div>

          <div className="relative">
            <form
              onSubmit={handleSubmit}
              className={`bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all duration-300 ${validated ? 'was-validated' : ''}`}
              noValidate
            >
            {/* Selected Plan Indicator */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Selected: {PLANS.find((p) => p.id === selectedPlan)?.name} Plan — {activePricing.symbol}
                  {selectedPricing?.display ?? PLANS.find((p) => p.id === selectedPlan)?.price}
                </p>
                <p className="text-xs text-slate-500">
                  You can change this above before submitting
                </p>
              </div>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Company Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="e.g. FinFlux AI"
                    className="form-input pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Founder Name *
                </label>
                <input
                  name="founderName"
                  value={formData.founderName}
                  onChange={handleInputChange}
                  placeholder="Your full name"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email Address *
                </label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="founder@company.com"
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Website / LinkedIn *
                </label>
                <input
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://yourcompany.com"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Pitch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                One-Line Pitch *
              </label>
              <input
                name="pitch"
                value={formData.pitch}
                onChange={handleInputChange}
                placeholder="e.g. AI-powered cash flow forecasting for Indian SMEs"
                className="form-input"
                required
                maxLength={120}
              />
              <p className="text-xs text-slate-500 mt-1">{formData.pitch.length}/120 characters</p>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Industry *
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="form-input cursor-pointer"
                  required
                >
                  <option value="">Select...</option>
                  {['AI/ML', 'SaaS', 'EdTech', 'FinTech', 'Healthcare'].map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Stage *
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleInputChange}
                  className="form-input cursor-pointer"
                  required
                >
                  <option value="">Select...</option>
                  {['Idea', 'Prototype', 'MVP', 'Growth', 'Scale'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Minimum Investment *
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="fundingAsk"
                    value={formData.fundingAsk}
                    onChange={handleInputChange}
                    placeholder="e.g. ₹2,00,000"
                    className="form-input pl-9"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 4: New Fields (Location, Team Size) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Location (City, Country) *
                </label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Bangalore, India"
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Team Size *
                </label>
                <input
                  name="teamSize"
                  type="number"
                  min="1"
                  value={formData.teamSize}
                  onChange={handleInputChange}
                  placeholder="e.g. 5"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Row 5: New Fields (Traction, Tags) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Traction / Users *
                </label>
                <input
                  name="traction"
                  value={formData.traction}
                  onChange={handleInputChange}
                  placeholder="e.g. 8,400+ learners, $12k MRR"
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Category / Tags *
                </label>
                <input
                  name="tagsString"
                  value={formData.tagsString}
                  onChange={handleInputChange}
                  placeholder="e.g. EdTech, SaaS, AI (comma separated)"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Contact Details Section */}
            <div className="border border-gray-200 rounded-xl p-5 bg-slate-50 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contact Channels</h3>
                <p className="text-xs text-indigo-600 font-semibold mt-1">At least one contact method is required</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Public Contact Email</label>
                  <input
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleInputChange}
                    placeholder="contact@company.com"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Phone Number</label>
                  <input
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="form-input"
                  />
                </div>
              </div>

              {/* Dynamic Channels */}
              {formData.additionalContacts && formData.additionalContacts.map((contact, index) => (
                <div key={index} className="flex items-center gap-3 animate-in fade-in duration-100">
                  <select
                    value={contact.label}
                    onChange={(e) => handleAdditionalContactChange(index, "label", e.target.value)}
                    className="form-input max-w-[120px]"
                    style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }}
                  >
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Twitter">Twitter</option>
                    <option value="GitHub">GitHub</option>
                    <option value="Pitch Deck">Pitch Deck</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    value={contact.value}
                    onChange={(e) => handleAdditionalContactChange(index, "value", e.target.value)}
                    placeholder="URL or handle"
                    className="form-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAdditionalContact(index)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addAdditionalContact}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                + Add More Channels
              </button>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Company Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your product, target market, traction, and why investors should connect with you..."
                className="form-input h-28 resize-none"
                rows={4}
                required
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Upload Documents (Pitch Deck / Incorporation Docs / GST Certificate)
              </label>
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer"
                style={{
                  borderColor: dragOver ? "#4f46e5" : "#e2e8f0",
                  background: dragOver ? "rgba(79,70,229,0.04)" : "#f8fafc",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload").click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: dragOver ? "#4f46e5" : "#94a3b8" }} />
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Drop files here or{" "}
                  <span style={{ color: "#4f46e5" }}>browse</span>
                </p>
                <p className="text-xs text-slate-500">PDF, DOCX, PPT up to 20MB each</p>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-gray-200"
                    >
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-800 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API error banner */}
            {submitError && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
                style={{
                  background: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#b91c1c",
                }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isMaintenanceMode}
                className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2"
                style={{
                  opacity: (isSubmitting || isMaintenanceMode) ? 0.55 : 1,
                  cursor: (isSubmitting || isMaintenanceMode) ? "not-allowed" : "pointer"
                }}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
                ) : isMaintenanceMode ? (
                  <>🔒 Submissions Paused</>
                ) : (
                  <>Submit Application <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
              <p className="text-xs text-slate-500 text-center">
                By submitting, you agree to our{" "}
                <span className="underline cursor-pointer hover:text-slate-700 transition-colors">Terms of Service</span>{" "}
                and{" "}
                <span className="underline cursor-pointer hover:text-slate-700 transition-colors">Privacy Policy</span>.
              </p>
            </div>
          </form>
          </div>
            </>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
