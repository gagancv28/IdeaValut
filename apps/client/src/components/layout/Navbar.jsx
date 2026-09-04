// src/components/layout/Navbar.jsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Zap, LayoutGrid, Rocket, Shield, ChevronRight, Menu, X, LogOut, LogIn, UserPlus } from "lucide-react";

export default function Navbar({ user, onLogout, onRegisterClick, onLoginClick }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Discover", icon: LayoutGrid },
    { to: "/onboard", label: "List Your Startup", icon: Rocket },
    { to: "/dashboard", label: "Dashboard", icon: Shield },
  ];

  return (
    <>
      {/* Spacer so page content isn't hidden behind fixed header */}
      <div style={{ height: 64 }} />

      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/" 
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-600 shadow-sm">
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-lg tracking-tight text-slate-900">IdeaVault</span>
                <span className="text-[10px] text-slate-500 font-medium">Startup Directory</span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600 font-semibold"
                        : "text-slate-700 hover:text-indigo-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-500"}`} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop CTA Buttons & Mobile Hamburger Button */}
            <div className="flex items-center gap-2 sm:gap-3.5">
              {/* Desktop Auth */}
              {user ? (
                <div className="hidden sm:flex items-center gap-3">
                  <span className="hidden lg:inline text-xs text-slate-500 max-w-[120px] truncate font-medium">
                    {user.email}
                  </span>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-all duration-200 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Log Out
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={onLoginClick}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition-all duration-200 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-slate-500" />
                    Log In
                  </button>
                  <button
                    onClick={onRegisterClick}
                    className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold shadow-sm cursor-pointer"
                  >
                    Register
                    <ChevronRight className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}

              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-150 shadow-lg">
            <div className="space-y-1">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-500"}`} />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-gray-100">
              {user ? (
                <div className="space-y-2">
                  <div className="px-4 text-xs font-semibold text-slate-500 truncate">
                    Logged in as: <span className="text-slate-900">{user.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold active:scale-98 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLoginClick();
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold active:scale-98 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-slate-500" />
                    Log In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onRegisterClick();
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs py-3 rounded-xl bg-indigo-600 text-white font-bold active:scale-98 transition-all shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
