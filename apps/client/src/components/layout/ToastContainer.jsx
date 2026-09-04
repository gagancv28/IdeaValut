// src/components/layout/ToastContainer.jsx
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export default function ToastContainer() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleToast = (e) => {
      setToast({ message: e.detail.message, type: e.detail.type });
    };
    window.addEventListener("show-toast", handleToast);
    return () => window.removeEventListener("show-toast", handleToast);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-md bg-slate-900/95 border-slate-800 text-slate-100 max-w-sm">
        {toast.type === "success" ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
        )}
        <div className="flex-1 text-sm font-medium pr-2">
          {toast.message}
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
