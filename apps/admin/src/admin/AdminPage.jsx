import { useState, useEffect, useRef } from "react";
import {
  Routes, Route, Navigate, useLocation, useNavigate, Link
} from "react-router-dom";
import {
  Shield, FileText, Building2, LayoutDashboard, Settings,
  Bell, LogOut, Eye, Download, Search, Zap, Compass,
  Rocket, ChevronRight, Mail, User, Sun, Clock, AlertTriangle,
  CheckCircle2, XCircle, MessageSquare, Lock, Send, Trash2, ExternalLink, Menu, X, RefreshCw
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getApiBaseUrl } from "../utils/apiConfig";
import { isPendingVerification } from "../utils/verificationHelper";
import Overview from "./Overview";
import AllListings from "./AllListings";
import SettingsView from "./Settings";
import QueriesView from "./QueriesView";
import ProfileView from "./ProfileView";
import SecurityView from "./SecurityView";
import NotificationCenter from "./NotificationCenter";

const CHECKLIST_ITEMS = [
  { id: "gst", label: "GST Certificate — valid & matches company name" },
  { id: "inc", label: "Incorporation Certificate — filed with MCA" },
  { id: "pitch", label: "Pitch deck reviewed — no misleading claims" },
  { id: "founder", label: "Founder identity verified via LinkedIn/email" },
  { id: "domain", label: "Domain/website matches registered company" },
];

function getTimeAgo(appId) {
  if (appId === 101) return "2d ago";
  if (appId === 102) return "1d ago";
  if (appId === 103) return "23h ago";
  return "Just now";
}

function getAppInitials(name) {
  if (typeof name !== 'string') return 'ST';
  return name.slice(0, 2).toUpperCase();
}

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

