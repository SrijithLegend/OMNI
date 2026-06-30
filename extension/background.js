/**
 * Omni Background Service Worker — Engine Architecture v2.0
 *
 * The background script is the central hub. It initializes all engines,
 * handles runtime messages through the MessagingEngine, and coordinates
 * all extension functionality.
 *
 * Architecture: Engines > Services > Background > Chrome APIs
 * No business logic here. Only orchestration.
 */

import { registerEngine, getEngine } from "./src/engines/base.js";
import { StorageEngine } from "./src/engines/storage.js";
import { MessagingEngine } from "./src/messaging/engine.js";
import { ContextEngine } from "./src/engines/context.js";
import { TransferEngine } from "./src/engines/transfer.js";
import { TimelineEngine } from "./src/engines/timeline.js";
import { LoggingEngine } from "./src/engines/logging.js";
import { NotificationEngine } from "./src/engines/notification.js";
import { UIEngine } from "./src/engines/ui.js";

// ── Engine Registry ─────────────────────────────────────────────────────────
const engines = {
  logging: null,
  storage: null,
  messaging: null,
  context: null,
  transfer: null,
  timeline: null,
  notification: null,
  ui: null,
};

// ── Keep-alive ───────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "omni-keepalive") {
    engines.logging?.log("debug", "background", "Keep-alive ping");
  }
});

// ── Initialize Extension ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create("omni-keepalive", { periodInMinutes: 0.4 });

  // Initialize engines
  await initEngines();

  // Setup context menus
  setupContextMenus();

  // Setup keyboard shortcuts
  setupKeyboardCommands();

  // Setup message routing
  setupMessageRouting();

  engines.logging?.log("info", "background", "Omni initialized v2.0.0");
});

chrome.runtime.onStartup.addListener(async () => {
  await initEngines();
  setupMessageRouting();
  engines.logging?.log("info", "background", "Omni started");
});

// ── Engine Initialization ───────────────────────────────────────────────────
async function initEngines() {
  // 1. Logging (always first)
  engines.logging = new LoggingEngine();
  registerEngine(engines.logging);
  await engines.logging.start();

  // 2. Storage
  engines.storage = new StorageEngine();
  registerEngine(engines.storage);
  await engines.storage.start();

  // 3. Messaging
  engines.messaging = new MessagingEngine({ debug: false, logMessages: false });
  registerEngine(engines.messaging);
  await engines.messaging.start();

  // 4. Context
  engines.context = new ContextEngine();
  registerEngine(engines.context);
  await engines.context.start();

  // 5. Transfer
  engines.transfer = new TransferEngine();
  registerEngine(engines.transfer);
  await engines.transfer.start();

  // 6. Timeline
  engines.timeline = new TimelineEngine();
  registerEngine(engines.timeline);
  await engines.timeline.start();

  // 7. Notification
  engines.notification = new NotificationEngine();
  registerEngine(engines.notification);
  await engines.notification.start();

  // 8. UI
  engines.ui = new UIEngine();
  registerEngine(engines.ui);
  await engines.ui.start();

  // Wire messaging handlers
  wireMessagingHandlers();
}

// ── Message Routing ────────────────────────────────────────────────────────
function setupMessageRouting() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!engines.messaging) return false;
    return engines.messaging.handleRuntimeMessage(msg, sendResponse);
  });
}

