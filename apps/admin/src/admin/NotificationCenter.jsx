// src/admin/NotificationCenter.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Shield, MessageSquare, CheckCheck, X,
  Clock, Inbox
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/apiConfig";
import { isPendingVerification } from "../utils/verificationHelper";

function timeAgo(dateStr) {
  if (!dateStr) return "Just now";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("admin_read_notifs") || "[]"));
    } catch { return new Set(); }
  });
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const items = [];

      // 1. Pending / Unverified startups
      try {
        const { data: startups } = await supabase
          .from("startups")
          .select("id, name, status, verification_status, created_at, requested_plan, plan_type")
          .order("created_at", { ascending: false })
          .limit(30);

        if (startups) {
          for (const s of startups) {
            if (isPendingVerification(s)) {
              items.push({
                id: `startup-${s.id}`,
                type: "verification",
                iconType: "shield",
                iconColor: "text-amber-400",
                iconBg: "bg-amber-400/10",
                title: "Pending Verification",
                message: `${s.name || "A startup"} is awaiting review`,
                time: s.created_at,
                link: "/verifications",
              });
            }
          }
        }
      } catch (e) {}

      // 2. Unread support queries
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/queries`);
        if (res.ok) {
          const queries = await res.json();
          for (const q of queries || []) {
            if (q.unread !== false) {
              items.push({
                id: `query-${q.id}`,
                type: "query",
                iconType: "message",
                iconColor: "text-indigo-400",
                iconBg: "bg-indigo-400/10",
                title: "New User Query",
                message: q.subject || (q.message || "").slice(0, 60) || "Support request received",
                time: q.created_at,
                link: "/queries",
              });
            }
          }
        }
      } catch (e) {}

      items.sort((a, b) => new Date(b.time) - new Date(a.time));
      setNotifications(items);
    } catch (err) {
      console.warn("[NotificationCenter] fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const handler = () => fetchNotifications();
    window.addEventListener("admin-badges-updated", handler);
    return () => window.removeEventListener("admin-badges-updated", handler);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    try { localStorage.setItem("admin_read_notifs", JSON.stringify([...allIds])); } catch (e) {}
  };

  const markOneRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("admin_read_notifs", JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  };

  const handleNotifClick = (notif) => {
    markOneRead(notif.id);
    setOpen(false);
    navigate(notif.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(p => !p); if (!open) fetchNotifications(); }}
        className="relative text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-[#161d33]/50"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-[8px] font-bold text-white flex items-center justify-center shadow-sm shadow-rose-500/40">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={null}
          className="absolute right-0 top-11 w-80 bg-[#0d1323] border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden"
          style={{ maxHeight: "420px" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-white tracking-wide">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[9px] font-extrabold border border-rose-500/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-7 w-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-[11px] text-slate-500 font-medium">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-slate-500" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold text-slate-400">You are all caught up</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">No pending items right now</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {notifications.map((notif) => {
                  const isUnread = !readIds.has(notif.id);
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors group ${isUnread ? "bg-indigo-500/[0.03]" : ""}`}
                    >
                      <div className={`flex-shrink-0 h-8 w-8 rounded-xl ${notif.iconBg} flex items-center justify-center mt-0.5`}>
                        {notif.iconType === "shield"
                          ? <Shield className={`w-4 h-4 ${notif.iconColor}`} />
                          : <MessageSquare className={`w-4 h-4 ${notif.iconColor}`} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-bold ${isUnread ? "text-white" : "text-slate-400"} truncate`}>
                            {notif.title}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" />}
                            <span className="text-[9px] text-slate-600 whitespace-nowrap flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {timeAgo(notif.time)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug truncate group-hover:text-slate-400 transition-colors">
                          {notif.message}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-slate-800/80 px-4 py-2.5 flex-shrink-0 text-center">
              <button
                onClick={() => { setOpen(false); navigate("/verifications"); }}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View all pending items ?
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
