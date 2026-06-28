// background.js — Omni Extension Service Worker

// ── Context menu setup ────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "omni-capture",
    title: "📋 Capture conversation for Omni",
    contexts: ["page"],
    documentUrlPatterns: [
      "https://claude.ai/*",
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://gemini.google.com/*",
      "https://grok.com/*",
      "https://chat.deepseek.com/*",
      "https://www.perplexity.ai/*",
      "https://copilot.microsoft.com/*",
      "https://aistudio.google.com/*"
    ]
  });

  chrome.contextMenus.create({
    id: "omni-transfer",
    title: "🔀 Transfer to another AI...",
    contexts: ["page"],
    documentUrlPatterns: [
      "https://claude.ai/*",
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://gemini.google.com/*",
      "https://grok.com/*",
      "https://chat.deepseek.com/*",
      "https://www.perplexity.ai/*",
      "https://copilot.microsoft.com/*",
      "https://aistudio.google.com/*"
    ]
  });
});

// ── Keyboard commands ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-omni") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
  if (command === "capture-conversation") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await captureFromTab(tab.id);
    }
  }
});

// ── Context menu clicks ───────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === "omni-capture") {
    await captureFromTab(tab.id);
  }

  if (info.menuItemId === "omni-transfer") {
    await captureFromTab(tab.id);
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});

// ── Extension icon click → open side panel ───────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CAPTURE_REQUEST") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) { sendResponse({ error: "No active tab" }); return; }
      const result = await captureFromTab(tab.id);
      sendResponse(result);
    })();
    return true; // keep channel open for async
  }

  if (msg.type === "TRANSFER_REQUEST") {
    (async () => {
      const result = await runTransfer(msg.payload);
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === "OPEN_TAB") {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Core: capture conversation from current tab ───────────────────────────────
async function captureFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractConversationFromPage
    });

    const captured = results?.[0]?.result;
    if (!captured || !captured.text) {
      return { error: "Could not extract conversation from this page." };
    }

    // Persist to storage so sidepanel can read it
    await chrome.storage.session.set({
      omni_captured: {
        text: captured.text,
        source: captured.source,
        url: captured.url,
        capturedAt: Date.now(),
        messageCount: captured.messageCount
      }
    });

    // Notify sidepanel if open
    chrome.runtime.sendMessage({
      type: "CONVERSATION_CAPTURED",
      payload: captured
    }).catch(() => {}); // sidepanel may not be open

    return { ok: true, captured };
  } catch (err) {
    return { error: err.message || "Capture failed" };
  }
}