// ── Wire Messaging Handlers ─────────────────────────────────────────────────
function wireMessagingHandlers() {
  const { messaging, context, transfer, timeline, storage, notification } = engines;

  // CAPTURE
  messaging.listen("CONVERSATION_CAPTURE", async (msg) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const result = await captureFromTab(tab.id);
    if (result.error) throw new Error(result.error);

    // Store in context engine
    const conversation = await context.capture(
      result.source,
      result.url,
      result.messages,
    );

    // Also store in session for popup/sidepanel
    await chrome.storage.session.set({
      omni_captured: {
        text: result.text,
        source: result.source,
        url: result.url,
        capturedAt: Date.now(),
        messageCount: result.messageCount,
      },
    });

    // Broadcast to all contexts
    messaging.broadcast("CONVERSATION_CAPTURED", {
      conversation,
      text: result.text,
      source: result.source,
      messageCount: result.messageCount,
    });

    // Log to timeline
    await timeline.add(
      "conversation-captured",
      "conversation",
      `Captured from ${result.source}`,
      `${result.messageCount} messages captured`,
      null,
      conversation.id,
    );

    return { ok: true, conversation };
  });

  // TRANSFER
  messaging.listen("TRANSFER_REQUEST", async (msg) => {
    const payload = msg.payload;
    const result = await runTransfer(payload);
    if (result.error) throw new Error(result.error);

    await timeline.add(
      "conversation-transferred",
      "conversation",
      `Transferred to ${result.targetModel}`,
      `${result.stats.outputChars} chars · ${result.stats.compressionPercent}% compressed`,
    );

    return result;
  });

  // OPEN TAB
  messaging.listen("OPEN_TAB", async (msg) => {
    chrome.tabs.create({ url: msg.payload?.url ?? msg.url });
    return { ok: true };
  });

  // OPEN AND PASTE
  messaging.listen("OPEN_AND_PASTE", async (msg) => {
    const { prompt, targetModel, url } = msg.payload;
    await chrome.storage.session.set({ omni_pending_paste: { prompt, targetModel } });
    const tab = await chrome.tabs.create({ url });
    const result = await waitForTabAndPaste(tab.id, url);
    return result;
  });

  // OPEN SIDEPANEL
  messaging.listen("OPEN_SIDEPANEL_WITH_TARGET", async (msg) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.storage.session.set({ omni_prefill_target: msg.targetModel });
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    return { ok: true };
  });

  // STORAGE
  messaging.listen("STORAGE_GET", async (msg) => {
    const value = await storage.get(msg.payload.key);
    return { value };
  });

  messaging.listen("STORAGE_SET", async (msg) => {
    await storage.set(msg.payload.key, msg.payload.value);
    return { ok: true };
  });

  // TIMELINE
  messaging.listen("TIMELINE_ADD", async (msg) => {
    const event = await timeline.add(
      msg.payload.type,
      msg.payload.category,
      msg.payload.title,
      msg.payload.description,
      msg.payload.projectId,
      msg.payload.conversationId,
      msg.payload.metadata,
    );
    return { event };
  });

  messaging.listen("TIMELINE_LIST", async (msg) => {
    const page = timeline.get(msg.payload.filter);
    return { page };
  });

  // NOTIFICATION
  messaging.listen("NOTIFY", async (msg) => {
    const notif = await notification.notify(
      msg.payload.level,
      msg.payload.title,
      msg.payload.message,
      msg.payload.action,
    );
    return { notification: notif };
  });

  // HEALTH
  messaging.listen("SYSTEM_HEALTH", async () => {
    const health = {};
    for (const [name, engine] of Object.entries(engines)) {
      if (engine?.health) {
        health[name] = await engine.health();
      }
    }
    return { health };
  });
}

// ── Context Menus ───────────────────────────────────────────────────────────
function setupContextMenus() {
  const AI_URLS = [
    "https://claude.ai/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://grok.com/*",
    "https://chat.deepseek.com/*",
    "https://www.perplexity.ai/*",
    "https://copilot.microsoft.com/*",
    "https://aistudio.google.com/*",
  ];

  chrome.contextMenus.create({
    id: "omni-capture",
    title: "📋 Capture conversation for Omni",
    contexts: ["page"],
    documentUrlPatterns: AI_URLS,
  });

  chrome.contextMenus.create({
    id: "omni-transfer",
    title: "🔀 Transfer to another AI...",
    contexts: ["page"],
    documentUrlPatterns: AI_URLS,
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "omni-capture") {
      const result = await captureFromTab(tab.id);
      engines.notification?.notify("success", "Captured", `Captured ${result.messageCount} messages from ${result.source}`);
    }
    if (info.menuItemId === "omni-transfer") {
      await captureFromTab(tab.id);
      if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
}

// ── Keyboard Commands ───────────────────────────────────────────────────────
function setupKeyboardCommands() {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "open-omni") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    if (command === "capture-conversation") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await captureFromTab(tab.id);
    }
    if (command === "quick-search") {
      engines.ui?.setView("search");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
}

// ── Extension Icon Click ────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
});

