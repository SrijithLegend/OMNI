// popup.js — Omni Extension Popup Logic (Step 5)

const SUPPORTED_DOMAINS = [
  "claude.ai", "chatgpt.com", "chat.openai.com", "gemini.google.com",
  "grok.com", "chat.deepseek.com", "www.perplexity.ai",
  "copilot.microsoft.com", "aistudio.google.com"
];

const AI_NAMES = {
  "claude.ai": "Claude", "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT", "gemini.google.com": "Gemini",
  "grok.com": "Grok", "chat.deepseek.com": "DeepSeek",
  "www.perplexity.ai": "Perplexity", "copilot.microsoft.com": "Microsoft Copilot",
  "aistudio.google.com": "Google AI Studio"
};

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

const $ = (id) => document.getElementById(id);

let currentTab = null;
let currentAIName = null;
let capturedData = null;
let transferResult = null;

async function init() {
  // Get current tab
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = currentTab?.url || "";
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch (_) {}

  const isAIPage = SUPPORTED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  currentAIName = isAIPage ? (AI_NAMES[hostname] || "AI") : null;

  // Update badge
  const badge = $("ai-badge");
  if (isAIPage && currentAIName) {
    badge.textContent = currentAIName;
    badge.classList.add("active");
    $("status-dot").classList.add("active");
    $("status-text").textContent = `You're on ${currentAIName}`;
    $("btn-capture-main").disabled = false;
    $("btn-capture-main").title = "";
  } else {
    badge.textContent = "Not on an AI page";
    $("status-text").textContent = "Open an AI chat page to get started";
    $("btn-capture-main").disabled = true;
    $("btn-capture-main").title = "Open an AI chat page first";
  }

  // Check for existing capture in session
  const session = await chrome.storage.session.get("omni_captured");
  if (session.omni_captured?.text) {
    capturedData = session.omni_captured;
    showStateB();
  } else {
    showStateA();
  }

  setupListeners();
}

function showStateA() {
  $("state-a").style.display = "block";
  $("state-b").style.display = "none";
}

function showStateB() {
  $("state-a").style.display = "none";
  $("state-b").style.display = "block";
  if (capturedData) {
    $("b-source-name").textContent = capturedData.source || "Unknown AI";
    const truncNote = capturedData.truncated ? " ⚠️ (truncated)" : "";
    $("b-msg-count").textContent = `${capturedData.messageCount || 0} messages captured${truncNote}`;
    $("b-from-label").textContent = `From: ${capturedData.source || "?"}`;
    // Pre-select a different target than source
    const targetSelect = $("b-target-select");
    const defaultTarget = capturedData.source === "ChatGPT" ? "Claude" : "ChatGPT";
    const opt = Array.from(targetSelect.options).find(o => o.value === defaultTarget);
    if (opt) targetSelect.value = defaultTarget;
  }
  // Reset result/progress visibility
  $("progress-row").classList.add("hidden");
  $("result-area").classList.add("hidden");
  $("error-row").classList.add("hidden");
  $("btn-transfer-now").classList.remove("hidden");
}

function setupListeners() {
  // State A: capture
  $("btn-capture-main").addEventListener("click", doCapture);

  // State A: open panel
  $("btn-open-panel-a").addEventListener("click", async (e) => {
    e.preventDefault();
    if (currentTab?.windowId) {
      await chrome.sidePanel.open({ windowId: currentTab.windowId });
    }
    window.close();
  });

  // State B: re-capture
  $("btn-recapture").addEventListener("click", () => {
    capturedData = null;
    transferResult = null;
    showStateA();
    // If on AI page, auto-trigger capture
    if (currentAIName) doCapture();
  });

  // State B: transfer
  $("btn-transfer-now").addEventListener("click", doTransfer);

  // State B: open panel
  $("btn-open-panel-b").addEventListener("click", async (e) => {
    e.preventDefault();
    if (currentTab?.windowId) {
      await chrome.sidePanel.open({ windowId: currentTab.windowId });
    }
    window.close();
  });

  // Result: copy
  $("btn-copy-result").addEventListener("click", async () => {
    if (!transferResult) return;
    await navigator.clipboard.writeText(transferResult);
    const btn = $("btn-copy-result");
    const orig = btn.innerHTML;
    btn.innerHTML = "✅ Copied!";
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });

  // Result: open + paste
  $("btn-open-paste-result").addEventListener("click", () => {
    if (!transferResult) return;
    const targetModel = $("b-target-select").value;
    const url = TARGET_URLS[targetModel];
    if (!url) return;
    chrome.runtime.sendMessage({
      type: "OPEN_AND_PASTE",
      payload: { prompt: transferResult, targetModel, url }
    });
    window.close();
  });
}

async function doCapture() {
  const btn = $("btn-capture-main");
  btn.disabled = true;
  btn.textContent = "Capturing…";
  $("status-text").textContent = "Scanning page…";

  chrome.runtime.sendMessage({ type: "CAPTURE_REQUEST" }, (response) => {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="m9 15 2 2 4-4"/></svg> Capture this page`;

    if (chrome.runtime.lastError || response?.error) {
      $("status-text").textContent = response?.error || "Capture failed";
      $("status-dot").classList.remove("active");
      return;
    }
    capturedData = response.captured;
    showStateB();
  });
}

async function doTransfer() {
  const targetModel = $("b-target-select").value;
  const intent = $("b-intent-input").value.trim();

  const { omni_api_key: apiKey, omni_api_provider: provider } =
    await chrome.storage.local.get(["omni_api_key", "omni_api_provider"]);

  if (!apiKey) {
    $("error-row").textContent = "❌ No API key — open full panel to configure one.";
    $("error-row").classList.remove("hidden");
    return;
  }
  if (!capturedData?.text) {
    $("error-row").textContent = "❌ No conversation captured.";
    $("error-row").classList.remove("hidden");
    return;
  }

  $("btn-transfer-now").classList.add("hidden");
  $("error-row").classList.add("hidden");
  $("result-area").classList.add("hidden");
  $("progress-row").classList.remove("hidden");

  chrome.runtime.sendMessage({
    type: "TRANSFER_REQUEST",
    payload: {
      conversation: capturedData.text,
      sourceModel: capturedData.source || "Unknown AI",
      targetModel,
      intent,
      apiKey,
      apiProvider: provider || "anthropic"
    }
  }, (response) => {
    $("progress-row").classList.add("hidden");

    if (chrome.runtime.lastError || response?.error) {
      $("error-row").textContent = "❌ " + (response?.error || "Transfer failed");
      $("error-row").classList.remove("hidden");
      $("btn-transfer-now").classList.remove("hidden");
      return;
    }

    transferResult = response.prompt;
    $("result-area").classList.remove("hidden");
  });
}

init();
