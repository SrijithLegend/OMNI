// sidepanel.js — Omni Extension Side Panel Logic

const TARGET_URLS = {
  "ChatGPT": "https://chatgpt.com/",
  "Claude": "https://claude.ai/new",
  "Gemini": "https://gemini.google.com/app",
  "Microsoft Copilot": "https://copilot.microsoft.com/",
  "Perplexity": "https://www.perplexity.ai/",
  "Grok": "https://grok.com/",
  "DeepSeek": "https://chat.deepseek.com/",
  "Google AI Studio": "https://aistudio.google.com/prompts/new_chat"
};

// ── State ────────────────────────────────────────────────────────────────────
let currentResult = null;
let currentTargetModel = "ChatGPT";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const conversationInput = $("conversation-input");
const sourceModelSelect = $("source-model");
const targetModelSelect = $("target-model");
const intentInput = $("intent-input");
const btnTransfer = $("btn-transfer");
const btnCapture = $("btn-capture");
const btnCopy = $("btn-copy");
const btnOpenTarget = $("btn-open-target");
const btnOpenPaste = $("btn-open-paste");
const outputSection = $("output-section");
const outputText = $("output-text");
const outputStats = $("output-stats");
const errorSection = $("error-section");
const errorText = $("error-text");
const loadingOverlay = $("loading-overlay");
const captureStatus = $("capture-status");
const captureTextEl = $("capture-text");
const charCount = $("char-count");
const transferHint = $("transfer-hint");
const apiKeyInput = $("api-key-input");
const apiProvider = $("api-provider");
const saveStatus = $("save-status");

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadSettings();
  await checkForCaptured();
  setupEventListeners();
  await loadHistory();
}

async function loadSettings() {
  const data = await chrome.storage.local.get(["omni_api_key", "omni_api_provider"]);
  if (data.omni_api_key) apiKeyInput.value = data.omni_api_key;
  if (data.omni_api_provider) apiProvider.value = data.omni_api_provider;
  // Check for prefilled target from rate-limit banner quick-pick
  const session = await chrome.storage.session.get("omni_prefill_target");
  if (session.omni_prefill_target) {
    const opt = Array.from(targetModelSelect.options).find(o => o.value === session.omni_prefill_target);
    if (opt) targetModelSelect.value = session.omni_prefill_target;
    await chrome.storage.session.remove("omni_prefill_target");
    // Switch to transfer tab and highlight
    switchTab("transfer");
  }
  updateTransferButton();
}

async function checkForCaptured() {
  const data = await chrome.storage.session.get("omni_captured");
  if (data.omni_captured) {
    applyCaptured(data.omni_captured);
  }
}

function applyCaptured(captured) {
  if (!captured?.text) return;
  conversationInput.value = captured.text;
  updateCharCount();
  captureStatus.className = "capture-status success";
  captureStatus.querySelector("svg").innerHTML = `<path d="m5 12 5 5 9-9"/>`;
  const truncNote = captured.truncated ? " ⚠️ truncated" : "";
  captureTextEl.textContent = `${captured.messageCount} messages captured from ${captured.source}${truncNote}`;
  if (captured.source && captured.source !== "Unknown AI") {
    // Try to set the select value; silently ignore if not found
    const opt = Array.from(sourceModelSelect.options).find(o => o.value === captured.source);
    if (opt) sourceModelSelect.value = captured.source;
  }
  if (captured.truncated) {
    transferHint.textContent = "⚠️ Conversation was truncated — only the most recent portion was used.";
    transferHint.style.color = "#f59e0b";
  }
  updateTransferButton();
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  $("btn-settings").addEventListener("click", () => switchTab("settings"));
  $("btn-history").addEventListener("click", () => switchTab("history"));

  // Conversation input
  conversationInput.addEventListener("input", () => {
    updateCharCount();
    updateTransferButton();
  });

  // Capture
  btnCapture.addEventListener("click", captureCurrentTab);

  // Transfer
  btnTransfer.addEventListener("click", runTransfer);

  // Copy
  btnCopy.addEventListener("click", copyResult);

  // Open target
  btnOpenTarget.addEventListener("click", () => {
    const url = TARGET_URLS[currentTargetModel];
    if (url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url });
  });

  // Open + Paste
  btnOpenPaste.addEventListener("click", () => openAndPaste());

  // Settings save
  $("btn-save-key").addEventListener("click", saveSettings);

  // Toggle key visibility
  $("btn-toggle-key").addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  // Clear history
  $("btn-clear-history").addEventListener("click", clearHistory);

  // Listen for captures from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CONVERSATION_CAPTURED") {
      applyCaptured(msg.payload);
    }
  });
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === `tab-${tabId}`));
  if (tabId === "history") loadHistory();
}

