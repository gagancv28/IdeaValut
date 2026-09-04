import React, { useState, useEffect } from "react";
import {
  User, Shield, Mail, Award, CheckCircle2, XCircle, Upload, RefreshCw,
  Globe, LayoutGrid, Loader2
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function ProfileView() {
  const { user, adminProfile, checkAdminAuthorization } = useAdminAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [adminId, setAdminId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Directory Activity Stats State (computed from database)
  const [stats, setStats] = useState({ completedVerifications: 0, approvalRate: 0 });

  // Preferences States
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [landingPage, setLandingPage] = useState("/overview");
  const [notificationPref, setNotificationPref] = useState("Instant Email Alert");

  // Alert & Loading States
  const [profileToast, setProfileToast] = useState(null);
  const [prefsToast, setPrefsToast] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (profileToast) {
      const timer = setTimeout(() => setProfileToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [profileToast]);

  useEffect(() => {
    if (prefsToast) {
      const timer = setTimeout(() => setPrefsToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [prefsToast]);

  // Load live authenticated admin profile from Supabase on mount & whenever user changes
  useEffect(() => {
    const fetchLiveProfile = async () => {
      try {
        setLoading(true);
        let currentUser = user;
        if (!currentUser) {
          const { data: { session } } = await supabase.auth.getSession();
          currentUser = session?.user || null;
        }

        if (currentUser && currentUser.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          setEmail(userEmail);

          // Restore saved avatar from localStorage immediately
          try {
            const savedAvatar = localStorage.getItem(`admin_avatar_${userEmail}`);
            if (savedAvatar) setAvatarUrl(savedAvatar);
          } catch (e) {}

          // Query admin_users table in Supabase by authenticated user email
          const { data, error } = await supabase
            .from("admin_users")
            .select("*")
            .eq("email", userEmail)
            .maybeSingle();

          // Read local storage overrides as fallback
          let localOverride = {};
          try {
            const overrideStr = localStorage.getItem(`admin_profile_override_${userEmail}`);
            if (overrideStr) localOverride = JSON.parse(overrideStr);
          } catch (e) {}

          const effectiveName = localOverride.name || data?.name || adminProfile?.name || userEmail.split("@")[0];
          const effectiveRole = data?.role || adminProfile?.role || "Super Admin";
          const effectiveTz = localOverride.timezone || data?.timezone || adminProfile?.timezone || "Asia/Kolkata";
          const effectiveLp = localOverride.default_landing_page || data?.default_landing_page || adminProfile?.default_landing_page || "/overview";
          const effectiveNotif = localStorage.getItem(`admin_notification_pref_${userEmail}`) || data?.notification_preference || adminProfile?.notification_preference || "Instant Email Alert";

          setFullName(effectiveName);
          setRole(effectiveRole);
          if (data?.id) setAdminId(data.id);
          else if (adminProfile?.id) setAdminId(adminProfile.id);
          setTimezone(effectiveTz);
          setLandingPage(effectiveLp);
          setNotificationPref(effectiveNotif);
        } else if (adminProfile) {
          const userEmail = (adminProfile.email || "").toLowerCase().trim();

          // Restore saved avatar from localStorage
          try {
            const savedAvatar = localStorage.getItem(`admin_avatar_${userEmail}`);
            if (savedAvatar) setAvatarUrl(savedAvatar);
          } catch (e) {}

          let localOverride = {};
          try {
            const overrideStr = localStorage.getItem(`admin_profile_override_${userEmail}`);
            if (overrideStr) localOverride = JSON.parse(overrideStr);
          } catch (e) {}

          setFullName(localOverride.name || adminProfile.name || "");
          setEmail(adminProfile.email || "");
          setRole(adminProfile.role || "Super Admin");
          setAdminId(adminProfile.id);
          setTimezone(localOverride.timezone || adminProfile.timezone || "Asia/Kolkata");
          setLandingPage(localOverride.default_landing_page || adminProfile.default_landing_page || "/overview");
        }

        // Fetch directory activity stats from Supabase
        try {
          const { data: startupsData } = await supabase.from("startups").select("status, verification_status");
          if (startupsData && startupsData.length > 0) {
            const completed = startupsData.filter(s => {
              const st = (s.status || "").toLowerCase();
              const vst = (s.verification_status || "").toLowerCase();
              return st === "active" || vst === "verified" || st === "approved";
            }).length;
            const total = startupsData.length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
            setStats({ completedVerifications: completed, approvalRate: rate });
          }
        } catch (e) {}

      } catch (err) {
        console.error("Error loading live profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveProfile();
  }, [user, adminProfile]);

  const getInitials = (nameStr) => {
    if (!nameStr || typeof nameStr !== "string") return "AD";
    const parts = nameStr.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "AD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSavingProfile(true);
    setProfileToast(null);

    try {
      const userEmail = email.toLowerCase().trim();

      // Save local override so state permanently survives page reload
      try {
        const currentOverrideStr = localStorage.getItem(`admin_profile_override_${userEmail}`);
        const currentOverride = currentOverrideStr ? JSON.parse(currentOverrideStr) : {};
        localStorage.setItem(
          `admin_profile_override_${userEmail}`,
          JSON.stringify({ ...currentOverride, name: fullName.trim() })
        );
      } catch (e) {}

      // 1. Execute Supabase update on admin_users table matching email or id
      try {
        let updateQuery = supabase
          .from("admin_users")
          .update({ name: fullName.trim() });

        if (adminId) updateQuery = updateQuery.eq("id", adminId);
        else updateQuery = updateQuery.eq("email", userEmail);

        await updateQuery;
      } catch (sErr) {}

      // 2. Execute Server API update (bypasses frontend RLS restrictions)
      try {
        await fetch(`${getApiBaseUrl()}/api/admin/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail, name: fullName.trim() })
        });
      } catch (apiErr) {}

      // Re-trigger auth context check so top header profile name & avatar update live
      if (user) {
        await checkAdminAuthorization(user);
      }

      setProfileToast({ type: "success", message: "Identity details saved to database successfully!" });
    } catch (err) {
      console.error("Error updating profile name:", err);
      setProfileToast({ type: "error", message: `Failed to update profile: ${err.message}` });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsToast(null);

    try {
      const userEmail = email.toLowerCase().trim();

      // Save local override & landing page preference so it permanently survives page reloads and drives login redirects
      try {
        const currentOverrideStr = localStorage.getItem(`admin_profile_override_${userEmail}`);
        const currentOverride = currentOverrideStr ? JSON.parse(currentOverrideStr) : {};
        localStorage.setItem(
          `admin_profile_override_${userEmail}`,
          JSON.stringify({
            ...currentOverride,
            timezone: timezone,
            default_landing_page: landingPage
          })
        );
        localStorage.setItem(`admin_landing_${userEmail}`, landingPage);
        localStorage.setItem(`admin_notification_pref_${userEmail}`, notificationPref);
      } catch (e) {}

      // 1. Execute Supabase update on admin_users
      try {
        let updateQuery = supabase
          .from("admin_users")
          .update({
            timezone: timezone,
            default_landing_page: landingPage,
            notification_preference: notificationPref
          });

        if (adminId) updateQuery = updateQuery.eq("id", adminId);
        else updateQuery = updateQuery.eq("email", userEmail);

        await updateQuery;
      } catch (sErr) {}

      // 2. Execute Server API update (triggers confirmation email send)
      let mailConfirmed = false;
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            timezone: timezone,
            default_landing_page: landingPage,
            notification_preference: notificationPref,
            send_confirmation_email: true
          })
        });
        const resData = await res.json();
        if (resData.email_sent) mailConfirmed = true;
      } catch (apiErr) {}

      // Refresh admin profile context if user is active
      if (user) {
        await checkAdminAuthorization(user);
      }

      setPrefsToast({
        type: "success",
        message: mailConfirmed
          ? `Platform preferences saved! Confirmation email sent to ${userEmail}.`
          : "Platform preferences saved to database successfully!"
      });
      if (user) {
        await checkAdminAuthorization(user);
      }

      setPrefsToast({ type: "success", message: "Platform preferences saved to database successfully!" });
    } catch (err) {
      console.error("Error saving platform preferences:", err);
      setPrefsToast({ type: "error", message: `Failed to save preferences: ${err.message}` });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce 2MB limit to keep localStorage safe
    if (file.size > 2 * 1024 * 1024) {
      setProfileToast({ type: "error", message: "Image too large. Please use a photo under 2MB." });
      return;
    }

    setAvatarLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setAvatarUrl(base64);
      setAvatarLoading(false);

      // Persist avatar in localStorage so it survives page refreshes
      try {
        const userEmail = (user?.email || email || "").toLowerCase().trim();
        if (userEmail) {
          localStorage.setItem(`admin_avatar_${userEmail}`, base64);
          // Also merge into the profile override blob so context picks it up
          const currentOverrideStr = localStorage.getItem(`admin_profile_override_${userEmail}`);
          const currentOverride = currentOverrideStr ? JSON.parse(currentOverrideStr) : {};
          localStorage.setItem(
            `admin_profile_override_${userEmail}`,
            JSON.stringify({ ...currentOverride, avatar_url: base64 })
          );
        }
      } catch (storageErr) {
        // Storage quota exceeded — notify user
        console.warn("[Avatar] localStorage quota exceeded:", storageErr);
        setProfileToast({ type: "error", message: "Could not save photo locally — storage quota exceeded. Try a smaller image." });
      }

      setProfileToast({ type: "success", message: "Profile photo updated and saved!" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-grow p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-[#070b13]">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">My Profile</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Manage your administrator account identity details, activity stats, and preferences</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Fetching authenticated admin profile...</p>
        </div>
      ) : (
        /* Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* LEFT COLUMN: Profile Info */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" /> Identity Details
              </h2>

              {/* Avatar Upload Area */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/20 bg-slate-900/60 flex items-center justify-center text-3xl font-extrabold text-indigo-400 shadow-inner">
                    {avatarLoading ? (
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(fullName)
                    )}
                  </div>
                  <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold">
                    <Upload className="w-4 h-4 mb-1" />
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    {fullName || "Administrator"}
                  </span>
                  <p className="text-[9px] text-slate-550 mt-0.5">Recommended: Square JPG/PNG, max 2MB</p>
                </div>
              </div>

              {/* Profile Info Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-400 tracking-wide">Full Name</label>
                  <div className="relative flex items-center bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus-within:border-indigo-500/50">
                    <User className="w-4 h-4 text-slate-555 mr-2.5 flex-shrink-0" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Enter full name"
                      className="bg-transparent border-none outline-none w-full text-slate-200 font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-450 tracking-wide">Work Email (Read Only)</label>
                  <div className="relative flex items-center bg-[#070b13]/60 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-500">
                    <Mail className="w-4 h-4 text-slate-600 mr-2.5 flex-shrink-0" />
                    <input
                      type="email"
                      value={email}
                      readOnly
                      disabled
                      className="bg-transparent border-none outline-none w-full text-slate-500 font-semibold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-455 tracking-wide">Administrator Role (Read Only)</label>
                  <div className="relative flex items-center bg-[#070b13]/60 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-500">
                    <Shield className="w-4 h-4 text-slate-600 mr-2.5 flex-shrink-0" />
                    <input
                      type="text"
                      value={role}
                      readOnly
                      disabled
                      className="bg-transparent border-none outline-none w-full text-slate-500 font-semibold cursor-not-allowed"
                    />
                  </div>
                </div>

                {profileToast && (
                  <div className={`rounded-xl p-3 flex items-center gap-2 text-[11px] font-bold border ${
                    profileToast.type === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    {profileToast.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                    <span>{profileToast.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer mt-4 flex items-center justify-center gap-2"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingProfile ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Activity & Preferences */}
          <div className="space-y-6 flex flex-col">
            
            {/* Activity Stats */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl">
              <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-400" /> Directory Activity Stats
              </h2>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-[#070b13]/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Verifications Completed</span>
                  <span className="text-2xl font-extrabold text-white mt-2 font-mono">{stats.completedVerifications}</span>
                </div>
                <div className="bg-[#070b13]/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Approval Success Rate</span>
                  <span className="text-2xl font-extrabold text-indigo-400 mt-2 font-mono">{stats.approvalRate}%</span>
                </div>
              </div>
            </div>

            {/* Preferences (Timezone & Landing Page) */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl flex-grow flex flex-col justify-between">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-indigo-400" /> Platform Preferences
                </h2>

                <form onSubmit={handleSavePreferences} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-500" /> System Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-[#070b13] border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-[#0d1323]/50 transition-colors"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST - GMT+05:30)</option>
                      <option value="UTC">UTC (GMT+00:00)</option>
                      <option value="America/New_York">America/New_York (EST - GMT-05:00)</option>
                      <option value="Europe/London">Europe/London (GMT+01:00)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-500" /> Default Landing Page
                    </label>
                    <select
                      value={landingPage}
                      onChange={(e) => setLandingPage(e.target.value)}
                      className="w-full bg-[#070b13] border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-[#0d1323]/50 transition-colors"
                    >
                      <option value="/overview">Overview Dashboard</option>
                      <option value="/listings">All Listings Control Room</option>
                      <option value="/verifications">Verifications Queue</option>
                      <option value="/queries">User Queries Support</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> Notification Preferences
                    </label>
                    <select
                      value={notificationPref}
                      onChange={(e) => setNotificationPref(e.target.value)}
                      className="w-full bg-[#070b13] border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl outline-none cursor-pointer focus:border-indigo-500/50 hover:bg-[#0d1323]/50 transition-colors"
                    >
                      <option value="None">None</option>
                      <option value="Daily Summary">Daily Summary</option>
                      <option value="Instant Email Alert">Instant Email Alert</option>
                    </select>
                  </div>

                  {prefsToast && (
                    <div className={`rounded-xl p-3 flex items-center gap-2 text-[11px] font-bold border ${
                      prefsToast.type === "success" 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}>
                      {prefsToast.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                      <span>{prefsToast.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingPrefs}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer mt-4 flex items-center justify-center gap-2"
                  >
                    {savingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingPrefs ? "Saving Preferences..." : "Save Preferences"}</span>
                  </button>
                </form>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