// ── Core: run AI transfer (calls user's configured API) ───────────────────────
async function runTransfer({ conversation, sourceModel, targetModel, targetStyle, intent, apiKey, apiProvider }) {
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
    Other: "Summarize context clearly and state the next task explicitly."
  };

  const styleGuide = targetGuidance[targetModel] || targetGuidance["Other"];
  const userIntentLine = intent?.trim() ? `\n\nUser's stated next step (prioritize this): ${intent.trim()}` : "";

  const systemPrompt = `You are the Context Engine inside Omni, a universal AI conversation bridge. Your job is to take a raw conversation a user had with one AI assistant and produce an optimized continuation prompt for a different AI assistant, so the new model can pick up exactly where the previous one left off.

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

  const userMessage = `Source AI: ${sourceModel}\nTarget AI: ${targetModel}${userIntentLine}\n\n--- BEGIN SOURCE CONVERSATION ---\n${conversation}\n--- END SOURCE CONVERSATION ---\n\nProduce the optimized continuation prompt now.`;

  try {
    // Determine API endpoint based on provider
    let endpoint, headers, body;

    if (apiProvider === "openai" || apiProvider === "chatgpt") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
      body = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });
    } else if (apiProvider === "anthropic" || apiProvider === "claude") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      };
      body = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      });
    } else if (apiProvider === "gemini") {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.3 }
      });
    } else if (apiProvider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
      body = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });
    } else {
      return { error: `Unknown API provider: ${apiProvider}` };
    }

    const resp = await fetch(endpoint, { method: "POST", headers, body });
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

    // Save to history
    await saveToHistory({ sourceModel, targetModel, prompt: outputText, compression, intent });

    return {
      ok: true,
      prompt: outputText.trim(),
      stats: { sourceChars, outputChars, compressionPercent: compression }
    };
  } catch (err) {
    return { error: err.message || "Transfer failed" };
  }
}

// ── History persistence ───────────────────────────────────────────────────────
async function saveToHistory({ sourceModel, targetModel, prompt, compression, intent }) {
  const { omni_history = [] } = await chrome.storage.local.get("omni_history");
  const entry = {
    id: Date.now(),
    sourceModel,
    targetModel,
    prompt,
    compression,
    intent: intent || "",
    createdAt: new Date().toISOString()
  };
  // Keep last 50
  const updated = [entry, ...omni_history].slice(0, 50);
  await chrome.storage.local.set({ omni_history: updated });
}

// ── Page scraper (injected into AI tabs) ─────────────────────────────────────
// This function runs IN the context of the AI page — no closures over background vars
function extractConversationFromPage() {
  const url = location.href;
  const host = location.hostname;

  // Detect which AI platform we're on
  let source = "Unknown AI";
  if (host.includes("claude.ai")) source = "Claude";
  else if (host.includes("chatgpt.com") || host.includes("openai.com")) source = "ChatGPT";
  else if (host.includes("gemini.google.com")) source = "Gemini";
  else if (host.includes("grok.com")) source = "Grok";
  else if (host.includes("deepseek.com")) source = "DeepSeek";
  else if (host.includes("perplexity.ai")) source = "Perplexity";
  else if (host.includes("copilot.microsoft.com")) source = "Microsoft Copilot";
  else if (host.includes("aistudio.google.com")) source = "Google AI Studio";

  const messages = [];

  // ── Claude ────────────────────────────────────────────────────────────────
  if (source === "Claude") {
    // Human turns
    document.querySelectorAll('[data-testid="human-turn"], .human-turn').forEach(el => {
      const text = el.innerText?.trim();
      if (text) messages.push({ role: "Human", text });
    });
    // Assistant turns
    document.querySelectorAll('[data-testid="assistant-turn"], .assistant-turn').forEach(el => {
      const text = el.innerText?.trim();
      if (text) messages.push({ role: "Claude", text });
    });

    // Fallback: interleave by DOM order
    if (messages.length === 0) {
      const allTurns = document.querySelectorAll('[data-testid$="-turn"]');
      allTurns.forEach(el => {
        const isHuman = el.getAttribute("data-testid")?.includes("human");
        const text = el.innerText?.trim();
        if (text) messages.push({ role: isHuman ? "Human" : "Claude", text });
      });
    }
  }

  // ── ChatGPT ───────────────────────────────────────────────────────────────
  else if (source === "ChatGPT") {
    document.querySelectorAll("[data-message-author-role]").forEach(el => {
      const role = el.getAttribute("data-message-author-role");
      const text = el.innerText?.trim();
      if (text) messages.push({ role: role === "user" ? "Human" : "ChatGPT", text });
    });
  }

  // ── Gemini ────────────────────────────────────────────────────────────────
  else if (source === "Gemini") {
    document.querySelectorAll(".query-text, .model-response-text").forEach(el => {
      const isUser = el.classList.contains("query-text");
      const text = el.innerText?.trim();
      if (text) messages.push({ role: isUser ? "Human" : "Gemini", text });
    });

    // Fallback
    if (messages.length === 0) {
      document.querySelectorAll("user-query, model-response").forEach(el => {
        const isUser = el.tagName.toLowerCase() === "user-query";
        const text = el.innerText?.trim();
        if (text) messages.push({ role: isUser ? "Human" : "Gemini", text });
      });
    }
  }

  // ── Grok ──────────────────────────────────────────────────────────────────
  else if (source === "Grok") {
    document.querySelectorAll("[class*='message'], [class*='Message']").forEach(el => {
      const text = el.innerText?.trim();
      if (!text || el.children.length > 5) return; // skip wrappers
      const isUser = el.className.toLowerCase().includes("user") ||
                     el.closest("[class*='user']") !== null;
      messages.push({ role: isUser ? "Human" : "Grok", text });
    });
  }

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  else if (source === "DeepSeek") {
    document.querySelectorAll(".dad65929, .ds-message-container, [class*='chat-message']").forEach(el => {
      const text = el.innerText?.trim();
      if (!text) return;
      const isUser = el.className.includes("user") || el.querySelector("[class*='user']");
      messages.push({ role: isUser ? "Human" : "DeepSeek", text });
    });
  }

  // ── Perplexity ────────────────────────────────────────────────────────────
  else if (source === "Perplexity") {
    // User messages
    document.querySelectorAll("[class*='query'], [data-testid*='query']").forEach(el => {
      const text = el.innerText?.trim();
      if (text) messages.push({ role: "Human", text });
    });
    // AI answers
    document.querySelectorAll("[class*='answer'], [class*='prose'], .prose").forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 30) messages.push({ role: "Perplexity", text });
    });
  }

  // ── Microsoft Copilot ─────────────────────────────────────────────────────
  else if (source === "Microsoft Copilot") {
    document.querySelectorAll("[class*='user-message'], [class*='bot-message'], cib-message-item").forEach(el => {
      const isUser = el.className?.includes("user") || el.getAttribute("type") === "human";
      const text = el.innerText?.trim();
      if (text) messages.push({ role: isUser ? "Human" : "Copilot", text });
    });
  }

  // ── Google AI Studio ──────────────────────────────────────────────────────
  else if (source === "Google AI Studio") {
    document.querySelectorAll("ms-chunk, .chunk").forEach(el => {
      const isUser = el.classList.contains("user") || el.getAttribute("role") === "user";
      const text = el.innerText?.trim();
      if (text) messages.push({ role: isUser ? "Human" : "AI Studio", text });
    });
  }

  // ── Generic fallback for unknown pages ────────────────────────────────────
  if (messages.length === 0) {
    // Try common patterns
    const selectors = [
      "[role='user']", "[role='assistant']",
      "[class*='user-message']", "[class*='assistant-message']",
      "[class*='human']", "[class*='ai-message']"
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const isUser = sel.includes("user") || sel.includes("human");
        const text = el.innerText?.trim();
        if (text && text.length > 5) {
          messages.push({ role: isUser ? "Human" : source, text });
        }
      });
    });
  }

  if (messages.length === 0) {
    return { text: null, source, url, messageCount: 0, error: "No conversation found on this page" };
  }

  // Format as transcript
  const text = messages
    .map(m => `${m.role}: ${m.text}`)
    .join("\n\n");

  return { text, source, url, messageCount: messages.length };
}