// ── Core: Capture Conversation ────────────────────────────────────────────────
async function captureFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractConversationFromPage,
    });

    const captured = results?.[0]?.result;
    if (!captured || !captured.text) {
      return {
        error: captured?.error || "Could not extract conversation from this page.",
      };
    }

    // Convert to message format
    const messages = captured.messages?.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role === "Human" ? "user" : "assistant",
      content: m.text,
      timestamp: Date.now(),
      platform: captured.source,
    })) ?? [];

    return {
      ok: true,
      text: captured.text,
      source: captured.source,
      url: captured.url,
      messages,
      messageCount: captured.messageCount,
      truncated: captured.truncated,
    };
  } catch (err) {
    return { error: err.message || "Capture failed" };
  }
}

// ── Core: Run AI Transfer ───────────────────────────────────────────────────
async function runTransfer({ conversation, sourceModel, targetModel, intent, apiKey, apiProvider }) {
  if (!apiKey) {
    return { error: "No API key configured. Open Omni settings to add one." };
  }

  const targetGuidance = {
    ChatGPT: "Use a clear system-style preamble. ChatGPT responds well to numbered context blocks, explicit role framing, and concrete next-step instructions.",
    Claude: "Use XML-style tags like <context>, <decisions>, <task>. Claude excels with structured tags, careful reasoning prompts, and natural language.",
    Gemini: "Use a structured markdown layout with headings. Gemini handles long context well; be explicit about which sources to trust.",
    "Microsoft Copilot": "Be concise and business-oriented. Frame the continuation in terms of deliverables and action items.",
    Perplexity: "Frame as a research continuation. Specify which facts are already established and what new information is needed.",
    Grok: "Direct, conversational tone. State the context plainly and ask the next question or task.",
    DeepSeek: "Technical, precise framing. Use code-fenced blocks for any code-related context and explicit task statements.",
    "Google AI Studio": "Use structured markdown. Specify context clearly with section headers.",
    Other: "Summarize context clearly and state the next task explicitly.",
  };

  const styleGuide = targetGuidance[targetModel] || targetGuidance["Other"];
  const userIntentLine = intent?.trim()
    ? `\n\nUser's stated next step (prioritize this): ${intent.trim()}`
    : "";

  let systemPrompt = `You are the Context Engine inside Omni, a universal AI conversation bridge. Your job is to take a raw conversation a user had with one AI assistant and produce an optimized continuation prompt for a different AI assistant, so the new model can pick up exactly where the previous one left off.

Rules:
- Preserve all material facts, decisions, constraints, code snippets, file names, identifiers, and unresolved questions.
- Drop pleasantries, restated questions, model refusals, repetition, and ungrounded speculation.
- Compress aggressively without losing reasoning continuity.
- Never invent facts that are not in the source conversation.
- Output ONLY the final prompt the user will paste into the new AI. No meta commentary, no "Here is the prompt", no markdown code fences around the whole output.

The continuation prompt MUST contain these sections, tuned to the target model's preferred style:
1. A brief framing line stating this is a continued conversation transferred from ${sourceModel}.
2. Project / topic summary (2-5 sentences).
3. Key decisions and constraints already agreed upon (bulleted).
4. Relevant artifacts: code, file names, data, links (only those present in the source).
5. Open questions / what was being worked on when the conversation paused.
6. The explicit next task for the new AI to perform.

Target model: ${targetModel}.
Style guidance for ${targetModel}: ${styleGuide}`;

  let userMessage = `Source AI: ${sourceModel}\nTarget AI: ${targetModel}${userIntentLine}\n\n--- BEGIN SOURCE CONVERSATION ---\n${conversation}\n--- END SOURCE CONVERSATION ---\n\nProduce the optimized continuation prompt now.`;

  try {
    let endpoint, headers, body;

    if (apiProvider === "openai" || apiProvider === "chatgpt") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
      body = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });
    } else if (apiProvider === "anthropic" || apiProvider === "claude") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
      body = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
    } else if (apiProvider === "gemini") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.3 },
      });
    } else if (apiProvider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
      body = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });
    } else {
      return { error: `Unknown API provider: ${apiProvider}` };
    }

    if (!navigator.onLine) {
      return { error: "You appear to be offline. Check your connection and try again." };
    }

    const { omni_custom_styles } = await chrome.storage.local.get("omni_custom_styles");
    if (omni_custom_styles) {
      if (omni_custom_styles.globalPrefix) {
        systemPrompt = omni_custom_styles.globalPrefix + "\n\n" + systemPrompt;
      }
      const customModelStyle = omni_custom_styles.perModel?.[targetModel];
      if (customModelStyle) {
        userMessage = userMessage.replace(
          new RegExp(
            `Style guidance for ${targetModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: [^\n]+`,
          ),
          `Style guidance for ${targetModel}: ${customModelStyle}`,
        );
      }
    }

    const wasTruncated = conversation.length > 80000;

    let resp;
    for (let attempt = 0; attempt < 2; attempt++) {
      resp = await fetch(endpoint, { method: "POST", headers, body });
      if (attempt === 0 && (resp.status === 429 || resp.status === 503)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `API error ${resp.status}: ${errText.slice(0, 300)}` };
    }

    const data = await resp.json();
    let outputText = "";

    if (apiProvider === "gemini") {
      outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (apiProvider === "anthropic" || apiProvider === "claude") {
      outputText = data.content?.[0]?.text || "";
    } else {
      outputText = data.choices?.[0]?.message?.content || "";
    }

    if (!outputText) return { error: "Empty response from AI." };

    const sourceChars = conversation.length;
    const outputChars = outputText.length;
    const compression = sourceChars > 0 ? Math.max(0, Math.round((1 - outputChars / sourceChars) * 100)) : 0;

    // Save to local history (legacy)
    await saveToHistory({ sourceModel, targetModel, prompt: outputText, compression, intent });
    await updateUsageStats(sourceChars, outputChars, sourceModel, targetModel);

    return {
      ok: true,
      prompt: outputText.trim(),
      stats: {
        sourceChars,
        outputChars,
        compressionPercent: compression,
        truncated: wasTruncated,
      },
      targetModel,
    };
  } catch (err) {
    return { error: err.message || "Transfer failed" };
  }
}

