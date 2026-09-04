// src/hooks/useStartupPlan.js
// Single source of truth for plan_type, status, expiry_date.
// Strategy:
//   1. Fetch from DB via /api/startups/:userId (primary source)
//   2. If DB row is missing status/plan_type columns, merge with sessionStorage
//   3. Listen to "startups-updated" event to re-fetch after any mutation
import { useState, useEffect, useCallback, useRef } from "react";
import { getApiBaseUrl } from "../utils/apiConfig";

export function useStartupPlan() {
  const [planType, setPlanType]           = useState("Basic");
  const [status, setStatus]               = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [expiryDate, setExpiryDate]       = useState(null);
  const [requestedPlan, setRequestedPlan] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState(null);
  const [loading, setLoading]             = useState(true);

  const fetchPlanRef = useRef(null);

  const fetchPlan = useCallback(async () => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      setLoading(false);
      return;
    }

    // Also check sessionStorage for any optimistic updates applied by mock payment
    const cachedProfile = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "null");

    try {
      setLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/api/startups/${session.userId}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.startup) {
          const rawTier = data.startup.tier || "Basic";
          // Normalize "Verified" → "Verified Pro"
          const cleanTier = rawTier === "Verified" ? "Verified Pro" : rawTier;

          // DB value for status — if column doesn't exist the server returns undefined/null
          // Fall back to sessionStorage value so mock payment updates show immediately
          const dbStatus = data.startup.status;
          const dbPaymentStatus = data.startup.payment_status || data.startup.paymentStatus;
          const dbExpiry = data.startup.subscription_ends_at || data.startup.subscriptionEndsAt || data.startup.expiryDate || data.startup.expiry_date;

          const resolvedStatus = dbStatus || cachedProfile?.status || "pending";
          const resolvedPaymentStatus = dbPaymentStatus || cachedProfile?.payment_status || cachedProfile?.paymentStatus || (resolvedStatus === "active" ? "paid" : "pending");
          let resolvedExpiry = dbExpiry || cachedProfile?.subscription_ends_at || cachedProfile?.subscriptionEndsAt || cachedProfile?.expiryDate || null;
          
          if ((resolvedStatus === "active" || resolvedPaymentStatus === "paid") && !resolvedExpiry) {
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() + 180);
            resolvedExpiry = fallbackDate.toISOString();
          }

          const resolvedTier   = (cleanTier !== "Basic" ? cleanTier : null)
                                 || cachedProfile?.tier
                                 || cachedProfile?.plan_type
                                 || "Basic";

          setPlanType(resolvedTier);
          setStatus(resolvedStatus);
          setPaymentStatus(resolvedPaymentStatus);
          setExpiryDate(resolvedExpiry);
          setRequestedPlan(data.startup.requested_plan || cachedProfile?.requested_plan || null);
          const resVerStatus = data.startup.verification_status || data.startup.additional_contacts?.verification_status || cachedProfile?.verification_status || null;
          const resUpgradeStatus = data.startup.upgrade_status || data.startup.additional_contacts?.upgrade_status || cachedProfile?.upgrade_status || null;
          const resReason = data.startup.suspension_reason || data.startup.additional_contacts?.suspension_reason || cachedProfile?.suspension_reason || null;

          setPlanType(resolvedTier);
          setStatus(resolvedStatus);
          setPaymentStatus(resolvedPaymentStatus);
          setExpiryDate(resolvedExpiry);
          setRequestedPlan(data.startup.requested_plan || cachedProfile?.requested_plan || null);
          setVerificationStatus(resVerStatus);
          setUpgradeStatus(resUpgradeStatus);
          setSuspensionReason(resReason);

          // Write resolved values back to sessionStorage so other components are consistent
          sessionStorage.setItem("ideavault_startup_profile", JSON.stringify({
            ...(cachedProfile || {}),
            tier: resolvedTier,
            plan_type: resolvedTier,
            status: resolvedStatus,
            payment_status: resolvedPaymentStatus,
            paymentStatus: resolvedPaymentStatus,
            subscription_ends_at: resolvedExpiry,
            subscriptionEndsAt: resolvedExpiry,
            expiryDate: resolvedExpiry,
            verification_status: resVerStatus,
            upgrade_status: resUpgradeStatus,
            suspension_reason: resReason,
          }));
        }
      } else {
        // If API fails, fall back to sessionStorage completely
        if (cachedProfile) {
          const rawTier = cachedProfile.tier || cachedProfile.plan_type || "Basic";
          const cleanTier = rawTier === "Verified" ? "Verified Pro" : rawTier;
          const resStatus = cachedProfile.status || "pending";
          const resExpiry = cachedProfile.subscription_ends_at || cachedProfile.subscriptionEndsAt || cachedProfile.expiryDate || null;
          setPlanType(cleanTier);
          setStatus(resStatus);
          setPaymentStatus(cachedProfile.payment_status || cachedProfile.paymentStatus || (resStatus === "active" ? "paid" : "pending"));
          setExpiryDate(resExpiry);
          setRequestedPlan(cachedProfile.requested_plan || null);
          setVerificationStatus(cachedProfile.verification_status || null);
          setUpgradeStatus(cachedProfile.upgrade_status || null);
          setSuspensionReason(cachedProfile.suspension_reason || null);
        }
      }
    } catch (err) {
      console.error("[useStartupPlan] Fetch failed:", err);
      // Fallback to sessionStorage on network error
      if (cachedProfile) {
        const rawTier = cachedProfile.tier || cachedProfile.plan_type || "Basic";
        const cleanTier = rawTier === "Verified" ? "Verified Pro" : rawTier;
        const resStatus = cachedProfile.status || "pending";
        const resExpiry = cachedProfile.subscription_ends_at || cachedProfile.subscriptionEndsAt || cachedProfile.expiryDate || null;
        setPlanType(cleanTier);
        setStatus(resStatus);
        setPaymentStatus(cachedProfile.payment_status || cachedProfile.paymentStatus || (resStatus === "active" ? "paid" : "pending"));
        setExpiryDate(resExpiry);
        setRequestedPlan(cachedProfile.requested_plan || null);
        setVerificationStatus(cachedProfile.verification_status || null);
        setUpgradeStatus(cachedProfile.upgrade_status || null);
        setSuspensionReason(cachedProfile.suspension_reason || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  fetchPlanRef.current = fetchPlan;

  useEffect(() => {
    fetchPlan();
    const handler = () => fetchPlanRef.current?.();
    window.addEventListener("startups-updated", handler);
    return () => window.removeEventListener("startups-updated", handler);
  }, [fetchPlan]);

  const invalidate = useCallback(() => {
    window.dispatchEvent(new CustomEvent("startups-updated"));
  }, []);

  const effectivePaymentStatus = paymentStatus || (status === "active" ? "paid" : "pending");

  return {
    planType,
    status,
    paymentStatus: effectivePaymentStatus,
    payment_status: effectivePaymentStatus,
    subscription_ends_at: expiryDate,
    subscriptionEndsAt: expiryDate,
    expiryDate,
    requestedPlan,
    requested_plan: requestedPlan,
    verificationStatus,
    verification_status: verificationStatus,
    upgradeStatus,
    upgrade_status: upgradeStatus,
    suspensionReason,
    suspension_reason: suspensionReason,
    loading,
    refetch: fetchPlan,
    invalidate,
  };
}
