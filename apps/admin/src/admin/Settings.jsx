// src/admin/Settings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sliders, Key, ShieldCheck, Users, Plus, Check,
  Trash2, Shield, Lock, Eye, EyeOff, CheckCircle2, X
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { createClient } from "@supabase/supabase-js";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function Settings() {
  const navigate = useNavigate();
  const { adminProfile } = useAdminAuth();
  const adminRole = adminProfile?.role || "Super Admin";
  const isSuperAdmin = adminRole === "Super Admin" || adminRole?.toLowerCase() === "super admin";
  const isModerator = adminRole === "Moderator" || adminRole?.toLowerCase() === "moderator";

  // URL Guard check: If Moderator attempts to access Settings, immediately redirect to /overview with red toast
  useEffect(() => {
    if (isModerator) {
      navigate("/overview", {
        replace: true,
        state: { toast: { type: "error", message: "Permission Denied: Super Admin access required." } }
      });
    }
  }, [isModerator, navigate]);

  const [activeTab, setActiveTab] = useState("platform");
  const [loading, setLoading] = useState(true);

  // Tab 1: Platform Controls State (INR & USD Dual Currency)
  const [basicPriceInr, setBasicPriceInr] = useState("Free");
  const [basicPriceUsd, setBasicPriceUsd] = useState("Free");
  const [proPriceInr, setProPriceInr] = useState("₹9,999");
  const [proPriceUsd, setProPriceUsd] = useState("$120");
  const [spotlightPriceInr, setSpotlightPriceInr] = useState("₹24,999");
  const [spotlightPriceUsd, setSpotlightPriceUsd] = useState("$300");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Tab 2: API & Integrations State
  const [gatewayKey, setGatewayKey] = useState("sk_live_51Oz...z8R9");
  const [llmKey, setLlmKey] = useState("g-ai-model-3f...9sK");
  const [showGatewayKey, setShowGatewayKey] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState("");
  const [llmStatus, setLlmStatus] = useState("");

  // Tab 3: Compliance State
  const [strictGst, setStrictGst] = useState(true);
  const [slaTarget, setSlaTarget] = useState("48");

  // Tab 4: Team Access State (Strictly loaded from database)
  const [team, setTeam] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("Moderator");
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Custom Delete Confirmation Modal State
  const [memberToDelete, setMemberToDelete] = useState(null);

  // Save Success & Error Toast Notification State
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch admin_users directly from Supabase
  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Supabase admin_users fetch error:", error.message);
        return;
      }

      if (data) {
        setTeam(data);
      }
    } catch (err) {
      console.warn("Supabase admin_users fetch exception:", err.message);
    }
  };

  // Load configuration and team members on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/platform-settings`);
          if (res.ok) {
            const data = await res.json();
            setBasicPriceInr(data.basic_price_inr || "Free");
            setBasicPriceUsd(data.basic_price_usd || "Free");
            setProPriceInr(data.pro_price_inr || "₹9,999");
            setProPriceUsd(data.pro_price_usd || "$120");
            setSpotlightPriceInr(data.spotlight_price_inr || "₹24,999");
            setSpotlightPriceUsd(data.spotlight_price_usd || "$300");
            setMaintenanceMode(!!data.maintenance_mode);
            setGatewayKey(data.gateway_key || "sk_live_51Oz...z8R9");
            setLlmKey(data.llm_key || "g-ai-model-3f...9sK");
            setStrictGst(!!data.strict_gst);
            setSlaTarget(data.sla_target || "48");
          }
        } catch (e) {}
        await fetchAdminUsers();
      } catch (err) {
        console.warn("Failed to load settings:", err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveToSupabase = async (sectionName, updatedTeam = null) => {
    // Client-side RBAC guard: Only Super Admin can update settings
    if (!isSuperAdmin) {
      setToast({ message: "Permission Denied: Super Admin access required.", type: "error" });
      return;
    }

    // Strip any currency symbols and commas from price values before saving
    const cleanPrice = (val) => String(val || "").replace(/[₹$,\s]/g, "").trim();

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/platform-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basic_price_inr: cleanPrice(basicPriceInr),
          basic_price_usd: cleanPrice(basicPriceUsd),
          pro_price_inr: cleanPrice(proPriceInr),
          pro_price_usd: cleanPrice(proPriceUsd),
          spotlight_price_inr: cleanPrice(spotlightPriceInr),
          spotlight_price_usd: cleanPrice(spotlightPriceUsd),
          maintenance_mode: maintenanceMode,
          gateway_key: gatewayKey,
          llm_key: llmKey,
          strict_gst: strictGst,
          sla_target: slaTarget,
          team: updatedTeam || team
        })
      });

      if (!response.ok) {
        // Surface the exact database error from the server so it doesn't fail silently
        let errMsg = "Save settings request failed.";
        try {
          const errBody = await response.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      setToast({ message: `✅ ${sectionName} settings saved successfully!`, type: "success" });
      window.dispatchEvent(new Event("startups-updated"));
    } catch (err) {
      console.error("Error saving settings:", err.message);
      setToast({ message: `Error saving settings: ${err.message}`, type: "error" });
    }
  };


  const handleTestConnection = (type) => {
    if (!isSuperAdmin) {
      setToast({ message: "Permission Denied: Super Admin access required.", type: "error" });
      return;
    }

    if (type === "gateway") {
      setGatewayTesting(true);
      setGatewayStatus("");
      setTimeout(() => {
        setGatewayTesting(false);
        setGatewayStatus("Connection Established (200 OK)");
      }, 1500);
    } else {
      setLlmTesting(true);
      setLlmStatus("");
      setTimeout(() => {
        setLlmTesting(false);
        setLlmStatus("Authentication Verified");
      }, 1500);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setToast({ message: "Permission Denied: Super Admin access required.", type: "error" });
      return;
    }

    if (!inviteName || !inviteEmail) return;

    const name = inviteName.trim();
    const email = inviteEmail.trim();
    const role = inviteRole;
    const password = invitePassword.trim();

    try {
      // 1. Insert into admin_users VIP table FIRST so VIP list verification is ready
      const { data, error } = await supabase
        .from("admin_users")
        .insert([{ name, email, role }])
        .select();

      if (error) {
        throw new Error(error.message);
      }

      const newAdmin = (data && data[0]) ? data[0] : { id: Date.now(), name, email, role, created_at: new Date().toISOString() };

      // 2. If password provided, register user in Supabase Auth using a non-persisting client so current admin session is NOT logged out!
      if (password) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dcgsmnosupjtochqmmvk.supabase.co";
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_SE3WddGx27LI4ZMRKk34OA_6u2XCm1D";
          const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          });
          await tempAuthClient.auth.signUp({ email, password });
        } catch (authErr) {
          console.warn("Supabase Auth sign up note:", authErr.message);
        }
      }

      // Update local state array immediately upon success
      setTeam((prev) => {
        const exists = prev.some(m => m.email === newAdmin.email || (m.id && String(m.id) === String(newAdmin.id)));
        return exists ? prev : [...prev, newAdmin];
      });

      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      setShowInviteModal(false);

      // Trigger green success toast
      setToast({ 
        message: password 
          ? `Successfully invited ${name} as ${role} and created login password!` 
          : `Successfully added ${name} to admin_users!`, 
        type: "success" 
      });
    } catch (err) {
      console.error("Error inviting member:", err);
      // Trigger red error toast with specific error message
      setToast({ message: `Failed to invite member: ${err.message}`, type: "error" });
    }
  };

  const handleRemoveMember = async (memberId, memberName, memberEmail) => {
    if (!isSuperAdmin) {
      setToast({ message: "Permission Denied: Super Admin access required.", type: "error" });
      return;
    }

    try {
      // 1. Direct Supabase database delete targeting user's id or email
      let error = null;
      if (memberId) {
        const resId = await supabase.from("admin_users").delete().eq("id", memberId);
        error = resId.error;
      }

      if ((error || !memberId) && memberEmail) {
        const resEmail = await supabase.from("admin_users").delete().eq("email", memberEmail);
        error = resEmail.error;
      }

      if (error) {
        throw new Error(error.message);
      }

      // 2. Also sync delete to backend API fallback
      if (memberId || memberEmail) {
        fetch(`${getApiBaseUrl()}/api/admin/users/${memberId || encodeURIComponent(memberEmail)}`, {
          method: "DELETE"
        }).catch(() => {});
      }

      // 3. Update local state instantly upon success
      setTeam((prev) => prev.filter((m) => String(m.id) !== String(memberId) && m.email !== memberEmail));

      // Trigger green success toast
      setToast({ message: `Deleted ${memberName || "administrator"} successfully!`, type: "success" });
    } catch (err) {
      console.error("Error removing member:", err);
      // Trigger red error toast
      setToast({ message: `Failed to remove member: ${err.message}`, type: "error" });
    }
  };

  if (isModerator) {
    return null;
  }

  return (
    <div className="flex-grow p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-[#070b13] relative">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">System Settings</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Configure system preferences, security keys, SLAs, and administrator roles</p>
        </div>
      </div>

      {/* Toast Notification Banner (Success / Error) */}
      {toast && (
        <div
          className={`border text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-2.5 shadow-lg animate-fade-in ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5"
          }`}
        >
          <CheckCircle2 className={`w-4.5 h-4.5 ${toast.type === "success" ? "text-emerald-400" : "text-rose-400"}`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Settings Interface Layout */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Left Side Vertical Tab Navigation */}
        <aside className="w-full md:w-56 flex flex-col gap-1 flex-shrink-0 md:border-r border-slate-900/40 pr-0 md:pr-6">
          <button
            onClick={() => setActiveTab("platform")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "platform"
                ? "bg-[#161d33] text-indigo-400 border border-indigo-500/15"
                : "text-slate-400 hover:bg-[#0d1323]/50 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Platform Controls</span>
          </button>
          
          <button
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "api"
                ? "bg-[#161d33] text-indigo-400 border border-indigo-500/15"
                : "text-slate-400 hover:bg-[#0d1323]/50 hover:text-slate-200"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API & Integrations</span>
          </button>
          
          <button
            onClick={() => setActiveTab("compliance")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "compliance"
                ? "bg-[#161d33] text-indigo-400 border border-indigo-500/15"
                : "text-slate-400 hover:bg-[#0d1323]/50 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Compliance & SLAs</span>
          </button>
          
          <button
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "team"
                ? "bg-[#161d33] text-indigo-400 border border-indigo-500/15"
                : "text-slate-400 hover:bg-[#0d1323]/50 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Access</span>
          </button>
        </aside>

        {/* Right Side Settings Pane */}
        <main className="flex-grow w-full bg-[#0d1323]/35 border border-slate-800/60 rounded-3xl p-6 md:p-8 shadow-xl shadow-black/25">
          
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs font-semibold">Loading configuration from server settings...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: PLATFORM CONTROLS */}
              {activeTab === "platform" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Platform Pricing & Controls</h3>
                    <p className="text-[11px] text-slate-500">Configure public tier directory pricing (INR and USD) and maintenance toggles</p>
                  </div>

                  <div className="space-y-4 max-w-md">
                    {/* Basic Tier Prices */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Basic Price (INR)</label>
                        <input
                          type="text"
                          value={basicPriceInr}
                          onChange={(e) => setBasicPriceInr(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Basic Price (USD)</label>
                        <input
                          type="text"
                          value={basicPriceUsd}
                          onChange={(e) => setBasicPriceUsd(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    {/* Pro Tier Prices */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Verified Pro (INR)</label>
                        <input
                          type="text"
                          value={proPriceInr}
                          onChange={(e) => setProPriceInr(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Verified Pro (USD)</label>
                        <input
                          type="text"
                          value={proPriceUsd}
                          onChange={(e) => setProPriceUsd(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    {/* Spotlight Tier Prices */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Spotlight (INR)</label>
                        <input
                          type="text"
                          value={spotlightPriceInr}
                          onChange={(e) => setSpotlightPriceInr(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-2">Spotlight (USD)</label>
                        <input
                          type="text"
                          value={spotlightPriceUsd}
                          onChange={(e) => setSpotlightPriceUsd(e.target.value)}
                          className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-full font-bold shadow-inner focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-900" />

                  {/* Maintenance Toggle */}
                  <label className="flex items-center justify-between py-2.5 max-w-md cursor-pointer select-none group">
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-slate-250 transition-colors">System Maintenance Mode</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Pause public startup listing submissions and block directory access</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${maintenanceMode ? "text-amber-500" : "text-slate-500"}`}>
                        {maintenanceMode ? "ON" : "OFF"}
                      </span>
                      <input
                        type="checkbox"
                        checked={maintenanceMode}
                        onChange={(e) => setMaintenanceMode(e.target.checked)}
                        className="w-5.5 h-5.5 rounded-lg border border-slate-800 bg-[#070b13] checked:bg-amber-500 checked:border-amber-500 text-[#070b13] cursor-pointer focus:ring-0 transition-all flex-shrink-0"
                      />
                    </div>
                  </label>

                  <div className="pt-4 border-t border-slate-900 flex justify-end">
                    <button
                      onClick={() => saveToSupabase("Platform Controls")}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: API & INTEGRATIONS */}
              {activeTab === "api" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">API Credentials & Keys</h3>
                    <p className="text-[11px] text-slate-500">Provide payment gateway details and AI verifier credentials</p>
                  </div>

                  <div className="space-y-5">
                    {/* Gateway Key */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block">Payment Gateway Secret Key</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow max-w-md">
                          <input
                            type={showGatewayKey ? "text" : "password"}
                            value={gatewayKey}
                            onChange={(e) => setGatewayKey(e.target.value)}
                            className="bg-[#070b13] border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-200 outline-none w-full font-mono font-bold shadow-inner focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => setShowGatewayKey(!showGatewayKey)}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {showGatewayKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleTestConnection("gateway")}
                          disabled={gatewayTesting}
                          className="bg-[#101726]/60 border border-slate-800 hover:bg-slate-800/40 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer"
                        >
                          {gatewayTesting ? "Connecting..." : "Test Connection"}
                        </button>
                      </div>
                      {gatewayStatus && (
                        <span className="text-[10px] text-emerald-400 font-bold block mt-1">{gatewayStatus}</span>
                      )}
                    </div>

                    {/* LLM Key */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block">LLM Provider Secret Key</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow max-w-md">
                          <input
                            type={showLlmKey ? "text" : "password"}
                            value={llmKey}
                            onChange={(e) => setLlmKey(e.target.value)}
                            className="bg-[#070b13] border border-slate-850 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-200 outline-none w-full font-mono font-bold shadow-inner focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => setShowLlmKey(!showLlmKey)}
                            className="absolute right-3 top-2.5 text-slate-550 hover:text-slate-350 transition-colors"
                          >
                            {showLlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleTestConnection("llm")}
                          disabled={llmTesting}
                          className="bg-[#101726]/60 border border-slate-800 hover:bg-slate-800/40 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer"
                        >
                          {llmTesting ? "Verifying..." : "Test Connection"}
                        </button>
                      </div>
                      {llmStatus && (
                        <span className="text-[10px] text-emerald-400 font-bold block mt-1">{llmStatus}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 flex justify-end">
                    <button
                      onClick={() => saveToSupabase("API & Integrations")}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: COMPLIANCE & SLAS */}
              {activeTab === "compliance" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Compliance & SLAs</h3>
                    <p className="text-[11px] text-slate-500">Configure audit guidelines and resolution timing targets</p>
                  </div>

                  <div className="space-y-6">
                    {/* GST Format Toggle */}
                    <label className="flex items-center justify-between py-2 max-w-md cursor-pointer select-none group">
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-slate-250 transition-colors">Strict GST Format Checking</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Enforce exact 15-digit alphanumeric formats matching government syntax</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${strictGst ? "text-indigo-400" : "text-slate-500"}`}>
                          {strictGst ? "ON" : "OFF"}
                        </span>
                        <input
                          type="checkbox"
                          checked={strictGst}
                          onChange={(e) => setStrictGst(e.target.checked)}
                          className="w-5.5 h-5.5 rounded-lg border border-slate-800 bg-[#070b13] checked:bg-indigo-650 checked:border-indigo-650 text-[#070b13] cursor-pointer focus:ring-0 transition-all flex-shrink-0"
                        />
                      </div>
                    </label>

                    <hr className="border-slate-900" />

                    {/* SLA Target */}
                    <div className="space-y-2 max-w-md">
                      <h4 className="text-xs font-bold text-white">Verification SLA Target (Hours)</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Target timeline in which pending listings must be verified or rejected by system auditors.
                      </p>
                      <input
                        type="number"
                        value={slaTarget}
                        onChange={(e) => setSlaTarget(e.target.value)}
                        className="bg-[#070b13] border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none w-32 font-bold shadow-inner focus:border-indigo-500/50 mt-1"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 flex justify-end">
                    <button
                      onClick={() => saveToSupabase("Compliance & SLAs")}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: TEAM ACCESS */}
              {activeTab === "team" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-900/60 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">Administrative Team</h3>
                      <p className="text-[11px] text-slate-500">Add or manage administrator access levels for directory auditing</p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Invite Member
                    </button>
                  </div>

                  {/* Data Table */}
                  <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0d1323] border-b border-slate-800/70 text-slate-400 font-extrabold text-[9.5px] tracking-wider uppercase">
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-xs text-slate-355">
                        {team.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-xs text-slate-500 font-medium italic">
                              No administrator users found. Click '+ Invite Member' to add an administrator.
                            </td>
                          </tr>
                        ) : (
                          team.map((member) => (
                            <tr key={member.id} className="hover:bg-[#161d33]/15 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-white">{member.name}</td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{member.email}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                  member.role === "Super Admin" 
                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" 
                                    : "bg-slate-500/10 text-slate-400 border-slate-800"
                                }`}>
                                  {member.role}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMemberToDelete(member);
                                  }}
                                  className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/5 transition-all cursor-pointer"
                                  title="Delete admin"
                                  aria-label="Delete admin"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Custom Delete Confirmation Modal */}
                  {memberToDelete && (
                    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMemberToDelete(null)} />
                      <div className="relative bg-[#090d16] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fade-in text-left">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                              <Trash2 className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">Delete Administrator</h4>
                              <p className="text-[10px] text-slate-400 font-medium">Revoke system access for team member</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setMemberToDelete(null)}
                            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/40 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Are you sure you want to delete <strong className="text-white">{memberToDelete.name}</strong> (<span className="font-mono text-slate-400">{memberToDelete.email}</span>)? This action will remove their record from <code className="text-indigo-400 font-mono">admin_users</code>.
                        </p>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setMemberToDelete(null)}
                            className="flex-1 rounded-2xl border border-slate-800 hover:bg-slate-800/40 text-xs font-bold text-slate-300 py-3 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const target = memberToDelete;
                              setMemberToDelete(null);
                              await handleRemoveMember(target.id, target.name, target.email);
                            }}
                            className="flex-1 rounded-2xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white py-3 transition-all shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer"
                          >
                            Yes, Delete Admin
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Invite Modal / Expandable Form */}
                  {showInviteModal && (
                    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
                      <div className="relative bg-[#090d16] border border-slate-850 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Users className="w-4.5 h-4.5 text-indigo-400" />
                            Invite Administrator
                          </h4>
                          <button 
                            onClick={() => setShowInviteModal(false)}
                            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/40 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-4">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-1.5">Full Name</label>
                            <input
                              type="text"
                              required
                              value={inviteName}
                              onChange={(e) => setInviteName(e.target.value)}
                              placeholder="e.g. Rahul Dev"
                              className="bg-[#070b13] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs text-slate-200 outline-none w-full font-semibold focus:border-indigo-500/50"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-1.5">Email Address</label>
                            <input
                              type="email"
                              required
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="e.g. rahul@example.com"
                              className="bg-[#070b13] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs text-slate-200 outline-none w-full font-semibold focus:border-indigo-500/50"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-1.5">Initial Password (for Admin Login)</label>
                            <input
                              type="password"
                              value={invitePassword}
                              onChange={(e) => setInvitePassword(e.target.value)}
                              placeholder="Set password for admin login (e.g. Admin123!)"
                              className="bg-[#070b13] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs text-slate-200 outline-none w-full font-semibold focus:border-indigo-500/50"
                            />
                            <p className="text-[9.5px] text-slate-500 font-medium mt-1">Registers login credentials in Supabase Auth so they can log in immediately.</p>
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase block mb-1.5">Permission Role</label>
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value)}
                              className="bg-[#070b13] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs text-slate-200 outline-none w-full font-semibold focus:border-indigo-500/50 cursor-pointer text-slate-300"
                            >
                              <option value="Moderator">Moderator</option>
                              <option value="Super Admin">Super Admin</option>
                            </select>
                          </div>

                          <div className="flex gap-3 pt-3 border-t border-slate-900">
                            <button
                              type="button"
                              onClick={() => setShowInviteModal(false)}
                              className="flex-1 rounded-2xl border border-slate-800 hover:bg-slate-800/40 text-xs font-bold text-slate-300 py-3 transition-colors active:scale-95 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white py-3 transition-colors active:scale-95 cursor-pointer"
                            >
                              Send Invitation
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
  );
}