// ── Helpers: History & Stats ────────────────────────────────────────────────
async function saveToHistory({ sourceModel, targetModel, prompt, compression, intent }) {
  const { omni_history = [] } = await chrome.storage.local.get("omni_history");
  const entry = {
    id: Date.now(),
    sourceModel,
    targetModel,
    prompt,
    compression,
    intent: intent || "",
    createdAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ omni_history: [entry, ...omni_history].slice(0, 50) });
}

async function updateUsageStats(sourceChars, outputChars, sourceModel, targetModel) {
  const { omni_usage_stats } = await chrome.storage.local.get("omni_usage_stats");
  const stats = omni_usage_stats || {
    totalTransfers: 0,
    totalSourceChars: 0,
    totalOutputChars: 0,
    bySource: {},
    byTarget: {},
  };
  stats.totalTransfers += 1;
  stats.totalSourceChars += sourceChars;
  stats.totalOutputChars += outputChars;
  stats.bySource[sourceModel] = (stats.bySource[sourceModel] || 0) + 1;
  stats.byTarget[targetModel] = (stats.byTarget[targetModel] || 0) + 1;
  await chrome.storage.local.set({ omni_usage_stats: stats });
}

// ── Open + Paste ────────────────────────────────────────────────────────────
async function waitForTabAndPaste(tabId, expectedUrl) {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 20000;

    function onUpdated(id, changeInfo, tab) {
      if (id !== tabId) return;
      if (changeInfo.status !== "complete") return;
      const tabUrl = tab.url || "";
      const expectedHost = new URL(expectedUrl).hostname;
      if (!tabUrl.includes(expectedHost)) return;

      chrome.tabs.onUpdated.removeListener(onUpdated);
      setTimeout(async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: pasteIntoTargetPage,
          });
          const result = results?.[0]?.result;
          resolve(result?.ok ? { ok: true } : { error: result?.error || "Paste failed" });
        } catch (err) {
          resolve({ error: err.message });
        }
      }, 1500);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve({ error: "Timed out waiting for page to load" });
    }, TIMEOUT_MS);
  });
}

