// content.js — Omni Extension: injected into all supported AI pages

(function () {
  "use strict";

  // ── Guard: only inject once per page load ─────────────────────────────────
  if (window.__omniInjected) return;
  window.__omniInjected = true;

  // ── FAB injection ─────────────────────────────────────────────────────────
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
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCapture(); }
    });
  }

  // ── Capture handler ───────────────────────────────────────────────────────
  function handleCapture() {
    setFabState("loading");
    chrome.runtime.sendMessage({ type: "CAPTURE_REQUEST" }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        showToast("❌ " + (response?.error || "Capture failed"), "error");
        setFabState("idle");
      } else {
        const count = response?.captured?.messageCount ?? 0;
        const truncated = response?.captured?.truncated ? " (truncated)" : "";
        showToast(`✅ ${count} messages captured${truncated}! Open Omni to transfer.`, "success");
        setFabState("done");
        // Reset to idle after 4 seconds
        setTimeout(() => setFabState("idle"), 4000);
      }
    });
  }

  // ── FAB state machine ─────────────────────────────────────────────────────
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
      label.textContent = "Capturing…";
      fab.classList.add("omni-loading");
      fab.setAttribute("aria-label", "Omni AI: capturing…");
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

  // ── SPA navigation detection ──────────────────────────────────────────────
  // Many AI sites are SPAs — URL changes without a full page reload.
  // We watch for URL changes and reset FAB state when user navigates to a new chat.

  let lastUrl = location.href;

  function onUrlChange(newUrl) {
    lastUrl = newUrl;
    // Reset FAB to idle (user started a new conversation)
    setFabState("idle");
    // Re-inject FAB if it was removed by the SPA's virtual DOM
    setTimeout(() => {
      if (!document.getElementById("omni-fab")) {
        injectFAB();
      }
    }, 800); // small delay for SPA render
  }

  // Method 1: MutationObserver watching for URL changes via title or body mutations
  const navObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      onUrlChange(currentUrl);
    }
    // Also re-inject if FAB was removed
    if (!document.getElementById("omni-fab")) {
      injectFAB();
    }
  });

  navObserver.observe(document.body, {
    childList: true,
    subtree: false, // only top-level to avoid performance hit
  });

  // Method 2: Override history API pushState/replaceState (catches programmatic navigation)
  const _pushState = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    _pushState(...args);
    setTimeout(() => {
      if (location.href !== lastUrl) onUrlChange(location.href);
    }, 0);
  };

  history.replaceState = function (...args) {
    _replaceState(...args);
    setTimeout(() => {
      if (location.href !== lastUrl) onUrlChange(location.href);
    }, 0);
  };

  // Method 3: popstate for browser back/forward
  window.addEventListener("popstate", () => {
    if (location.href !== lastUrl) onUrlChange(location.href);
  });

  // ── Listen for messages from background ───────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONVERSATION_CAPTURED") {
      const count = msg.payload?.messageCount ?? 0;
      showToast(`✅ Captured ${count} messages from ${msg.payload?.source}`, "success");
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  // Wait for body if not ready yet
  if (document.body) {
    injectFAB();
  } else {
    document.addEventListener("DOMContentLoaded", injectFAB);
  }
})();
