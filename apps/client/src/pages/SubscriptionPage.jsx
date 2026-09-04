// src/pages/SubscriptionPage.jsx
// Razorpay Checkout (Test Mode) for paid tiers + QR PaymentModal for Basic plan.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Check, Clock, Zap, Loader2,
  CheckCircle2, XCircle, AlertTriangle, X, Brain, Star
} from "lucide-react";
import { useStartupPlan } from "../hooks/useStartupPlan";
import { useRazorpayCheckout } from "../hooks/useRazorpayCheckout";
import { toast } from "../utils/toast";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/apiConfig";

const PLANS = [
  {
    id: "Basic",
    name: "Basic",
    price: "Free",
    features: [
      "Standard Directory Listing",
      "Upload Pitch Deck Document",
      "Search & View Investor Profiles",
      "Basic Analytics (Search Impressions)",
    ],
  },
  {
    id: "Verified Pro",
    name: "Verified Pro",
    price: "₹1,999 / mo",
    features: [
      "Everything in Basic",
      "Verified Blue Verification Badge",
      "Priority Placement in Searches",
      "Detailed Analytics (Profile Views & Clicks)",
      "Direct Investor Connection Messages",
    ],
  },
  {
    id: "Spotlight",
    name: "Spotlight",
    price: "₹4,999 / mo",
    features: [
      "Everything in Verified Pro",
      "Spotlight Featured Carousel Listing",
      "Immediate Email Alerts to Active Investors",
      "1-on-1 Pitch Consulting Session",
      "Unlimited Document Upload Slots",
    ],
  },
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { planType, status, paymentStatus, payment_status, expiryDate, loading: planLoading, invalidate, approvalStatus, approval_status } = useStartupPlan();
  const isActive = status === "active" || paymentStatus === "paid" || payment_status === "paid";

  const [currency, setCurrency] = useState("INR"); // INR or USD
  
  const { handleCheckout, isProcessing: submitting } = useRazorpayCheckout();

  // Live prices from platform settings (dual currency INR and USD)
  const [prices, setPrices] = useState({
    INR: {
      Basic: "Free",
      "Verified Pro": "₹9,999",
      Spotlight: "₹24,999"
    },
    USD: {
      Basic: "Free",
      "Verified Pro": "$120",
      Spotlight: "$300"
    }
  });

  const [localToast, setLocalToast] = useState(null);
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/platform-settings`);
        if (res.ok) {
          const data = await res.json();
          setIsMaintenance(!!data.maintenance_mode);
          setPrices({
            INR: {
              Basic: data?.basic_price_inr || "Free",
              "Verified Pro": data?.pro_price_inr || "₹9,999",
              Spotlight: data?.spotlight_price_inr || "₹24,999"
            },
            USD: {
              Basic: data?.basic_price_usd || "Free",
              "Verified Pro": data?.pro_price_usd || "$120",
              Spotlight: data?.spotlight_price_usd || "$300"
            }
          });
        }
      } catch (err) {
        console.warn("Error loading dynamic settings prices:", err);
      }
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrency("USD");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (!res.ok) throw new Error("Failed reverse geocode fetch");

          const data = await res.json();
          const countryCode = data.countryCode;

          if (countryCode === "IN") {
            setCurrency("INR");
          } else {
            setCurrency("USD");
          }
        } catch {
          setCurrency("USD");
        }
      },
      () => {
        setCurrency("USD");
      }
    );
  }, []);

  const getDaysLeft = (expiry) => {
    if (!expiry) return 0;
    const diff = new Date(expiry) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getDaysLeft(expiryDate);
  const [isFinalPayment, setIsFinalPayment] = useState(false);

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => setLocalToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);

  if (planLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-indigo-600">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm font-semibold text-slate-600">Loading subscription details...</span>
        </div>
      </div>
    );
  }

  return (
    <>

      <div className="min-h-screen pt-24 pb-16 bg-slate-50 text-slate-900">
        <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-10">

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-slate-900">Subscription & Pricing</h1>
          </div>

          {/* Current Plan Overview */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Current Plan Overview</h2>
              <p className="text-xs text-slate-500 mt-1">
                Live data pulled directly from your database row.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Active Tier */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Tier</span>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="text-lg font-extrabold text-slate-900">{planType}</span>
                </div>
              </div>

              {/* Visibility Status */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Visibility Status</span>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold uppercase border ${
                      isActive
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                        Active (Live)
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                        Pending Payment
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Days Remaining */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Visibility Remaining</span>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold">
                    {isActive
                      ? (daysLeft > 0 ? `${daysLeft} Days Left` : "Active Subscription")
                      : "Timer starts upon payment"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Table */}
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Listing Visibility Tiers
              </h2>
              <p className="text-sm text-slate-500 max-w-lg mx-auto">
                Upgrade your membership to get featured slots, verified badges, and priority investor connections.
              </p>
              {/* Simulation badge */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Zap className="w-3 h-3" />
                  Razorpay Secure Checkout
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                  <Brain className="w-3 h-3" />
                  AI Vault Score Included
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => {
                const isCurrent = planType === plan.id;
                const isSpotlight = plan.id === "Spotlight";
                const isVerified = plan.id === "Verified Pro";

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl p-6 border flex flex-col justify-between shadow-sm transition-all duration-300 hover:scale-[1.01] ${
                      isCurrent
                        ? "bg-white border-indigo-400 ring-1 ring-indigo-400/20 shadow-indigo-100"
                        : isSpotlight
                        ? "bg-amber-50 border-amber-300 hover:border-amber-400"
                        : isVerified
                        ? "bg-indigo-50 border-indigo-200 hover:border-indigo-400"
                        : "bg-white border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {/* Badges */}
                    {isSpotlight && (
                      <span className="absolute -top-3 right-6 px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-lg">
                        ★ Most Popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                        ✓ Current Plan
                      </span>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span
                            className={`text-2xl font-black ${
                              isSpotlight
                                ? "text-amber-600"
                                : isVerified
                                ? "text-indigo-600"
                                : "text-slate-900"
                            }`}
                          >
                            {plan.id === "Basic" ? prices[currency]?.Basic :
                             plan.id === "Verified Pro" ? prices[currency]?.["Verified Pro"] :
                             prices[currency]?.Spotlight}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-2.5 pt-4 border-t border-gray-100">
                        {plan.features.map((f, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                            <Check
                              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                isSpotlight
                                  ? "text-amber-600"
                                  : isVerified
                                  ? "text-indigo-600"
                                  : "text-slate-400"
                              }`}
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    <div className="pt-6 mt-auto space-y-3">
                      {(() => {
                        const isActivePlan = planType === plan.id && isActive;
                        const isApproved = approval_status === "approved" || status === "pending_payment" || status === "approved";
                        const isPendingApproval = (planType === plan.id || plan.id !== "Basic") && (!isApproved && (status === "pending_verification" || status === "pending" || approval_status === "pending"));
                        const isUnlockedForPayment = isApproved && !isActivePlan && plan.id !== "Basic";

                        let btnText = `Request Upgrade to ${plan.name}`;
                        if (isMaintenance) {
                          btnText = "Paused for Maintenance";
                        } else if (isActivePlan) {
                          btnText = "✓ Current Plan";
                        } else if (isPendingApproval) {
                          btnText = "Pending Admin Approval";
                        } else if (isUnlockedForPayment) {
                          btnText = `Pay Now — ${plan.name}`;
                        } else if (plan.id === "Basic") {
                          btnText = "Switch to Basic";
                        }

                        const isDisabled = isActivePlan || (isPendingApproval && !isUnlockedForPayment) || submitting || isMaintenance;

                        return (
                          <>
                            {isPendingApproval && !isApproved && plan.id !== "Basic" && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-1">
                                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Pending Approval
                                </p>
                                <p className="text-[11px] text-slate-600 leading-snug">
                                  Your profile is pending admin approval. You will be able to complete payment once approved.
                                </p>
                              </div>
                            )}

                            <button
                              disabled={isDisabled}
                              onClick={async () => {
                                if (plan.id === "Basic") {
                                  handleCheckout("Basic", () => {
                                    setLocalToast({ message: "Activated Basic plan.", type: "success" });
                                  });
                                  return;
                                }

                                if (isUnlockedForPayment) {
                                  // Razorpay payment button unlocked ONLY when approval_status === 'approved'
                                  handleCheckout(plan.id, () => {
                                    setLocalToast({ message: `Your payment for ${plan.id} was successful!`, type: "success" });
                                  });
                                } else {
                                  // Request approval from admin
                                  const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
                                  if (!session?.userId) return;
                                  try {
                                    const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}/upgrade-request`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ tier: plan.id })
                                    });
                                    if (res.ok) {
                                      invalidate();
                                      setLocalToast({ message: `Upgrade request for ${plan.name} submitted for admin review!`, type: "success" });
                                    }
                                  } catch (e) {
                                    setLocalToast({ message: "Failed to submit upgrade request.", type: "error" });
                                  }
                                }
                              }}
                              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                                isDisabled
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  : isUnlockedForPayment
                                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-[0.98]"
                                  : isSpotlight
                                  ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20 cursor-pointer active:scale-[0.98]"
                                  : isVerified
                                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-[0.98]"
                                  : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer active:scale-[0.98]"
                              }`}
                            >
                              {btnText}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {localToast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-md bg-white/95 border-gray-200 text-slate-900 max-w-sm">
            {localToast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : localToast.type === "error" ? (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div className="flex-1 text-sm font-medium pr-2 text-slate-800">
              {localToast.message}
            </div>
            <button
              onClick={() => setLocalToast(null)}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