// ── Capture ───────────────────────────────────────────────────────────────────
async function captureCurrentTab() {
  btnCapture.disabled = true;
  btnCapture.textContent = "Capturing…";
  captureStatus.className = "capture-status";
  captureTextEl.textContent = "Scanning page…";

  chrome.runtime.sendMessage({ type: "CAPTURE_REQUEST" }, (response) => {
    btnCapture.disabled = false;
    btnCapture.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="m9 15 2 2 4-4"/></svg> Capture tab`;

    if (chrome.runtime.lastError || response?.error) {
      captureStatus.className = "capture-status error";
      captureTextEl.textContent = response?.error || "Failed — try on an AI chat page";
    } else {
      applyCaptured(response.captured);
    }
  });
}

// ── Transfer ──────────────────────────────────────────────────────────────────
async function runTransfer() {
  const conversation = conversationInput.value.trim();
  const sourceModel = sourceModelSelect.value;
  const targetModel = targetModelSelect.value;
  const intent = intentInput.value.trim();

  const { omni_api_key: apiKey, omni_api_provider: provider } = await chrome.storage.local.get([
    "omni_api_key", "omni_api_provider"
  ]);

  hideOutput();
  hideError();
  showLoading("Compressing context…");
  currentTargetModel = targetModel;

  chrome.runtime.sendMessage({
    type: "TRANSFER_REQUEST",
    payload: { conversation, sourceModel, targetModel, intent, apiKey, apiProvider: provider || "anthropic" }
  }, (response) => {
    hideLoading();
    if (chrome.runtime.lastError || response?.error) {
      showError(response?.error || "Transfer failed. Check your API key in Settings.");
    } else {
      showOutput(response);
      loadHistory(); // refresh history tab
    }
  });
}

// ── Output ────────────────────────────────────────────────────────────────────
function showOutput({ prompt, stats }) {
  currentResult = prompt;
  outputText.textContent = prompt;
  outputStats.textContent = `${stats.outputChars.toLocaleString()} chars · ${stats.compressionPercent}% smaller`;
  btnOpenTarget.innerHTML = `Open ${currentTargetModel} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  btnOpenPaste.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><rect x="9" y="1" width="6" height="4" rx="1"/></svg> Open + Paste`;
  btnOpenPaste.disabled = false;
  outputSection.classList.remove("hidden");
  outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openAndPaste() {
  if (!currentResult) return;
  btnOpenPaste.disabled = true;
  btnOpenPaste.textContent = "Opening…";

  const url = TARGET_URLS[currentTargetModel];
  if (!url) { btnOpenPaste.textContent = "No URL for model"; return; }

  chrome.runtime.sendMessage({
    type: "OPEN_AND_PASTE",
    payload: { prompt: currentResult, targetModel: currentTargetModel, url }
  }, (response) => {
    if (response?.error) {
      btnOpenPaste.innerHTML = "❌ Paste failed — copied instead";
      navigator.clipboard.writeText(currentResult).catch(() => {});
    } else {
      btnOpenPaste.innerHTML = "✅ Pasted!";
    }
    setTimeout(() => {
      btnOpenPaste.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><rect x="9" y="1" width="6" height="4" rx="1"/></svg> Open + Paste`;
      btnOpenPaste.disabled = false;
    }, 3000);
  });
}

