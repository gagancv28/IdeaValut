// src/pages/FounderDashboard.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, BarChart3, HelpCircle, Send, FileText,
  Clock, Save, ArrowUpRight, Search, Eye, MousePointerClick, AlertCircle, ExternalLink, RefreshCw, Trash2, XCircle, X,
  Camera, Loader2, Upload, Brain, Star, Sparkles, TrendingUp, ChevronRight
} from "lucide-react";
import { supabase } from "../utils/supabase";
import StartupCard from "../components/discovery/StartupCard";
import ContactModal from "../components/discovery/ContactModal";
import { useRazorpayCheckout } from "../hooks/useRazorpayCheckout";
import { useStartupPlan } from "../hooks/useStartupPlan";
import { toast } from "../utils/toast";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function FounderDashboard({ isMaintenance }) {
  const navigate = useNavigate();
  const { planType, status, paymentStatus, payment_status, subscription_ends_at, expiryDate, requested_plan, verification_status, upgrade_status, suspension_reason } = useStartupPlan();
  const isActive = status === "active" || paymentStatus === "paid" || payment_status === "paid";
  const [activeContactStartup, setActiveContactStartup] = useState(null);
  
  const { handleCheckout, isProcessing } = useRazorpayCheckout();
  const [activeTab, setActiveTab] = useState("My Listing");
  const [saveStatus, setSaveStatus] = useState("");
  const [queryStatus, setQueryStatus] = useState("");
  const [queryText, setQueryText] = useState("");
  const [querySubject, setQuerySubject] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedSuspensionBanner, setDismissedSuspensionBanner] = useState(false);
  const logoInputRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [metrics, setMetrics] = useState({
    impressions: 0,
    views: 0,
    clicks: 0,
    impressionsChange: "+0% vs last week",
    viewsChange: "+0% vs last week",
    clicksChange: "+0% vs last week",
  });
  const [chartData, setChartData] = useState([0, 0, 0, 0]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const hasProfile = sessionStorage.getItem("ideavault_has_profile") === "true";

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPublicDoc, setUploadingPublicDoc] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPublicDoc, setDeletingPublicDoc] = useState(false);
  const [validated, setValidated] = useState(false);
  const [aiInsights, setAiInsights] = useState(null); // AI Vault Score data
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyzeListing = async () => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}/rerun-analysis`, {
        method: "POST"
      });
      if (res.ok) {
        toast.success("AI Analysis completed!");
        const res2 = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}/ai-insights?t=${Date.now()}`);
        if (res2.ok) {
          const data = await res2.json();
          if (data?.ai_insights) setAiInsights(data.ai_insights);
        }
      } else {
        toast.error("AI Analysis failed.");
      }
    } catch (err) {
      toast.error("Error running AI analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Load dynamically from sessionStorage if completed, otherwise use fallback defaults
  const [formData, setFormData] = useState(() => {
    const savedProfile = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "null");
    const sessionUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");

    if (savedProfile) {
      return {
        name: savedProfile.companyName || savedProfile.name || "",
        founderName: savedProfile.founderName || "",
        email: savedProfile.email || sessionUser?.email || "",
        website: savedProfile.website || "",
        pitch: savedProfile.pitch || "",
        industry: savedProfile.industry === "Other" ? savedProfile.industryOther : savedProfile.industry || "",
        stage: savedProfile.stage || "",
        minTicket: savedProfile.fundingAsk || savedProfile.minTicket || "",
        description: savedProfile.description || "",
        location: savedProfile.location || "",
        teamSize: savedProfile.teamSize || savedProfile.team || "",
        traction: savedProfile.traction || "",
        tagsString: savedProfile.tagsString || (Array.isArray(savedProfile.tags) ? savedProfile.tags.join(", ") : ""),
        tier: savedProfile.tier || "Basic",
        // Private doc → pitchDeckUrl; Public doc → publicDocumentUrl
        pitchDeckUrl: savedProfile.pitchDeckUrl || savedProfile.documentUrl || (savedProfile.documentUrls || [])[0] || "",
        documentUrls: savedProfile.documentUrls || (savedProfile.pitchDeckUrl ? [savedProfile.pitchDeckUrl] : []),
        publicDocumentUrl: savedProfile.publicDocumentUrl || savedProfile.public_document_url || "",
        public_document_url: savedProfile.public_document_url || savedProfile.publicDocumentUrl || "",
        logoUrl: savedProfile.logoUrl || savedProfile.logo_url || "",
        logo_url: savedProfile.logo_url || savedProfile.logoUrl || "",
        contactEmail: savedProfile.contactInfo?.email || savedProfile.contactEmail || "",
        contactPhone: savedProfile.contactInfo?.phone || savedProfile.contactPhone || "",
        additionalContacts: savedProfile.contactInfo?.additional || savedProfile.additionalContacts || [],
      };
    }

    return {
      name: "",
      founderName: "",
      email: sessionUser?.email || "",
      website: "",
      pitch: "",
      industry: "",
      stage: "",
      minTicket: "",
      description: "",
      location: "",
      teamSize: "",
      traction: "",
      tagsString: "",
      tier: "Basic",
      pitchDeckUrl: "",
      documentUrls: [],
      publicDocumentUrl: "",
      public_document_url: "",
      logoUrl: "",
      logo_url: "",
      contactEmail: "",
      contactPhone: "",
      additionalContacts: [],
    };
  });

  // Always re-fetch the latest data from Supabase and server on mount so hard refresh keeps updated logo
  useEffect(() => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) return;

    // 1. Direct Supabase fetch query selecting * to explicitly retrieve logo_url column
    const loadFromSupabase = async () => {
      try {
        let sbRow = null;
        if (isValidUUID(session.userId)) {
          const { data } = await supabase.from('startups').select('*').eq('user_id', session.userId).maybeSingle();
          sbRow = data;
        } else if (!isNaN(Number(session.userId))) {
          const { data } = await supabase.from('startups').select('*').eq('id', Number(session.userId)).maybeSingle();
          sbRow = data;
        }

        if (sbRow) {
          const fetchedLogo = sbRow.logo_url || sbRow.logoUrl || (sbRow.additional_contacts && sbRow.additional_contacts.logo_url) || "";
          if (fetchedLogo) {
            setFormData(prev => ({
              ...prev,
              logo_url: fetchedLogo,
              logoUrl: fetchedLogo
            }));
          }
        }
      } catch (err) {
        console.warn("[dashboard] Direct Supabase logo fetch error:", err.message);
      }
    };

    loadFromSupabase();

    fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.startup) return;
        const s = data.startup;
        setFormData(prev => ({
          ...prev,
          name: s.companyName || s.name || prev.name,
          founderName: s.founderName || prev.founderName,
          email: s.email || prev.email,
          website: s.website || prev.website,
          pitch: s.pitch || prev.pitch,
          industry: s.industry || prev.industry,
          stage: s.stage || prev.stage,
          minTicket: s.minTicket || s.fundingAsk || prev.minTicket,
          description: s.description || prev.description,
          location: s.location || prev.location,
          teamSize: s.teamSize || prev.teamSize,
          traction: s.traction || prev.traction,
          tagsString: s.tagsString || (Array.isArray(s.tags) ? s.tags.join(", ") : prev.tagsString),
          pitchDeckUrl: s.pitchDeckUrl || s.pitch_deck_url || s.documentUrl || (s.documentUrls || [])[0] || prev.pitchDeckUrl || "",
          documentUrls: (Array.isArray(s.documentUrls) && s.documentUrls.length > 0) ? s.documentUrls : ((s.pitchDeckUrl || s.pitch_deck_url) ? [s.pitchDeckUrl || s.pitch_deck_url] : (prev.documentUrls || [])),
          publicDocumentUrl: s.publicDocumentUrl || s.public_document_url || prev.publicDocumentUrl || "",
          public_document_url: s.public_document_url || s.publicDocumentUrl || prev.public_document_url || "",
          logoUrl: s.logoUrl || s.logo_url || prev.logoUrl || prev.logo_url || "",
          logo_url: s.logo_url || s.logoUrl || prev.logo_url || prev.logoUrl || "",
          contactEmail: s.contactEmail || prev.contactEmail,
          contactPhone: s.contactPhone || prev.contactPhone,
          additionalContacts: s.additionalContacts || prev.additionalContacts,
        }));
        const updated = {
          ...s,
          companyName: s.companyName || s.name,
          logo_url: s.logo_url || s.logoUrl,
          logoUrl: s.logoUrl || s.logo_url,
          tagsString: s.tagsString || (Array.isArray(s.tags) ? s.tags.join(", ") : ""),
          contactInfo: { email: s.contactEmail, phone: s.contactPhone, additional: s.additionalContacts || [] },
        };
        sessionStorage.setItem("ideavault_startup_profile", JSON.stringify(updated));
        console.log("[dashboard] Loaded fresh startup data from server for user:", session.userId);
      })
      .catch(err => console.warn("[dashboard] Could not fetch fresh startup data:", err.message));

    // Fetch AI Insights alongside startup data
    const fetchAiInsights = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}/ai-insights?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ai_insights) {
            setAiInsights(data.ai_insights);
          }
        }
      } catch (err) {
        console.warn("[dashboard] Could not fetch AI insights:", err.message);
      }
    };
    fetchAiInsights();
  }, []);

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

  const isValidUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || "");

  const handleLogoUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit. Please choose a smaller image.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Invalid file format. Only JPG, PNG, and WEBP images are allowed.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    const sessionUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    const userId = sessionUser?.userId || "startup";

    try {
      setUploadingLogo(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `logos/${userId}-${Date.now()}.${fileExt}`;

      let publicUrl = "";
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.warn("[dashboard] Client storage upload returned error, attempting server upload fallback:", uploadError.message);
        // Fallback to server API upload (bypasses RLS)
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const fileData = await base64Promise;

        const res = await fetch(`${getApiBaseUrl()}/api/upload/logo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, fileName: file.name, fileData, mimeType: file.type })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || uploadError.message || "Failed to upload logo.");
        }

        const resData = await res.json();
        publicUrl = resData.publicUrl;
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
        publicUrl = publicUrlData?.publicUrl || "";
      }

      if (!userId || !publicUrl) {
        const msg = "Missing startup ID or Image URL";
        toast.error(msg);
        throw new Error(msg);
      }

      try {
        let updateRes = null;
        if (isValidUUID(userId)) {
          updateRes = await supabase
            .from('startups')
            .update({ logo_url: publicUrl })
            .eq('user_id', userId)
            .select();
        } else if (!isNaN(Number(userId))) {
          updateRes = await supabase
            .from('startups')
            .update({ logo_url: publicUrl })
            .eq('id', Number(userId))
            .select();
        }

        if (updateRes?.error) {
          console.warn("[dashboard] Direct client Supabase update warning:", updateRes.error.message);
        } else if (updateRes?.data && updateRes.data.length > 0) {
          sbSuccess = true;
        }
      } catch (sbErr) {
        console.warn("[dashboard] Direct Supabase update exception:", sbErr.message);
      }

      // Server API update via service role key (guarantees DB write even when client RLS restricts update)
      const putRes = await fetch(`${getApiBaseUrl()}/api/startups/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, logo_url: publicUrl, logoUrl: publicUrl })
      });

      if (!putRes.ok) {
        console.warn("[dashboard] Server API logo sync warning:", putRes.statusText);
      }

      setFormData(prev => ({
        ...prev,
        logoUrl: publicUrl,
        logo_url: publicUrl
      }));

      const cached = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify({
        ...cached,
        logo_url: publicUrl,
        logoUrl: publicUrl
      }));

      window.dispatchEvent(new CustomEvent("startups-updated"));
      toast.success("Logo updated successfully");
    } catch (err) {
      console.error("[dashboard] Logo upload error:", err);
      toast.error(`Logo Upload Failed: ${err.message || "Upload error"}`);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleDocumentUpload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const files = Array.from(e?.target?.files || []);
    if (files.length === 0) return;

    setUploadingDoc(true);
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      const msg = "Session expired. Please log in again to upload documents.";
      toast.error(msg);
      alert(msg);
      setUploadingDoc(false);
      return;
    }

    try {
      const currentPrivateUrls = Array.isArray(formData.documentUrls) && formData.documentUrls.length > 0
        ? formData.documentUrls
        : (typeof formData.pitchDeckUrl === 'string' ? formData.pitchDeckUrl.split(',').map(s=>s.trim()).filter(Boolean) : []);

      const newUrls = [];
      for (const file of files) {
        const filePath = `${session.userId}/${Date.now()}_${file.name}`;
        try {
          await supabase.storage
            .from("documents")
            .upload(filePath, file, { cacheControl: "3600", upsert: false });
        } catch (stEx) {
          console.warn("[dashboard] Storage upload notice:", stEx);
        }

        const { data: publicUrlData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (publicUrl) {
          newUrls.push(publicUrl);
        }
      }

      if (newUrls.length === 0) {
        throw new Error("Failed to retrieve uploaded file URLs.");
      }

      const updatedList = [...currentPrivateUrls, ...newUrls];
      const joinedStr = updatedList.join(',');

      await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pitchDeckUrl: joinedStr,
          pitch_deck_url: joinedStr,
          documentUrls: updatedList,
          status: "pending_documents",
          verification_status: "pending"
        })
      });

      setFormData((prev) => ({
        ...prev,
        documentUrls: updatedList,
        documentUrl: updatedList[0] || "",
        pitchDeckUrl: joinedStr
      }));

      const cached = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify({
        ...cached,
        documentUrls: updatedList,
        pitchDeckUrl: joinedStr
      }));

      toast.success(`${newUrls.length} Verification document(s) uploaded successfully!`);
    } catch (err) {
      console.error("Document Upload Flow Error:", err);
      toast.error(`Upload error: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      if (e?.target) e.target.value = "";
    }
  };

  const handlePublicDocumentUpload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const files = Array.from(e?.target?.files || []);
    if (files.length === 0) return;

    setUploadingPublicDoc(true);
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      const msg = "Session expired. Please log in again to upload documents.";
      toast.error(msg);
      alert(msg);
      setUploadingPublicDoc(false);
      return;
    }

    try {
      const currentPublicUrls = Array.isArray(formData.publicDocumentUrls) && formData.publicDocumentUrls.length > 0
        ? formData.publicDocumentUrls
        : (typeof formData.publicDocumentUrl === 'string' ? formData.publicDocumentUrl.split(',').map(s=>s.trim()).filter(Boolean) : []);

      const newUrls = [];
      for (const file of files) {
        const filePath = `${session.userId}/public_${Date.now()}_${file.name}`;
        try {
          await supabase.storage
            .from("documents")
            .upload(filePath, file, { cacheControl: "3600", upsert: false });
        } catch (stEx) {
          console.warn("[dashboard] Storage upload notice:", stEx);
        }

        const { data: publicUrlData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (publicUrl) {
          newUrls.push(publicUrl);
        }
      }

      if (newUrls.length === 0) {
        throw new Error("Failed to retrieve uploaded public file URLs.");
      }

      const updatedList = [...currentPublicUrls, ...newUrls];
      const joinedStr = updatedList.join(',');

      await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          publicDocumentUrl: joinedStr,
          public_document_url: joinedStr,
          publicDocumentUrls: updatedList,
          status: "pending_documents",
          verification_status: "pending"
        })
      });

      setFormData((prev) => ({
        ...prev,
        publicDocumentUrls: updatedList,
        publicDocumentUrl: joinedStr,
        public_document_url: joinedStr
      }));

      const cached = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify({
        ...cached,
        publicDocumentUrls: updatedList,
        publicDocumentUrl: joinedStr
      }));

      toast.success(`${newUrls.length} Public pitch deck file(s) uploaded successfully!`);
    } catch (err) {
      console.error("Public Document Upload Flow Error:", err);
      toast.error(`Upload error: ${err.message}`);
    } finally {
      setUploadingPublicDoc(false);
      if (e?.target) e.target.value = "";
    }
  };

  const handleRemovePrivateDocItem = async (indexToRemove) => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) return;

    const currentList = Array.isArray(formData.documentUrls) && formData.documentUrls.length > 0
      ? formData.documentUrls
      : (typeof formData.pitchDeckUrl === 'string' ? formData.pitchDeckUrl.split(',').map(s=>s.trim()).filter(Boolean) : []);

    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    const joinedStr = updatedList.join(',');

    try {
      await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pitchDeckUrl: joinedStr,
          pitch_deck_url: joinedStr,
          documentUrls: updatedList
        })
      });

      setFormData((prev) => ({
        ...prev,
        documentUrls: updatedList,
        documentUrl: updatedList[0] || "",
        pitchDeckUrl: joinedStr
      }));

      toast.success("Document removed.");
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("Failed to remove document.");
    }
  };

  const handleRemovePublicDocItem = async (indexToRemove) => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) return;

    const currentList = Array.isArray(formData.publicDocumentUrls) && formData.publicDocumentUrls.length > 0
      ? formData.publicDocumentUrls
      : (typeof formData.publicDocumentUrl === 'string' ? formData.publicDocumentUrl.split(',').map(s=>s.trim()).filter(Boolean) : []);

    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    const joinedStr = updatedList.join(',');

    try {
      await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          publicDocumentUrl: joinedStr,
          public_document_url: joinedStr,
          publicDocumentUrls: updatedList
        })
      });

      setFormData((prev) => ({
        ...prev,
        publicDocumentUrls: updatedList,
        publicDocumentUrl: joinedStr,
        public_document_url: joinedStr
      }));

      toast.success("Public pitch deck document removed.");
    } catch (err) {
      console.error("Error deleting public document:", err);
      toast.error("Failed to remove public document.");
    }
  };

  const executeDeletePublicDocument = async () => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      alert("Session expired. Please log in again.");
      setIsDeleteModalOpen(false);
      return;
    }

    try {
      setDeletingPublicDoc(true);

      // 1. Remove file from Supabase Storage
      const urlToRemove = formData.publicDocumentUrl || formData.public_document_url;
      if (urlToRemove && typeof urlToRemove === "string" && urlToRemove.includes("/documents/")) {
        const parts = urlToRemove.split("/documents/");
        if (parts[1]) {
          const storagePath = parts[1].split("?")[0];
          await supabase.storage.from("documents").remove([storagePath]);
          console.log("[dashboard] Removed public doc from Supabase storage:", storagePath);
        }
      }

      // 2. Direct Supabase Database Update: set public_document_url to null
      try {
        const { error: sbErr } = await supabase
          .from("startups")
          .update({ public_document_url: null })
          .eq("user_id", session.userId);

        if (sbErr) {
          console.warn("[dashboard] Direct Supabase public_document_url update warning:", sbErr.message);
        } else {
          console.log("[dashboard] Directly set public_document_url to null in Supabase for user:", session.userId);
        }
      } catch (sbEx) {
        console.warn("[dashboard] Direct Supabase update exception:", sbEx.message);
      }

      // 3. Backend API Update
      const updatedPayload = {
        ...formData,
        publicDocumentUrl: "",
        public_document_url: "",
        company_name: formData.name,
        companyName: formData.name,
        userId: session.userId,
      };

      const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update database.");
      }

      // 4. Update local state immediately
      setFormData((prev) => ({
        ...prev,
        publicDocumentUrl: "",
        public_document_url: "",
      }));

      // 5. Update local sessionStorage cache
      const cached = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
      cached.publicDocumentUrl = "";
      cached.public_document_url = "";
      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify(cached));

      setIsDeleteModalOpen(false);
      toast.success("Public Pitch Deck deleted successfully");
    } catch (err) {
      console.error("[dashboard] Error deleting public document:", err);
      alert("Failed to delete public document: " + err.message);
    } finally {
      setDeletingPublicDoc(false);
    }
  };

  const fetchStartupAndAnalytics = useCallback(async () => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      setAnalyticsLoading(false);
      return;
    }

    try {
      setAnalyticsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        const responseData = await res.json();
        if (responseData.startup) {
          const startup = responseData.startup;
          setFormData(prev => ({
            ...prev,
            name: startup.companyName || prev.name || "",
            founderName: startup.founderName || prev.founderName || "",
            email: startup.email || session.email || prev.email || "",
            website: startup.website || prev.website || "",
            pitch: startup.pitch || prev.pitch || "",
            industry: startup.industry || prev.industry || "",
            stage: startup.stage || prev.stage || "",
            minTicket: startup.fundingAsk || prev.minTicket || "",
            description: startup.description || prev.description || "",
            location: startup.location || prev.location || "",
            teamSize: startup.teamSize || startup.team || prev.teamSize || "",
            traction: startup.traction || prev.traction || "",
            tagsString: startup.tagsString || (Array.isArray(startup.tags) ? startup.tags.join(", ") : prev.tagsString || ""),
            tier: startup.tier || prev.tier || "Basic",
            pitchDeckUrl: startup.pitchDeckUrl || startup.pitch_deck_url || startup.documentUrl || (startup.documentUrls || [])[0] || prev.pitchDeckUrl || "",
            documentUrls: (Array.isArray(startup.documentUrls) && startup.documentUrls.length > 0) ? startup.documentUrls : ((startup.pitchDeckUrl || startup.pitch_deck_url) ? [startup.pitchDeckUrl || startup.pitch_deck_url] : (prev.documentUrls || [])),
            publicDocumentUrl: startup.publicDocumentUrl || startup.public_document_url || prev.publicDocumentUrl || "",
            public_document_url: startup.public_document_url || startup.publicDocumentUrl || prev.public_document_url || "",
            logoUrl: startup.logoUrl || startup.logo_url || prev.logoUrl || prev.logo_url || "",
            logo_url: startup.logo_url || startup.logoUrl || prev.logo_url || prev.logoUrl || "",
            contactEmail: startup.contactEmail || prev.contactEmail || "",
            contactPhone: startup.contactPhone || prev.contactPhone || "",
            additionalContacts: startup.additionalContacts || prev.additionalContacts || [],
          }));

          // Fetch time-series analytics breakdown cleanly in an isolated try/catch block
          try {
            const analyticsRes = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}/analytics?t=${Date.now()}`, {
              cache: "no-store",
              headers: { "Cache-Control": "no-cache" }
            });
            if (analyticsRes.ok) {
              const analyticsObj = await analyticsRes.json();
              setMetrics({
                impressions: Number(analyticsObj?.impressions) || 0,
                views: Number(analyticsObj?.views) || 0,
                clicks: Number(analyticsObj?.clicks) || 0,
                impressionsChange: analyticsObj?.impressionsChange || "+0% vs last week",
                viewsChange: analyticsObj?.viewsChange || "+0% vs last week",
                clicksChange: analyticsObj?.clicksChange || "+0% vs last week",
              });
              setChartData(
                Array.isArray(analyticsObj?.weeklyTraffic) && analyticsObj.weeklyTraffic.length > 0
                  ? analyticsObj.weeklyTraffic
                  : [0, 0, 0, 0]
              );
            } else {
              setMetrics({
                impressions: 0,
                views: 0,
                clicks: 0,
                impressionsChange: "+0% vs last week",
                viewsChange: "+0% vs last week",
                clicksChange: "+0% vs last week",
              });
              setChartData([0, 0, 0, 0]);
            }
          } catch (aErr) {
            console.warn("[analytics] Non-blocking analytics sub-fetch warning:", aErr.message);
            setMetrics({
              impressions: 0,
              views: 0,
              clicks: 0,
              impressionsChange: "+0% vs last week",
              viewsChange: "+0% vs last week",
              clicksChange: "+0% vs last week",
            });
            setChartData([0, 0, 0, 0]);
          }

          // Sync local storage
          sessionStorage.setItem("ideavault_startup_profile", JSON.stringify(startup));
          sessionStorage.setItem("ideavault_has_profile", "true");
        }
      }
    } catch (err) {
      console.error("Error fetching startup analytics from Supabase:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStartupAndAnalytics();

    window.addEventListener("startups-updated", fetchStartupAndAnalytics);

    return () => {
      window.removeEventListener("startups-updated", fetchStartupAndAnalytics);
    };
  }, [fetchStartupAndAnalytics]);

  // Re-fetch fresh analytics whenever founder switches to the 'Analytics' tab
  useEffect(() => {
    if (activeTab === "Analytics") {
      fetchStartupAndAnalytics();
    }
  }, [activeTab, fetchStartupAndAnalytics]);

  if (analyticsLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-600 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-800">Loading Startup Profile & Performance...</span>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-lg animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Building2 className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Startup Listing Incomplete</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            You have successfully authenticated! To access your performance dashboard and investor analytics, please complete your startup directory listing details first.
          </p>
          <button
            onClick={() => navigate("/onboard")}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            Fill Startup Details
          </button>
        </div>
      </div>
    );
  }

  // Parse category/tags string to array for live card rendering
  const parsedTags = formData?.tagsString
    ? formData.tagsString.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const mockStartup = {
    id: 99,
    name: formData?.name || "",
    logoInitials: formData?.name ? formData.name.substring(0, 2).toUpperCase() : "IV",
    logoColor: "#6366f1",
    pitch: formData?.pitch || "",
    industry: formData?.industry || "",
    stage: formData?.stage || "",
    location: formData?.location || "N/A",
    tier: planType,
    minTicket: formData?.minTicket || "",
    verified: planType === "Verified Pro" || planType === "Spotlight",
    founded: "2024",
    team: parseInt(formData?.teamSize || "0", 10) || 0,
    traction: formData?.traction || "N/A",
    description: formData?.description || "",
    tags: parsedTags,
    logoUrl: formData?.logoUrl || formData?.logo_url || "",
    logo_url: formData?.logo_url || formData?.logoUrl || "",
  };

  const effectiveExpiry = subscription_ends_at || expiryDate;

  const getDaysLeft = (expiry) => {
    if (!expiry) return null;
    const diff = new Date(expiry) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysLeft = getDaysLeft(effectiveExpiry);
  const cycleEndStr = effectiveExpiry
    ? new Date(effectiveExpiry).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  const analyticsCards = [
    { 
      label: "Search Impressions", 
      value: metrics.impressions.toLocaleString(), 
      icon: Search, 
      change: metrics.impressionsChange || "+0% vs last week", 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10" 
    },
    { 
      label: "Profile Views", 
      value: metrics.views.toLocaleString(), 
      icon: Eye, 
      change: metrics.viewsChange || "+0% vs last week", 
      color: "text-indigo-500", 
      bgColor: "bg-indigo-500/10" 
    },
    { 
      label: "Outbound Clicks", 
      value: metrics.clicks.toLocaleString(), 
      icon: MousePointerClick, 
      change: metrics.clicksChange || "+0% vs last week", 
      color: "text-emerald-500", 
      bgColor: "bg-emerald-500/10" 
    },
  ];

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateContacts = () => {
    const hasEmail = !!formData.contactEmail?.trim();
    const hasPhone = !!formData.contactPhone?.trim();
    const hasAdditional = (formData.additionalContacts || []).some((c) => !!c.value?.trim());
    return hasEmail || hasPhone || hasAdditional;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setValidated(true);
    setSaveStatus("saving");

    if (!validateContacts()) {
      alert("Please provide at least one contact method so investors can reach you.");
      setSaveStatus("");
      return;
    }

    try {
      const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
      if (!session?.userId) {
        alert("Session expired. Please log in again.");
        setSaveStatus("");
        return;
      }

      const payload = {
        name: formData.name,
        company_name: formData.name,
        companyName: formData.name,
        founderName: formData.founderName,
        email: formData.email,
        website: formData.website,
        pitch: formData.pitch,
        industry: formData.industry,
        stage: formData.stage,
        minTicket: formData.minTicket,
        description: formData.description,
        location: formData.location,
        teamSize: formData.teamSize,
        traction: formData.traction,
        tags: formData.tagsString ? formData.tagsString.split(",").map((t) => t.trim()).filter(Boolean) : [],
        userId: session.userId,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        additionalContacts: formData.additionalContacts || [],
        // Private verification document → pitch_deck_url column
        pitchDeckUrl: formData.pitchDeckUrl || (formData.documentUrls || [])[0] || "",
        documentUrls: formData.documentUrls || [],
        // Public pitch deck → public_document_url column
        publicDocumentUrl: formData.publicDocumentUrl || formData.public_document_url || "",
        logoUrl: formData.logoUrl || formData.logo_url || (JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}").logo_url) || "",
        logo_url: formData.logo_url || formData.logoUrl || (JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}").logo_url) || "",
      };

      // All saves route through the server PUT which uses the Supabase service role key
      // (bypasses RLS). Direct client-side writes with the anon key are blocked by RLS
      // and silently fail, so we do NOT use supabase.update() here from the client.


      // Send PUT to server endpoint (which also upserts into Supabase and local DB)
      const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      if (!res.ok) {
        const errMsg = responseData.error || responseData.dbError || "Failed to save startup details.";
        throw new Error(`Save failed: ${errMsg}`);
      }

      // Update local sessionStorage cache on success
      const parsedTags = (formData.tagsString || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const savedData = {
        ...formData,
        companyName: formData.name,
        fundingAsk: formData.minTicket,
        tags: parsedTags,
        team: parseInt(formData.teamSize, 10) || 0,
        status: "active",
      };

      sessionStorage.setItem("ideavault_startup_profile", JSON.stringify(savedData));

      // Broadcast to all components (Discover page, etc.) to refresh
      window.dispatchEvent(new CustomEvent("startups-updated"));

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error(err);
      alert(err.message);
      setSaveStatus("");
    }
  };

  const handleSendQuery = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!queryText.trim() || !querySubject.trim()) {
      toast.error("Please fill in both the subject and message.");
      return;
    }

    isSubmittingRef.current = true;
    setQueryStatus("sending");
    setIsSubmitting(true);

    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      toast.error("Session expired. Please log in again.");
      setQueryStatus("");
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return;
    }

    const founderName = sessionStorage.getItem("ideavault_startup_profile") 
      ? JSON.parse(sessionStorage.getItem("ideavault_startup_profile")).founderName 
      : (session?.email ? session.email.split('@')[0] : 'Founder');
    const email = session?.email || 'founder@example.com';
    const company = sessionStorage.getItem("ideavault_startup_profile")
      ? JSON.parse(sessionStorage.getItem("ideavault_startup_profile")).companyName
      : 'Client Dashboard';

    try {
      // Call backend API which performs the single insert and propagates to support threads
      const res = await fetch(`${getApiBaseUrl()}/api/dashboard-queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: founderName,
          email: email,
          company: company,
          subject: querySubject.trim(),
          category: "Technical",
          message: queryText.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit query.");
      }

      setQueryStatus("sent");
      setQueryText("");
      setQuerySubject("");
      toast.success("Support query submitted successfully!");

      setTimeout(() => setQueryStatus(""), 3000);
    } catch (err) {
      console.error("[dashboard] Error sending support query:", err);
      toast.error("Failed to send query: " + err.message);
      alert("Failed to send query: " + err.message);
      setQueryStatus("");
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-slate-50 text-slate-800">
      {/* 1. Sidebar Layout */}
      <aside
        className="w-full md:w-64 flex-shrink-0 bg-white text-slate-800 border-b md:border-b-0 md:border-r border-gray-200 md:min-h-[calc(100vh-4rem)] p-4 sm:p-6 shadow-sm"
      >
        <div className="mb-4 md:mb-8">
          <div className="flex items-center gap-3 mb-1 md:mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <span className="text-amber-500 font-bold text-sm">IV</span>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm leading-tight">{formData.name || "Startup Listing"}</h2>
              <span className={`text-xs font-medium ${planType === "Spotlight" ? "text-amber-600 font-bold" : "text-indigo-600"}`}>
                ★ {planType} Member
              </span>
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col overflow-x-auto gap-2 md:gap-1.5 pb-1 md:pb-0">
          {[
            { id: "My Listing", label: "My Listing", icon: Building2 },
            { id: "Analytics", label: "Analytics", icon: BarChart3 },
            { id: "Support", label: "Support", icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 bg-slate-50 text-slate-800 p-6 md:p-10 max-w-5xl mx-auto w-full">
        {activeTab === "My Listing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
            {/* Left Col: Status & Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Status Banners ── */}

              {/* 1. Upgrade suspended by admin (targeted — base plan untouched) */}
              {!dismissedSuspensionBanner && upgrade_status === 'suspended' ? (
                <div className="rounded-2xl border border-red-300 bg-red-50 overflow-hidden mb-4 relative">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-red-100 border-b border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                      <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">Upgrade Request Suspended</h4>
                    </div>
                    <button
                      onClick={() => setDismissedSuspensionBanner(true)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-200/60 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                      title="Dismiss message"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-700">
                      Your request to upgrade to <strong>{requested_plan || 'a higher plan'}</strong> was <strong className="text-red-600">suspended by the admin</strong>. Your current <strong>{planType}</strong> plan is still active.
                    </p>
                    <div className="bg-white border border-red-200 rounded-xl px-3.5 py-3 shadow-sm">
                      <p className="text-[10.5px] font-bold text-red-600 uppercase tracking-wider mb-1">Reason for Suspension</p>
                      <p className="text-xs text-slate-800 font-medium">{suspension_reason || "No specific reason provided by admin. Please contact support for details."}</p>
                    </div>
                    <div className="flex gap-2 pt-1 items-center">
                      <button
                        onClick={() => { setActiveTab('Support'); }}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all"
                      >
                        <Send className="h-3 w-3" />
                        Contact Support
                      </button>
                      <button
                        onClick={() => setActiveTab('My Listing')}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 transition-all"
                      >
                        Re-submit Documents
                      </button>
                      <button
                        onClick={() => setDismissedSuspensionBanner(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : (!dismissedSuspensionBanner && (verification_status === 'suspended' || status === 'suspended')) ? (
                <div className="rounded-2xl border border-red-300 bg-red-50 overflow-hidden mb-4 relative">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-red-100 border-b border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                      <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">Application Suspended</h4>
                    </div>
                    <button
                      onClick={() => setDismissedSuspensionBanner(true)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-200/60 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                      title="Dismiss message"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-700">Your verification application was reviewed and suspended by admin.</p>
                    <div className="bg-white border border-red-200 rounded-xl px-3.5 py-3 shadow-sm">
                      <p className="text-[10.5px] font-bold text-red-600 uppercase tracking-wider mb-1">Reason for Suspension</p>
                      <p className="text-xs text-slate-800 font-medium">{suspension_reason || "No specific reason provided by admin. Please contact support for details."}</p>
                    </div>
                    <div className="flex gap-2 pt-1 items-center">
                      <button
                        onClick={() => setActiveTab('Support')}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all"
                      >
                        <Send className="h-3 w-3" />
                        Contact Support
                      </button>
                      <button
                        onClick={() => setDismissedSuspensionBanner(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : verification_status === "pending" ? (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-500/20 rounded-2xl mb-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide">Upgrade Request Pending</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Your request to upgrade to {requested_plan || "Premium"} is under review by admin.</p>
                  </div>
                </div>
              ) : isActive ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-500/20 rounded-2xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Live on Directory</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Your startup is visible and searchable by registered investors.</p>
                  </div>
                </div>
              ) : null}

              {/* ── AI Vault Score Card (shown when payment is active + AI insights exist) ── */}
              {isActive && aiInsights && (
                <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-indigo-50 to-white shadow-sm">
                  {/* Decorative glow */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-violet-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                  <div className="p-5 relative z-10">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-violet-600/15 border border-violet-500/25 flex items-center justify-center">
                          <Brain className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div>
                          <h3 className="text-xs font-extrabold text-violet-700 uppercase tracking-wider">AI Analysis Complete</h3>
                          <p className="text-[10px] text-slate-500 font-medium">Payment Successful · Powered by Gemini</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">✓ Active</span>
                    </div>

                    {/* Score + Details Row */}
                    <div className="flex items-center gap-5">
                      {/* Animated Score Ring */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        {(() => {
                          const score = aiInsights.vault_score || 0;
                          const circumference = 2 * Math.PI * 28;
                          const dashOffset = circumference - (circumference * score) / 10;
                          const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
                          return (
                            <>
                              <svg width="72" height="72" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="6" />
                                <circle
                                  cx="36" cy="36" r="28" fill="none"
                                  stroke={color} strokeWidth="6" strokeLinecap="round"
                                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                                  transform="rotate(-90 36 36)"
                                  style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                                />
                                <text x="36" y="32" textAnchor="middle" fill={color} fontSize="16" fontWeight="900">{score}</text>
                                <text x="36" y="44" textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="700">/10</text>
                              </svg>
                              <span className="text-[9px] font-extrabold text-violet-600 tracking-widest uppercase">Vault Score</span>
                            </>
                          );
                        })()}
                      </div>

                      {/* Quick Stats */}
                      <div className="flex-1 space-y-2">
                        {aiInsights.sector && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-bold w-16 flex-shrink-0 uppercase tracking-wider">Sector</span>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{aiInsights.sector}</span>
                          </div>
                        )}
                        {aiInsights.revenue_model && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-bold w-16 flex-shrink-0 uppercase tracking-wider">Model</span>
                            <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">{aiInsights.revenue_model}</span>
                          </div>
                        )}
                        {aiInsights.investor_profiles?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-bold w-16 flex-shrink-0 uppercase tracking-wider">Matches</span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{aiInsights.investor_profiles.length} Investor Profiles</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Summary */}
                    {aiInsights.ai_summary && (
                      <div className="mt-4 p-3 bg-white/70 border border-violet-100 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3 h-3 text-violet-500" />
                          <span className="text-[9px] font-extrabold text-violet-600 uppercase tracking-wider">AI Summary</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{aiInsights.ai_summary}</p>
                      </div>
                    )}

                    {aiInsights.model === 'mock-fallback' && (
                      <p className="text-[9px] text-amber-500 font-medium mt-3 text-center">Demo analysis · Add GEMINI_API_KEY to apps/server/.env for real AI insights</p>
                    )}
                  </div>
                </div>
              )}

              {(status === "pending_verification" && verification_status !== "pending") ? (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-500/20 rounded-2xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide">Submitted for Admin Approval</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Your request to upgrade to {planType} is under review by admin.</p>
                  </div>
                </div>
              ) : status === "pending_payment" ? (
                <div className="flex items-center justify-between gap-4 p-4 bg-indigo-50 border border-indigo-500/20 rounded-2xl flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">Upgrade Request Approved</h4>
                      <p className="text-xs text-slate-600 mt-0.5">Your application for {planType} was approved! Please finalize the payment.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (isMaintenance) return;
                      setModalTier(planType);
                    }}
                    disabled={isMaintenance}
                    className={`font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 ${
                      isMaintenance 
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed opacity-50" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                    }`}
                    title={isMaintenance ? "Payment disabled during system maintenance" : ""}
                  >
                    Make Payment
                  </button>
                </div>
              ) : !isActive ? (
                <div className="flex items-center gap-3 p-4 bg-slate-100 border border-slate-200 rounded-2xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide">Pending Visibility / Payment</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Please upgrade or renew your plan to activate listing visibility.</p>
                  </div>
                </div>
              ) : null}

              {/* Edit Form */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Startup Profile</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Update your directory listing details below.</p>
                </div>

                <form onSubmit={handleSave} className={`space-y-4 ${validated ? 'was-validated' : ''}`} noValidate>
                  {/* Logo Upload Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 mb-6">
                    <div className="relative group flex-shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-indigo-500/20 shadow-md overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-3xl relative">
                        {(formData.logoUrl || formData.logo_url) ? (
                          <img
                            src={formData.logoUrl || formData.logo_url}
                            alt="Startup Logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{formData.name?.[0]?.toUpperCase() || "S"}</span>
                        )}

                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center z-10">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-full shadow-lg border-2 border-white transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Upload new logo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-1.5">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-sm font-bold text-slate-900">Startup Logo / Profile Picture</h3>
                        {(formData.logoUrl || formData.logo_url) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Active Logo</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Upload a high-resolution logo for your startup card and public profile. Accepted formats: JPG, PNG, or WEBP (Max 2MB).
                      </p>
                      <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingLogo ? "Uploading..." : (formData.logoUrl || formData.logo_url) ? "Change Logo" : "Upload Logo"}
                        </button>
                        {(formData.logoUrl || formData.logo_url) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, logoUrl: "", logo_url: "" }));
                              toast.success("Logo removed. Click 'Save Profile' below to apply changes.");
                            }}
                            disabled={uploadingLogo}
                            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Startup Name</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Founder Name</label>
                      <input
                        name="founderName"
                        value={formData.founderName}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Website *</label>
                      <input
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">One-Line Pitch *</label>
                    <input
                      name="pitch"
                      value={formData.pitch}
                      onChange={handleInputChange}
                      className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Industry *</label>
                      <select
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full cursor-pointer"
                        required
                      >
                        <option value="">Select...</option>
                        {['AI/ML', 'SaaS', 'EdTech', 'FinTech', 'Healthcare'].map((i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Stage *</label>
                      <select
                        name="stage"
                        value={formData.stage}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full cursor-pointer"
                        required
                      >
                        <option value="">Select...</option>
                        {['Idea', 'Prototype', 'MVP', 'Growth', 'Scale'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Min. Investment *</label>
                      <input
                        name="minTicket"
                        value={formData.minTicket}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Location</label>
                      <input
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Team Size</label>
                      <input
                        name="teamSize"
                        type="number"
                        min="1"
                        value={formData.teamSize}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Traction / Users</label>
                      <input
                        name="traction"
                        value={formData.traction}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Category / Tags</label>
                      <input
                        name="tagsString"
                        value={formData.tagsString}
                        onChange={handleInputChange}
                        className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        placeholder="e.g. EdTech, SaaS, AI (comma separated)"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full h-24 resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="border border-gray-200 rounded-2xl p-5 bg-slate-50 space-y-4 shadow-sm">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contact Details</h3>
                      <p className="text-xs text-indigo-600 font-semibold mt-1">At least one contact method is required</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Public Contact Email</label>
                        <input
                          name="contactEmail"
                          value={formData.contactEmail}
                          onChange={handleInputChange}
                          placeholder="contact@company.com"
                          className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Phone Number</label>
                        <input
                          name="contactPhone"
                          value={formData.contactPhone}
                          onChange={handleInputChange}
                          placeholder="+91 98765 43210"
                          className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                        />
                      </div>
                    </div>

                    {/* Dynamic Contacts */}
                    {formData.additionalContacts && formData.additionalContacts.map((contact, index) => (
                      <div key={index} className="flex items-center gap-3 animate-in fade-in duration-100">
                        <select
                          value={contact.label}
                          onChange={(e) => handleAdditionalContactChange(index, "label", e.target.value)}
                          className="form-input bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all max-w-[120px] cursor-pointer"
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
                          className="form-input bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeAdditionalContact(index)}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
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

                  {/* Responsive Document Upload Zones (Stacks Vertically on Mobile) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Private Verification Document Upload */}
                    <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4 shadow-sm">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          PRIVATE VERIFICATION DOCUMENTS (Admin Only)
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                          Uploaded verification documents are kept strictly confidential and only reviewed by the Admin team.
                        </p>
                      </div>

                      {/* Currently Uploaded UI Block */}
                      {(() => {
                        const privateList = Array.isArray(formData?.documentUrls) && formData.documentUrls.length > 0
                          ? formData.documentUrls
                          : (typeof formData?.pitchDeckUrl === 'string' ? formData.pitchDeckUrl.split(',').map(s=>s.trim()).filter(Boolean) : (formData?.pitch_deck_url ? [formData.pitch_deck_url] : []));

                        if (privateList.length === 0) return null;

                        return (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                              Uploaded Documents ({privateList.length})
                            </span>
                            {privateList.map((url, idx) => {
                              if (!url) return null;
                              const fileName = typeof url === "string" && url.startsWith("http")
                                ? (url.split("/").pop()?.split("?")[0] || `Document_${idx + 1}`)
                                : `Document_${idx + 1}`;

                              return (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs"
                                >
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-indigo-700 font-medium hover:underline truncate max-w-[180px] sm:max-w-[240px]"
                                      title={url}
                                    >
                                      {fileName}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-indigo-200 shadow-xs"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <span className="text-[10px] text-slate-400 italic bg-slate-100 px-2 py-1 rounded">Locked</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Input Field State */}
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Upload Verification Document(s) (Multiple files allowed)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.ppt,.pptx,.doc,.docx"
                            onChange={handleDocumentUpload}
                            disabled={uploadingDoc}
                            className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 file:cursor-pointer"
                          />
                        </div>
                        {uploadingDoc && (
                          <p className="text-xs text-indigo-600 font-medium animate-pulse">
                            Uploading to Supabase Storage...
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Public Pitch Deck (Optional) Upload */}
                    <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4 shadow-sm">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          PUBLIC PITCH DECK (Optional)
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                          These documents will be visible to all users on your public Discover profile.
                        </p>
                      </div>

                      {/* Currently Uploaded UI Block */}
                      {(() => {
                        const publicList = Array.isArray(formData?.publicDocumentUrls) && formData.publicDocumentUrls.length > 0
                          ? formData.publicDocumentUrls
                          : (typeof formData?.publicDocumentUrl === 'string' ? formData.publicDocumentUrl.split(',').map(s=>s.trim()).filter(Boolean) : (formData?.public_document_url ? [formData.public_document_url] : []));

                        if (publicList.length === 0) return null;

                        return (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                              Uploaded Public Pitch Deck Documents ({publicList.length})
                            </span>
                            {publicList.map((url, idx) => {
                              if (!url) return null;
                              const fileName = typeof url === "string" && url.startsWith("http")
                                ? (url.split("/").pop()?.split("?")[0] || `Pitch_Deck_${idx + 1}`)
                                : `Pitch_Deck_${idx + 1}`;

                              return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-emerald-700 font-medium hover:underline truncate max-w-[180px] sm:max-w-[240px]"
                                      title={url}
                                    >
                                      {fileName}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-emerald-200 shadow-xs"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePublicDocItem(idx)}
                                      className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Delete this public pitch deck document"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Input Field State */}
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Upload Public Pitch Deck Document(s) (Multiple files allowed)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.ppt,.pptx,.doc,.docx"
                            onChange={handlePublicDocumentUpload}
                            disabled={uploadingPublicDoc}
                            className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
                          />
                        </div>
                        {uploadingPublicDoc && (
                          <p className="text-xs text-emerald-600 font-medium animate-pulse">
                            Uploading public document to Supabase Storage...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saveStatus === "saving"}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Changes Saved!" : "Save Changes"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Col: Preview & Billing & AI */}
            <div className="space-y-6">
              {/* AI Pitch Insights Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1.5"><Brain className="w-4 h-4" /> AI Pitch Insights</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Automated assessment powered by Gemini AI</p>
                  </div>
                  <button
                    onClick={handleAnalyzeListing}
                    disabled={analyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 font-semibold text-[11px] rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  >
                    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Analyze Listing
                  </button>
                </div>
                {aiInsights ? (
                  <div className="space-y-4 text-sm mt-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700 text-xs uppercase">Vault Score</span>
                      <span className="text-xl font-black text-indigo-600 flex items-center gap-1"><Star className="w-4 h-4 fill-indigo-500" /> {aiInsights.score}/10</span>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold uppercase text-slate-500 mb-1">Executive Summary</h4>
                      <p className="text-slate-800 text-xs leading-relaxed">{aiInsights.summary}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-[11px] font-bold uppercase text-emerald-600 mb-1">Strengths</h4>
                        <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                          {aiInsights.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold uppercase text-rose-600 mb-1">Risk Flags</h4>
                        <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                          {aiInsights.risk_flags?.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center text-center">
                    <Brain className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-500">No AI analysis generated yet.</p>
                  </div>
                )}
              </div>

              {/* Card Preview Container */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Card Preview</span>
                  <p className="text-xs text-slate-500 mt-0.5">How your Spotlight listing looks to investors in the directory.</p>
                </div>

                {/* Live Preview Card */}
                <div className="origin-top">
                  <StartupCard startup={mockStartup} onConnect={setActiveContactStartup} />
                </div>
              </div>

              {/* Billing Widget */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Plan & Subscription</span>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                    {planType} Tier
                    <span className={`text-[10px] px-2.5 py-0.5 font-bold rounded-full border ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : planType === "Spotlight"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : planType === "Verified Pro"
                            ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {isActive ? "✓ Active" : (planType === "Spotlight" ? "Premium" : planType === "Verified Pro" ? "Pro" : "Free")}
                    </span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {isActive ? (
                    <>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          {daysLeft !== null ? `${daysLeft} Days Remaining` : "Active Subscription"}
                        </span>
                        <span className="text-slate-500 font-medium">
                          {daysLeft !== null ? `${daysLeft} days left` : (cycleEndStr ? `Cycle Ends ${cycleEndStr}` : "Auto-renews")}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${daysLeft !== null ? Math.min(100, Math.max(5, (daysLeft / 180) * 100)) : 100}%`
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Timer starts upon payment activation</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (isMaintenance) return;
                    handleCheckout(planType === 'Basic' ? 'Verified Pro' : planType, () => {
                      toast.success('Plan renewed/upgraded successfully!');
                    });
                  }}
                  disabled={isMaintenance || isProcessing}
                  className={`w-full py-2.5 border border-gray-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                    isMaintenance || isProcessing
                      ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400" 
                      : "hover:bg-slate-50 cursor-pointer"
                  }`}
                  title={isMaintenance ? "Upgrade disabled during system maintenance" : ""}
                >
                  {isProcessing ? "Processing Checkout..." : "Renew / Upgrade Plan"}
                  {!isProcessing && <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Analytics" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Performance & Analytics</h1>
              <p className="text-sm text-slate-500 mt-1">Real-time statistics on how investors are interacting with your profile.</p>
            </div>

            {analyticsLoading ? (
              <div className="p-12 rounded-2xl bg-white border border-gray-200 text-center space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-500">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Loading live analytics from Supabase...</p>
              </div>
            ) : (
              <>
                {/* 3 Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {analyticsCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                          <div className="text-3xl font-extrabold text-slate-900 mt-1">{stat.value}</div>
                          <div className="text-[11px] text-slate-500 mt-1">{stat.change}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Visual Analytics Chart */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Weekly Traffic Overview</h3>
                  {chartData.length > 0 && chartData.some((v) => v > 0) ? (
                    <div className="h-48 flex items-end gap-2 pt-4 border-b border-gray-200 pb-2">
                      {chartData.map((h, i) => {
                        const maxVal = Math.max(...chartData, 1);
                        const barHeight = Math.round((h / maxVal) * 160);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end group cursor-pointer" style={{ height: '100%' }}>
                            <div className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity mb-1">{h}</div>
                            <div
                              className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-125"
                              style={{
                                height: `${barHeight}px`,
                                background: 'linear-gradient(180deg, #818cf8, #4f46e5)',
                                boxShadow: '0 0 8px rgba(99, 102, 241, 0.3)',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-48 border-b border-gray-200 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-gray-200 flex items-center justify-center mb-3 text-slate-400">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">No traffic recorded yet</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Live weekly traffic bars will populate automatically as investors explore your directory listing.
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500 px-2 font-medium">
                    <span>Week 1</span>
                    <span>Week 2</span>
                    <span>Week 3</span>
                    <span>Week 4</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "Support" && (
          <div className="max-w-3xl animate-in fade-in-50 duration-200">
            {/* Contact Form */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Message the Admin</h2>
                <p className="text-xs text-slate-500 mt-0.5">Submit your support tickets, verification query, or billing assistance requests.</p>
              </div>

              <form onSubmit={handleSendQuery} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Subject</label>
                  <input
                    type="text"
                    value={querySubject}
                    onChange={(e) => setQuerySubject(e.target.value)}
                    placeholder="e.g. Document manual review request"
                    className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Message Description</label>
                  <textarea
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Explain your query in detail..."
                    className="form-input bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-full h-36 resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending Query..." : queryStatus === "sent" ? "Query Sent!" : "Send Query"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {activeContactStartup && (
        <ContactModal
          startup={activeContactStartup}
          onClose={() => setActiveContactStartup(null)}
        />
      )}

      {/* Custom Confirmation Modal for Deleting Public Document */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50 duration-150">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-100 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Public Document?</h3>
              <p className="text-sm text-slate-500">
                Are you sure you want to permanently delete your public pitch deck? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingPublicDoc}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeletePublicDocument}
                disabled={deletingPublicDoc}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {deletingPublicDoc ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
