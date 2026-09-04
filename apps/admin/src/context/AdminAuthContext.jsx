import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check user authorization against admin_users table in Supabase
  const checkAdminAuthorization = async (authUser) => {
    if (!authUser || !authUser.email) {
      setUser(null);
      setAdminProfile(null);
      setIsAuthorized(false);
      setLoading(false);
      return false;
    }

    try {
      const email = authUser.email.toLowerCase().trim();
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .eq("email", email);

      if (error) {
        console.warn("[AdminAuth] Error checking admin_users table:", error.message);
      }

      // Check if user's email exists in VIP admin_users table
      const adminMatch = data && data.length > 0 ? data[0] : null;

      if (adminMatch) {
        // Check for local storage profile override
        let finalProfile = adminMatch;
        try {
          const localOverrideStr = localStorage.getItem(`admin_profile_override_${email}`);
          if (localOverrideStr) {
            const localOverride = JSON.parse(localOverrideStr);
            finalProfile = { ...adminMatch, ...localOverride };
          }
        } catch (e) {}

        setUser(authUser);
        setAdminProfile(finalProfile);
        setIsAuthorized(true);
        setLoading(false);
        return true;
      } else {
        // Not in VIP list — force sign out immediately
        console.warn(`[AdminAuth] Access Denied: ${email} is not in admin_users VIP list.`);
        await supabase.auth.signOut();
        setUser(null);
        setAdminProfile(null);
        setIsAuthorized(false);
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error("[AdminAuth] Authorization exception:", err);
      setUser(null);
      setAdminProfile(null);
      setIsAuthorized(false);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await checkAdminAuthorization(session.user);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("[AdminAuth] Init error:", err);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await checkAdminAuthorization(session.user);
      } else {
        setUser(null);
        setAdminProfile(null);
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    setLoading(true);
    try { sessionStorage.clear(); } catch (e) {}
    await supabase.auth.signOut();
    setUser(null);
    setAdminProfile(null);
    setIsAuthorized(false);
    setLoading(false);
  };

  return (
    <AdminAuthContext.Provider value={{ user, adminProfile, isAuthorized, loading, checkAdminAuthorization, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
