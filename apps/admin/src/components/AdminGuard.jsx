import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Shield, Loader2 } from "lucide-react";

export default function AdminGuard({ children }) {
  const { isAuthorized, loading, user, adminProfile } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#070b13] flex flex-col items-center justify-center gap-4 text-slate-100 font-sans">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center shadow-xl shadow-indigo-500/10 animate-pulse">
          <Shield className="h-6 w-6 text-indigo-400 fill-indigo-400/20" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-xs font-bold text-slate-300 tracking-wide">Verifying Admin Authorization...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2FA Gate Check: Only enforce 2FA if explicitly turned ON for this specific user email
  const userEmail = (user?.email || adminProfile?.email || "").toLowerCase().trim();
  const is2FAEnabled = !!(userEmail && (
    localStorage.getItem(`2fa_enabled_${userEmail}`) === "true" ||
    adminProfile?.two_factor_enabled === true
  ));

  if (is2FAEnabled) {
    const is2FAPassed = sessionStorage.getItem(`2fa_passed_${userEmail}`) === "true";
    if (!is2FAPassed) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  return children;
}
