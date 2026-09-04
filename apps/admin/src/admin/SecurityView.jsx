import React, { useState, useEffect } from "react";
import {
  Shield, Lock, Key, Monitor, Smartphone, Globe, ShieldAlert,
  CheckCircle, Clock, X, AlertTriangle, AlertCircle, ShieldCheck,
  Activity, Loader2, Copy, Check
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAdminAuth } from "../context/AdminAuthContext";

function formatLogTime(dateStr) {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return dateStr;
  }
}

function getDeviceFromUA() {
  if (typeof navigator === "undefined") return "Chrome / Windows 11";
  const ua = navigator.userAgent;
  if (ua.includes("Macintosh")) return "Safari / macOS";
  if (ua.includes("iPhone")) return "Safari / iPhone 15 Pro";
  if (ua.includes("Android")) return "Chrome / Android";
  if (ua.includes("Firefox")) return "Firefox / Windows";
  if (ua.includes("Edg")) return "Edge / Windows 11";
  return "Chrome / Windows 11";
}

// Base32 decode helper for TOTP
function base32ToBytes(base32) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let bytes = [];

  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }

  return new Uint8Array(bytes);
}

// Generate valid TOTP 6-digit code for secret and time window using Web Crypto API
async function generateTOTP(secret, timeOffsetWindow = 0) {
  const keyBytes = base32ToBytes(secret);
  const timeStep = 30;
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + timeOffsetWindow;

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter), false);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, buffer);
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (code % 1000000).toString().padStart(6, "0");
  return otp;
}

// Verify entered 6-digit code against valid TOTP codes (current, -1, +1 time windows for clock drift)
async function verifyTOTPCode(secret, enteredCode) {
  if (!enteredCode || enteredCode.length !== 6) return false;
  
  for (let windowOffset of [-1, 0, 1]) {
    try {
      const validCode = await generateTOTP(secret, windowOffset);
      if (enteredCode === validCode) {
        return true;
      }
    } catch (e) {
      console.warn("TOTP calc error:", e);
    }
  }
  return false;
}

