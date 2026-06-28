// content.js — injected into all supported AI pages

(function () {
  if (document.getElementById("omni-fab")) return; // already injected

  // ── Floating Action Button ──────────────────────────────────────────────────
  const fab = document.createElement("div");
  fab.id = "omni-fab";
  fab.innerHTML = `
    <div id="omni-fab-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
        <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
        <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
        <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        <path d="m9 15 2 2 4-4"/>
      </svg>
    </div>
    <span id="omni-fab-label">Capture</span>
    <div id="omni-toast" class="omni-toast hidden"></div>
  `;
  document.body.appendChild(fab);

  // ── FAB click → capture + notify ───────────────────────────────────────────
  fab.addEventListener("click", async (e) => {
    e.stopPropagation();
    setFabState("loading");
    chrome.runtime.sendMessage({ type: "CAPTURE_REQUEST" }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        showToast("❌ " + (response?.error || "Capture failed"), "error");
        setFabState("idle");
      } else {
        const count = response?.captured?.messageCount ?? 0;
        showToast(`✅ ${count} messages captured! Open Omni to transfer.`, "success");
        setFabState("done");
        setTimeout(() => setFabState("idle"), 3000);
      }
    });
  });

  function setFabState(state) {
    const icon = document.getElementById("omni-fab-icon");
    const label = document.getElementById("omni-fab-label");
    if (state === "loading") {
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="0" class="omni-spin-circle"/></svg>`;
      label.textContent = "Capturing…";
      fab.classList.add("omni-loading");
    } else if (state === "done") {
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5 9-9"/></svg>`;
      label.textContent = "Captured!";
      fab.classList.remove("omni-loading");
      fab.classList.add("omni-done");
    } else {
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="m9 15 2 2 4-4"/></svg>`;
      label.textContent = "Capture";
      fab.classList.remove("omni-loading", "omni-done");
    }
  }

  function showToast(msg, type = "info") {
    const toast = document.getElementById("omni-toast");
    toast.textContent = msg;
    toast.className = `omni-toast omni-toast-${type}`;
    setTimeout(() => { toast.className = "omni-toast hidden"; }, 4000);
  }

  // ── Listen for messages from background ────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONVERSATION_CAPTURED") {
      showToast(`✅ Captured ${msg.payload.messageCount} messages from ${msg.payload.source}`, "success");
    }
  });
})();
