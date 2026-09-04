// src/admin/AllListings.jsx
import React, { useState, useEffect } from "react";
import {
  FileText, ExternalLink, Download, CreditCard, X, CheckCircle,
  Building, User, Mail, ArrowRight, ShieldAlert, Clock, Search, Trash2,
  Brain, Sparkles, TrendingUp, DollarSign, Target, RefreshCw, Star, Zap
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getApiBaseUrl } from "../utils/apiConfig";

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function getDaysRemaining(endDateStr) {
  if (!endDateStr) return 0;
  const end = new Date(endDateStr);
  const now = new Date();
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function AllListings() {
  const { user, adminProfile } = useAdminAuth();
  const adminRole = adminProfile?.role || 'Super Admin';
  const isModerator = adminRole === 'Moderator';
  const currentAdminName = adminProfile?.name || adminProfile?.full_name || adminProfile?.email || user?.user_metadata?.full_name || user?.email || "Admin";

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStartup, setSelectedStartup] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // AI Insights Modal state
  const [aiModal, setAiModal] = useState({ open: false, startup: null, data: null, loading: false, error: null });

  const handleOpenAiInsights = async (item) => {
    setAiModal({ open: true, startup: item, data: null, loading: true, error: null });
    try {
      const identifier = item.user_id || item.userId || item.id;
      const res = await fetch(`${getApiBaseUrl()}/api/startups/${identifier}/ai-insights?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch AI insights.");
      const json = await res.json();
      setAiModal(prev => ({ ...prev, loading: false, data: json.ai_insights || null }));
    } catch (err) {
      setAiModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleRerunAnalysis = async () => {
    if (!aiModal.startup) return;
    const identifier = aiModal.startup.user_id || aiModal.startup.userId || aiModal.startup.id;
    setAiModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      await fetch(`${getApiBaseUrl()}/api/startups/${identifier}/rerun-analysis`, { method: "POST" });
      // Poll after 4 seconds
      setTimeout(async () => {
        const res = await fetch(`${getApiBaseUrl()}/api/startups/${identifier}/ai-insights?t=${Date.now()}`);
        const json = await res.json();
        setAiModal(prev => ({ ...prev, loading: false, data: json.ai_insights || null }));
      }, 4000);
    } catch (err) {
      setAiModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleDeleteDocument = async (docUrl) => {
    // Guard Clause: Prevent Moderator mutation
    if (isModerator) {
      alert("Permission Denied: Super Admin access required.");
      return;
    }

    if (!selectedStartup || !docUrl) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this document? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      // Step A: Client-side Supabase storage delete safeguard
      if (docUrl.includes("/documents/")) {
        const parts = docUrl.split("/documents/");
        if (parts[1]) {
          const storagePath = parts[1].split("?")[0];
          await supabase.storage.from("documents").remove([storagePath]);
          console.log("[admin] Removed file from Supabase storage:", storagePath);
        }
      }

      // Step B: Backend DB reference update
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${selectedStartup.id}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl: docUrl }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete document from database.");
      }

      const resData = await res.json();
      const updatedDocs = resData.documentUrls || (selectedStartup.documents || []).filter((d) => d !== docUrl);

      // Step C: Update local state immediately
      const updatedStartup = {
        ...selectedStartup,
        documents: updatedDocs,
        document_urls: updatedDocs,
        document_url: updatedDocs[0] || "",
        pitch_deck_url: updatedDocs[0] || "",
      };

      setSelectedStartup(updatedStartup);
      setListings((prev) =>
        prev.map((item) => (item.id === selectedStartup.id ? updatedStartup : item))
      );

      alert("Document deleted successfully");
    } catch (err) {
      console.error("[admin] Document deletion error:", err);
      alert("Failed to delete document: " + err.message);
    }
  };

  // Filter States
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [companyQuery, setCompanyQuery] = useState("");
  const [founderQuery, setFounderQuery] = useState("");

  function parseDocList(val) {
    if (Array.isArray(val)) {
      return val.flatMap(item => parseDocList(item)).filter(Boolean);
    }
    if (!val || typeof val !== 'string') return [];
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }

function getCalculatedExpiry(startDateStr) {
  const baseDate = startDateStr ? new Date(startDateStr) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const expiry = new Date(validBase);
  expiry.setDate(expiry.getDate() + 180);
  return expiry.toISOString();
}

  const mapDbStartupToView = (s) => {
    const contactEmail = s.contact_info?.email || s.email || s.contactEmail || '';
    const contactPhone = s.contact_info?.phone || s.phone_number || s.contactPhone || '';
    const additionalContacts = s.additional_contacts || s.contact_info?.additional || [];

    const docList = [
      s.pitch_deck_url,
      s.pitchDeckUrl,
      s.public_document_url,
      s.publicDocumentUrl,
      s.private_document_url,
      s.privateDocumentUrl,
      s.document_url,
      s.documentUrl,
      s.document_urls,
      s.documentUrls,
      s.documents
    ];
    const documents = Array.from(new Set(docList.flatMap(parseDocList).filter(u => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")))));

    const rawCreatedAt = s.created_at || s.createdAt || s.created_date || s.submitted_at || s.date_submitted || s.date || null;
    const isStatusActive = s.status === 'active' || s.status === 'paid' || s.status === 'Live' || s.status === 'approved';
    const rawExpiry = s.subscription_ends_at || s.expiry_date || s.expiryDate || s.subscription_end_date || s.additional_contacts?.expiry_date || s.additional_contacts?.subscription_ends_at || (isStatusActive ? getCalculatedExpiry(rawCreatedAt) : null);
    const endDate = rawExpiry;
    const amountPaid = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "")
      ? `${(s.currency || 'INR').toUpperCase() === 'USD' ? '$' : '₹'}${s.amount_paid}`
      : ((s.plan_type === 'Basic' || !s.plan_type) ? '₹0' : s.plan_type === 'Verified Pro' ? '₹9,999' : '₹24,999');

    const resolvedApprovedBy = s.approved_by || s.approvedBy || (typeof s.additional_contacts === 'object' && s.additional_contacts?.approved_by) || (isStatusActive ? currentAdminName : null);

    return {
      ...s,
      id: s.id,
      name: s.company_name || s.companyName || s.name || 'N/A',
      industry: s.industry || 'N/A',
      founder: s.founder_name || s.founderName || 'N/A',
      email: s.email || 'N/A',
      created_at: rawCreatedAt,
      submissionDate: formatDate(rawCreatedAt),
      startDate: rawCreatedAt,
      endDate: rawExpiry,
      expiry_date: rawExpiry,
      subscription_ends_at: rawExpiry,
      tier: s.plan_type || s.tier || 'Basic',
      status: s.status || 'pending',
      approved_by: resolvedApprovedBy,
      approvedBy: resolvedApprovedBy,
      pitch: s.pitch || 'N/A',
      txnId: 'txn_mock_' + s.id,
      amountPaid,
      documents,
      contactEmail,
      contactPhone,
      additionalContacts
    };
  };

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      let data = [];
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/startups?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {}

      if (!data || data.length === 0) {
        const { data: sbData } = await supabase.from('startups').select('*');
        if (sbData && sbData.length > 0) {
          data = sbData;
        }
      }
      
      const mapped = (data || []).map(mapDbStartupToView);
      setListings(mapped);

      // Keep slide-over selection updated if open
      if (selectedStartup) {
        const updatedSelected = mapped.find(item => item.id === selectedStartup.id);
        if (updatedSelected) {
          setSelectedStartup(updatedSelected);
        }
      }
    } catch (err) {
      console.error("Error fetching listings:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleApproveStatus = async (id) => {
    // Guard Clause: Prevent Moderator mutation
    if (isModerator) {
      alert("Permission Denied: Super Admin access required.");
      return;
    }

    try {
      const startup = listings.find(l => l.id === id);
      const targetPlan = startup?.requested_plan || startup?.tier || 'Verified Pro';

      const expiryDays = 180;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      const expiryIso = expiryDate.toISOString();

      let activeAdminName = currentAdminName;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          activeAdminName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || activeAdminName;
        }
      } catch (authErr) {}

      const existingAC = startup?.additional_contacts || {};
      const updatedAC = {
        ...(Array.isArray(existingAC) ? { links: existingAC } : existingAC),
        tier: targetPlan,
        plan_type: targetPlan,
        approval_status: "approved",
        verification_status: "approved",
        approved_by: activeAdminName,
        expiry_date: expiryIso,
        subscription_ends_at: expiryIso
      };

      const payload = {
        status: "pending_payment",
        approval_status: "approved",
        verification_status: "approved",
        subscription_ends_at: expiryIso,
        expiry_date: expiryIso,
        plan_type: targetPlan,
        requested_plan: null,
        approved_by: activeAdminName,
        additional_contacts: updatedAC
      };

      // 1. Direct Supabase update
      try {
        const { error: sbErr } = await supabase.from('startups').update(payload).eq('id', id);
        if (sbErr && sbErr.message.includes('approved_by')) {
          const safePayload = { ...payload };
          delete safePayload.approved_by;
          await supabase.from('startups').update(safePayload).eq('id', id);
        }
      } catch (sErr) {}

      // 2. Server proxy update
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to approve startup.");

      // 3. Immediate local React state update
      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
      if (selectedStartup && selectedStartup.id === id) {
        setSelectedStartup((prev) => ({ ...prev, ...payload }));
      }

      await fetchListings();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      console.error("Error updating status to active:", err.message);
      alert("Failed to approve startup: " + err.message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    // Guard Clause: Prevent Moderator mutation
    if (isModerator) {
      alert("Permission Denied: Super Admin access required.");
      return;
    }

    try {
      let targetPaymentStatus = "pending";
      if (newStatus === "active" || newStatus === "paid" || newStatus === "Live") {
        targetPaymentStatus = "paid";
      } else if (newStatus === "pending" || newStatus === "Draft") {
        targetPaymentStatus = "pending";
      } else if (newStatus === "pending_verification" || newStatus === "pending_documents" || newStatus === "pending_payment") {
        targetPaymentStatus = "pending";
      } else if (newStatus === "suspended") {
        targetPaymentStatus = "suspended";
      }

      const payload = {
        status: newStatus,
        payment_status: targetPaymentStatus
      };

      if (newStatus === "active" || newStatus === "paid" || newStatus === "Live" || newStatus === "approved") {
        const expiryDays = 180;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        const expiryIso = expiryDate.toISOString();
        payload.subscription_ends_at = expiryIso;
        payload.expiry_date = expiryIso;

        const startup = listings.find(l => l.id === id);
        const targetPlan = startup?.requested_plan || startup?.tier || 'Verified Pro';

        let activeAdminName = currentAdminName;
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            activeAdminName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || activeAdminName;
          }
        } catch (authErr) {}

        const existingAC = startup?.additional_contacts || {};
        const updatedAC = {
          ...(Array.isArray(existingAC) ? { links: existingAC } : existingAC),
          tier: targetPlan,
          plan_type: targetPlan,
          approved_by: activeAdminName,
          expiry_date: expiryIso,
          subscription_ends_at: expiryIso
        };

        payload.plan_type = targetPlan;
        payload.requested_plan = null;
        payload.verification_status = "approved";
        payload.approved_by = activeAdminName;
        payload.additional_contacts = updatedAC;
      }

      // 1. Direct Supabase update
      try {
        const { error: sbErr } = await supabase
          .from('startups')
          .update(payload)
          .eq('id', id);
        if (sbErr && sbErr.message.includes('approved_by')) {
          const safePayload = { ...payload };
          delete safePayload.approved_by;
          await supabase.from('startups').update(safePayload).eq('id', id);
        } else if (sbErr) {
          console.warn("[admin] Direct Supabase update warning:", sbErr.message);
        }
      } catch (sErr) {}

      // 2. Backend server update
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to change startup status.");

      // 3. Immediate local React state update
      setListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
      if (selectedStartup && selectedStartup.id === id) {
        setSelectedStartup((prev) => ({ ...prev, ...payload }));
      }

      await fetchListings();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      console.error("Error changing status:", err.message);
      alert("Failed to change status: " + err.message);
    }
  };

  const handleTierChange = async (id, newTier) => {
    // Guard Clause: Prevent Moderator mutation
    if (isModerator) {
      alert("Permission Denied: Super Admin access required.");
      return;
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${id}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: newTier })
      });
      if (!res.ok) throw new Error("Failed to change startup plan.");
      await fetchListings();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      console.error("Error changing plan type:", err.message);
      alert("Failed to override plan type: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    // Guard Clause: Prevent Moderator mutation
    if (isModerator) {
      alert("Permission Denied: Super Admin access required.");
      return;
    }

    if (!window.confirm("Are you sure you want to permanently delete this startup listing? This action cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete startup.");
      await fetchListings();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      console.error("Error deleting startup:", err.message);
      alert("Failed to delete startup listing: " + err.message);
    }
  };

  const openSlideOver = async (startup) => {
    setSelectedStartup(startup);
    setIsSlideOverOpen(true);
    if (!startup) return;

    try {
      const identifier = startup.user_id || startup.userId || startup.id;
      let freshData = null;

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/startups/${identifier}?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        });
        if (res.ok) {
          const json = await res.json();
          freshData = json.startup || json;
        }
      } catch (fErr) {}

      if (!freshData && startup.id) {
        const { data } = await supabase
          .from('startups')
          .select('*')
          .eq('id', startup.id)
          .maybeSingle();
        freshData = data;
      }

      if (freshData) {
        const mappedFresh = mapDbStartupToView(freshData);
        const mergedApprovedBy = mappedFresh.approved_by || mappedFresh.approvedBy || startup.approved_by || startup.approvedBy || null;
        const mergedExpiry = mappedFresh.endDate || mappedFresh.expiry_date || startup.endDate || startup.expiry_date || null;
        setSelectedStartup({
          ...startup,
          ...mappedFresh,
          approved_by: mergedApprovedBy,
          approvedBy: mergedApprovedBy,
          endDate: mergedExpiry,
          expiry_date: mergedExpiry,
          subscription_ends_at: mergedExpiry
        });
      }
    } catch (err) {
      console.error("[AllListings] Fresh fetch on details open error:", err);
    }
  };

  const closeSlideOver = () => {
    setIsSlideOverOpen(false);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "active":
      case "Live":
      case "paid":
        return "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20";
      case "pending":
      case "Draft":
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
      case "pending_verification":
        return "bg-amber-500/10 text-amber-450 border border-amber-500/25";
      case "pending_documents":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25";
      case "pending_payment":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25";
      case "suspended":
      case "Suspended":
        return "bg-rose-500/10 text-rose-455 border border-rose-500/25";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-800";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "active":
      case "Live":
      case "paid":
        return "Paid / Active";
      case "pending":
      case "Draft":
        return "Pending / Draft";
      case "pending_verification":
        return "Pending Verification";
      case "pending_documents":
        return "Awaiting Documents";
      case "pending_payment":
        return "Awaiting Payment";
      case "suspended":
      case "Suspended":
        return "Suspended";
      default:
        return status || "Pending";
    }
  };

  const getTierStyle = (tier) => {
    switch (tier) {
      case "Spotlight":
        return "text-indigo-400 border border-indigo-500/25 bg-indigo-500/5";
      case "Verified Pro":
        return "text-violet-400 border border-violet-500/20 bg-violet-500/5";
      default:
        return "text-slate-450 border border-slate-800 bg-slate-900/40";
    }
  };

  const renderRemainingBadge = (endDateStr) => {
    if (!endDateStr) return null;
    const days = getDaysRemaining(endDateStr);
    if (days <= 0) {
      return (
        <span className="inline-flex items-center text-[9px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md mt-1.5 uppercase">
          Expired
        </span>
      );
    } else if (days <= 15) {
      return (
        <span className="inline-flex items-center text-[9px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md mt-1.5 uppercase">
          {days} Days Left
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md mt-1.5 uppercase">
          {days} Days Left
        </span>
      );
    }
  };

  // Perform dynamic filtering based on all select and text inputs
  const filteredListings = listings.filter((item) => {
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesTier = tierFilter === "All" || item.tier === tierFilter;
    
    const matchesCompanyOrIndustry = 
      item.name.toLowerCase().includes(companyQuery.toLowerCase()) ||
      item.industry.toLowerCase().includes(companyQuery.toLowerCase());
      
    const matchesFounder = 
      item.founder.toLowerCase().includes(founderQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(founderQuery.toLowerCase());

    return matchesStatus && matchesTier && matchesCompanyOrIndustry && matchesFounder;
  });

  return (
    <div className="flex-grow p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-[#070b13] relative">
      {/* AI Insights Modal */}
      <AiInsightsModal
        aiModal={aiModal}
        onClose={() => setAiModal({ open: false, startup: null, data: null, loading: false, error: null })}
        onRerun={handleRerunAnalysis}
      />
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-4 sm:pb-5 gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Database Control Room</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Manage, verify, and override status/payment tiers of directory entries</p>
        </div>
        <span className="text-[10px] font-extrabold text-slate-400 px-3 py-1.5 rounded-full bg-[#0d1323] border border-slate-850 self-start sm:self-auto">
          Database: {filteredListings.length} Entries
        </span>
      </div>

      {/* Sorting & Filtering Control Bar */}
      <div className="flex items-center gap-5 bg-[#0d1323]/30 border border-slate-800/60 rounded-2xl p-4 flex-wrap shadow-sm">
        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-slate-500 tracking-wide">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#070b13] border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-[#0d1323]/50 transition-colors"
          >
            <option value="All">All Statuses</option>
            <option value="active">Paid / Active</option>
            <option value="pending">Pending / Draft</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="pending_documents">Awaiting Documents</option>
            <option value="pending_payment">Awaiting Payment</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Tier Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-slate-500 tracking-wide">Tier:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-[#070b13] border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-[#0d1323]/50 transition-colors"
          >
            <option value="All">All Tiers</option>
            <option value="Spotlight">Spotlight</option>
            <option value="Verified Pro">Verified Pro</option>
            <option value="Basic">Basic</option>
          </select>
        </div>

        {/* Manual Company/Industry Input */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-slate-500 tracking-wide">Search Startup/Sector:</span>
          <div className="relative flex items-center bg-[#070b13] border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus-within:border-indigo-500/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-slate-600 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Enter name or sector..."
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder:text-slate-600 w-36 font-semibold"
            />
          </div>
        </div>

        {/* Manual Founder Input */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-slate-500 tracking-wide">Search Founder/Email:</span>
          <div className="relative flex items-center bg-[#070b13] border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus-within:border-indigo-500/50 transition-colors">
            <User className="w-3.5 h-3.5 text-slate-600 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Enter name or email..."
              value={founderQuery}
              onChange={(e) => setFounderQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder:text-slate-600 w-36 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && listings.length === 0 ? (
        <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-3xl p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold">Loading startups from Supabase...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-8 text-center text-rose-400">
          <p className="text-sm font-bold">Failed to load startups: {error}</p>
          <button 
            onClick={fetchListings} 
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Retry Fetch
          </button>
        </div>
      ) : (
        /* Table Container */
        <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-3xl overflow-hidden shadow-xl shadow-black/25">
          {/* Horizontal scroll wrapper — ensures Actions column is never clipped */}
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-max text-left border-collapse">
            <thead>
              <tr className="bg-[#0d1323] border-b border-slate-800/70 text-slate-400 font-extrabold text-[10px] tracking-wider uppercase select-none">
                <th className="py-4 px-6">Startup Name & Industry</th>
                <th className="py-4 px-5">Founder Email</th>
                <th className="py-4 px-5">Date Submitted</th>
                <th className="py-4 px-5">Plan Type</th>
                <th className="py-4 px-5">Duration / Expiry</th>
                <th className="py-4 px-5">Current Status</th>
                <th className="py-4 px-5">APPROVED BY</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-xs text-slate-300 font-medium">
              {filteredListings.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-[#161d33]/25 transition-colors cursor-pointer group"
                  onClick={() => openSlideOver(item)}
                >
                  {/* Company Name & Industry */}
                  <td className="py-4.5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold mt-1">
                        {item.industry}
                      </span>
                    </div>
                  </td>

                  {/* Founder Email */}
                  <td className="py-4.5 px-5">
                    <span className="text-slate-200 font-mono">{item.email}</span>
                  </td>

                  {/* Date Submitted */}
                  <td className="py-4.5 px-5 font-mono text-slate-400">
                    {item.submissionDate && item.submissionDate !== "N/A" ? item.submissionDate : formatDate(item.created_at)}
                  </td>

                  {/* Plan Type (Interactive for Super Admin, Read-Only Badge for Moderator) */}
                  <td className="py-4.5 px-5" onClick={(e) => e.stopPropagation()}>
                    {isModerator ? (
                      <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-xl ${getTierStyle(item.tier)}`}>
                        {item.tier}
                      </span>
                    ) : (
                      <select
                        value={item.tier}
                        onChange={(e) => handleTierChange(item.id, e.target.value)}
                        className={`bg-[#070b13] border border-slate-850 rounded-xl px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer focus:border-indigo-500/50 ${getTierStyle(item.tier)}`}
                      >
                        <option value="Basic">Basic</option>
                        <option value="Verified Pro">Verified Pro</option>
                        <option value="Spotlight">Spotlight</option>
                      </select>
                    )}
                  </td>

                  {/* Duration Column */}
                  <td className="py-4.5 px-5">
                    <div className="flex flex-col items-start leading-tight">
                      {(item.endDate || item.expiry_date || item.subscription_ends_at) ? (
                        <>
                          <span className="text-slate-300 font-medium font-mono text-[11px]">
                            Until {formatDate(item.endDate || item.expiry_date || item.subscription_ends_at)}
                          </span>
                          {renderRemainingBadge(item.endDate || item.expiry_date || item.subscription_ends_at)}
                        </>
                      ) : (
                        <span className="text-slate-500 italic">No expiry set</span>
                      )}
                    </div>
                  </td>

                  {/* Current Status (Interactive for Super Admin, Read-Only Badge for Moderator) */}
                  <td className="py-4.5 px-5" onClick={(e) => e.stopPropagation()}>
                    {isModerator ? (
                      <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-xl ${getStatusStyle(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    ) : (
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className={`bg-[#070b13] rounded-xl px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer ${getStatusStyle(item.status)}`}
                      >
                        <option value="pending" className="text-slate-400 bg-[#070b13]">Pending / Draft</option>
                        <option value="pending_verification" className="text-amber-400 bg-[#070b13]">Pending Verification</option>
                        <option value="pending_documents" className="text-cyan-400 bg-[#070b13]">Awaiting Documents</option>
                        <option value="pending_payment" className="text-indigo-400 bg-[#070b13]">Awaiting Payment</option>
                        <option value="active" className="text-emerald-400 bg-[#070b13]">Paid / Active</option>
                        <option value="suspended" className="text-rose-400 bg-[#070b13]">Suspended</option>
                      </select>
                    )}
                  </td>

                  {/* Approved By Column */}
                  <td className="py-4.5 px-5">
                    <span className="text-slate-300 font-semibold text-xs">
                      {item.approved_by || item.approvedBy || "-"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2.5">
                      {!isModerator && item.status !== "active" && (
                        <button
                          onClick={() => handleApproveStatus(item.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {/* AI Insights button — shown for paid/active listings */}
                      {(item.status === "active" || item.status === "paid" || item.status === "Live") && (
                        <button
                          onClick={() => handleOpenAiInsights(item)}
                          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="View AI Pitch Analysis"
                        >
                          <Brain className="w-3 h-3" />
                          AI Insights
                        </button>
                      )}
                      {!isModerator && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        onClick={() => openSlideOver(item)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer pl-1"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredListings.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                    No directory entries match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>{/* end overflow-x-auto */}
        </div>
      )}

      {/* Slide-over Side Panel (Deep Dive) */}
      {isSlideOverOpen && selectedStartup && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={closeSlideOver}
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            {/* Slide-over Content Container */}
            <div className="w-screen max-w-md bg-[#090d16] border-l border-slate-900 shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-900 bg-[#0c1323]/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white">Startup Profile Deep-Dive</span>
                </div>
                <button 
                  onClick={closeSlideOver}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                
                {/* Company Overview */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-sm font-extrabold text-indigo-400 shadow-inner">
                      {selectedStartup.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedStartup.name}</h2>
                      <div className="flex flex-wrap gap-2 items-center mt-1">
                        <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/5 border border-indigo-500/25 px-2 py-0.5 rounded">
                          {selectedStartup.industry}
                        </span>
                        <span className="text-[10px] text-violet-400 font-bold bg-violet-500/5 border border-violet-500/20 px-2 py-0.5 rounded">
                          {selectedStartup.tier}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pitch description */}
                  <div className="bg-[#0d1323]/30 border border-slate-850 rounded-2xl p-4 space-y-2">
                    <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase block">Elevator Pitch</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {selectedStartup.pitch}
                    </p>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <User className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold leading-none">Founder</p>
                        <p className="mt-0.5 font-bold">{selectedStartup.founder}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold leading-none">Email Address</p>
                        <p className="mt-0.5 font-bold">{selectedStartup.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-900" />

                {/* Duration details in Slide-over */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">ADVERTISING PERIOD</h3>
                  </div>

                  <div className="bg-[#0d1323]/40 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-semibold text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Duration Range</span>
                      <span className="font-mono text-slate-200">
                        {selectedStartup.startDate ? formatDate(selectedStartup.startDate) : 'N/A'} - {selectedStartup.endDate ? formatDate(selectedStartup.endDate) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Days Remaining</span>
                      {selectedStartup.endDate ? renderRemainingBadge(selectedStartup.endDate) : <span className="text-slate-500 italic">No expiry</span>}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-900" />

                {/* Reviewer / Approved By details in Slide-over */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">REVIEW DETAILS</h3>
                  </div>

                  <div className="bg-[#0d1323]/40 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-semibold text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Review Status</span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold ${getStatusStyle(selectedStartup.status)}`}>
                        {selectedStartup.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Approved By</span>
                      {selectedStartup.approved_by || selectedStartup.approvedBy ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-[8px] font-extrabold text-indigo-400">
                            {String(selectedStartup.approved_by || (typeof selectedStartup.approvedBy === 'string' ? selectedStartup.approvedBy : selectedStartup.approvedBy?.name || 'SA')).slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-slate-200 font-semibold">
                            {selectedStartup.approved_by || (typeof selectedStartup.approvedBy === 'string' ? selectedStartup.approvedBy : selectedStartup.approvedBy?.name)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-550 italic">Pending Review</span>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-900" />

                {/* Payment Proof */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">PAYMENT PROOF</h3>
                  </div>

                  <div className="bg-[#0d1323]/40 border border-slate-800/80 rounded-2xl p-4 space-y-3 font-semibold text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-550">Transaction ID</span>
                      <span className="font-mono text-slate-200">{selectedStartup.txnId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-550">Amount Charged</span>
                      <span className="font-bold text-white">{selectedStartup.amountPaid}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-550">Status</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-450">
                        <CheckCircle className="w-3.5 h-3.5" /> Captured
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-900" />

                {/* Document Viewer */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">SUBMITTED DOCUMENTS</h3>
                  </div>

                  <div className="space-y-2">
                    {selectedStartup.documents?.map((doc, idx) => (
                      <div 
                        key={idx}
                        className="bg-[#0d1323]/40 border border-slate-850 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-slate-200 transition-all hover:bg-[#0d1323]/60"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileText className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          <a 
                            href={doc} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-semibold text-indigo-400 hover:text-indigo-300 underline truncate max-w-[220px]"
                            title={doc}
                          >
                            {typeof doc === 'string' && doc.startsWith('http') ? (doc.split('/').pop().split('?')[0] || 'View Document') : 'View Document'}
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 flex items-center justify-center text-[11px]"
                            title="View in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={doc}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 flex items-center justify-center text-[11px]"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {!isModerator && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 flex items-center justify-center text-[11px] cursor-pointer"
                              title="Delete document permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!selectedStartup.documents || selectedStartup.documents.length === 0) && (
                      <p className="text-xs text-slate-500 italic">No verification documents submitted yet.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-5 border-t border-slate-900 bg-[#0c1323]/50 flex gap-3">
                <button
                  onClick={closeSlideOver}
                  className="flex-1 rounded-2xl border border-slate-800 hover:bg-slate-800/40 text-xs font-bold text-slate-300 py-3 transition-colors active:scale-95 cursor-pointer"
                >
                  Close Panel
                </button>
                {!isModerator && (
                  selectedStartup.status === "suspended" || selectedStartup.status === "Suspended" ? (
                    <button
                      onClick={() => handleStatusChange(selectedStartup.id, "active")}
                      className="flex-grow flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white py-3 transition-colors active:scale-95 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" /> Activate Listing
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(selectedStartup.id, "suspended")}
                      className="flex-grow flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-3 transition-colors active:scale-95 cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" /> Suspend Listing
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Insights Modal Component ─────────────────────────────────────────────────
function AiInsightsModal({ aiModal, onClose, onRerun }) {
  if (!aiModal.open) return null;

  const { startup, data, loading, error } = aiModal;
  const score = data?.score || 0;
  const scoreColor = score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-rose-400";
  const scoreBg = score >= 8 ? "bg-emerald-500/10 border-emerald-500/30" : score >= 6 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30";
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (circumference * score) / 10;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-2xl bg-[#090d16] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-900 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Insights</h2>
              <p className="text-[10px] text-slate-400 font-semibold">{startup?.name || "Startup"} — Pitch Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRerun}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Re-run Analysis
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                <Brain className="w-6 h-6 text-violet-400 absolute inset-0 m-auto" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-300">Gemini AI is analyzing the pitch deck...</p>
                <p className="text-[11px] text-slate-500 mt-1">Extracting sector, revenue model, and generating Vault Score</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
                <X className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-sm font-bold text-rose-400">Failed to load insights</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && !data && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                <Brain className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm font-bold text-slate-400">No AI analysis yet</p>
              <p className="text-xs text-slate-500 mt-1">Click "Re-run Analysis" to trigger Gemini AI processing</p>
              <button
                onClick={onRerun}
                className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Run AI Analysis Now
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Vault Score + Metadata Row */}
              <div className="flex items-stretch gap-4">
                {/* Vault Score Radial Gauge */}
                <div className={`flex flex-col items-center justify-center p-5 rounded-2xl border ${scoreBg} min-w-[140px]`}>
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    {/* Background track */}
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    {/* Score arc */}
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={score >= 8 ? "#34d399" : score >= 6 ? "#fbbf24" : "#f87171"}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                    <text x="50" y="44" textAnchor="middle" className="font-black" fill={score >= 8 ? "#34d399" : score >= 6 ? "#fbbf24" : "#f87171"} fontSize="22" fontWeight="900">{score}</text>
                    <text x="50" y="60" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">/10</text>
                  </svg>
                  <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mt-1">Vault Score</span>
                  {data.model === 'mock-fallback' && (
                    <span className="text-[8px] text-amber-400 font-bold mt-1 text-center">Demo (add Gemini key)</span>
                  )}
                </div>

                {/* Score Summary */}
                <div className="bg-gradient-to-br from-violet-600/5 to-indigo-600/5 border border-violet-500/15 rounded-2xl p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <p className="text-[9px] font-extrabold text-violet-400 tracking-widest uppercase">Executive Summary</p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{data.summary}</p>
                </div>
              </div>

              {/* Strengths & Risk Flags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4">
                  <p className="text-[9px] font-extrabold text-emerald-500 tracking-widest uppercase mb-2">Strengths</p>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5">
                    {data.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4">
                  <p className="text-[9px] font-extrabold text-rose-500 tracking-widest uppercase mb-2">Risk Flags</p>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5">
                    {data.risk_flags?.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>

              {/* Recommended Sectors */}
              {data.recommended_sectors?.length > 0 && (
                <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4">
                  <p className="text-[9px] font-extrabold text-slate-500 tracking-widest uppercase mb-3">Recommended Sectors</p>
                  <div className="flex flex-wrap gap-2">
                    {data.recommended_sectors.map((sec, i) => (
                      <span key={i} className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                <span className="text-[9px] text-slate-600 font-mono">Analyzed: {data.analyzed_at ? new Date(data.analyzed_at).toLocaleString() : 'N/A'}</span>
                <span className="text-[9px] text-slate-600 font-mono uppercase">{data.model || 'gemini'}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
