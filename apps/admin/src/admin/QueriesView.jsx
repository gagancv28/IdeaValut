// src/admin/QueriesView.jsx
import React, { useState, useEffect } from "react";
import {
  MessageSquare, Search, Send, User, Clock, CheckCircle,
  AlertCircle, ChevronRight, Trash2
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/apiConfig";

export default function QueriesView() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQueryId, setSelectedQueryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/admin/queries`);
      if (!res.ok) throw new Error("Failed to fetch support queries.");
      const data = await res.json();
      
      setQueries(data || []);

      if (data && data.length > 0) {
        setSelectedQueryId((prev) => {
          const exists = data.some(q => q.id === prev);
          return exists ? prev : data[0].id;
        });
      } else {
        setSelectedQueryId(null);
      }
    } catch (err) {
      console.error("Error loading support queries:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const selectedQuery = queries.find((q) => q.id === selectedQueryId);

  const handleSelectQuery = async (id) => {
    setSelectedQueryId(id);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/queries/${id}/read`, {
        method: "PUT"
      });
      if (res.ok) {
        setQueries((prev) =>
          prev.map((q) => (q.id === id ? { ...q, unread: false } : q))
        );
        window.dispatchEvent(new Event("admin-badges-updated"));
      }
    } catch (err) {
      console.warn("Could not mark query as read:", err.message);
    }
  };

  const handleReplyViaEmail = async () => {
    if (!selectedQuery) return;

    const activeQuery = {
      user_email: selectedQuery.email
    };
    const gmailUrl = `https://mail.google.com/mail/u/2/#search/${activeQuery.user_email}`;
    window.open(gmailUrl, '_blank');

    try {
      // 1. Direct Supabase update
      const { error: supabaseErr } = await supabase
        .from('user_queries')
        .update({ status: 'replied', unread: false })
        .eq('id', selectedQuery.id);

      if (supabaseErr) {
        console.warn("Direct Supabase update failed:", supabaseErr.message);
      }

      // 2. Sync to local JSON fallback database on the backend
      const res = await fetch(`${getApiBaseUrl()}/api/admin/queries/${selectedQuery.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "replied" })
      });

      if (res.ok) {
        setQueries((prev) =>
          prev.map((q) =>
            q.id === selectedQuery.id
              ? { ...q, unread: false, status: "replied" }
              : q
          )
        );
        setSelectedQueryId(null); // Clear the active view
        window.dispatchEvent(new Event("admin-badges-updated"));
      }
    } catch (err) {
      console.error("Failed to update query status:", err.message);
    }
  };

  const handleDeleteQuery = async () => {
    if (!selectedQuery) return;
    if (!window.confirm("Are you sure you want to delete this query? This cannot be undone.")) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/queries/${selectedQuery.id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Failed to delete query.");
      }
      setSelectedQueryId(null);
      setQueries((prev) => prev.filter((q) => q.id !== selectedQuery.id));
      window.dispatchEvent(new Event("admin-badges-updated"));
    } catch (err) {
      alert("Failed to delete query: " + err.message);
    }
  };

  const filteredQueries = queries.filter(
    (q) =>
      q.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = queries.filter((q) => q.unread).length;

  return (
    <div className="flex-grow p-8 flex flex-col gap-6 overflow-hidden bg-[#070b13] h-full">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">User Queries</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Manage and respond to startup founder support tickets and platform inquiries</p>
        </div>
        <span className="text-[10px] font-extrabold text-slate-400 px-3 py-1.5 rounded-full bg-[#0d1323] border border-slate-850">
          Unread: {unreadCount} Ticket{unreadCount !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-slate-500 text-xs font-semibold">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Loading support tickets...
          </div>
        </div>
      ) : queries.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-white">All caught up!</h3>
            <p className="text-xs text-slate-400 mt-1">There are no user support queries or tickets remaining in the system.</p>
          </div>
        </div>
      ) : (
        /* Main Inbox Container */
        <div className="flex-grow flex gap-6 min-h-0 items-stretch">
          
          {/* Left Side: Ticket List */}
          <div className="w-80 flex flex-col gap-3.5 flex-shrink-0">
            {/* Search bar */}
            <div className="relative flex items-center bg-[#0d1323]/50 border border-slate-850 rounded-2xl px-4 py-2.5 text-xs text-slate-200">
              <Search className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-slate-200 placeholder:text-slate-655 font-semibold"
              />
            </div>

            {/* List scrollbox */}
            <div className="flex-grow overflow-y-auto space-y-2 pr-1.5">
              {filteredQueries.map((q) => {
                const isSelected = q.id === selectedQueryId;
                return (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuery(q.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative ${
                      isSelected
                        ? "bg-[#161d33] border-indigo-500/35 text-white"
                        : "bg-[#0d1323]/35 border-slate-900/60 text-slate-355 hover:bg-[#0d1323]/60"
                    }`}
                  >
                    {q.unread && (
                      <span className="absolute top-4.5 right-4 h-2 w-2 rounded-full bg-indigo-500 shadow-sm" />
                    )}

                    <div className="flex justify-between items-start pr-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white leading-tight">{q.sender}</span>
                        <span className="text-[10px] text-slate-500 font-semibold mt-0.5">{q.company}</span>
                      </div>
                      <span className="text-[9px] text-slate-550 font-semibold font-mono">
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-semibold truncate leading-tight mt-0.5">
                      {q.subject}
                    </p>

                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          q.category === "Verification"
                            ? "bg-amber-500/10 text-amber-450 border border-amber-500/25"
                            : q.category === "Billing"
                            ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>
                          {q.category}
                        </span>
                        {q.status === 'replied' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Replied
                          </span>
                        )}
                      </div>
                      {isSelected && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                  </div>
                );
              })}
              {filteredQueries.length === 0 && (
                <p className="text-center text-xs text-slate-600 italic py-8">No tickets found matching search.</p>
              )}
            </div>
          </div>

          {/* Right Side: Chat Window */}
          <div className="flex-1 bg-[#0d1323]/25 border border-slate-805 rounded-3xl overflow-hidden flex flex-col justify-between shadow-lg">
            {selectedQuery ? (
              <>
                {/* Chat Header */}
                <div className="px-6 py-4.5 border-b border-slate-900 bg-[#0c1323]/55 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-xs font-extrabold text-indigo-400">
                      {selectedQuery.sender.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{selectedQuery.sender}</h3>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Founder @ {selectedQuery.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedQuery.status === 'replied' ? (
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/25">
                        Replied
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-amber-450 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/25">
                        Pending Reply
                      </span>
                    )}
                    <span className="text-[10px] text-slate-450 font-bold bg-[#070b13] px-3 py-1 rounded-xl border border-slate-850 max-w-xs truncate">
                      Topic: {selectedQuery.subject}
                    </span>
                    <button
                      onClick={handleDeleteQuery}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center justify-center"
                      title="Delete query"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Chat Messages Log */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  {selectedQuery.messages && selectedQuery.messages.map((msg, idx) => {
                    const isAdmin = msg.role === "admin";
                    return (
                      <div
                        key={idx}
                        className={`flex ${isAdmin ? "justify-end" : "justify-start"} items-start gap-3`}
                      >
                        {!isAdmin && (
                          <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-extrabold text-slate-400 flex-shrink-0 mt-0.5 select-none">
                            F
                          </div>
                        )}
                        
                        {/* Message Bubble */}
                        <div className={`max-w-md rounded-2xl p-3.5 text-xs ${
                          isAdmin
                            ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-650/5"
                            : "bg-[#0d1323]/90 border border-slate-850 text-slate-200 rounded-tl-none"
                        }`}>
                          <div className="flex justify-between items-baseline gap-4 mb-1">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-450">
                              {isAdmin ? "Admin (Aman)" : msg.sender}
                            </span>
                            <span className="text-[8px] font-semibold text-slate-500 font-mono">{msg.time}</span>
                          </div>
                          <p className="leading-relaxed font-semibold">{msg.text}</p>
                        </div>

                        {isAdmin && (
                          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-[9px] font-extrabold text-white flex-shrink-0 mt-0.5 select-none">
                            A
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Chat Action Footer */}
                <div className="p-4.5 border-t border-slate-900 bg-[#0c1323]/35 flex gap-3 items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-medium">
                    This ticket will be marked as <strong className="text-slate-400">Replied</strong> upon clicking the button.
                  </div>
                  <button
                    onClick={handleReplyViaEmail}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-indigo-600/15"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Reply via Email
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 p-8 select-none">
                <MessageSquare className="w-12 h-12 mb-3 text-slate-800" />
                <span className="text-sm font-semibold">Select a support ticket to reply</span>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