// ── Paste into Target Page ──────────────────────────────────────────────────
async function pasteIntoTargetPage() {
  const MAX_RETRIES = 15;
  const RETRY_MS = 350;

  const stored = await chrome.storage.session.get("omni_pending_paste");
  const text = stored?.omni_pending_paste?.prompt;
  if (!text) return { error: "No pending prompt found" };

  const INPUT_SELECTORS = [
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="chat-input"]',
    'div#prompt-textarea[contenteditable="true"]',
    "#prompt-textarea",
    'rich-textarea div.ql-editor[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"]',
    'textarea[data-testid="tweetTextarea_0"]',
    'div[data-testid="grok-input"] [contenteditable="true"]',
    '[data-testid="grok-composer"] [contenteditable="true"]',
    "textarea#chat-input",
    'textarea[placeholder*="Send a message" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="Follow-up" i]',
    "cib-text-input textarea",
    'div[aria-label*="Ask me anything" i][contenteditable="true"]',
    'textarea[aria-label*="Ask me anything" i]',
    '[aria-label="Type something"] div[contenteditable="true"]',
    "ms-autosize-textarea textarea",
    'textarea[aria-label*="prompt" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="type" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    "textarea",
  ];

  function findInput() {
    for (const sel of INPUT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      } catch (_) {
        /* skip */
      }
    }
    return null;
  }

  let el = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    el = findInput();
    if (el) break;
    await new Promise((r) => setTimeout(r, RETRY_MS));
  }

  if (!el) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {}
    return { error: "Could not find input — prompt copied to clipboard instead" };
  }

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    if (!el.innerText.trim()) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    }
  }

  el.focus();
  el.scrollTop = el.scrollHeight;
  await chrome.storage.session.remove("omni_pending_paste");

  return { ok: true };
}

