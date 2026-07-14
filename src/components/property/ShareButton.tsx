"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: window.location.href,
      }).catch(() => {
        // Fallback to clipboard if share dialog is cancelled or fails
        copyToClipboard();
      });
    } else {
      copyToClipboard();
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-2xl text-sm font-medium transition-all"
      style={{
        background: "var(--bg-secondary)",
        color: copied ? "var(--color-success, #10b981)" : "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      {copied ? "Link copiado!" : "Compartilhar"}
    </button>
  );
}
