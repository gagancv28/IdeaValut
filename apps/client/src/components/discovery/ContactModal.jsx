// src/components/discovery/ContactModal.jsx
import React, { useEffect } from "react";
import { X, Mail, Phone, ExternalLink, MessageSquare, Share2, Terminal, Globe } from "lucide-react";

export default function ContactModal({ startup, onClose }) {
  const {
    name,
    contactEmail,
    email,
    contactPhone,
    phone_number,
    additionalContacts
  } = startup;

  const displayEmail = contactEmail || email;
  const displayPhone = contactPhone || phone_number;
  const contactsList = additionalContacts || [];

  // Prevent body scroll and layout shift while modal is open
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getIconForLabel = (label) => {
    const lower = (label || "").toLowerCase();
    if (lower.includes("linkedin")) return <Share2 className="w-4 h-4 text-[#0a66c2]" />;
    if (lower.includes("twitter") || lower.includes("x")) return <MessageSquare className="w-4 h-4 text-sky-400" />;
    if (lower.includes("github")) return <Terminal className="w-4 h-4 text-slate-200" />;
    if (lower.includes("website") || lower.includes("pitch")) return <Globe className="w-4 h-4 text-emerald-400" />;
    return <MessageSquare className="w-4 h-4 text-indigo-400" />;
  };

  const hasAnyContact = displayEmail || displayPhone || contactsList.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* 2. Nuke the Overlay Blur: Hardcoded class exactly as requested */}
      <div 
        className="fixed inset-0 z-50 bg-black/80" 
        onClick={onClose}
      />

      {/* Dialog content (Clean and stripped of animations/transforms/shadows) */}
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 z-50 my-auto"
        style={{
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Connect with {name}</h3>
            <p className="text-xs text-slate-400 mt-1">Get in touch directly with the founders</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!hasAnyContact ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            No contact information is publicly listed for this startup.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Email */}
            {displayEmail && (
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Mail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email Address</p>
                    <p className="text-sm text-slate-200 font-semibold">{displayEmail}</p>
                  </div>
                </div>
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${displayEmail}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 font-semibold flex items-center gap-1 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg"
                >
                  Send Mail
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Phone */}
            {displayPhone && (
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="text-sm text-slate-200 font-semibold">{displayPhone}</p>
                  </div>
                </div>
                <a
                  href={`tel:${displayPhone}`}
                  className="text-xs text-emerald-400 font-semibold flex items-center gap-1 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg"
                >
                  Call Now
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Additional Contacts */}
            {contactsList.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Other Channels</h4>
                <div className="grid grid-cols-1 gap-2">
                  {contactsList.map((contact, idx) => {
                    if (!contact.value || !contact.value.trim()) return null;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                            {getIconForLabel(contact.label)}
                          </div>
                          <span className="text-xs font-bold text-slate-300">{contact.label}</span>
                        </div>
                        <a
                          href={contact.value.startsWith("http") ? contact.value : `https://${contact.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 flex items-center gap-1 font-medium hover:bg-slate-800 px-2.5 py-1.5 rounded-lg"
                        >
                          Visit Link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-800 mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-slate-200 font-semibold rounded-xl text-xs hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