function hideOutput() { outputSection.classList.add("hidden"); }

function showError(msg) {
  errorText.textContent = msg;
  errorSection.classList.remove("hidden");
}

function hideError() { errorSection.classList.add("hidden"); }

async function copyResult() {
  if (!currentResult) return;
  await navigator.clipboard.writeText(currentResult);
  const orig = btnCopy.innerHTML;
  btnCopy.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5 9-9"/></svg> Copied!`;
  setTimeout(() => { btnCopy.innerHTML = orig; }, 2000);
}

// ── Loading ───────────────────────────────────────────────────────────────────
function showLoading(msg = "Working…") {
  $("loading-text").textContent = msg;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() { loadingOverlay.classList.add("hidden"); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function updateCharCount() {
  const n = conversationInput.value.length;
  charCount.textContent = `${n.toLocaleString()} chars`;
}

function updateTransferButton() {
  const hasContent = conversationInput.value.trim().length >= 20;
  btnTransfer.disabled = !hasContent;
  if (!hasContent) {
    transferHint.textContent = "Needs a configured API key and 20+ chars of conversation.";
  } else {
    transferHint.textContent = "Configured API key required. Set one in Settings.";
  }
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  const { omni_history = [] } = await chrome.storage.local.get("omni_history");
  const list = $("history-list");

  if (omni_history.length === 0) {
    list.innerHTML = `<div class="empty-state muted">No transfers yet. Use the Transfer tab to get started.</div>`;
    return;
  }

  list.innerHTML = omni_history.map(item => `
    <div class="history-item" data-id="${item.id}" data-prompt="${encodeURIComponent(item.prompt)}">
      <div class="history-header">
        <div class="history-models">
          <span>${item.sourceModel}</span>
          <svg class="history-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          <span>${item.targetModel}</span>
          ${item.compression > 0 ? `<span class="muted text-xs">(${item.compression}% smaller)</span>` : ""}
        </div>
        <span class="history-date">${formatDate(item.createdAt)}</span>
      </div>
      ${item.intent ? `<div class="history-preview">${escHtml(item.intent)}</div>` : `<div class="history-preview">${escHtml(item.prompt.slice(0, 80))}…</div>`}
    </div>
  `).join("");

  // Click to restore
  list.querySelectorAll(".history-item").forEach(el => {
    el.addEventListener("click", () => {
      const prompt = decodeURIComponent(el.dataset.prompt);
      currentResult = prompt;
      outputText.textContent = prompt;
      outputStats.textContent = "From history";
      outputSection.classList.remove("hidden");
      switchTab("transfer");
    });
  });
}

async function clearHistory() {
  await chrome.storage.local.remove("omni_history");
  await loadHistory();
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString();
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function saveSettings() {
  const key = apiKeyInput.value.trim();
  const provider = apiProvider.value;
  await chrome.storage.local.set({ omni_api_key: key, omni_api_provider: provider });
  saveStatus.textContent = "✅ Saved";
  updateTransferButton();
  setTimeout(() => { saveStatus.textContent = ""; }, 2500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6 — Export conversation
// ═══════════════════════════════════════════════════════════════════════════

function setupExport() {
  const sel = $("export-format");
  if (!sel) return;
  sel.addEventListener("change", () => {
    const fmt = sel.value;
    if (!fmt) return;
    sel.value = "";
    const text = conversationInput.value.trim();
    if (!text) { alert("No conversation to export."); return; }
    const source = sourceModelSelect.value || "AI";
    const date = new Date().toISOString().slice(0, 10);
    let content, mime, ext;

    if (fmt === "md") {
      content = exportAsMarkdown(text);
      mime = "text/markdown";
      ext = "md";
    } else if (fmt === "json") {
      content = exportAsJSON(text);
      mime = "application/json";
      ext = "json";
    } else {
      content = exportAsPlainText(text);
      mime = "text/plain";
      ext = "txt";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omni-export-${source.toLowerCase().replace(/\s+/g, "-")}-${date}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function parseConversationMessages(text) {
  // Parse "Role: text" blocks separated by blank lines
  const blocks = text.split(/\n\n+/);
  const messages = [];
  for (const block of blocks) {
    const match = block.match(/^([^:]+):\s*([\s\S]+)/);
    if (match) {
      messages.push({ role: match[1].trim(), text: match[2].trim() });
    } else if (block.trim()) {
      messages.push({ role: "Unknown", text: block.trim() });
    }
  }
  return messages;
}

function exportAsMarkdown(text) {
  const messages = parseConversationMessages(text);
  return messages.map((m, i) => `## ${m.role}\n\n${m.text}`).join("\n\n---\n\n");
}

function exportAsJSON(text) {
  const messages = parseConversationMessages(text);
  const arr = messages.map((m, i) => ({ index: i + 1, role: m.role, text: m.text }));
  return JSON.stringify(arr, null, 2);
}

function exportAsPlainText(text) {
  const messages = parseConversationMessages(text);
  return messages.map(m => `${m.role}: ${m.text}`).join("\n\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7 — Multi-model comparison
// ═══════════════════════════════════════════════════════════════════════════

function setupCompare() {
  const btn = $("btn-compare-generate");
  if (!btn) return;

  // Enable/disable based on selection + conversation
  function updateCompareBtn() {
    const checked = getCheckedModels();
    const hasConversation = conversationInput.value.trim().length >= 20;
    const valid = checked.length >= 2 && checked.length <= 4 && hasConversation;
    btn.disabled = !valid;
    const hint = $("compare-hint");
    if (!hasConversation) hint.textContent = "Capture or paste a conversation first.";
    else if (checked.length < 2) hint.textContent = "Select at least 2 models.";
    else if (checked.length > 4) hint.textContent = "Select at most 4 models.";
    else hint.textContent = `Will generate ${checked.length} prompts in parallel.`;
  }

  document.querySelectorAll("#compare-model-list input[type='checkbox']").forEach(cb => {
    cb.addEventListener("change", updateCompareBtn);
  });
  conversationInput.addEventListener("input", updateCompareBtn);
  updateCompareBtn();

  btn.addEventListener("click", runCompare);
}

function getCheckedModels() {
  return Array.from(document.querySelectorAll("#compare-model-list input[type='checkbox']:checked"))
    .map(cb => cb.value);
}

async function runCompare() {
  const models = getCheckedModels();
  const conversation = conversationInput.value.trim();
  const sourceModel = sourceModelSelect.value;
  const { omni_api_key: apiKey, omni_api_provider: provider } = await chrome.storage.local.get([
    "omni_api_key", "omni_api_provider"
  ]);

  if (!apiKey) { showError("No API key configured. Go to Settings."); switchTab("compare"); return; }

  const resultsEl = $("compare-results");
  resultsEl.innerHTML = "";

  // Create placeholder cards
  const cards = {};
  for (const model of models) {
    const card = document.createElement("div");
    card.className = "compare-card loading";
    card.innerHTML = `
      <div class="compare-card-header">
        <span class="compare-card-model">${model}</span>
        <span class="compare-card-stat"><span class="compare-spinner"></span></span>
      </div>`;
    resultsEl.appendChild(card);
    cards[model] = card;
  }

  // Fire all requests in parallel
  const requests = models.map(targetModel =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "TRANSFER_REQUEST",
        payload: { conversation, sourceModel, targetModel, intent: "", apiKey, apiProvider: provider || "anthropic" }
      }, (response) => resolve({ targetModel, response }));
    }).catch(err => ({ targetModel: models[0], response: { error: err.message } }))
  );

  const results = await Promise.all(requests);

  for (const { targetModel, response } of results) {
    const card = cards[targetModel];
    if (!card) continue;
    card.classList.remove("loading");

    if (response?.error || !response?.prompt) {
      card.classList.add("error");
      card.innerHTML = `
        <div class="compare-card-header">
          <span class="compare-card-model">❌ ${targetModel}</span>
          <span class="compare-card-stat">${response?.error?.slice(0, 60) || "Failed"}</span>
        </div>`;
    } else {
      const stat = `${response.stats.outputChars.toLocaleString()} chars · ${response.stats.compressionPercent}% smaller`;
      card.innerHTML = `
        <div class="compare-card-header">
          <span class="compare-card-model">${targetModel}</span>
          <span class="compare-card-stat">${stat}</span>
        </div>
        <pre>${escHtml(response.prompt)}</pre>
        <div class="compare-card-actions" style="padding:8px 12px;display:flex;gap:6px">
          <button class="btn btn-sm btn-outline" data-copy="${encodeURIComponent(response.prompt)}" aria-label="Copy ${targetModel} prompt">Copy</button>
          <button class="btn btn-sm btn-primary" data-open="${encodeURIComponent(response.prompt)}" data-model="${targetModel}" aria-label="Open ${targetModel} and paste">Open + Paste</button>
        </div>`;

      card.querySelector("[data-copy]").addEventListener("click", async (e) => {
        const text = decodeURIComponent(e.target.dataset.copy);
        await navigator.clipboard.writeText(text);
        const orig = e.target.textContent;
        e.target.textContent = "Copied!";
        setTimeout(() => { e.target.textContent = orig; }, 2000);
      });
      card.querySelector("[data-open]").addEventListener("click", (e) => {
        const prompt = decodeURIComponent(e.target.dataset.open);
        const model = e.target.dataset.model;
        const url = TARGET_URLS[model];
        if (url) chrome.runtime.sendMessage({ type: "OPEN_AND_PASTE", payload: { prompt, targetModel: model, url } });
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 8 — Custom prompt style settings
// ═══════════════════════════════════════════════════════════════════════════

const TARGET_MODELS = ["ChatGPT", "Claude", "Gemini", "Microsoft Copilot", "Perplexity", "Grok", "DeepSeek", "Google AI Studio"];

async function setupCustomStyles() {
  const container = $("per-model-overrides");
  if (!container) return;

  // Build per-model rows
  container.innerHTML = TARGET_MODELS.map(model => `
    <div class="per-model-row" id="pm-row-${model.replace(/\s+/g, "-")}">
      <div class="per-model-toggle" data-model="${model}">
        <span>${model}</span><span class="toggle-arrow">▶</span>
      </div>
      <textarea class="per-model-textarea" placeholder="Leave blank to use Omni's default for ${model}." data-model="${model}" rows="3"></textarea>
    </div>
  `).join("");

  // Toggle expand
  container.querySelectorAll(".per-model-toggle").forEach(toggle => {
    toggle.addEventListener("click", () => {
      toggle.closest(".per-model-row").classList.toggle("open");
    });
  });

  // Load saved values
  const { omni_custom_styles } = await chrome.storage.local.get("omni_custom_styles");
  if (omni_custom_styles) {
    if (omni_custom_styles.globalPrefix) {
      $("global-prefix-input").value = omni_custom_styles.globalPrefix;
    }
    for (const [model, text] of Object.entries(omni_custom_styles.perModel || {})) {
      const ta = container.querySelector(`textarea[data-model="${model}"]`);
      if (ta && text) ta.value = text;
    }
  }

  $("btn-save-styles").addEventListener("click", async () => {
    const globalPrefix = $("global-prefix-input").value.trim();
    const perModel = {};
    container.querySelectorAll("textarea[data-model]").forEach(ta => {
      const v = ta.value.trim();
      if (v) perModel[ta.dataset.model] = v;
    });
    await chrome.storage.local.set({ omni_custom_styles: { globalPrefix, perModel } });
    const status = $("style-save-status");
    status.textContent = "✅ Saved";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });

  $("btn-reset-styles").addEventListener("click", async () => {
    $("global-prefix-input").value = "";
    container.querySelectorAll("textarea[data-model]").forEach(ta => { ta.value = ""; });
    await chrome.storage.local.remove("omni_custom_styles");
    const status = $("style-save-status");
    status.textContent = "✅ Reset to defaults";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 9 — Usage tracker display
// ═══════════════════════════════════════════════════════════════════════════

async function loadUsageStats() {
  const { omni_usage_stats } = await chrome.storage.local.get("omni_usage_stats");
  const stats = omni_usage_stats || {
    totalTransfers: 0, totalSourceChars: 0, totalOutputChars: 0,
    bySource: {}, byTarget: {}
  };

  $("stat-transfers").textContent = stats.totalTransfers.toLocaleString();
  const charsSaved = Math.max(0, stats.totalSourceChars - stats.totalOutputChars);
  $("stat-chars").textContent = formatBigNum(charsSaved);
  const tokensSaved = Math.round((stats.totalSourceChars - stats.totalOutputChars) / 4);
  $("stat-tokens").textContent = formatBigNum(Math.max(0, tokensSaved));

  renderMiniChart($("usage-sources-chart"), stats.bySource);
  renderMiniChart($("usage-targets-chart"), stats.byTarget);
}

function formatBigNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function renderMiniChart(container, data) {
  if (!container) return;
  const entries = Object.entries(data || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (entries.length === 0) { container.innerHTML = `<div class="muted text-xs">No data yet</div>`; return; }
  const max = entries[0][1];
  container.innerHTML = entries.map(([name, val]) => {
    const pct = max > 0 ? Math.round((val / max) * 100) : 0;
    const shortName = name.length > 14 ? name.slice(0, 12) + "…" : name;
    return `<div class="mini-chart-row">
      <div class="mini-chart-label">${escHtml(shortName)} <span style="color:#4b4b60">(${val})</span></div>
      <div class="mini-chart-bar-wrap"><div class="mini-chart-bar" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}

function setupResetStats() {
  const btn = $("btn-reset-stats");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await chrome.storage.local.remove("omni_usage_stats");
    await loadUsageStats();
  });
}

// ── Patch init to run new setup ───────────────────────────────────────────
const _originalInit = init;
// Re-declare init to extend it
(async function extendInit() {
  // These run after the original init; we hook into the settings tab load
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "settings") {
        loadUsageStats();
      }
    });
  });
})();

// Run new setups
setupExport();
setupCompare();
setupCustomStyles();
setupResetStats();
// Load API key validation
setupApiKeyValidation();

function setupApiKeyValidation() {
  const saveBtn = $("btn-save-key");
  if (!saveBtn) return;
  // Override click to also validate
  const origHandler = saveBtn.onclick;
  saveBtn.addEventListener("click", async () => {
    // After save, validate
    const key = $("api-key-input").value.trim();
    const provider = $("api-provider").value;
    if (!key) return;
    await validateApiKey(key, provider);
  });
}

async function validateApiKey(key, provider) {
  const status = $("save-status");
  status.textContent = "Testing key…";
  try {
    let ok = false;
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
      });
      ok = r.status !== 401 && r.status !== 403;
    } else if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 1 })
      });
      ok = r.status !== 401 && r.status !== 403;
    } else if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } })
      });
      ok = r.status !== 400 && r.status !== 403;
    } else if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "hi" }], max_tokens: 1 })
      });
      ok = r.status !== 401 && r.status !== 403;
    }
    status.textContent = ok ? "✅ Key valid" : "❌ Invalid key — check and re-enter";
    status.style.color = ok ? "#4ade80" : "#fca5a5";
  } catch {
    status.textContent = "⚠️ Could not verify (offline?)";
    status.style.color = "#fbbf24";
  }
  setTimeout(() => { status.textContent = ""; status.style.color = ""; }, 4000);
}