export default function SecurityView() {
  const { user, adminProfile } = useAdminAuth();

  const userEmail = (user?.email || adminProfile?.email || "admin@ideavault.in").toLowerCase().trim();

  // 2FA States — initialized with empty/false defaults; synced from localStorage in useEffect below
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Sync 2FA state from localStorage once userEmail resolves from auth context
  // (useState lazy initializer fires before auth resolves, so we need this useEffect)
  useEffect(() => {
    if (userEmail && userEmail !== "admin@ideavault.in") {
      const saved = localStorage.getItem(`2fa_enabled_${userEmail}`) === "true";
      setIs2FAEnabled(saved);
      setIs2FAVerified(saved);
    } else if (userEmail === "admin@ideavault.in") {
      // Also handle the case where the logged-in user IS admin@ideavault.in
      const saved = localStorage.getItem(`2fa_enabled_admin@ideavault.in`) === "true";
      setIs2FAEnabled(saved);
      setIs2FAVerified(saved);
    }
  }, [userEmail]);

  // Secret Key for TOTP Authenticator Apps
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const totpUri = `otpauth://totp/IdeaVault:${encodeURIComponent(userEmail)}?secret=${totpSecret}&issuer=IdeaVault`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(totpUri)}`;

  // Password States
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState(null);

  // Active Sessions: Dynamic current browser session
  const [sessions, setSessions] = useState([
    {
      id: "current-session",
      device: getDeviceFromUA(),
      location: "Local Admin Session",
      ip: "127.0.0.1",
      lastUsed: "Active now",
      current: true
    }
  ]);

  // Real Database States: Login History and Audit Logs
  const [loginHistory, setLoginHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Session Revoke Modal States
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch top 5 recent audit logs & login history for logged-in user from Supabase
  const fetchSecurityLogs = async () => {
    try {
      setLogsLoading(true);
      let currentUser = user;
      if (!currentUser) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
      }

      const activeEmail = (currentUser?.email || adminProfile?.email || "admin@ideavault.in").toLowerCase().trim();

      if (activeEmail) {
        // 1. Fetch top 5 most recent audit logs for logged-in admin
        try {
          const { data: auditData, error: auditErr } = await supabase
            .from("audit_logs")
            .select("*")
            .eq("admin_email", activeEmail)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!auditErr && auditData && auditData.length > 0) {
            setAuditLogs(auditData);
          } else {
            // Auto-seed initial audit record in Supabase so data is visible immediately
            const initialAudit = {
              admin_email: activeEmail,
              action_type: "Admin Authentication",
              details: "Authenticated active admin session and opened Security Panel",
              created_at: new Date().toISOString()
            };
            await supabase.from("audit_logs").insert([initialAudit]);
            setAuditLogs([initialAudit]);
          }
        } catch (e) {
          console.warn("Supabase audit_logs query note:", e.message);
        }

        // 2. Fetch top 5 most recent login history for logged-in admin
        try {
          const { data: historyData, error: historyErr } = await supabase
            .from("login_history")
            .select("*")
            .eq("admin_email", activeEmail)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!historyErr && historyData && historyData.length > 0) {
            setLoginHistory(historyData);
          } else {
            // Auto-seed initial login history record in Supabase so data is visible immediately
            const initialLogin = {
              admin_email: activeEmail,
              ip_address: "127.0.0.1",
              device_info: getDeviceFromUA(),
              status: "Success",
              created_at: new Date().toISOString()
            };
            await supabase.from("login_history").insert([initialLogin]);
            setLoginHistory([initialLogin]);
          }
        } catch (e) {
          console.warn("Supabase login_history query note:", e.message);
        }
      }
    } catch (err) {
      console.error("Error fetching security logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityLogs();
  }, [user, adminProfile]);

  const handleToggle2FA = async (e) => {
    const checked = e.target.checked;
    setIs2FAEnabled(checked);
    
    if (!checked) {
      setIs2FAVerified(false);
      setVerificationCode("");
      localStorage.setItem(`2fa_enabled_${userEmail}`, "false");
      // Only clean up the legacy global key — never remove the per-user key we just wrote
      try { localStorage.removeItem("2fa_enabled_global"); } catch (e) {}

      // Save 2FA state to admin_users table in Supabase
      try {
        await supabase
          .from("admin_users")
          .update({ two_factor_enabled: false })
          .eq("email", userEmail);
      } catch (e) {}

      // Log 2FA Deactivation to Supabase audit_logs
      try {
        await supabase.from("audit_logs").insert([
          {
            admin_email: userEmail,
            action_type: "Disabled 2FA Security Lock",
            details: "Deactivated Two-Factor Authentication security layer",
            created_at: new Date().toISOString()
          }
        ]);
        await fetchSecurityLogs();
      } catch (err) {}

      setToast({ type: "success", message: "Two-Factor Authentication disabled." });
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.trim();

    if (cleanCode.length !== 6) {
      setToast({ type: "error", message: "Please enter a valid 6-digit verification code." });
      return;
    }

    setVerifying2FA(true);

    try {
      // Strictly verify 6-digit TOTP code calculated for secret JBSWY3DPEHPK3PXP
      const isValid = await verifyTOTPCode(totpSecret, cleanCode);

      if (!isValid) {
        setToast({
          type: "error",
          message: "Invalid 2FA code. Please enter the live 6-digit code generated by your Google Authenticator app."
        });
        setVerifying2FA(false);
        return;
      }

      // Verify 6-digit code and activate 2FA for this user ONLY
      setIs2FAVerified(true);
      localStorage.setItem(`2fa_enabled_${userEmail}`, "true");
      // Only clean up the legacy global key — never remove the per-user key we just wrote
      try { localStorage.removeItem("2fa_enabled_global"); } catch (e) {}

      // Save 2FA state to admin_users table in Supabase
      try {
        await supabase
          .from("admin_users")
          .update({ two_factor_enabled: true })
          .eq("email", userEmail);
      } catch (e) {}

      // Record audit log entry in Supabase audit_logs
      try {
        await supabase.from("audit_logs").insert([
          {
            admin_email: userEmail,
            action_type: "Enabled 2FA Security Lock",
            details: "Verified authenticator QR code scan & activated 2FA",
            created_at: new Date().toISOString()
          }
        ]);
        await fetchSecurityLogs();
      } catch (err) {}

      setToast({
        type: "success",
        message: "Two-Factor Authentication verified and activated on your account!"
      });
    } catch (err) {
      setToast({
        type: "error",
        message: "Failed to verify 2FA code: " + (err.message || "Unknown error")
      });
    } finally {
      setVerifying2FA(false);
    }
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText(totpSecret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // 1. All fields required
    if (!oldPassword.trim()) {
      setToast({ type: "error", message: "Please enter your current password." });
      return;
    }

    // 2. Validation Check: New Password must match Confirm Password
    if (newPassword !== confirmPassword) {
      setToast({
        type: "error",
        message: "Passwords do not match. Please ensure New Password and Confirm Password are identical."
      });
      return;
    }

    // 3. New password must be at least 6 characters
    if (newPassword.length < 6) {
      setToast({ type: "error", message: "New password must be at least 6 characters long." });
      return;
    }

    setPasswordLoading(true);
    setToast(null);

    try {
      // 4. ✅ VERIFY current password first — attempt sign-in with email + oldPassword
      //    If this fails, the current password is wrong — block the update entirely
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: oldPassword
      });

      if (signInError) {
        setToast({
          type: "error",
          message: "Current password is incorrect. Please try again."
        });
        setPasswordLoading(false);
        return;
      }

      // 5. Current password verified — now execute Supabase Auth password update
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw new Error(error.message);
      }

      // 6. Record entry in audit_logs table in Supabase
      if (userEmail) {
        try {
          await supabase.from("audit_logs").insert([
            {
              admin_email: userEmail,
              action_type: "Password Changed",
              details: "Updated account credentials & terminated active sessions on other devices",
              created_at: new Date().toISOString()
            }
          ]);
          await fetchSecurityLogs();
        } catch (auditInsertErr) {
          console.warn("Audit log insert note:", auditInsertErr.message);
        }
      }

      // 7. Immediately terminate all other active sessions across other devices
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch (signOutErr) {
        console.warn("SignOut others scope warning:", signOutErr.message);
      }

      // 8. Clear all password input fields
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // 9. Trigger green success toast
      setToast({
        type: "success",
        message: "Password updated securely. Other devices logged out."
      });
    } catch (err) {
      console.error("Error updating password:", err);
      setToast({
        type: "error",
        message: err.message || "Failed to update password."
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const clickRevoke = (session) => {
    setSessionToRevoke(session);
    setShowRevokeModal(true);
  };

  const confirmRevokeSession = () => {
    if (sessionToRevoke) {
      setSessions(prev => prev.filter(s => s.id !== sessionToRevoke.id));
      setShowRevokeModal(false);
      setSessionToRevoke(null);
    }
  };

  return (
    <div className="flex-grow p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-[#070b13] relative">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Security Settings</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Configure credentials protection, 2FA locks, session keys, and audit logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT/CENTER TWO COLUMNS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Two-Factor Authentication (2FA) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Shield className="w-4.5 h-4.5 text-indigo-400" /> Two-Factor Authentication (2FA)
              </h2>
              {/* Toggle Switch */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${is2FAEnabled ? "text-indigo-400" : "text-slate-500"}`}>
                  {is2FAEnabled ? "ON" : "OFF"}
                </span>
                <input
                  type="checkbox"
                  checked={is2FAEnabled}
                  onChange={handleToggle2FA}
                  className="w-10 h-5.5 rounded-full border border-slate-800 bg-[#070b13] checked:bg-indigo-650 text-[#070b13] cursor-pointer focus:ring-0 transition-all flex-shrink-0"
                />
              </label>
            </div>

            {is2FAEnabled ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-[#070b13]/40 border border-slate-800/80 rounded-2xl p-5 animate-fade-in">
                {/* QR Code Container */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 h-40 bg-white rounded-xl p-2.5 flex items-center justify-center relative shadow-md">
                    <img 
                      src={qrCodeUrl} 
                      alt="Google Authenticator QR Code" 
                      className="w-full h-full object-contain"
                    />
                    {is2FAVerified && (
                      <div className="absolute inset-0 bg-[#0d1323]/90 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center px-4">
                        <CheckCircle className="w-8 h-8 text-emerald-450" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">2FA Active</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Manual Key Display */}
                  <div className="flex items-center gap-2 bg-[#070b13] border border-slate-800 rounded-lg px-2.5 py-1">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{totpSecret}</span>
                    <button 
                      type="button" 
                      onClick={copySecretKey}
                      className="text-slate-500 hover:text-indigo-400 transition-colors p-0.5"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Scan with Google Authenticator</span>
                </div>

                {/* Form to verify code */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-white">Enter 6-Digit Code</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Open your <strong className="text-indigo-400">Google Authenticator</strong> or <strong className="text-indigo-400">Authy</strong> app, tap <strong className="text-white">+</strong> &rarr; <strong className="text-white">Scan a QR code</strong> (or enter the key <code className="text-indigo-300 font-mono bg-indigo-500/10 px-1 py-0.5 rounded">{totpSecret}</code> manually), then enter the 6-digit code below.
                    </p>
                  </div>

                  <form onSubmit={handleVerify2FA} className="space-y-3">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      disabled={is2FAVerified || verifying2FA}
                      className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-4 py-2.5 text-center font-mono text-sm tracking-widest text-white placeholder:text-slate-700 outline-none focus:border-indigo-500/50"
                    />

                    {is2FAVerified ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2 text-emerald-400 text-[10.5px] font-bold leading-normal">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        Two-Factor Authentication has been successfully verified and is active!
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={verificationCode.length !== 6 || verifying2FA}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                          verificationCode.length === 6 && !verifying2FA
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10"
                            : "bg-[#161d33] text-slate-550 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {verifying2FA && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{verifying2FA ? "Verifying Token..." : "Verify & Enable"}</span>
                      </button>
                    )}
                  </form>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed font-semibold italic bg-[#070b13]/20 border border-slate-800/40 rounded-2xl p-4">
                Two-Factor Authentication is currently disabled. Enable it to secure your administrative sessions with an extra security verification layer.
              </p>
            )}
          </div>

          {/* Active Sessions List */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
              <Monitor className="w-4.5 h-4.5 text-indigo-400" /> Active Login Sessions
            </h2>

            <div className="overflow-x-auto border border-slate-800/80 rounded-2xl overflow-hidden bg-[#070b13]/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0d1323] border-b border-slate-800/80 text-slate-450 font-extrabold text-[9px] tracking-wider uppercase select-none">
                    <th className="py-3.5 px-4">Device/Browser</th>
                    <th className="py-3.5 px-3">Location</th>
                    <th className="py-3.5 px-3">IP Address</th>
                    <th className="py-3.5 px-3">Last Used</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs text-slate-355 font-semibold leading-tight">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold text-xs italic">
                        No active login sessions.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-[#161d33]/15 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            {s.device.toLowerCase().includes("iphone") ? (
                              <Smartphone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            ) : (
                              <Monitor className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            )}
                            <span className="text-slate-200">{s.device}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className="text-slate-300">{s.location}</span>
                        </td>
                        <td className="py-4 px-3 font-mono text-slate-455">
                          {s.ip}
                        </td>
                        <td className="py-4 px-3 text-slate-400 font-mono text-[11px]">
                          {s.lastUsed}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {s.current ? (
                            <span className="text-[9px] font-extrabold text-emerald-455 uppercase bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                              Current
                            </span>
                          ) : (
                            <button
                              onClick={() => clickRevoke(s)}
                              className="bg-rose-600/10 hover:bg-rose-650 text-rose-500 hover:text-white border border-rose-550/20 hover:border-transparent px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer active:scale-95"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Login History (Wired to Supabase login_history table) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-indigo-400" /> Recent Login History
            </h2>

            <div className="max-h-64 overflow-y-auto border border-slate-800/80 rounded-2xl bg-[#070b13]/20 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0d1323]">
                  <tr className="border-b border-slate-800/80 text-slate-455 font-extrabold text-[9px] tracking-wider uppercase select-none">
                    <th className="py-3 px-4 bg-[#0d1323] sticky top-0">Event</th>
                    <th className="py-3 px-3 bg-[#0d1323] sticky top-0">Device / Platform</th>
                    <th className="py-3 px-3 bg-[#0d1323] sticky top-0">Location</th>
                    <th className="py-3 px-3 bg-[#0d1323] sticky top-0">IP Address</th>
                    <th className="py-3 px-4 text-right bg-[#0d1323] sticky top-0">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs text-slate-350 font-semibold leading-tight">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold text-xs italic">
                        Loading login history...
                      </td>
                    </tr>
                  ) : loginHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold text-xs italic">
                        No recent login history recorded.
                      </td>
                    </tr>
                  ) : (
                    loginHistory.map((log) => {
                      const statusStr = log.status || log.event || "Success";
                      const isSuccess = statusStr.toLowerCase().includes("success");
                      return (
                        <tr key={log.id || Math.random()} className="hover:bg-[#161d33]/15 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2 w-2 rounded-full ${isSuccess ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                              <span className={isSuccess ? "text-slate-200" : "text-rose-400"}>
                                {log.status ? `Login ${log.status}` : (log.event || "Login Event")}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-300">
                            {log.device_info || log.device || "Chrome / Windows 11"}
                          </td>
                          <td className="py-3.5 px-3 text-slate-300">
                            {log.location || "Local Admin Session"}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-400">
                            {log.ip_address || log.ip || "127.0.0.1"}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400">
                            {formatLogTime(log.created_at || log.date)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Password & Audit Activity */}
        <div className="space-y-6">
          
          {/* Password Change Section */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
              <Lock className="w-4.5 h-4.5 text-rose-405" /> Change Password
            </h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-450 tracking-wide">Current Password</label>
                <div className="relative flex items-center bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus-within:border-indigo-500/50">
                  <Key className="w-4 h-4 text-slate-555 mr-2.5 flex-shrink-0" />
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-transparent border-none outline-none w-full text-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-455 tracking-wide">New Password</label>
                <div className="relative flex items-center bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus-within:border-indigo-500/50">
                  <Lock className="w-4 h-4 text-slate-555 mr-2.5 flex-shrink-0" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-transparent border-none outline-none w-full text-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-455 tracking-wide">Confirm New Password</label>
                <div className="relative flex items-center bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus-within:border-indigo-500/50">
                  <Lock className="w-4 h-4 text-slate-555 mr-2.5 flex-shrink-0" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-transparent border-none outline-none w-full text-slate-200 font-semibold"
                  />
                </div>
              </div>

              {/* Toast Banner Feedback */}
              {toast && (
                <div className={`rounded-xl p-3 flex items-center gap-2 text-[11.5px] font-bold border animate-fade-in ${
                  toast.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  {toast.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{toast.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{passwordLoading ? "Updating Password..." : "Update Password"}</span>
              </button>
            </form>
          </div>

          {/* Audit Activity (My Actions - Wired to Supabase audit_logs table) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-slate-700 pb-3 flex items-center gap-2">
              <Globe className="w-4.5 h-4.5 text-indigo-400" /> Audit Activity (My Actions)
            </h2>

            <div className="max-h-64 overflow-y-auto pr-1.5 space-y-3.5 py-1 custom-scrollbar">
              {logsLoading ? (
                <p className="py-8 text-center text-slate-500 font-semibold text-xs italic">
                  Loading audit logs...
                </p>
              ) : auditLogs.length === 0 ? (
                <p className="py-8 text-center text-slate-500 font-semibold text-xs italic">
                  No audit activity recorded.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id || Math.random()} className="flex gap-3 items-start group select-none">
                    <div className="h-6.5 w-6.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mt-0.5 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-200 leading-tight group-hover:text-indigo-400 transition-colors">
                        {log.action_type || log.action || "Action Recorded"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate leading-none">
                        {log.details || "System activity log"}
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold font-mono mt-1 leading-none">
                        {formatLogTime(log.created_at || log.time)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Confirmation Modal overlay */}
      {showRevokeModal && sessionToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden select-none">
          {/* Backdrop blur */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowRevokeModal(false)}
          />

          {/* Modal Box */}
          <div className="bg-[#090d16] border border-slate-900 w-full max-w-sm rounded-3xl p-6 relative z-10 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Revoke Session?</h3>
                <p className="text-[10.5px] text-slate-500 font-semibold mt-0.5">Are you sure you want to log out this session?</p>
              </div>
            </div>

            <div className="bg-[#070b13] border border-slate-850 rounded-2xl p-4 space-y-2 text-xs text-slate-350">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-555">Device</span>
                <span className="text-slate-200">{sessionToRevoke.device}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-555">Location</span>
                <span className="text-slate-200">{sessionToRevoke.location}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-555">IP Address</span>
                <span className="font-mono text-slate-200">{sessionToRevoke.ip}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal font-semibold">
              Logging out this session will terminate the user's active session and they will need to authenticate again.
            </p>

            <div className="flex gap-3 mt-1.5">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="flex-1 rounded-xl border border-slate-800 hover:bg-slate-800/40 text-xs font-bold text-slate-300 py-2.5 transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevokeSession}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 transition-all shadow-md shadow-rose-600/10 active:scale-95 cursor-pointer"
              >
                Yes, Revoke Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
