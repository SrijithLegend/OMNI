/**
 * Omni Content Script — Engine Architecture v2.0
 *
 * Runs in every supported AI page. Uses the Messaging Engine for
 * all communication with the background script. Injects the FAB,
 * handles captures, and shows the rate-limit banner.
 */

import { MessagingEngine } from "../messaging/engine.js";

(function () {
  "use strict";

  if (window.__omniInjected) return;
  window.__omniInjected = true;

  // ── Messaging Engine (lightweight in-page instance) ─────────────────────
  const messaging = new MessagingEngine({ debug: false, logMessages: false });
  messaging.start();

  // ── FAB Injection ─────────────────────────────────────────────────────────
  function injectFAB() {
    if (document.getElementById("omni-fab")) return;

    const fab = document.createElement("div");
    fab.id = "omni-fab";
    fab.setAttribute("aria-label", "Omni AI: capture this conversation");
    fab.setAttribute("role", "button");
    fab.setAttribute("tabindex", "0");
    fab.innerHTML = `
      <div id="omni-fab-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          <path d="m9 15 2 2 4-4"/>
        </svg>
      </div>
      <span id="omni-fab-label">Capture</span>
      <div id="omni-toast" class="omni-toast omni-toast-hidden" role="status" aria-live="polite"></div>
    `;
    document.body.appendChild(fab);

    fab.addEventListener("click", handleCapture);
    fab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCapture();
      }
    });
  }

  // ── Capture Handler ───────────────────────────────────────────────────────
  function handleCapture() {
    setFabState("loading");
    chrome.runtime.sendMessage({ type: "CONVERSATION_CAPTURE" }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        showToast("❌ " + (response?.error || "Capture failed"), "error");
        setFabState("idle");
      } else {
        const count = response?.conversation?.messages?.length ?? 0;
        const source = response?.source ?? "AI";
        showToast(`✅ ${count} messages captured from ${source}! Open Omni to transfer.`, "success");
        setFabState("done");
        setTimeout(() => setFabState("idle"), 4000);
      }
    });
  }

  // ── FAB State Machine ─────────────────────────────────────────────────────
  const ICONS = {
    idle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="m9 15 2 2 4-4"/></svg>`,
    loading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="0" class="omni-spin-circle"/></svg>`,
    done: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5 9-9"/></svg>`,
  };

  function setFabState(state) {
    const fab = document.getElementById("omni-fab");
    const icon = document.getElementById("omni-fab-icon");
    const label = document.getElementById("omni-fab-label");
    if (!fab || !icon || !label) return;

    icon.innerHTML = ICONS[state] || ICONS.idle;
    fab.classList.remove("omni-loading", "omni-done");

    if (state === "loading") {
      label.textContent = "Capturing...";
      fab.classList.add("omni-loading");
      fab.setAttribute("aria-label", "Omni AI: capturing...");
    } else if (state === "done") {
      label.textContent = "Captured!";
      fab.classList.add("omni-done");
      fab.setAttribute("aria-label", "Omni AI: captured successfully");
    } else {
      label.textContent = "Capture";
      fab.setAttribute("aria-label", "Omni AI: capture this conversation");
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, type = "info") {
    const toast = document.getElementById("omni-toast");
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = `omni-toast omni-toast-${type}`;
    toastTimer = setTimeout(() => {
      toast.className = "omni-toast omni-toast-hidden";
    }, 4500);
  }

  // ── Rate Limit Banner ───────────────────────────────────────────────────
  const RATE_LIMIT_PATTERNS = [
    /usage\s*limit/i,
    /message\s*limit/i,
    /rate\s*limit/i,
    /you'?ve?\s*reached/i,
    /at\s*capacity/i,
    /quota\s*exceeded/i,
    /too\s*many\s*requests/i,
    /upgrade\s*(your\s*)?(plan|to)/i,
    /free\s*(plan\s*)?limit/i,
    /try\s*again\s*(in|later)/i,
    /daily\s*(message|usage|limit)/i,
    /out\s*of\s*(messages|credits|tokens)/i,
    /limit\s*reached/i,
    /temporarily\s*unavailable/i,
    /overloaded/i,
  ];

  const QUICK_TARGETS = [
    { name: "ChatGPT", url: "https://chatgpt.com/" },
    { name: "Gemini", url: "https://gemini.google.com/app" },
    { name: "Grok", url: "https://grok.com/" },
    { name: "DeepSeek", url: "https://chat.deepseek.com/" },
  ];

  let bannerDismissed = !!sessionStorage.getItem("omni_rl_dismissed");
  let bannerShown = false;

  function isRateLimitText(text) {
    return RATE_LIMIT_PATTERNS.some((re) => re.test(text));
  }

  function removeBanner() {
    const b = document.getElementById("omni-rl-banner");
    if (b) {
      b.remove();
      bannerShown = false;
    }
  }

  function injectBanner() {
    if (bannerShown || bannerDismissed) return;
    if (document.getElementById("omni-rl-banner")) return;
    bannerShown = true;

    if (!document.getElementById("omni-rl-style")) {
      const style = document.createElement("style");
      style.id = "omni-rl-style";
      style.textContent = `
        @keyframes omni-slide-in {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes omni-slide-out {
          from { opacity:1; transform:translateY(0); }
          to   { opacity:0; transform:translateY(12px); }
        }
      `;
      document.head.appendChild(style);
    }

    const banner = document.createElement("div");
    banner.id = "omni-rl-banner";
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "assertive");
    banner.style.cssText = [
      "position:fixed",
      "bottom:80px",
      "right:24px",
      "z-index:2147483646",
      "background:#1e1b4b",
      "border:1px solid #4c1d95",
      "border-radius:14px",
      "padding:12px 14px",
      "max-width:300px",
      "min-width:260px",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "font-size:13px",
      "color:#e8e8f0",
      "box-shadow:0 8px 32px rgba(0,0,0,0.45)",
      "animation:omni-slide-in 0.25s ease",
    ].join(";");

    const btns = QUICK_TARGETS
      .map(
        (t) =>
          `<button data-url="${t.url}" data-model="${t.name}" style="background:#4c1d95;border:none;border-radius:8px;color:#e8e8f0;font-size:12px;font-weight:600;padding:5px 10px;cursor:pointer;font-family:inherit;">${t.name}</button>`,
      )
      .join("");

    banner.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
        <span style="font-weight:600;line-height:1.4;">
          ⚡ Omni: usage limit detected.<br>
          <span style="font-weight:400;color:#a5b4fc;">Continue in another AI?</span>
        </span>
        <button id="omni-rl-close" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:20px;line-height:1;padding:0;font-family:inherit;flex-shrink:0;" aria-label="Dismiss rate limit banner">×</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${btns}</div>
    `;

    document.body.appendChild(banner);

    document.getElementById("omni-rl-close").addEventListener("click", () => {
      banner.style.animation = "omni-slide-out 0.2s ease forwards";
      setTimeout(() => {
        banner.remove();
        bannerShown = false;
      }, 200);
      bannerDismissed = true;
      sessionStorage.setItem("omni_rl_dismissed", "1");
    });

    banner.querySelectorAll("button[data-model]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetModel = btn.dataset.model;
        btn.textContent = "Capturing...";
        btn.disabled = true;
        btn.style.opacity = "0.6";

        chrome.runtime.sendMessage({ type: "CONVERSATION_CAPTURE" }, (captureResp) => {
          chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL_WITH_TARGET", targetModel });
          banner.remove();
          bannerShown = false;
        });
      });
    });
  }

  // ── SPA Navigation Detection ────────────────────────────────────────────
  let lastUrl = location.href;

  function handleUrlChange(newUrl) {
    lastUrl = newUrl;
    setFabState("idle");
    removeBanner();
    bannerShown = false;
    setTimeout(() => {
      if (!document.getElementById("omni-fab")) injectFAB();
    }, 800);
  }

  const navObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      handleUrlChange(currentUrl);
    }
    if (!document.getElementById("omni-fab")) {
      injectFAB();
    }
  });

  navObserver.observe(document.body, { childList: true, subtree: false });

  const _pushState = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    _pushState(...args);
    setTimeout(() => {
      if (location.href !== lastUrl) handleUrlChange(location.href);
    }, 0);
  };

  history.replaceState = function (...args) {
    _replaceState(...args);
    setTimeout(() => {
      if (location.href !== lastUrl) handleUrlChange(location.href);
    }, 0);
  };

  window.addEventListener("popstate", () => {
    if (location.href !== lastUrl) handleUrlChange(location.href);
  });

  // ── Rate Limit Detection ──────────────────────────────────────────────────
  let rlCheckTimer = null;
  function scheduleRlCheck(node) {
    if (bannerDismissed || bannerShown) return;
    if (rlCheckTimer) return;
    rlCheckTimer = setTimeout(() => {
      rlCheckTimer = null;
      if (bannerDismissed || bannerShown) return;
      const candidates = [node];
      if (node.children) candidates.push(...Array.from(node.children).slice(0, 5));
      for (const el of candidates) {
        if (el.nodeType !== Node.ELEMENT_NODE) continue;
        const text = (el.innerText || el.textContent || "").trim();
        if (text.length > 5 && text.length < 800 && isRateLimitText(text)) {
          injectBanner();
          return;
        }
      }
    }, 500);
  }

  const rlObserver = new MutationObserver((mutations) => {
    if (bannerDismissed || bannerShown) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        scheduleRlCheck(node);
        if (bannerShown) return;
      }
    }
  });

  rlObserver.observe(document.body, { childList: true, subtree: true });

  // ── HTTP 429 Interceptors ─────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = function (...args) {
    return _origFetch.apply(this, args).then((res) => {
      if (res.status === 429 && !bannerDismissed && !bannerShown) {
        setTimeout(injectBanner, 400);
      }
      return res;
    });
  };

  const _origXhrOpen = XMLHttpRequest.prototype.open;
  const _origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__omniUrl = url;
    return _origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      if (this.status === 429 && !bannerDismissed && !bannerShown) {
        setTimeout(injectBanner, 400);
      }
    });
    return _origXhrSend.apply(this, args);
  };

  // ── Listen for captures from background ─────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONVERSATION_CAPTURED") {
      const count = msg.payload?.messageCount ?? 0;
      showToast(`✅ Captured ${count} messages from ${msg.payload?.source}`, "success");
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.body) {
    injectFAB();
  } else {
    document.addEventListener("DOMContentLoaded", injectFAB);
  }
})();
