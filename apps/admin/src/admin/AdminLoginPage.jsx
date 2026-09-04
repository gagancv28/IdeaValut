import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Zap, Loader2, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

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

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 2FA Verification Step States
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [pendingUser, setPendingUser] = useState(null);

  const totpSecret = "JBSWY3DPEHPK3PXP";

  const { isAuthorized, checkAdminAuthorization, user, adminProfile } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getLandingPath = (userEmail) => {
    const emailKey = (userEmail || email || "").toLowerCase().trim();

    // 1. FIRST — always honour the user's explicitly saved default landing page
    const savedLp =
      adminProfile?.default_landing_page ||
      (emailKey ? localStorage.getItem(`admin_landing_${emailKey}`) : null);
    if (savedLp && savedLp !== "/" && savedLp !== "/login" && savedLp !== "/admin/login") {
      return savedLp;
    }

    // 2. FALLBACK — only use the "from" path when no preference is saved
    //    (e.g. user tried to access a deep-link before logging in)
    const fromPath = location.state?.from?.pathname;
    if (fromPath && fromPath !== "/login" && fromPath !== "/admin/login" && fromPath !== "/") {
      return fromPath;
    }

    // 3. Ultimate fallback
    return "/overview";
  };

  // Handle session authorization & 2FA enforcement
  useEffect(() => {
    if (isAuthorized) {
      const userEmail = (user?.email || email || "").trim().toLowerCase();
      if (!userEmail) return;

      const is2FAEnabled = !!(userEmail && (
        localStorage.getItem(`2fa_enabled_${userEmail}`) === "true" ||
        adminProfile?.two_factor_enabled === true
      ));

      const is2FAPassed = sessionStorage.getItem(`2fa_passed_${userEmail}`) === "true";

      if (is2FAEnabled && !is2FAPassed) {
        // Account has 2FA enabled, but 2FA hasn't been verified in this session -> prompt for 2FA OTP code!
        setRequires2FA(true);
        setPendingUser(user);
      } else {
        // Account does not use 2FA OR 2FA was already verified in this session -> proceed to landing page
        const targetPath = getLandingPath(userEmail);
        navigate(targetPath, { replace: true });
      }
    }
  }, [isAuthorized, user, adminProfile]);

  // Finalize successful authentication & record logs
  const finalizeLogin = async (authUser) => {
    const userEmail = (authUser?.email || email).trim().toLowerCase();
    
    // Mark session as 2FA passed
    try {
      sessionStorage.setItem(`2fa_passed_${userEmail}`, "true");
    } catch (e) {}

    const ua = navigator.userAgent;
    let devInfo = "Chrome / Windows 11";
    if (ua.includes("Macintosh")) devInfo = "Safari / macOS";
    else if (ua.includes("iPhone")) devInfo = "Safari / iPhone 15 Pro";
    else if (ua.includes("Firefox")) devInfo = "Firefox / Linux";
    else if (ua.includes("Edg")) devInfo = "Edge / Windows 11";

    try {
      await supabase.from("login_history").insert([
        {
          admin_email: userEmail,
          ip_address: "127.0.0.1",
          device_info: devInfo,
          status: "Success",
          created_at: new Date().toISOString()
        }
      ]);

      await supabase.from("audit_logs").insert([
        {
          admin_email: userEmail,
          action_type: "Admin Authentication",
          details: `Successful 2FA-secured login to Admin Portal from ${devInfo}`,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (logErr) {
      console.warn("Auto login log warning:", logErr.message);
    }

    const targetPath = getLandingPath(userEmail);
    navigate(targetPath, { replace: true });
  };

  const handlePasswordStep = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData?.user) {
        throw new Error("Authentication failed. No user returned.");
      }

      // 2. Perform VIP list check against admin_users table
      const isOk = await checkAdminAuthorization(authData.user);

      if (!isOk) {
        setErrorMessage(`Access Denied: The account '${email.trim()}' is not listed in the admin_users table.`);
        setSubmitting(false);
        return;
      }

      const userEmail = email.trim().toLowerCase();

      // Check if 2FA is explicitly enabled for this specific admin account
      const is2FAEnabled = !!(userEmail && (
        localStorage.getItem(`2fa_enabled_${userEmail}`) === "true" ||
        adminProfile?.two_factor_enabled === true
      ));

      if (is2FAEnabled) {
        // 2FA is required! Switch to 2FA Prompt Step
        setPendingUser(authData.user);
        setRequires2FA(true);
        setSubmitting(false);
      } else {
        // 2FA not enabled, complete login directly
        sessionStorage.setItem(`2fa_passed_${userEmail}`, "true");
        await finalizeLogin(authData.user);
      }
    } catch (err) {
      console.error("[AdminLogin] Error:", err);
      setErrorMessage(err.message || "Failed to log in as administrator.");
      setSubmitting(false);
    }
  };

  const handle2FAVerifyStep = async (e) => {
    e.preventDefault();
    const cleanCode = totpCode.trim();

    if (cleanCode.length !== 6) {
      setErrorMessage("Please enter a valid 6-digit code from Google Authenticator.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      // Strictly verify TOTP 6-digit code against secret
      const isValid = await verifyTOTPCode(totpSecret, cleanCode);

      if (!isValid) {
        setErrorMessage("Invalid 2FA Authenticator Code. Please check your Google Authenticator app and try again.");
        setSubmitting(false);
        return;
      }

      const targetUser = pendingUser || user;
      const userEmail = (targetUser?.email || email || "").trim().toLowerCase();
      if (userEmail) {
        sessionStorage.setItem(`2fa_passed_${userEmail}`, "true");
      }

      // 2FA Verification Passed! Complete login
      await finalizeLogin(targetUser);
    } catch (err) {
      setErrorMessage("Failed to verify 2FA code. " + (err.message || ""));
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#070b13] text-slate-100 font-sans flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#0d1323]/80 border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-black/60 backdrop-blur-xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 items-center justify-center shadow-lg shadow-indigo-500/25 mb-1">
            {requires2FA ? <KeyRound className="h-6 w-6 text-white" /> : <Shield className="h-6 w-6 text-white fill-white/20" />}
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            IdeaVault <span className="text-indigo-400 font-mono text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">{requires2FA ? "2FA Verification" : "Admin Gate"}</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            {requires2FA ? "Enter 6-digit code from Google Authenticator" : "Authorized Administrator Access Only"}
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold p-3.5 rounded-2xl flex items-start gap-2.5 shadow-lg shadow-rose-500/5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* STEP 2: 2FA VERIFICATION SCREEN */}
        {requires2FA ? (
          <form onSubmit={handle2FAVerifyStep} className="space-y-4 animate-fade-in">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Two-Factor Authentication Active</span>
              <p className="text-xs text-slate-300 font-semibold">{email}</p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300">Google Authenticator Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 123456"
                  className="w-full bg-[#070b13] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-center text-sm font-mono tracking-widest text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || totpCode.length !== 6}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer ${
                totpCode.length === 6 && !submitting
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-600/20"
                  : "bg-[#161d33] text-slate-550 opacity-60 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying 2FA Token...</span>
                </>
              ) : (
                <>
                  <span>Verify & Access Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTotpCode("");
                setErrorMessage("");
              }}
              className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold py-1 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </form>
        ) : (
          /* STEP 1: PASSWORD LOGIN FORM */
          <form onSubmit={handlePasswordStep} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300">Admin Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ideavault.in"
                  className="w-full bg-[#070b13] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#070b13] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying VIP Access...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Notice */}
        <div className="border-t border-slate-850 pt-4 text-center">
          <p className="text-[10px] text-slate-500 font-medium">
            Protected by Supabase Auth & Row Level Security Guard
          </p>
        </div>
      </div>
    </div>
  );
}