function MockPDFViewer({ filename, startup, onDeleteDocument }) {
  const docSources = [
    startup?.documents,
    startup?.pitch_deck_url,
    startup?.pitchDeckUrl,
    startup?.private_document_url,
    startup?.privateDocumentUrl,
    startup?.document_url,
    startup?.documentUrl,
    filename
  ];

  const allUrls = Array.from(new Set(docSources.flatMap(parseDocList).filter(u => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")))));

  return (
    <div className="bg-[#0b0f19] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col min-h-[350px] shadow-lg shadow-black/30 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Verification Documents ({allUrls.length})</h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/60">
          Admin Safe Link Viewer
        </span>
      </div>

      {allUrls.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 border border-dashed border-slate-800/60 rounded-xl bg-slate-900/30">
          <FileText className="w-10 h-10 text-slate-600" />
          <div>
            <p className="text-xs font-bold text-slate-400">No document files attached</p>
            <p className="text-[10px] text-slate-500 mt-1">
              Founder has not uploaded any verification or pitch deck documents yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
          {allUrls.map((url, index) => {
            const fileName = url.split("/").pop()?.split("?")[0] || `Document_${index + 1}`;
            return (
              <div 
                key={index} 
                className="flex items-center justify-between p-3.5 bg-[#0d1323] border border-slate-800 rounded-xl hover:border-slate-700 transition-all text-xs group"
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate group-hover:text-white" title={fileName}>
                      {fileName}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">Document #{index + 1}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold rounded-lg border border-indigo-500/30 transition-all cursor-pointer"
                  >
                    View Document {index + 1}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download document"
                    className="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-800/40 flex items-center justify-center border border-slate-800 bg-[#0b0f19] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {onDeleteDocument && (
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(url)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-800/40 flex items-center justify-center border border-slate-800 bg-[#0b0f19] cursor-pointer"
                      title="Delete document permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VerificationsView() {
  const { user, adminProfile } = useAdminAuth();
  const currentAdminName = adminProfile?.name || adminProfile?.full_name || adminProfile?.email || user?.user_metadata?.full_name || user?.email || "Admin";

  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [checklists, setChecklists] = useState({});
  const [requestsCount, setRequestsCount] = useState({});
  const [requestText, setRequestText] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [toast, setToast] = useState(null);
  const [suspendModal, setSuspendModal] = useState({ open: false, selectedPresets: [], customReason: '', submitting: false });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      let allStartups = [];
      try {
        const statsRes = await fetch(`${getApiBaseUrl()}/api/admin/stats`);
        const stats = await statsRes.json();
        setRequestsCount(prev => ({ ...prev, queries: stats.user_queries || 0 }));
      } catch (e) {
        console.warn("[stats] Failed to fetch server stats:", e);
      }
      
      try {
        const { data: sbData } = await supabase.from('startups').select('*');
        if (sbData && sbData.length > 0) {
          allStartups = sbData;
        }
      } catch (e) {}

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/startups`);
        if (res.ok) {
          const apiStartups = await res.json();
          apiStartups.forEach(apiS => {
            const existsIdx = allStartups.findIndex(s => (s.id && String(s.id) === String(apiS.id)) || (s.user_id && s.user_id === apiS.userId));
            if (existsIdx >= 0) {
              allStartups[existsIdx] = { ...allStartups[existsIdx], ...apiS };
            } else {
              allStartups.push(apiS);
            }
          });
        }
      } catch (err) {}

      const data = allStartups.filter(isPendingVerification);
      
      console.log('Fetched Verifications:', data);
      
      const mapped = (data || []).map((s) => {
        const contactEmail = s.contact_info?.email || s.email || s.contactEmail || '';
        const contactPhone = s.contact_info?.phone || s.phone_number || s.contactPhone || '';
        const additionalContacts = s.additional_contacts || s.contact_info?.additional || [];
        
        const docList = [];
        if (s.pitch_deck_url) docList.push(s.pitch_deck_url);
        if (s.pitchDeckUrl) docList.push(s.pitchDeckUrl);
        if (s.private_document_url) docList.push(s.private_document_url);
        if (s.privateDocumentUrl) docList.push(s.privateDocumentUrl);
        if (s.document_url) docList.push(s.document_url);
        if (s.documentUrl) docList.push(s.documentUrl);
        if (Array.isArray(s.document_urls)) docList.push(...s.document_urls);
        if (Array.isArray(s.documentUrls)) docList.push(...s.documentUrls);
        const documents = Array.from(new Set(docList.flatMap(parseDocList).filter(Boolean)));

        return {
          ...s,
          id: s.id,
          name: s.company_name || s.companyName || s.name || 'N/A',
          founder: s.founder_name || s.founderName || 'N/A',
          email: s.email || 'N/A',
          submittedAt: s.created_at || s.submittedAt,
          tier: s.requested_plan || s.plan_type || s.tier || 'Basic',
          industry: s.industry || 'N/A',
          stage: s.stage || 'N/A',
          status: s.status || 'pending_verification',
          documents,
          minTicket: s.min_investment || s.minTicket || '₹1,00,000',
          pitch: s.pitch || 'N/A',
          contactEmail,
          contactPhone,
          additionalContacts
        };
      });
      
      setApplications(mapped);
      if (mapped.length > 0) {
        setSelectedApp((prev) => {
          if (!prev) return mapped[0];
          const exists = mapped.find(a => a.id === prev.id);
          return exists ? exists : mapped[0];
        });
      } else {
        setSelectedApp(null);
      }
    } catch (err) {
      console.error("Error fetching pending applications:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    const channel = supabase.channel('startups-verification')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startups' }, (payload) => {
        console.log('[Admin Verifications] Realtime update received', payload);
        fetchApplications();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedApp) {
      setSelectedDoc(selectedApp.documents?.[0] || null);
    } else {
      setSelectedDoc(null);
    }
  }, [selectedApp]);

  const filteredApps = applications.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.founder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentChecklist = checklists[selectedApp?.id] || {
    gst: false,
    inc: false,
    pitch: false,
    founder: false,
    domain: false,
  };

  const checkedCount = Object.values(currentChecklist).filter(Boolean).length;
  const isChecklistComplete = checkedCount === CHECKLIST_ITEMS.length;

  const toggleChecklistItem = (itemId) => {
    if (!selectedApp) return;
    setChecklists((prev) => ({
      ...prev,
      [selectedApp.id]: {
        ...currentChecklist,
        [itemId]: !currentChecklist[itemId],
      },
    }));
  };

  const handleDeleteDocument = async (docUrl) => {
    if (!selectedApp || !docUrl) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this document? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      if (docUrl.includes("/documents/")) {
        const parts = docUrl.split("/documents/");
        if (parts[1]) {
          const storagePath = parts[1].split("?")[0];
          await supabase.storage.from("documents").remove([storagePath]);
          console.log("[admin] Removed file from Supabase storage:", storagePath);
        }
      }

      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${selectedApp.id}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl: docUrl }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete document from database.");
      }

      const resData = await res.json();
      const updatedDocs = resData.documentUrls || (selectedApp.documents || []).filter((d) => d !== docUrl);

      const updatedApp = {
        ...selectedApp,
        documents: updatedDocs,
        document_urls: updatedDocs,
        document_url: updatedDocs[0] || "",
        pitch_deck_url: updatedDocs[0] || "",
      };

      setSelectedApp(updatedApp);
      if (selectedDoc === docUrl) {
        setSelectedDoc(updatedDocs[0] || "");
      }
      setApplications((prev) =>
        prev.map((item) => (item.id === selectedApp.id ? updatedApp : item))
      );

      alert("Document deleted successfully");
    } catch (err) {
      console.error("[admin] Document deletion error:", err);
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedApp) return;

    const activeVerification = {
      founder_email: selectedApp.contactEmail || selectedApp.email
    };
    const gmailUrl = `https://mail.google.com/mail/u/2/#search/${activeVerification.founder_email}`;
    window.open(gmailUrl, '_blank');

    try {
      setSendingRequest(true);

      const { error: supabaseErr } = await supabase
        .from('startups')
        .update({ status: 'pending_documents' })
        .eq('id', selectedApp.id);

      if (supabaseErr) {
        console.warn("Direct Supabase update failed:", supabaseErr.message);
      }

      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${selectedApp.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_documents" })
      });

      if (!res.ok) {
        throw new Error("Failed to update status on server.");
      }

      setRequestsCount((prev) => ({
        ...prev,
        [selectedApp.id]: (prev[selectedApp.id] || 0) + 1,
      }));
      alert("Additional documents request opened in Gmail. Status updated successfully.");
      await fetchApplications();
    } catch (err) {
      alert("Error updating status: " + err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleApprove = async () => {
    if (!isChecklistComplete || !selectedApp) return;
    try {
      const nextPlan = selectedApp.requested_plan || selectedApp.plan_type || selectedApp.tier || 'Verified Pro';
      
      const existingAC = selectedApp.additional_contacts || {};
      const updatedAC = {
        ...(Array.isArray(existingAC) ? { links: existingAC } : existingAC),
        tier: nextPlan,
        plan_type: nextPlan
      };

      let activeAdminName = currentAdminName;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          activeAdminName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || activeAdminName;
        }
      } catch (authErr) {}

      const payload = {
        status: "pending_payment",
        plan_type: nextPlan,
        requested_plan: null,
        verification_status: "approved",
        approved_by: activeAdminName,
        additional_contacts: { ...updatedAC, approved_by: activeAdminName },
        updated_at: new Date().toISOString()
      };

      if (selectedApp.user_id) {
        const { error: sbErr } = await supabase.from('startups').update(payload).eq('user_id', selectedApp.user_id);
        if (sbErr && sbErr.message.includes('approved_by')) {
          const safePayload = { ...payload };
          delete safePayload.approved_by;
          await supabase.from('startups').update(safePayload).eq('user_id', selectedApp.user_id);
        }
      }
      if (selectedApp.id && !isNaN(Number(selectedApp.id))) {
        const { error: sbErr } = await supabase.from('startups').update(payload).eq('id', Number(selectedApp.id));
        if (sbErr && sbErr.message.includes('approved_by')) {
          const safePayload = { ...payload };
          delete safePayload.approved_by;
          await supabase.from('startups').update(safePayload).eq('id', Number(selectedApp.id));
        }
      }

      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${selectedApp.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to sync status update to local database.");
      
      setToast({ message: `Successfully approved ${selectedApp.name} for ${nextPlan} plan!`, type: "success" });
      await fetchApplications();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      console.error("[admin] Approval error:", err);
      setToast({ message: "Failed to approve application: " + err.message, type: "error" });
    }
  };

  // Open the suspension reason modal (called by the Reject button)
  const openSuspendModal = () => {
    if (!selectedApp) return;
    setSuspendModal({ open: true, selectedPresets: [], customReason: '', submitting: false });
  };

  // Toggle a preset chip on/off; combined presets auto-fill the text area
  const togglePreset = (preset) => {
    setSuspendModal(prev => {
      const already = prev.selectedPresets.includes(preset);
      const next = already
        ? prev.selectedPresets.filter(p => p !== preset)
        : [...prev.selectedPresets, preset];
      return { ...prev, selectedPresets: next };
    });
  };

  // Build the final reason string from selected presets + optional custom note
  const buildReason = (presets, custom) => {
    const parts = [...presets];
    if (custom.trim()) parts.push(custom.trim());
    return parts.join('; ');
  };

  // Called when admin confirms suspension from the modal
  const handleReject = async (reason) => {
    if (!selectedApp) return;
    setSuspendModal(prev => ({ ...prev, submitting: true }));
    try {
      const hasActivePlan = selectedApp.status === 'active' || selectedApp.payment_status === 'paid';
      const isUpgradeRequest = !!(selectedApp.requested_plan);

      const existingAC = selectedApp.additional_contacts || {};
      const updatedAC = {
        ...(Array.isArray(existingAC) ? { links: existingAC } : existingAC),
        suspension_reason: reason,
        verification_status: 'suspended',
        ...(hasActivePlan && isUpgradeRequest ? { upgrade_status: 'suspended' } : {})
      };

      const payload = hasActivePlan && isUpgradeRequest
        ? {
            requested_plan: null,
            verification_status: 'suspended',
            suspension_reason: reason,
            additional_contacts: updatedAC,
            founder_email: selectedApp.email || selectedApp.contact_email || '',
            startup_name: selectedApp.name || selectedApp.startup_name || '',
          }
        : {
            status: 'suspended',
            verification_status: 'suspended',
            suspension_reason: reason,
            additional_contacts: updatedAC,
            founder_email: selectedApp.email || selectedApp.contact_email || '',
            startup_name: selectedApp.name || selectedApp.startup_name || '',
          };

      const sbPayload = { ...payload };
      delete sbPayload.founder_email;
      delete sbPayload.startup_name;
      delete sbPayload.upgrade_status;

      // 1. Direct Supabase update with error verification and schema fallback
      let sbRes = null;
      if (selectedApp.user_id) {
        sbRes = await supabase.from('startups').update(sbPayload).eq('user_id', selectedApp.user_id);
      }
      if ((!sbRes || sbRes.error) && selectedApp.id && !isNaN(Number(selectedApp.id))) {
        sbRes = await supabase.from('startups').update(sbPayload).eq('id', Number(selectedApp.id));
      }

      // Schema cache fallback: if top-level suspension_reason column throws a PostgREST cache error, retry with suspension_reason in additional_contacts
      if (sbRes?.error && sbRes.error.message.includes('suspension_reason')) {
        const safeSbPayload = { ...sbPayload };
        delete safeSbPayload.suspension_reason;
        if (selectedApp.user_id) {
          sbRes = await supabase.from('startups').update(safeSbPayload).eq('user_id', selectedApp.user_id);
        } else if (selectedApp.id && !isNaN(Number(selectedApp.id))) {
          sbRes = await supabase.from('startups').update(safeSbPayload).eq('id', Number(selectedApp.id));
        }
      }

      if (sbRes?.error) {
        throw sbRes.error;
      }

      // 2. Call server status API (email notification & local DB fallback)
      const targetId = selectedApp.id || selectedApp.user_id;
      const res = await fetch(`${getApiBaseUrl()}/api/admin/startups/${targetId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to update status on server API.");
      }

      // 3. Update local React state immediately so Admin UI reflects suspended state
      const updatedApp = {
        ...selectedApp,
        ...(hasActivePlan && isUpgradeRequest
          ? { upgrade_status: 'suspended', verification_status: 'suspended', suspension_reason: reason, requested_plan: null }
          : { status: 'suspended', verification_status: 'suspended', suspension_reason: reason }),
        additional_contacts: updatedAC
      };

      setSelectedApp(updatedApp);
      setApplications(prev => prev.map(app => (app.id === selectedApp.id || app.user_id === selectedApp.user_id) ? updatedApp : app));

      // 4. Fire success toast strictly after confirmed DB & API updates
      setSuspendModal({ open: false, selectedPresets: [], customReason: '', submitting: false });
      setToast({ message: `Suspended${hasActivePlan && isUpgradeRequest ? ' (upgrade only — base plan intact)' : ''}. Email sent to founder.`, type: "success" });
      await fetchApplications();
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      setSuspendModal(prev => ({ ...prev, submitting: false }));
      const errorMsg = err?.message || (typeof err === "string" ? err : "Failed to suspend startup.");
      setToast({ message: `Rejection Failed: ${errorMsg}`, type: "error" });
    }
  };

  const handleSelectApp = async (app) => {
    setSelectedApp(app);
    if (!app) return;

    try {
      const identifier = app.user_id || app.userId || app.id;
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

      if (!freshData && app.id) {
        const { data } = await supabase
          .from('startups')
          .select('*')
          .eq('id', app.id)
          .maybeSingle();
        freshData = data;
      }

      if (freshData) {
        const docList = [
          freshData.pitch_deck_url,
          freshData.pitchDeckUrl,
          freshData.private_document_url,
          freshData.privateDocumentUrl,
          freshData.document_url,
          freshData.documentUrl,
          freshData.document_urls,
          freshData.documentUrls
        ];
        const updatedDocuments = Array.from(new Set(docList.flatMap(parseDocList).filter(Boolean)));

        setSelectedApp((prev) => ({
          ...prev,
          ...freshData,
          name: freshData.company_name || freshData.name || prev?.name,
          founder: freshData.founder_name || freshData.founder || prev?.founder,
          pitch_deck_url: freshData.pitch_deck_url || prev?.pitch_deck_url,
          public_document_url: freshData.public_document_url || prev?.public_document_url,
          documents: updatedDocuments
        }));
      }
    } catch (err) {
      console.error("[Admin Verifications] Fresh fetch on select error:", err);
    }
  };

  return (
    <div className="flex-grow p-8 flex flex-col gap-6 overflow-y-auto bg-[#070b13]">
      {/* Header Block */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Startup Verification Center</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Review pending applications and issue verification badges</p>
        </div>
      </div>

      {/* Inner Content Grid */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0">
      {/* Left Column - Pending Applications List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Pending Applications</h2>
            <span className="h-5 w-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-sm">
              {applications.length}
            </span>
          </div>
          <button 
            onClick={fetchApplications} 
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" 
            title="Refresh Applications"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search Box */}
        <div className="relative bg-[#0d1323] border border-slate-800/80 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <Search className="w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder:text-slate-500 w-full"
          />
        </div>

        {/* List Container */}
        <div className="space-y-3 overflow-y-auto pr-1">
          {applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 py-16 gap-3 border border-dashed border-slate-800/40 rounded-3xl bg-[#0d1323]/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <div className="text-center">
                <h3 className="text-xs font-bold text-white">All caught up!</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">No startups pending verification.</p>
              </div>
            </div>
          ) : filteredApps.length === 0 ? (
            <p className="text-center text-xs text-slate-600 italic py-8">No matching applications found.</p>
          ) : (
            filteredApps.map((app) => {
              const isSelected = selectedApp?.id === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => handleSelectApp(app)}
                  className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-[#161d33] border-indigo-500/40 shadow-md shadow-black/15"
                      : "bg-[#0d1323]/50 border-slate-800/60 hover:bg-[#0d1323]/80 hover:border-slate-800"
                  }`}
                >
                  {/* Squircle Initials */}
                  <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                    {getAppInitials(app.name)}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{app.name}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-400 flex-shrink-0">
                          Reviewing &gt;
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1 truncate">
                      {app.founder}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-3.5">
                      <span className="text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded bg-[#101726]/60 border border-slate-800/40">
                        {app.tier}
                      </span>
                      {app.status === 'pending_documents' && (
                        <span className="text-[9px] font-bold text-amber-450 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25">
                          Awaiting Docs
                        </span>
                      )}
                      <span className="text-[9px] font-semibold text-slate-500">
                        {getTimeAgo(app.id)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column - Startup Details */}
      {selectedApp ? (
        <div className="flex flex-col gap-6 pb-12">
          {/* Detail Header Box */}
          <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm">
            {/* Left Side Info */}
            <div className="flex items-start gap-4 flex-1">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-sm font-extrabold text-indigo-400 flex-shrink-0 shadow-inner">
                {getAppInitials(selectedApp.name)}
              </div>
              <div className="space-y-2">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedApp.name}</h2>
                  <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                    {selectedApp.industry} • {selectedApp.stage}
                  </p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                  {selectedApp.pitch}
                </p>
              </div>
            </div>

            {/* Right Side Metadata */}
            <div className="flex flex-col gap-2.5 text-[10px] text-slate-400 font-medium justify-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedApp.founder}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-355">{selectedApp.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{getTimeAgo(selectedApp.id)}</span>
              </div>
            </div>
          </div>

          {/* Grid of Info widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-center min-h-[70px]">
              <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">LISTING TIER</span>
              <span className="text-xs font-bold text-white mt-1.5">{selectedApp.tier}</span>
            </div>
            <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-center min-h-[70px]">
              <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">MINIMUM INVESTMENT</span>
              <span className="text-xs font-bold text-white mt-1.5">{selectedApp.minTicket || "—"}</span>
            </div>
            <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-center min-h-[70px]">
              <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">INDUSTRY</span>
              <span className="text-xs font-bold text-white mt-1.5">{selectedApp.industry}</span>
            </div>
            <div className="bg-[#0d1323]/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-center min-h-[70px]">
              <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">DOCUMENTS</span>
              <span className="text-xs font-bold text-white mt-1.5">{selectedApp.documents?.length || 0} files</span>
            </div>
          </div>

          {/* Document Preview Section */}
          <div className="w-full">
            <MockPDFViewer filename={selectedDoc || ""} startup={selectedApp} onDeleteDocument={handleDeleteDocument} />
          </div>

          {/* Request Additional Documents Card */}
          <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-white">Request Additional Documents</h3>
                <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-[#0d1323] border border-slate-800/60">
                  {requestsCount[selectedApp.id] || 0} requested
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-medium mt-1">
                Ask the founder for missing verification paperwork.
              </p>
            </div>
            <button
              onClick={handleSendRequest}
              disabled={sendingRequest}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-md flex-shrink-0 ${
                !sendingRequest
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/15"
                  : "bg-[#161d33] text-slate-550 opacity-60 cursor-not-allowed"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {sendingRequest ? "Sending..." : "Request via Email"}
            </button>
          </div>

          {/* Verification Checklist + Action Buttons — hidden when already suspended/rejected */}
          {(selectedApp.status === 'suspended' || selectedApp.verification_status === 'suspended' || selectedApp.verification_status === 'rejected') ? (
            <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                  <XCircle className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wide">
                    {selectedApp.status === 'suspended' ? 'Status: Suspended' :
                     selectedApp.verification_status === 'suspended' ? 'Upgrade Suspended' : 'Status: Rejected'}
                  </h3>
                  <p className="text-[11px] text-rose-400/70 font-medium mt-0.5">
                    {selectedApp.status === 'suspended'
                      ? 'This listing has been suspended. No further action is available.'
                      : selectedApp.verification_status === 'suspended'
                      ? 'The upgrade request was suspended. The founder\'s base plan remains active.'
                      : 'This application was rejected. The founder must resubmit.'
                    }
                  </p>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-3 text-[10.5px] font-semibold">
                <div className="bg-[#0d1323]/60 border border-slate-800/60 rounded-xl p-3">
                  <span className="text-slate-500 block mb-0.5">Base Plan</span>
                  <span className="text-white">{selectedApp.plan_type || 'Basic'}</span>
                </div>
                <div className="bg-[#0d1323]/60 border border-rose-800/30 rounded-xl p-3">
                  <span className="text-slate-500 block mb-0.5">Upgrade Request</span>
                  <span className="text-rose-400">Suspended</span>
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Verification Checklist Card */}
          <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-indigo-400 fill-indigo-400/10" />
                <h3 className="text-sm font-bold text-white">Verification Checklist</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {checkedCount}/{CHECKLIST_ITEMS.length} completed
              </span>
            </div>

            <div className="space-y-3.5 py-1">
              {CHECKLIST_ITEMS.map((item) => {
                const isChecked = currentChecklist[item.id];
                return (
                  <label
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    {/* Sharp Empty Checkbox Square */}
                    <div
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-500 bg-transparent group-hover:border-slate-350"
                      }`}
                    >
                      {isChecked && (
                        <svg
                          className="h-3 w-3 stroke-[3]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Warning message if incomplete */}
            {!isChecklistComplete && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 mt-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-amber-400/90 font-bold leading-normal">
                  Complete all checklist items before issuing the verification badge.{" "}
                  {CHECKLIST_ITEMS.length - checkedCount} items remaining.
                </p>
              </div>
            )}

            {/* Bottom Approval & Reject Action Buttons */}
            <div className="flex gap-4 mt-2">
              <button
                onClick={handleApprove}
                disabled={!isChecklistComplete}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-bold transition-all shadow-sm ${
                  isChecklistComplete
                    ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-emerald-600/10 active:scale-[0.98]"
                    : "bg-[#161d33] border border-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve &amp; Issue Badge
              </button>
              
              <button
                onClick={openSuspendModal}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white py-3.5 text-xs font-bold transition-all shadow-sm hover:shadow-rose-600/10 active:scale-[0.98]"
              >
                <XCircle className="h-4 w-4" />
                Reject &amp; Request Re-upload
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center bg-[#0d1323]/20 border border-slate-800/40 rounded-3xl p-8">
          <span className="text-sm text-slate-500 font-medium">Select a startup application to review</span>
        </div>
      )}
      {/* Suspension Reason Modal */}
      {suspendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d1323] border border-rose-500/20 rounded-3xl p-7 w-full max-w-md shadow-2xl shadow-black/60 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Suspend Application</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedApp?.name || 'This startup'} &mdash; select one or more reasons so the founder knows how to fix it.
                </p>
              </div>
            </div>

            {/* Multi-select preset reason chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">Quick Reasons</p>
                {suspendModal.selectedPresets.length > 0 && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                    {suspendModal.selectedPresets.length} selected
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Invalid GST Certificate',
                  'Incomplete Pitch Deck',
                  'Incorporation Certificate Missing',
                  'Founder Identity Unverifiable',
                  'Domain Does Not Match Company',
                  'Misleading Information',
                ].map(preset => {
                  const isSelected = suspendModal.selectedPresets.includes(preset);
                  return (
                    <button
                      key={preset}
                      onClick={() => togglePreset(preset)}
                      className={`text-[10.5px] font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-[#161d33] border-slate-700 text-slate-300 hover:border-rose-500/50 hover:text-rose-300'
                      }`}
                    >
                      {isSelected && <span className="text-[9px] leading-none">✓</span>}
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional notes text area */}
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Additional Notes <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={suspendModal.customReason}
                onChange={e => setSuspendModal(prev => ({ ...prev, customReason: e.target.value }))}
                placeholder="Add any extra details for the founder..."
                className="w-full bg-[#161d33] border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50 resize-none transition-colors"
              />
            </div>

            {/* Combined preview */}
            {(suspendModal.selectedPresets.length > 0 || suspendModal.customReason.trim()) && (
              <div className="bg-[#161d33] border border-rose-800/30 rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-bold text-rose-400/70 uppercase tracking-wider mb-1">Will be sent to founder:</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{buildReason(suspendModal.selectedPresets, suspendModal.customReason)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setSuspendModal({ open: false, selectedPresets: [], customReason: '', submitting: false })}
                disabled={suspendModal.submitting}
                className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[#161d33] border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(buildReason(suspendModal.selectedPresets, suspendModal.customReason))}
                disabled={suspendModal.submitting || (!suspendModal.selectedPresets.length && !suspendModal.customReason.trim())}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  suspendModal.submitting || (!suspendModal.selectedPresets.length && !suspendModal.customReason.trim())
                    ? 'bg-rose-900/40 text-rose-400/50 cursor-not-allowed border border-rose-800/30'
                    : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-[0.98]'
                }`}
              >
                <XCircle className="h-3.5 w-3.5" />
                {suspendModal.submitting ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border animate-fade-in ${
          toast.type === "success"
            ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
            : "bg-rose-950/90 border-rose-500/30 text-rose-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, adminProfile, signOut } = useAdminAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const adminEmail = user?.email || adminProfile?.email || "admin@ideavault.in";
  const userEmailKey = (adminEmail || "").toLowerCase().trim();

  const [notificationPref, setNotificationPref] = useState(() => {
    try {
      const saved = localStorage.getItem(`admin_notification_pref_${userEmailKey}`);
      if (saved) return saved;
    } catch (e) {}
    return adminProfile?.notification_preference || "Instant Email Alert";
  });

  const [sendingNotificationEmail, setSendingNotificationEmail] = useState(false);

  const handleNotificationPrefChange = async (newPref) => {
    setNotificationPref(newPref);
    if (userEmailKey) {
      try {
        localStorage.setItem(`admin_notification_pref_${userEmailKey}`, newPref);
      } catch (e) {}
    }

    setSendingNotificationEmail(true);

    // 1. Supabase update
    try {
      if (userEmailKey) {
        await supabase
          .from("admin_users")
          .update({ notification_preference: newPref })
          .eq("email", userEmailKey);
      }
    } catch (e) {}

    // 2. Server API call — triggers Nodemailer email send to admin
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmailKey,
          notification_preference: newPref,
          send_confirmation_email: true
        })
      });
      const data = await res.json();
      if (data.email_sent) {
        setToast({
          type: "success",
          message: `Notification preference updated to "${newPref}". Confirmation email sent to ${userEmailKey}!`
        });
      } else {
        setToast({
          type: "success",
          message: `Notification preference updated to "${newPref}".`
        });
      }
    } catch (apiErr) {
      console.warn("API profile update error:", apiErr);
      setToast({
        type: "success",
        message: `Notification preference updated to "${newPref}".`
      });
    } finally {
      setSendingNotificationEmail(false);
    }
  };

  const [verificationsCount, setVerificationsCount] = useState(0);
  const [queriesCount, setQueriesCount] = useState(0);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {}
    navigate("/login", { replace: true });
  };

  const adminName = adminProfile?.name || user?.email?.split('@')[0] || "Administrator";
  const adminRole = adminProfile?.role || "Super Admin";
  const isModerator = adminRole === "Moderator" || adminRole?.toLowerCase() === "moderator";
  const adminInitials = adminName.slice(0, 2).toUpperCase();

  // Restore header avatar from localStorage
  const headerAvatarUrl = (() => {
    try {
      const emailKey = (user?.email || adminProfile?.email || "").toLowerCase().trim();
      return emailKey ? localStorage.getItem(`admin_avatar_${emailKey}`) : null;
    } catch (e) { return null; }
  })();

  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (location.state?.toast) {
      setToast(location.state.toast);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchBadgeCounts = async () => {
    try {
      // 1. Direct Supabase query for live verifications count
      const { data, error } = await supabase
        .from('startups')
        .select('status, verification_status, requested_plan');

      let liveVerificationsCount = 0;
      if (!error && data) {
        liveVerificationsCount = data.filter(isPendingVerification).length;
        setVerificationsCount(liveVerificationsCount);
      }

      // 2. Use server stats API for unread queries count — server uses service role key which bypasses RLS
      //    (Direct Supabase anon client is blocked by RLS on user_queries table)
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/stats`);
        if (res.ok) {
          const statsData = await res.json();
          setQueriesCount(statsData.unreadQueriesCount || 0);
          // Use stats pendingCount as fallback if direct Supabase query failed
          if (error || !data) setVerificationsCount(statsData.pendingCount || 0);
        }
      } catch (e) {
        console.warn("Error fetching queries count from stats API:", e.message);
      }
    } catch (err) {
      console.warn("Error fetching admin sidebar counts:", err.message);
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
    window.addEventListener("admin-badges-updated", fetchBadgeCounts);
    return () => window.removeEventListener("admin-badges-updated", fetchBadgeCounts);
  }, [location.pathname]);

  const isOverview = location.pathname === "/overview" || location.pathname === "/";
  const isVerifications = location.pathname === "/verifications";
  const isListings = location.pathname === "/listings";
  const isQueries = location.pathname === "/queries";
  const isSettings = location.pathname === "/settings";

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/overview" },
    { id: "verifications", label: "Verifications", icon: Shield, badge: verificationsCount, path: "/verifications" },
    { id: "listings", label: "All Listings", icon: Building2, path: "/listings" },
    { id: "queries", label: "User Queries", icon: MessageSquare, badge: queriesCount, path: "/queries" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  const filteredSidebarItems = sidebarItems.filter(item => {
    if (item.id === "settings" && isModerator) {
      return false;
    }
    return true;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#070b13] text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      {/* Fixed Top Header / Navbar */}
      <header className="h-14 sm:h-16 border-b border-slate-900 bg-[#070b13] grid grid-cols-3 items-center px-3 sm:px-6 z-40 flex-shrink-0">
        {/* Left: Hamburger (mobile) + Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide">IdeaVault</span>
            <span className="hidden sm:block text-[10px] text-slate-400 font-medium mt-0.5">Startup Directory</span>
          </div>
        </div>

        {/* Center Tab - Admin Only */}
        <div className="flex justify-center">
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#161d33] border border-slate-800/80 shadow-md shadow-black/10">
            <Shield className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400/20" />
            Admin
          </button>
        </div>

        {/* Right side - Notification Bell & Profile with Dropdown */}
        <div className="flex items-center justify-end gap-4 relative">
          <NotificationCenter />

          {/* User Avatar Click Trigger */}
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-8 w-8 rounded-full bg-blue-600/25 border border-blue-500/20 flex items-center justify-center text-xs font-extrabold text-blue-400 hover:bg-blue-600/40 transition-all focus:outline-none cursor-pointer overflow-hidden"
          >
            {headerAvatarUrl
              ? <img src={headerAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : (adminInitials[0] || 'A')
            }
          </button>

          {/* Absolute Profile Dropdown Card */}
          {isProfileOpen && (
            <>
              {/* Clicking outside backdrop overlay */}
              <div 
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setIsProfileOpen(false)}
              />

              <div className="absolute right-0 top-11 w-64 bg-[#0d1323] border border-slate-850 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3.5 select-none animate-fade-in text-left">
                {/* Identity Header */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-600/25 border border-blue-500/20 flex items-center justify-center text-xs font-extrabold text-blue-400 flex-shrink-0 overflow-hidden">
                    {headerAvatarUrl
                      ? <img src={headerAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      : adminInitials
                    }
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate">{adminName}</span>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{adminEmail}</span>
                    <span className="inline-flex max-w-max px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 mt-1">
                      {adminRole}
                    </span>
                  </div>
                </div>

                <hr className="border-slate-900" />

                {/* Menu Items */}
                <div className="flex flex-col gap-1">
                  <Link 
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-350 hover:bg-[#161d33] hover:text-slate-100 transition-all text-left cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>My Profile</span>
                  </Link>
                  <Link 
                    to="/security"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-350 hover:bg-[#161d33] hover:text-slate-100 transition-all text-left cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>Security Settings</span>
                  </Link>
                </div>

                <hr className="border-slate-900" />

                {/* Notification Preference Dropdown */}
                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[9px] font-extrabold text-slate-550 tracking-wider uppercase pl-2.5 flex items-center justify-between">
                    <span>Notification Preferences</span>
                    {sendingNotificationEmail && <span className="text-[8px] text-indigo-400 font-normal animate-pulse">Sending email...</span>}
                  </span>
                  
                  <div className="px-2.5 py-1">
                    <select
                      value={notificationPref}
                      disabled={sendingNotificationEmail}
                      onChange={(e) => handleNotificationPrefChange(e.target.value)}
                      className="w-full bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold px-2.5 py-2 rounded-xl outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      <option value="None" className="bg-slate-800 text-slate-200">None</option>
                      <option value="Daily Summary" className="bg-slate-800 text-slate-200">Daily Summary</option>
                      <option value="Instant Email Alert" className="bg-slate-800 text-slate-200">Instant Email Alert</option>
                    </select>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/5 transition-all text-left cursor-pointer w-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — hidden on mobile, visible on md+. On mobile it slides in as a drawer. */}
        <aside
          className={`
            fixed md:relative inset-y-0 left-0 z-50
            w-64 border-r border-slate-900 bg-[#070b13] p-4 flex flex-col justify-between flex-shrink-0
            transition-transform duration-200 ease-in-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          {/* Mobile close button */}
          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Navigation</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            {/* Admin Platform Card */}
            <div className="flex items-center gap-3 p-3 bg-[#0d1323] border border-slate-800/60 rounded-2xl mb-6 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-indigo-400 fill-indigo-400/15" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-bold text-white">Admin Panel</span>
                <span className="text-[10px] text-slate-500 mt-1 font-medium">IdeaVault Platform</span>
              </div>
            </div>

            {/* Nav Menu */}
            <nav className="space-y-1">
              {filteredSidebarItems.map(({ id, label, icon: Icon, badge, path }) => {
                const isActive = id === "overview" ? isOverview :
                                 id === "verifications" ? isVerifications :
                                 id === "listings" ? isListings :
                                 id === "queries" ? isQueries :
                                 id === "settings" ? isSettings : false;
                return (
                  <button
                    key={id}
                    onClick={() => { navigate(path); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#161d33] text-indigo-400 border border-indigo-500/10"
                        : "text-slate-400 hover:bg-[#0d1323]/50 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                      <span>{label}</span>
                    </div>
                    {badge > 0 && (
                      <span className="h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-sm">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sign Out Button */}
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all w-full text-left cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </aside>

        {/* Scrollable Main Content Area */}
        <main className="flex-1 flex flex-col bg-[#070b13] overflow-y-auto overflow-x-hidden relative">
          {/* Dynamic Nested Route Rendering */}
          <Routes>
            <Route 
              path="/" 
              element={
                <Navigate 
                  to={
                    (() => {
                      const emailKey = (user?.email || "").toLowerCase().trim();
                      const pref = adminProfile?.default_landing_page || (emailKey ? localStorage.getItem(`admin_landing_${emailKey}`) : null);
                      if (pref && pref !== "/" && pref !== "/login" && pref !== "/admin/login") {
                        return pref;
                      }
                      return "/overview";
                    })()
                  } 
                  replace 
                />
              } 
            />
            <Route path="/overview" element={<Overview />} />
            <Route path="/verifications" element={<VerificationsView />} />
            <Route path="/listings" element={<AllListings />} />
            <Route path="/queries" element={<QueriesView />} />
            <Route 
              path="/settings" 
              element={
                isModerator ? (
                  <Navigate 
                    to="/overview" 
                    replace 
                    state={{ toast: { type: "error", message: "Permission Denied: Super Admin access required." } }} 
                  />
                ) : (
                  <SettingsView />
                )
              } 
            />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/security" element={<SecurityView />} />
          </Routes>

          {/* Global Toast Notification */}
          {toast && (
            <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border animate-fade-in ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
                : "bg-rose-950/90 border-rose-500/30 text-rose-400 shadow-rose-500/10"
            }`}>
              {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span className="text-xs font-bold">{toast.message}</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
