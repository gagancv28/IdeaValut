// src/components/auth/SignupModal.jsx
import { useState } from 'react';
import { X, Lock, Eye, EyeOff, Loader2, CheckCircle2, Building2, Mail } from 'lucide-react';
import { signupFounder, loginFounder } from '../../services/api';

export default function SignupModal({ onSuccess, onClose, initialMode = 'signup', isMaintenance = false }) {
  const [isLoginMode, setIsLoginMode] = useState(initialMode === 'login');
  const [form, setForm] = useState({ email: '', password: '', companyName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(''); // clear error on new input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoginMode && isMaintenance) return; // Prevent signup submission during maintenance
    setError('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // ─── LOGIN FLOW ───
        const data = await loginFounder({
          email: form.email,
          password: form.password,
        });

        // Store session info
        sessionStorage.setItem('ideavault_user', JSON.stringify({
          email: form.email,
          companyName: data.companyName || '',
          userId: data.user?.id ?? null,
        }));

        // If user already has a company name set, mark profile as completed
        if (data.companyName) {
          sessionStorage.setItem('ideavault_has_profile', 'true');
          sessionStorage.setItem('ideavault_startup_profile', JSON.stringify({
            companyName: data.companyName,
            email: form.email,
          }));
        } else {
          sessionStorage.removeItem('ideavault_has_profile');
          sessionStorage.removeItem('ideavault_startup_profile');
        }

        setSuccess(true);
        setTimeout(() => {
          onSuccess({
            email: form.email,
            companyName: data.companyName || '',
            hasProfile: !!data.companyName
          });
        }, 1200);

      } else {
        // ─── SIGNUP FLOW ───
        const data = await signupFounder({
          email: form.email,
          password: form.password,
          companyName: form.companyName,
        });

        // Store session info
        sessionStorage.setItem('ideavault_user', JSON.stringify({
          email: form.email,
          companyName: form.companyName,
          userId: data.user?.id ?? null,
        }));

        // A brand new user has no startup profile filled yet
        sessionStorage.removeItem('ideavault_has_profile');
        sessionStorage.removeItem('ideavault_startup_profile');

        setSuccess(true);
        setTimeout(() => {
          onSuccess({
            email: form.email,
            companyName: form.companyName,
            hasProfile: false
          });
        }, 1200);
      }
    } catch (err) {
      console.error('Auth Network Error:', err);
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Cannot reach the server. Make sure the backend is running on port 3001.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setError('');
    setForm({ email: '', password: '', companyName: '' });
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 sm:p-8 border animate-in fade-in-50 zoom-in-95 duration-200 my-auto"
        style={{
          background: '#ffffff',
          borderColor: 'rgba(79,70,229,0.25)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success State */}
        {success ? (
          <div className="text-center py-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(79,70,229,0.12)', border: '2px solid rgba(79,70,229,0.3)' }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: '#4f46e5' }} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {isLoginMode ? 'Welcome Back!' : 'Account Created!'}
            </h3>
            <p className="text-sm text-slate-400">
              {isLoginMode ? 'Logging you into your dashboard…' : 'Setting up your founder workspace…'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.25)' }}
              >
                <Lock className="w-5 h-5" style={{ color: '#4f46e5' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {isLoginMode ? 'Log In to IdeaVault' : 'Create Your Account'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isLoginMode ? 'Access your founder dashboard' : 'Register to list your startup on IdeaVault'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Company Name (only show during Signup) */}
              {!isLoginMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Company / Startup Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      name="companyName"
                      type="text"
                      value={form.companyName}
                      onChange={handleChange}
                      placeholder="e.g. FinFlux AI"
                      required
                      autoFocus
                      className="form-input pl-10 w-full"
                      style={{
                        background: '#f0f4ff',
                        border: '1px solid #c7d2fe',
                        borderRadius: '10px',
                        padding: '10px 12px 10px 36px',
                        color: '#1e293b',
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="founder@company.com"
                    required
                    className="form-input pl-10 w-full"
                    style={{
                      background: '#f0f4ff',
                      border: '1px solid #c7d2fe',
                      borderRadius: '10px',
                      padding: '10px 12px 10px 36px',
                      color: '#1e293b',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder={isLoginMode ? 'Enter your password' : 'Min. 6 characters'}
                    required
                    minLength={6}
                    className="form-input pr-10 w-full"
                    style={{
                      background: '#f0f4ff',
                      border: '1px solid #c7d2fe',
                      borderRadius: '10px',
                      padding: '10px 40px 10px 12px',
                      color: '#1e293b',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-xl text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#b91c1c',
                  }}
                >
                  <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || (!isLoginMode && isMaintenance)}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                style={{
                  background: (isLoading || (!isLoginMode && isMaintenance)) ? 'rgba(148,163,184,0.5)' : '#4f46e5',
                  boxShadow: (isLoading || (!isLoginMode && isMaintenance)) ? 'none' : '0 4px 14px rgba(79,70,229,0.35)',
                  cursor: (isLoading || (!isLoginMode && isMaintenance)) ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isLoginMode ? 'Logging in…' : 'Creating account…'}
                  </>
                ) : (
                  !isLoginMode && isMaintenance ? 'Paused for Maintenance' : (isLoginMode ? 'Log In' : 'Create Account & Continue')
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs text-slate-600 mt-5">
              {isLoginMode ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-indigo-600 hover:text-indigo-500 font-semibold transition-colors"
              >
                {isLoginMode ? 'Register instead' : 'Log in instead'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
