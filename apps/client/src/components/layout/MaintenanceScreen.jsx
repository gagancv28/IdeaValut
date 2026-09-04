import React from "react";
import { Settings } from "lucide-react";

export default function MaintenanceScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20 animate-pulse">
          <Settings className="w-8 h-8 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100">System Under Maintenance</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            IdeaVault is currently undergoing scheduled maintenance. Please check back shortly.
          </p>
        </div>
        <div className="pt-2">
          <span className="text-[10px] text-slate-500 font-semibold bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-full">
            Pipeline Safety Enabled
          </span>
        </div>
      </div>
    </div>
  );
}
