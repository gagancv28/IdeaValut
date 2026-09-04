import { useState, useCallback } from "react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { toast } from "../utils/toast";
import { useStartupPlan } from "./useStartupPlan";

export const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export function useRazorpayCheckout() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { invalidate } = useStartupPlan();

  const handleCheckout = useCallback(async (planId, onSuccessCallback) => {
    const session = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    if (!session?.userId) {
      toast.error("Please log in to proceed.");
      return;
    }

    try {
      setIsProcessing(true);

      // 1. Load Razorpay checkout.js
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load Razorpay checkout. Check your internet connection.");
      }

      // 2. Create order on server
      const orderRes = await fetch(`${getApiBaseUrl()}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: planId, userId: session.userId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create payment order.");
      }

      // Get the startup_id from the session profile cache for a more reliable DB update
      const startupProfile = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
      const startupId = startupProfile?.id || startupProfile?.startup_id || null;

      // 3. Open Razorpay checkout modal
      await new Promise((resolve, reject) => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || orderData.key,
          amount: orderData.amount,
          currency: orderData.currency || "INR",
          name: "IdeaVault",
          description: `${planId} Plan — AI Matchmaker Included`,
          image: "/logo.png",
          order_id: orderData.orderId,
          prefill: {
            email: session.email || "",
            name: session.companyName || "",
          },
          theme: { color: "#4f46e5" },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              toast.success("Payment cancelled. No charges made.");
              resolve(); 
            },
          },
          handler: async (response) => {
            try {
              setIsProcessing(true); // Keep processing true during verification
              console.log("[Razorpay] Payment response:", response);
              // 4. Verify payment on server
              const verifyRes = await fetch(`${getApiBaseUrl()}/api/payment/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  userId: session.userId,
                  tier: planId,
                  startup_id: startupId, // pass startup DB row id for reliable update
                }),
              });
              const verifyData = await verifyRes.json();
              console.log("[Razorpay] Verify response:", verifyData);

              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || "Payment verification failed.");
              }

              if (verifyData.supabaseError) {
                console.warn("[Razorpay] Supabase update issue:", verifyData.supabaseError);
              }

              // 5. Payment success — update UI
              invalidate();
              window.dispatchEvent(new Event("admin-badges-updated"));
              window.dispatchEvent(new Event("startups-updated"));

              // Update local session cache
              const cached = JSON.parse(sessionStorage.getItem("ideavault_startup_profile") || "{}");
              sessionStorage.setItem("ideavault_startup_profile", JSON.stringify({
                ...cached,
                plan_type: planId,
                status: "pending_verification",
                payment_status: "paid",
                verification_status: "pending",
              }));

              toast.success(`🎉 Payment Successful! ${planId} plan activated. Your listing is now in our verification queue.`);
              
              if (onSuccessCallback) {
                onSuccessCallback(planId);
              }
              
              resolve();
            } catch (verifyErr) {
              console.error("[Razorpay] Verify error:", verifyErr);
              reject(verifyErr);
            } finally {
              setIsProcessing(false);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (failResponse) => {
          toast.error(`Payment failed: ${failResponse.error?.description || "Unknown error"}`);
          setIsProcessing(false);
          resolve();
        });
        rzp.open();
      });
    } catch (err) {
      console.error("[Razorpay] Checkout error:", err);
      toast.error(err.message || "Failed to initiate payment.");
      setIsProcessing(false);
    }
  }, [invalidate]);

  return {
    handleCheckout,
    isProcessing
  };
}
