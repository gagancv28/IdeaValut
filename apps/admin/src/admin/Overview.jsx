// src/admin/Overview.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, ShieldAlert, Landmark, Wallet, ArrowRight, Clock, BarChart3, BadgeCheck
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/apiConfig";
import { isPendingVerification } from "../utils/verificationHelper";

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingCount: 0,
    totalCount: 0,
    activeCount: 0,
    proCount: 0,
    spotCount: 0,
    revenueInr: 0,
    revenueUsd: 0,
    proRevenue: 0,
    spotRevenue: 0,
    unreadQueriesCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // 1. Fetch unread queries count from stats endpoint
        let unreadQueriesCount = 0;
        try {
          const statsRes = await fetch(`${getApiBaseUrl()}/api/admin/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            unreadQueriesCount = statsData.unreadQueriesCount || 0;
          }
        } catch (err) {
          console.warn("Could not fetch queries count:", err.message);
        }

        // 2. Fetch all startups directly from Supabase / API to calculate directory metrics and revenue
        let startups = [];
        try {
          const { data, error } = await supabase.from('startups').select('*');
          if (!error && data && data.length > 0) {
            startups = data;
          } else {
            const res = await fetch(`${getApiBaseUrl()}/api/admin/startups`);
            if (res.ok) startups = await res.json();
          }
        } catch (e) {
          const res = await fetch(`${getApiBaseUrl()}/api/admin/startups`);
          if (res.ok) startups = await res.json();
        }

        // Fetch platform settings for pricing fallbacks (INR + USD)
        let basicPriceInr = 2499;
        let proPriceInr = 9999;
        let spotPriceInr = 24999;
        let basicPriceUsd = 49;
        let proPriceUsd = 149;
        let spotPriceUsd = 300;
        try {
          const settingsRes = await fetch(`${getApiBaseUrl()}/api/platform-settings`);
          if (settingsRes.ok) {
            const sData = await settingsRes.json();
            if (sData.basic_price_inr) basicPriceInr = parseInt(String(sData.basic_price_inr).replace(/[^0-9]/g, ''), 10) || 2499;
            if (sData.pro_price_inr) proPriceInr = parseInt(String(sData.pro_price_inr).replace(/[^0-9]/g, ''), 10) || 9999;
            if (sData.spotlight_price_inr) spotPriceInr = parseInt(String(sData.spotlight_price_inr).replace(/[^0-9]/g, ''), 10) || 24999;
            if (sData.basic_price_usd) basicPriceUsd = parseInt(String(sData.basic_price_usd).replace(/[^0-9]/g, ''), 10) || 49;
            if (sData.pro_price_usd) proPriceUsd = parseInt(String(sData.pro_price_usd).replace(/[^0-9]/g, ''), 10) || 149;
            if (sData.spotlight_price_usd) spotPriceUsd = parseInt(String(sData.spotlight_price_usd).replace(/[^0-9]/g, ''), 10) || 300;
          }
        } catch (e) {}
        
        // Strict paid/active filter
        const paidStartups = startups.filter(s => {
          const status = (s.status || '').toLowerCase();
          return status === 'paid' || status === 'active';
        });

        // Counts
        const totalCount = startups.length;
        const activeCount = paidStartups.length;

        // Pending Count: startups waiting in moderation/verification/documents using standardized filter
        const pendingCount = startups.filter(isPendingVerification).length;

        // Case-insensitive tier classifier helpers
        const isPro = (s) => {
          const p = (s.plan_type || s.tier || s.requested_plan || s.subscription_plan || '').toLowerCase();
          return p.includes('pro');
        };

        const isSpotlight = (s) => {
          const p = (s.plan_type || s.tier || s.requested_plan || s.subscription_plan || '').toLowerCase();
          return p.includes('spotlight');
        };

        const isBasic = (s) => !isPro(s) && !isSpotlight(s);

        // Pro and Spotlight counts ONLY for paid/active directory listings
        const proCount = paidStartups.filter(isPro).length;
        const spotCount = paidStartups.filter(isSpotlight).length;

        // Helper to extract row price with currency conversion (1 USD = 83.5 INR)
        const getRowAmountInr = (s) => {
          const curr = (s.currency || '').toUpperCase();
          const isUsd = curr === 'USD' || curr === '$';
          const defaultPrice = isPro(s) 
            ? (isUsd ? proPriceUsd * 83.5 : proPriceInr) 
            : (isSpotlight(s) ? (isUsd ? spotPriceUsd * 83.5 : spotPriceInr) : (isUsd ? basicPriceUsd * 83.5 : basicPriceInr));
          
          if (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "") {
            const rawAmt = Number(s.amount_paid);
            return isNaN(rawAmt) ? 0 : (isUsd ? rawAmt * 83.5 : rawAmt);
          }
          return defaultPrice;
        };

        // Calculate normalized INR basic revenue for chart visualization
        const basicRevenue = paidStartups.filter(isBasic).reduce((sum, s) => sum + getRowAmountInr(s), 0);
        const proRevenue = paidStartups.filter(isPro).reduce((sum, s) => sum + getRowAmountInr(s), 0);
        const spotRevenue = paidStartups.filter(isSpotlight).reduce((sum, s) => sum + getRowAmountInr(s), 0);

        // Raw currency totals
        const revenueInr = paidStartups.reduce((sum, s) => {
          const curr = (s.currency || 'INR').toUpperCase();
          if (curr === 'INR' || curr === '₹' || !curr) {
            const defaultPrice = isPro(s) ? proPriceInr : (isSpotlight(s) ? spotPriceInr : basicPriceInr);
            const amount = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "")
              ? Number(s.amount_paid)
              : defaultPrice;
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        const revenueUsd = paidStartups.reduce((sum, s) => {
          const curr = (s.currency || '').toUpperCase();
          if (curr === 'USD' || curr === '$') {
            const defaultPrice = isPro(s) ? proPriceUsd : (isSpotlight(s) ? spotPriceUsd : basicPriceUsd);
            const amount = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "")
              ? Number(s.amount_paid)
              : defaultPrice;
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        const basicRevenueUsd = paidStartups.filter(isBasic).reduce((sum, s) => {
          const curr = (s.currency || '').toUpperCase();
          if (curr === 'USD' || curr === '$') {
            const amount = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "") ? Number(s.amount_paid) : basicPriceUsd;
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        const proRevenueUsd = paidStartups.filter(isPro).reduce((sum, s) => {
          const curr = (s.currency || '').toUpperCase();
          if (curr === 'USD' || curr === '$') {
            const amount = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "") ? Number(s.amount_paid) : proPriceUsd;
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        const spotRevenueUsd = paidStartups.filter(isSpotlight).reduce((sum, s) => {
          const curr = (s.currency || '').toUpperCase();
          if (curr === 'USD' || curr === '$') {
            const amount = (s.amount_paid !== undefined && s.amount_paid !== null && s.amount_paid !== "") ? Number(s.amount_paid) : spotPriceUsd;
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        setStats({
          pendingCount,
          totalCount,
          activeCount,
          proCount,
          spotCount,
          revenueInr,
          revenueUsd,
          basicRevenue,
          proRevenue,
          spotRevenue,
          basicRevenueUsd,
          proRevenueUsd,
          spotRevenueUsd,
          unreadQueriesCount
        });
      } catch (err) {
        console.error("Error fetching admin overview stats:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const maxVal = 50000;
  const getBarPct = (val) => {
    if (!val || val <= 0) return 0;
    return Math.max(4, Math.min(95, Math.round((val / maxVal) * 100)));
  };

  return (
    <div className="flex-grow p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-[#070b13]">
      {/* Header Block */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Overview Dashboard</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Platform operations, analytics, and startup directories status</p>
        </div>
      </div>

      {/* Action Required Banner */}
      {stats.pendingCount > 0 && (
        <div 
          onClick={() => navigate("/verifications")}
          className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all hover:scale-[0.99] active:scale-[0.985] shadow-lg shadow-amber-500/5 group animate-pulse"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-500">Action Required</h4>
              <p className="text-xs text-amber-400/80 font-medium mt-0.5">{stats.pendingCount} Startup{stats.pendingCount > 1 ? 's' : ''} Awaiting Verification</p>
            </div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate("/verifications");
            }}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-450 text-[#070b13] px-4.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 group-hover:translate-x-0.5 cursor-pointer"
          >
            Review Documents <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Revenue Snapshot Card */}
      <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-900 pb-5">
          <div>
            <h3 className="text-sm font-bold text-white">Revenue Snapshot</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Subscription billing and listing application fee transaction records</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 px-2.5 py-1 rounded bg-[#101726]/60 border border-slate-800/40">
              Live DB Stats
            </span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Synchronized
            </span>
          </div>
        </div>

        {/* Money Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0c1224]/30 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-center min-h-[90px]">
            <div className="flex items-center gap-2 text-slate-500">
              <Landmark className="w-4 h-4" />
              <span className="text-[10px] font-extrabold tracking-wider uppercase">HISTORICAL REVENUE (LIVE DB)</span>
            </div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-lg font-bold text-white">₹{stats.revenueInr.toLocaleString()}</span>
              {stats.revenueUsd > 0 && (
                <span className="text-sm font-bold text-indigo-400">/ ${stats.revenueUsd.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="bg-[#0c1224]/30 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-center min-h-[90px]">
            <div className="flex items-center gap-2 text-slate-500">
              <Wallet className="w-4 h-4" />
              <span className="text-[10px] font-extrabold tracking-wider uppercase">ACTIVE DIRECTORY ENTRIES</span>
            </div>
            <span className="text-lg font-bold text-white mt-2">{stats.activeCount} Startups</span>
          </div>
          <div className="bg-[#0c1224]/30 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-center min-h-[90px]">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="w-4 h-4" />
              <span className="text-[10px] font-extrabold tracking-wider uppercase">PENDING VERIFICATIONS</span>
            </div>
            <span className="text-lg font-bold text-amber-500 mt-2">{stats.pendingCount}</span>
          </div>
        </div>

        {/* Middle Bar Chart: Revenue by Tier with Y-Axis and Grid Lines */}
        <div className="h-64 bg-[#101726]/30 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-900/60 pb-2">
            <span>Historical Revenue Breakdown</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-slate-500" /> Basic ({stats.basicRevenue > 0 ? `₹${stats.basicRevenue.toLocaleString()}` : 'Free'})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-violet-600" /> Verified Pro</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-indigo-500" /> Spotlight</span>
            </div>
          </div>

          <div className="flex-1 flex items-stretch gap-4 min-h-0">
            {/* Left Y-Axis Amount Labels */}
            <div className="flex flex-col justify-between text-[8.5px] text-slate-400 font-bold font-mono h-full pb-4 select-none text-right w-11 border-r border-slate-800/20 pr-3">
              <span>₹50,000</span>
              <span>₹40,000</span>
              <span>₹30,000</span>
              <span>₹20,000</span>
              <span>₹10,000</span>
              <span>₹0</span>
            </div>

            {/* Monthly Bar Columns */}
            <div className="flex-1 flex items-end gap-5 h-full relative">
              {/* Horizontal Faint Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-4">
                <div className="w-full border-t border-slate-700/35" />
                <div className="w-full border-t border-slate-700/20" />
                <div className="w-full border-t border-slate-700/20" />
                <div className="w-full border-t border-slate-700/20" />
                <div className="w-full border-t border-slate-700/20" />
                <div className="w-full border-t border-slate-700/35" />
              </div>

              {/* Monthly Bar Columns (z-10 to render above gridlines) */}
              {[
                { 
                  month: "Total Collections", 
                  basicPct: getBarPct(stats.basicRevenue), 
                  basicRev: stats.basicRevenue > 0 ? `₹${stats.basicRevenue.toLocaleString()}` : "Free (₹0)", 
                  proPct: getBarPct(stats.proRevenue), 
                  proRev: `₹${stats.proRevenue.toLocaleString()}`, 
                  spotPct: getBarPct(stats.spotRevenue), 
                  spotRev: `₹${stats.spotRevenue.toLocaleString()}` 
                }
              ].map((d) => (
                <div key={d.month} className="flex-grow flex flex-col items-center gap-1.5 h-full justify-end z-10">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full max-w-[200px]">
                    
                    {/* Bar 1: Basic */}
                    <div className="relative group flex flex-col justify-end h-full cursor-pointer">
                      <div 
                        style={{ height: `${d.basicPct}%` }} 
                        className="w-6 rounded bg-slate-500 hover:bg-slate-400 transition-all duration-300" 
                      />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center bg-[#0c1224] border border-slate-800 shadow-xl pointer-events-none whitespace-nowrap z-35 text-center px-2 py-1 rounded-md leading-normal">
                        <span className="text-slate-300 text-[8.5px] font-extrabold">Basic Tier</span>
                        <span className="text-slate-400 text-[8px] font-bold font-mono mt-0.5">{d.basicRev}</span>
                      </span>
                    </div>

                    {/* Bar 2: Verified Pro */}
                    <div className="relative group flex flex-col justify-end h-full cursor-pointer">
                      <div 
                        style={{ height: `${d.proPct}%` }} 
                        className="w-6 rounded bg-violet-600 hover:bg-violet-500 transition-all duration-300" 
                      />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center bg-[#0c1224] border border-violet-550/20 shadow-xl pointer-events-none whitespace-nowrap z-35 text-center px-2 py-1 rounded-md leading-normal">
                        <span className="text-violet-400 text-[8.5px] font-extrabold">Verified Pro Total</span>
                        <span className="text-violet-300 text-[8px] font-bold font-mono mt-0.5">{d.proRev}</span>
                      </span>
                    </div>

                    {/* Bar 3: Spotlight */}
                    <div className="relative group flex flex-col justify-end h-full cursor-pointer">
                      <div 
                        style={{ height: `${d.spotPct}%` }} 
                        className="w-6 rounded bg-indigo-500 hover:bg-indigo-400 transition-all duration-300" 
                      />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center bg-[#0c1224] border border-indigo-500/25 shadow-xl pointer-events-none whitespace-nowrap z-35 text-center px-2 py-1 rounded-md leading-normal">
                        <span className="text-indigo-400 text-[8.5px] font-extrabold">Spotlight Total</span>
                        <span className="text-indigo-300 text-[8px] font-bold font-mono mt-0.5">{d.spotRev}</span>
                      </span>
                    </div>

                  </div>
                  <span className="text-[9px] text-slate-550 font-bold mt-0.5">{d.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of other dashboard cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Directory Health */}
        <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-900">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">DIRECTORY HEALTH</h3>
          </div>
          <div className="space-y-3 font-semibold text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Total Listed Startups</span>
              <span className="font-bold text-white">{stats.totalCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Active Listings</span>
              <span className="font-bold text-white">{stats.activeCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pending Moderation</span>
              <span className="font-bold text-amber-500">{stats.pendingCount}</span>
            </div>
          </div>
        </div>

        {/* Verification Performance */}
        <div className="bg-[#0d1323]/50 border border-slate-800/60 rounded-3xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-900">
            <BadgeCheck className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">VERIFICATION RATIOS</h3>
          </div>
          <div className="space-y-3 font-semibold text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Spotlight Tier Count</span>
              <span className="font-bold text-white">{stats.spotCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Verified Pro Tier Count</span>
              <span className="font-bold text-white">{stats.proCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Basic Free Tier Count</span>
              <span className="font-bold text-white">{stats.activeCount - stats.proCount - stats.spotCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
