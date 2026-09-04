// src/App.jsx
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import DiscoveryPage from "./pages/DiscoveryPage";
import OnboardingPage from "./pages/OnboardingPage";
import FounderDashboard from "./pages/FounderDashboard";
import SubscriptionPage from "./pages/SubscriptionPage";
import StartupDetails from "./pages/StartupDetails";
import SignupModal from "./components/auth/SignupModal";
import MaintenanceScreen from "./components/layout/MaintenanceScreen";
import ToastContainer from "./components/layout/ToastContainer";
import { ThemeProvider } from "./context/ThemeContext";
import { getPlatformSettings } from "./services/api";

// Inner component so we can use useNavigate (must be inside BrowserRouter)
function AppInner() {
  const navigate = useNavigate();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupModalMode, setSignupModalMode] = useState("signup"); // 'signup' | 'login'
  const [user, setUser] = useState(() => {
    return JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
  });
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const settings = await getPlatformSettings();
        setIsMaintenance(!!settings.maintenance_mode);
      } catch (err) {
        console.warn("Failed to check maintenance mode status:", err);
      }
    };
    checkMaintenance();
  }, []);

  const openSignup = () => {
    setSignupModalMode("signup");
    setShowSignupModal(true);
  };

  const openLogin = () => {
    setSignupModalMode("login");
    setShowSignupModal(true);
  };

  // Called by SignupModal after a successful login/signup from the backend
  const handleSignupSuccess = ({ email, companyName, hasProfile }) => {
    setShowSignupModal(false);
    const updatedUser = JSON.parse(sessionStorage.getItem("ideavault_user") || "null");
    setUser(updatedUser);

    if (hasProfile) {
      navigate("/dashboard");
    } else {
      navigate("/onboard");
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Navbar receives user state and handlers */}
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        onRegisterClick={openSignup}
        onLoginClick={openLogin}
      />

      <Routes>
        <Route path="/" element={<DiscoveryPage onRegisterClick={openSignup} />} />
        <Route path="/startup/:id" element={<StartupDetails />} />
        <Route 
          path="/onboard" 
          element={
            isMaintenance ? (
              <MaintenanceScreen />
            ) : (
              <OnboardingPage 
                user={user} 
                onOpenSignup={openSignup} 
                onOpenLogin={openLogin}
              />
            )
          } 
        />
        <Route path="/dashboard" element={<FounderDashboard isMaintenance={isMaintenance} />} />
        <Route 
          path="/dashboard/subscription" 
          element={
            isMaintenance ? (
              <MaintenanceScreen />
            ) : (
              <SubscriptionPage />
            )
          } 
        />
      </Routes>

      {/* Global Signup Modal — rendered at root level so it works from any page */}
      {showSignupModal && (
        <SignupModal
          onSuccess={handleSignupSuccess}
          onClose={() => setShowSignupModal(false)}
          initialMode={signupModalMode}
          isMaintenance={isMaintenance}
        />
      )}

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </ThemeProvider>
  );
}