// ── Page Scraper (injected into page) ─────────────────────────────────────────
function extractConversationFromPage() {
  const url = location.href;
  const host = location.hostname;
  const MAX_CHARS = 100_000;

  let source = "Unknown AI";
  if (host.includes("claude.ai")) source = "Claude";
  else if (host.includes("chatgpt.com") || host.includes("openai.com")) source = "ChatGPT";
  else if (host.includes("gemini.google.com")) source = "Gemini";
  else if (host.includes("grok.com")) source = "Grok";
  else if (host.includes("deepseek.com")) source = "DeepSeek";
  else if (host.includes("perplexity.ai")) source = "Perplexity";
  else if (host.includes("copilot.microsoft.com")) source = "Microsoft Copilot";
  else if (host.includes("aistudio.google.com")) source = "Google AI Studio";

  const UI_NOISE = [
    /^(copy|copied|like|dislike|regenerate|retry|edit|share|report|flag|delete|pin|bookmark|thumbs up|thumbs down|good response|bad response|report a problem)$/i,
    /^\d+\s*(tokens?|chars?|words?)(\s+used)?$/i,
    /^(loading|thinking|generating|typing)\.{0,3}$/i,
  ];

  function cleanText(raw) {
    if (!raw) return "";
    return raw
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return t && !UI_NOISE.some((re) => re.test(t));
      })
      .join("\n")
      .trim();
  }

  const seenTexts = new Set();
  function addMessage(messages, role, rawText) {
    const text = cleanText(rawText);
    if (!text || text.length < 3) return;
    const key = role + "::" + text.slice(0, 120);
    if (seenTexts.has(key)) return;
    seenTexts.add(key);
    messages.push({ role, text });
  }

  function getTextWithCode(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll("pre code, pre").forEach((code) => {
      const lang = code.className?.match(/language-(\w+)/)?.[1] || "";
      const marker = lang ? `\`\`\`${lang}` : "\`\`\`";
      code.prepend(document.createTextNode(marker + "\n"));
      code.append(document.createTextNode("\n\`\`\`"));
    });
    return clone.innerText || clone.textContent || "";
  }

  const messages = [];

  // Platform-specific scrapers
  if (source === "Claude") {
    const turns = Array.from(
      document.querySelectorAll('[data-testid="human-turn"], [data-testid="assistant-turn"]'),
    );
    if (turns.length > 0) {
      turns.forEach((el) => {
        const isHuman = el.getAttribute("data-testid") === "human-turn";
        addMessage(messages, isHuman ? "Human" : "Claude", getTextWithCode(el));
      });
    }
    if (messages.length === 0) {
      document.querySelectorAll(".font-user-message, .font-claude-message").forEach((el) => {
        const isHuman = el.classList.contains("font-user-message");
        addMessage(messages, isHuman ? "Human" : "Claude", getTextWithCode(el));
      });
    }
  } else if (source === "ChatGPT") {
    const roleTurns = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleTurns.length > 0) {
      roleTurns.forEach((el) => {
        const role = el.getAttribute("data-message-author-role");
        addMessage(messages, role === "user" ? "Human" : "ChatGPT", getTextWithCode(el));
      });
    }
    if (messages.length === 0) {
      document.querySelectorAll("article[data-testid^='conversation-turn']").forEach((el) => {
        const isUser =
          !!el.querySelector("[data-message-author-role='user']") ||
          el.querySelector("img[alt='You']") !== null;
        addMessage(messages, isUser ? "Human" : "ChatGPT", getTextWithCode(el));
      });
    }
  } else if (source === "Gemini") {
    const allTurns = Array.from(document.querySelectorAll("user-query, model-response"));
    if (allTurns.length > 0) {
      allTurns.forEach((el) => {
        const isUser = el.tagName.toLowerCase() === "user-query";
        if (isUser) {
          const textEl = el.querySelector(".query-text, p") || el;
          addMessage(messages, "Human", getTextWithCode(textEl));
        } else {
          const clone = el.cloneNode(true);
          clone.querySelectorAll("related-questions, .related-questions, suggestion-chips, [class*='suggestion'], [class*='related']").forEach((n) => n.remove());
          const content = clone.querySelector(".response-content, .model-response-text") || clone;
          addMessage(messages, "Gemini", getTextWithCode(content));
        }
      });
    }
  } else if (source === "Grok") {
    const roleEls = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleEls.length > 0) {
      roleEls.forEach((el) => {
        const role = el.getAttribute("data-message-author-role");
        addMessage(messages, role === "user" ? "Human" : "Grok", getTextWithCode(el));
      });
    }
  } else if (source === "DeepSeek") {
    const roleEls = Array.from(document.querySelectorAll("[data-role]"));
    if (roleEls.length > 0) {
      roleEls.forEach((el) => {
        const role = el.getAttribute("data-role");
        const isUser = role === "user";
        if (role !== "user" && role !== "assistant") return;
        const thinkEl = el.querySelector("[class*='think'], [class*='reasoning'], details, summary");
        let fullText = "";
        if (thinkEl) {
          const thinkText = cleanText(thinkEl.innerText || "");
          if (thinkText) fullText = `[DeepSeek Reasoning]:\n${thinkText}\n\n`;
          const clone = el.cloneNode(true);
          clone.querySelectorAll("[class*='think'], [class*='reasoning'], details").forEach((n) => n.remove());
          fullText += getTextWithCode(clone);
        } else {
          fullText = getTextWithCode(el);
        }
        addMessage(messages, isUser ? "Human" : "DeepSeek", fullText);
      });
    }
  } else if (source === "Perplexity") {
    const allEls = Array.from(
      document.querySelectorAll(
        "[data-testid='user-query-content'], [class*='UserQuery'], [data-testid='answer-content'], [class*='AnswerBody']",
      ),
    ).filter((el) => {
      return !el.parentElement?.closest(
        "[data-testid='user-query-content'], [class*='UserQuery'], [data-testid='answer-content'], [class*='AnswerBody']",
      );
    });
    allEls.forEach((el) => {
      const testId = el.getAttribute("data-testid") || "";
      const cls = el.className || "";
      const isUser = testId.includes("user-query") || /UserQuery/i.test(cls);
      const clone = el.cloneNode(true);
      clone
        .querySelectorAll(
          "[class*='source'], [class*='citation'], [class*='related'], [class*='suggestions'], [class*='SuggestionChip'], [class*='FollowUp']",
        )
        .forEach((n) => n.remove());
      addMessage(messages, isUser ? "Human" : "Perplexity", getTextWithCode(clone));
    });
  } else if (source === "Microsoft Copilot") {
    const turns = Array.from(document.querySelectorAll("cib-chat-turn"));
    if (turns.length > 0) {
      turns.forEach((turn) => {
        const shadow = turn.shadowRoot;
        const userEl =
          turn.querySelector(".user-message, [class*='userMessage'], [class*='user-turn']") ||
          shadow?.querySelector(".user-message, [class*='user']");
        const botEl =
          turn.querySelector(
            ".response-message, cib-message-group, [class*='responseMessage'], [class*='bot-response']",
          ) ||
          shadow?.querySelector("[class*='response'], cib-message-group");
        if (userEl) addMessage(messages, "Human", getTextWithCode(userEl));
        if (botEl) addMessage(messages, "Microsoft Copilot", getTextWithCode(botEl));
      });
    }
  } else if (source === "Google AI Studio") {
    const chunks = Array.from(
      document.querySelectorAll("ms-chunk, ms-prompt-chunk, ms-model-response, ms-turn"),
    );
    if (chunks.length > 0) {
      chunks.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className || "").toLowerCase();
        const attr = (el.getAttribute("role") || "").toLowerCase();
        const isUser =
          tag.includes("prompt") || cls.includes("user") || cls.includes("input") || cls.includes("human") || attr.includes("user");
        addMessage(messages, isUser ? "Human" : "AI Studio", getTextWithCode(el));
      });
    }
  }

  // Generic fallback
  if (messages.length === 0) {
    const roleSelectors = [
      { sel: "[role='user'], [data-role='user'], [aria-label*='user' i]", role: "Human" },
      { sel: "[role='assistant'], [data-role='assistant'], [aria-label*='assistant' i]", role: source },
      { sel: "[class*='user-message'], [class*='userMessage'], [class*='human-message']", role: "Human" },
      { sel: "[class*='assistant-message'], [class*='ai-message'], [class*='bot-message']", role: source },
    ];
    roleSelectors.forEach(({ sel, role }) => {
      document.querySelectorAll(sel).forEach((el) => {
        addMessage(messages, role, getTextWithCode(el));
      });
    });
  }

  if (messages.length === 0) {
    return {
      text: null,
      source,
      url,
      messageCount: 0,
      truncated: false,
      error:
        "No conversation found on this page. Make sure you are on an active chat (not the homepage). Scroll up to load older messages, then try again.",
    };
  }

  let text = messages.map((m) => `${m.role}: ${m.text}`).join("\n\n");

  let truncated = false;
  if (text.length > MAX_CHARS) {
    text =
      "[Note: conversation truncated to most recent context due to length]\n\n" +
      text.slice(text.length - MAX_CHARS);
    truncated = true;
  }

  return { text, source, url, messages, messageCount: messages.length, truncated };
}
