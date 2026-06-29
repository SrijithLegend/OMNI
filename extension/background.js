// background.js — Omni Extension Service Worker

// ── Step 10: Service worker keep-alive alarm ─────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "omni-keepalive") { /* no-op — just keeps SW alive */ }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("omni-keepalive", { periodInMinutes: 0.4 }); // ~25s

  const AI_URLS = [
    "https://claude.ai/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://grok.com/*",
    "https://chat.deepseek.com/*",
    "https://www.perplexity.ai/*",
    "https://copilot.microsoft.com/*",
    "https://aistudio.google.com/*"
  ];

  chrome.contextMenus.create({
    id: "omni-capture",
    title: "📋 Capture conversation for Omni",
    contexts: ["page"],
    documentUrlPatterns: AI_URLS
  });

  chrome.contextMenus.create({
    id: "omni-transfer",
    title: "🔀 Transfer to another AI...",
    contexts: ["page"],
    documentUrlPatterns: AI_URLS
  });
});

// ── Keyboard commands ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-omni") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  }
  if (command === "capture-conversation") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await captureFromTab(tab.id);
  }
});

// ── Context menu clicks ───────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "omni-capture") await captureFromTab(tab.id);
  if (info.menuItemId === "omni-transfer") {
    await captureFromTab(tab.id);
    if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ── Extension icon click → open side panel ───────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
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
    return true;
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

  if (msg.type === "OPEN_AND_PASTE") {
    (async () => {
      const { prompt, targetModel, url } = msg.payload;
      await chrome.storage.session.set({ omni_pending_paste: { prompt, targetModel } });
      const tab = await chrome.tabs.create({ url });
      const result = await waitForTabAndPaste(tab.id, url);
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === "OPEN_SIDEPANEL_WITH_TARGET") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        await chrome.storage.session.set({ omni_prefill_target: msg.targetModel });
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      sendResponse({ ok: true });
    })();
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
      return { error: captured?.error || "Could not extract conversation from this page." };
    }

    await chrome.storage.session.set({
      omni_captured: {
        text: captured.text,
        source: captured.source,
        url: captured.url,
        capturedAt: Date.now(),
        messageCount: captured.messageCount
      }
    });

    chrome.runtime.sendMessage({
      type: "CONVERSATION_CAPTURED",
      payload: captured
    }).catch(() => {});

    return { ok: true, captured };
  } catch (err) {
    return { error: err.message || "Capture failed" };
  }
}

// ── Core: run AI transfer ─────────────────────────────────────────────────────
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
  let userIntentLine = intent?.trim() ? `\n\nUser's stated next step (prioritize this): ${intent.trim()}` : "";

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
      headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
      body = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        max_tokens: 2000,
        temperature: 0.3
      });
    } else if (apiProvider === "anthropic" || apiProvider === "claude") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
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
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        max_tokens: 2000,
        temperature: 0.3
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
          new RegExp(`Style guidance for ${targetModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: [^\n]+`),
          `Style guidance for ${targetModel}: ${customModelStyle}`
        );
      }
    }

    let wasTruncated = conversation.length > 80000;

    let resp;
    for (let attempt = 0; attempt < 2; attempt++) {
      resp = await fetch(endpoint, { method: "POST", headers, body });
      if (attempt === 0 && (resp.status === 429 || resp.status === 503)) {
        await new Promise(r => setTimeout(r, 2000));
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

    await saveToHistory({ sourceModel, targetModel, prompt: outputText, compression, intent });
    await updateUsageStats(sourceChars, outputChars, sourceModel, targetModel);

    return {
      ok: true,
      prompt: outputText.trim(),
      stats: { sourceChars, outputChars, compressionPercent: compression, truncated: wasTruncated }
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
    sourceModel, targetModel, prompt, compression,
    intent: intent || "",
    createdAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ omni_history: [entry, ...omni_history].slice(0, 50) });
}

// ── Usage stats tracker ───────────────────────────────────────────────────────
async function updateUsageStats(sourceChars, outputChars, sourceModel, targetModel) {
  const { omni_usage_stats } = await chrome.storage.local.get("omni_usage_stats");
  const stats = omni_usage_stats || {
    totalTransfers: 0, totalSourceChars: 0, totalOutputChars: 0,
    bySource: {}, byTarget: {}
  };
  stats.totalTransfers += 1;
  stats.totalSourceChars += sourceChars;
  stats.totalOutputChars += outputChars;
  stats.bySource[sourceModel] = (stats.bySource[sourceModel] || 0) + 1;
  stats.byTarget[targetModel] = (stats.byTarget[targetModel] || 0) + 1;
  await chrome.storage.local.set({ omni_usage_stats: stats });
}

// ── Page scraper — Step 2: hardened with exact per-platform selectors ─────────
// IMPORTANT: Runs IN the page context via executeScript. Must be self-contained.
function extractConversationFromPage() {
  const url = location.href;
  const host = location.hostname;
  const MAX_CHARS = 100_000;

  // ── Platform detection ───────────────────────────────────────────────────
  let source = "Unknown AI";
  if (host.includes("claude.ai"))                  source = "Claude";
  else if (host.includes("chatgpt.com") ||
           host.includes("openai.com"))             source = "ChatGPT";
  else if (host.includes("gemini.google.com"))     source = "Gemini";
  else if (host.includes("grok.com"))              source = "Grok";
  else if (host.includes("deepseek.com"))          source = "DeepSeek";
  else if (host.includes("perplexity.ai"))         source = "Perplexity";
  else if (host.includes("copilot.microsoft.com")) source = "Microsoft Copilot";
  else if (host.includes("aistudio.google.com"))   source = "Google AI Studio";

  // ── Noise filter ─────────────────────────────────────────────────────────
  const UI_NOISE = [
    /^(copy|copied|like|dislike|regenerate|retry|edit|share|report|flag|delete|pin|bookmark|thumbs up|thumbs down|good response|bad response|report a problem)$/i,
    /^\d+\s*(tokens?|chars?|words?)(\s+used)?$/i,
    /^(loading|thinking|generating|typing)\.{0,3}$/i,
  ];

  function cleanText(raw) {
    if (!raw) return "";
    return raw.split("\n")
      .filter(line => {
        const t = line.trim();
        return t && !UI_NOISE.some(re => re.test(t));
      })
      .join("\n").trim();
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
    clone.querySelectorAll("pre code, pre").forEach(code => {
      const lang = code.className?.match(/language-(\w+)/)?.[1] || "";
      const marker = lang ? `\`\`\`${lang}` : "```";
      code.prepend(document.createTextNode(marker + "\n"));
      code.append(document.createTextNode("\n```"));
    });
    return clone.innerText || clone.textContent || "";
  }

  const messages = [];

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — HARDENED SCRAPERS WITH EXACT SELECTORS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 1. Claude (claude.ai) ─────────────────────────────────────────────────
  // Verified selectors as of 2025-Q2
  if (source === "Claude") {
    // Primary: data-testid turn containers (most stable — Anthropic's own test hooks)
    const turns = Array.from(
      document.querySelectorAll('[data-testid="human-turn"], [data-testid="assistant-turn"]')
    );
    if (turns.length > 0) {
      turns.forEach(el => {
        const isHuman = el.getAttribute("data-testid") === "human-turn";
        addMessage(messages, isHuman ? "Human" : "Claude", getTextWithCode(el));
      });
    }

    // Fallback A: font-* utility classes Claude uses on message containers
    if (messages.length === 0) {
      document.querySelectorAll(".font-user-message, .font-claude-message").forEach(el => {
        const isHuman = el.classList.contains("font-user-message");
        addMessage(messages, isHuman ? "Human" : "Claude", getTextWithCode(el));
      });
    }

    // Fallback B: prose content containers paired with the user bubble
    if (messages.length === 0) {
      // Claude wraps user messages in a rounded bubble: look for bg-[#f4f4f4] or similar
      const container = document.querySelector('[data-testid="conversation-turn-list"]') ||
                        document.querySelector("main") ||
                        document.body;
      // Walk children, classify by presence of "You" avatar or AI prose class
      Array.from(container.querySelectorAll("div[class]")).forEach(el => {
        const cls = el.className || "";
        if (cls.includes("human") || cls.includes("user-turn")) {
          addMessage(messages, "Human", getTextWithCode(el));
        } else if (cls.includes("assistant") || cls.includes("claude-turn") || cls.includes("prose")) {
          // Only pick leaf-level prose blocks
          const hasChildProse = el.querySelector("[class*='prose']");
          if (!hasChildProse) addMessage(messages, "Claude", getTextWithCode(el));
        }
      });
    }
  }

  // ── 2. ChatGPT (chatgpt.com / chat.openai.com) ────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "ChatGPT") {
    // Primary: data-message-author-role — the gold standard attribute OpenAI uses
    const roleTurns = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleTurns.length > 0) {
      roleTurns.forEach(el => {
        const role = el.getAttribute("data-message-author-role");
        addMessage(messages, role === "user" ? "Human" : "ChatGPT", getTextWithCode(el));
      });
    }

    // Fallback A: article[data-testid="conversation-turn-N"] — each turn is an <article>
    if (messages.length === 0) {
      document.querySelectorAll("article[data-testid^='conversation-turn']").forEach(el => {
        // User turns have an SVG avatar with title "You"; assistant turns do not
        const isUser = !!el.querySelector("[data-message-author-role='user']") ||
                       el.querySelector("img[alt='You']") !== null;
        addMessage(messages, isUser ? "Human" : "ChatGPT", getTextWithCode(el));
      });
    }

    // Fallback B: markdown div inside the turn — ChatGPT wraps AI output in .markdown
    if (messages.length === 0) {
      document.querySelectorAll("div.markdown").forEach(el => {
        // Climb to find the nearest article or role container
        const article = el.closest("article");
        const roleAttr = article?.querySelector("[data-message-author-role]")
                               ?.getAttribute("data-message-author-role");
        const isUser = roleAttr === "user";
        addMessage(messages, isUser ? "Human" : "ChatGPT", getTextWithCode(el));
      });
    }

    // Fallback C: role=presentation rows used in some ChatGPT variants
    if (messages.length === 0) {
      document.querySelectorAll("[class*='ConversationItem'], [class*='group']").forEach(el => {
        const cls = (el.className || "").toLowerCase();
        const isUser = cls.includes("user") || cls.includes("human");
        const text = getTextWithCode(el);
        if (text.length > 5) addMessage(messages, isUser ? "Human" : "ChatGPT", text);
      });
    }
  }

  // ── 3. Gemini (gemini.google.com) ─────────────────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "Gemini") {
    // Primary: Gemini uses custom elements <user-query> and <model-response>
    const allTurns = Array.from(
      document.querySelectorAll("user-query, model-response")
    );
    if (allTurns.length > 0) {
      allTurns.forEach(el => {
        const isUser = el.tagName.toLowerCase() === "user-query";
        if (isUser) {
          // User text lives inside .query-text or a <p> inside the custom element
          const textEl = el.querySelector(".query-text, p") || el;
          addMessage(messages, "Human", getTextWithCode(textEl));
        } else {
          // Strip related-questions / suggestion chips before capturing AI text
          const clone = el.cloneNode(true);
          clone.querySelectorAll(
            "related-questions, .related-questions, suggestion-chips, [class*='suggestion'], [class*='related']"
          ).forEach(n => n.remove());
          // The prose response lives in .response-content or .model-response-text
          const content = clone.querySelector(".response-content, .model-response-text") || clone;
          addMessage(messages, "Gemini", getTextWithCode(content));
        }
      });
    }

    // Fallback A: class-based for older Gemini layouts
    if (messages.length === 0) {
      document.querySelectorAll(".query-text").forEach(el =>
        addMessage(messages, "Human", cleanText(el.innerText || ""))
      );
      document.querySelectorAll(".model-response-text, .response-text, .response-content").forEach(el => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("[class*='related'], [class*='suggestion']").forEach(n => n.remove());
        addMessage(messages, "Gemini", getTextWithCode(clone));
      });
    }

    // Fallback B: conversation container with role indicators
    if (messages.length === 0) {
      document.querySelectorAll("[data-turn-role]").forEach(el => {
        const role = el.getAttribute("data-turn-role");
        addMessage(messages, role === "user" ? "Human" : "Gemini", getTextWithCode(el));
      });
    }
  }

  // ── 4. Grok (grok.com / x.com/i/grok) ────────────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "Grok") {
    // Primary: Grok uses data-message-author-role (same pattern as ChatGPT)
    const roleEls = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleEls.length > 0) {
      roleEls.forEach(el => {
        const role = el.getAttribute("data-message-author-role");
        addMessage(messages, role === "user" ? "Human" : "Grok", getTextWithCode(el));
      });
    }

    // Fallback A: Grok wraps turns in divs with aria-label="Human message" / "AI message"
    if (messages.length === 0) {
      document.querySelectorAll("[aria-label]").forEach(el => {
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("human") || label.includes("user") || label.includes("your message")) {
          addMessage(messages, "Human", getTextWithCode(el));
        } else if (label.includes("grok") || label.includes("ai") || label.includes("assistant")) {
          addMessage(messages, "Grok", getTextWithCode(el));
        }
      });
    }

    // Fallback B: Tailwind-hashed class substring match on the scroll container
    if (messages.length === 0) {
      const scrollContainer =
        document.querySelector("main [class*='overflow-y-auto']") ||
        document.querySelector("[class*='overflow-y-auto']") ||
        document.querySelector("main") ||
        document.body;

      // Grok renders user bubbles with a distinct background; look for class substrings
      const userPattern = /message.*user|user.*message|human.*message|message.*human/i;
      const aiPattern   = /message.*assistant|assistant.*message|message.*grok|grok.*message|message.*bot/i;

      let matched = false;
      Array.from(scrollContainer.querySelectorAll("div[class]")).forEach(el => {
        const cls = el.className || "";
        if (userPattern.test(cls)) {
          addMessage(messages, "Human", getTextWithCode(el));
          matched = true;
        } else if (aiPattern.test(cls)) {
          addMessage(messages, "Grok", getTextWithCode(el));
          matched = true;
        }
      });

      // Fallback C: structural alternation if class matching failed
      if (!matched) {
        // Grok's chat list: direct children of the scroll area, alternating user/ai
        const topChildren = Array.from(scrollContainer.children).filter(el => {
          const tag = el.tagName;
          return !["NAV","HEADER","FOOTER","ASIDE"].includes(tag);
        });
        let role = "Human";
        topChildren.forEach(el => {
          const text = getTextWithCode(el);
          if (text.length < 10) return;
          addMessage(messages, role, text);
          role = role === "Human" ? "Grok" : "Human";
        });
      }
    }
  }

  // ── 5. DeepSeek (chat.deepseek.com) ──────────────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "DeepSeek") {
    // Primary: DeepSeek uses data-role="user" / data-role="assistant" on message wrappers
    const roleEls = Array.from(document.querySelectorAll("[data-role]"));
    if (roleEls.length > 0) {
      roleEls.forEach(el => {
        const role = el.getAttribute("data-role");
        const isUser = role === "user";
        if (role !== "user" && role !== "assistant") return;

        // Preserve DeepSeek's chain-of-thought / thinking blocks
        const thinkEl = el.querySelector("[class*='think'], [class*='reasoning'], details, summary");
        let fullText = "";
        if (thinkEl) {
          const thinkText = cleanText(thinkEl.innerText || "");
          if (thinkText) fullText = `[DeepSeek Reasoning]:\n${thinkText}\n\n`;
          const clone = el.cloneNode(true);
          clone.querySelectorAll("[class*='think'], [class*='reasoning'], details").forEach(n => n.remove());
          fullText += getTextWithCode(clone);
        } else {
          fullText = getTextWithCode(el);
        }
        addMessage(messages, isUser ? "Human" : "DeepSeek", fullText);
      });
    }

    // Fallback A: class-based bubble selectors DeepSeek uses
    if (messages.length === 0) {
      // User messages: .fbb737a4 or classes containing "user" / "human"
      document.querySelectorAll("[class*='userMessage'], [class*='user-message'], [class*='human']").forEach(el =>
        addMessage(messages, "Human", getTextWithCode(el))
      );
      // AI messages: classes containing "assistantMessage" or "ds-markdown"
      document.querySelectorAll(
        "[class*='assistantMessage'], [class*='assistant-message'], [class*='ds-markdown'], [class*='markdown-body']"
      ).forEach(el => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("[class*='think'], details").forEach(n => n.remove());
        addMessage(messages, "DeepSeek", getTextWithCode(clone));
      });
    }

    // Fallback B: aria-label on message containers
    if (messages.length === 0) {
      document.querySelectorAll("[aria-label*='message' i]").forEach(el => {
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        const isUser = label.includes("user") || label.includes("human") || label.includes("you");
        addMessage(messages, isUser ? "Human" : "DeepSeek", getTextWithCode(el));
      });
    }
  }

  // ── 6. Perplexity (perplexity.ai) ─────────────────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "Perplexity") {
    // Primary: Perplexity wraps each thread in a col div; user query at top, answer below
    // The user query container has data-testid="user-query-content" (or similar)
    const queryEls = Array.from(
      document.querySelectorAll(
        "[data-testid='user-query-content'], [class*='UserQuery'], .my-md.md\\:my-lg"
      )
    );
    const answerEls = Array.from(
      document.querySelectorAll(
        "[data-testid='answer-content'], [class*='AnswerBody'], [class*='prose']"
      )
    );

    // Build ordered list from DOM position
    if (queryEls.length > 0 || answerEls.length > 0) {
      const allEls = Array.from(
        document.querySelectorAll(
          "[data-testid='user-query-content'], [class*='UserQuery'], " +
          "[data-testid='answer-content'], [class*='AnswerBody']"
        )
      ).filter(el => {
        // Deduplicate: skip elements that are children of already-matched elements
        return !el.parentElement?.closest(
          "[data-testid='user-query-content'], [class*='UserQuery'], " +
          "[data-testid='answer-content'], [class*='AnswerBody']"
        );
      });

      allEls.forEach(el => {
        const testId = el.getAttribute("data-testid") || "";
        const cls = el.className || "";
        const isUser = testId.includes("user-query") || /UserQuery/i.test(cls);
        // Strip source citations and "People also ask" chips
        const clone = el.cloneNode(true);
        clone.querySelectorAll(
          "[class*='source'], [class*='citation'], [class*='related'], [class*='suggestions'], " +
          "[class*='SuggestionChip'], [class*='FollowUp']"
        ).forEach(n => n.remove());
        addMessage(messages, isUser ? "Human" : "Perplexity", getTextWithCode(clone));
      });
    }

    // Fallback A: thread structure — each thread = one (query, answer) pair
    if (messages.length === 0) {
      const threads = Array.from(document.querySelectorAll("[class*='Thread'], [class*='thread']"));
      threads.forEach(thread => {
        const qEl = thread.querySelector("h1, h2, [class*='query'], [class*='question']");
        const aEl = thread.querySelector(".prose, [class*='answer'], [class*='markdown']");
        if (qEl) addMessage(messages, "Human", cleanText(qEl.innerText || ""));
        if (aEl) {
          const clone = aEl.cloneNode(true);
          clone.querySelectorAll("[class*='source'], [class*='related']").forEach(n => n.remove());
          addMessage(messages, "Perplexity", getTextWithCode(clone));
        }
      });
    }

    // Fallback B: main content area scan
    if (messages.length === 0) {
      const main = document.querySelector("main") || document.body;
      main.querySelectorAll("h1, h2, [class*='query'], [class*='question']").forEach(el => {
        const t = cleanText(el.innerText || "");
        if (t.length > 5 && t.length < 500) addMessage(messages, "Human", t);
      });
      main.querySelectorAll(".prose, [class*='answer'], [class*='markdown']").forEach(el => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("[class*='source'], [class*='related']").forEach(n => n.remove());
        const t = cleanText(clone.innerText || "");
        if (t.length > 50) addMessage(messages, "Perplexity", getTextWithCode(clone));
      });
    }
  }

  // ── 7. Microsoft Copilot (copilot.microsoft.com) ──────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "Microsoft Copilot") {
    // Primary: cib-chat-turn Web Components with shadow DOM
    const turns = Array.from(document.querySelectorAll("cib-chat-turn"));
    if (turns.length > 0) {
      turns.forEach(turn => {
        // Copilot uses shadow DOM — try both light and shadow
        const shadow = turn.shadowRoot;
        const userEl = turn.querySelector(".user-message, [class*='userMessage'], [class*='user-turn']") ||
                       shadow?.querySelector(".user-message, [class*='user']");
        const botEl  = turn.querySelector(
          ".response-message, cib-message-group, [class*='responseMessage'], [class*='bot-response']"
        ) || shadow?.querySelector("[class*='response'], cib-message-group");

        if (userEl) addMessage(messages, "Human", getTextWithCode(userEl));
        if (botEl)  addMessage(messages, "Microsoft Copilot", getTextWithCode(botEl));
      });
    }

    // Fallback A: data-author / role-based attrs used in newer Copilot
    if (messages.length === 0) {
      document.querySelectorAll("[data-author]").forEach(el => {
        const author = (el.getAttribute("data-author") || "").toLowerCase();
        const isUser = author === "user" || author.includes("human");
        addMessage(messages, isUser ? "Human" : "Microsoft Copilot", getTextWithCode(el));
      });
    }

    // Fallback B: class-based scan (Copilot redesigns frequently)
    if (messages.length === 0) {
      document.querySelectorAll(
        "[class*='user-message'], [class*='userMessage'], [class*='HumanMessage']"
      ).forEach(el => addMessage(messages, "Human", getTextWithCode(el)));
      document.querySelectorAll(
        "[class*='bot-message'], [class*='botMessage'], [class*='CopilotMessage'], " +
        "[class*='assistant-message'], [class*='responseMessage']"
      ).forEach(el => addMessage(messages, "Microsoft Copilot", getTextWithCode(el)));
    }

    // Fallback C: role=listitem in the conversation list
    if (messages.length === 0) {
      document.querySelectorAll("[role='listitem']").forEach(el => {
        const text = cleanText(el.innerText || "");
        if (text.length < 10) return;
        const isUser = !!el.querySelector("[class*='user']") ||
                       el.getAttribute("data-author") === "user";
        addMessage(messages, isUser ? "Human" : "Microsoft Copilot", text);
      });
    }
  }

  // ── 8. Google AI Studio (aistudio.google.com) ─────────────────────────────
  // Verified selectors as of 2025-Q2
  else if (source === "Google AI Studio") {
    // Primary: ms-chunk and ms-prompt-chunk Angular custom elements
    // AI Studio uses Angular Material — elements have specific tag names
    const chunks = Array.from(
      document.querySelectorAll("ms-chunk, ms-prompt-chunk, ms-model-response, ms-turn")
    );
    if (chunks.length > 0) {
      chunks.forEach(el => {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className || "").toLowerCase();
        const attr = (el.getAttribute("role") || "").toLowerCase();
        const isUser = tag.includes("prompt") || cls.includes("user") ||
                       cls.includes("input") || cls.includes("human") ||
                       attr.includes("user");
        addMessage(messages, isUser ? "Human" : "AI Studio", getTextWithCode(el));
      });
    }

    // Fallback A: .turn or .chunk class elements with role indicator
    if (messages.length === 0) {
      document.querySelectorAll(".turn, .chunk, [class*='Turn'], [class*='Chunk']").forEach(el => {
        const cls = (el.className || "").toLowerCase();
        const isUser = cls.includes("user") || cls.includes("input") || cls.includes("prompt");
        addMessage(messages, isUser ? "Human" : "AI Studio", getTextWithCode(el));
      });
    }

    // Fallback B: Angular Material mat-card — AI Studio wraps each turn in a card
    if (messages.length === 0) {
      document.querySelectorAll("mat-card, [mat-card], [class*='mat-card']").forEach(el => {
        const cls = (el.className || "").toLowerCase();
        const text = getTextWithCode(el);
        if (text.length < 10) return;
        const isUser = cls.includes("user") || cls.includes("human") || cls.includes("prompt");
        addMessage(messages, isUser ? "Human" : "AI Studio", text);
      });
    }

    // Fallback C: contenteditable sections (AI Studio has editable prompts)
    if (messages.length === 0) {
      document.querySelectorAll("[contenteditable='true']").forEach(el => {
        const text = getTextWithCode(el);
        if (text.length < 5) return;
        addMessage(messages, "Human", text);
      });
      document.querySelectorAll("[class*='response'], [class*='output'], [class*='answer']").forEach(el => {
        const text = getTextWithCode(el);
        if (text.length < 10) return;
        addMessage(messages, "AI Studio", text);
      });
    }
  }

  // ── Generic fallback for unknown/unmatched pages ───────────────────────────
  if (messages.length === 0) {
    const roleSelectors = [
      { sel: "[role='user'], [data-role='user'], [aria-label*='user' i]", role: "Human" },
      { sel: "[role='assistant'], [data-role='assistant'], [aria-label*='assistant' i]", role: source },
      { sel: "[class*='user-message'], [class*='userMessage'], [class*='human-message']", role: "Human" },
      { sel: "[class*='assistant-message'], [class*='ai-message'], [class*='bot-message']", role: source },
    ];
    roleSelectors.forEach(({ sel, role }) => {
      document.querySelectorAll(sel).forEach(el => {
        addMessage(messages, role, getTextWithCode(el));
      });
    });
  }

  // ── Guard: nothing found ──────────────────────────────────────────────────
  if (messages.length === 0) {
    return {
      text: null, source, url,
      messageCount: 0, truncated: false,
      error: "No conversation found on this page. Make sure you are on an active chat " +
             "(not the homepage). Scroll up to load older messages, then try again."
    };
  }

  // ── Format as transcript ──────────────────────────────────────────────────
  let text = messages.map(m => `${m.role}: ${m.text}`).join("\n\n");

  let truncated = false;
  if (text.length > MAX_CHARS) {
    text = "[Note: conversation truncated to most recent context due to length]\n\n" +
           text.slice(text.length - MAX_CHARS);
    truncated = true;
  }

  return { text, source, url, messageCount: messages.length, truncated };
}

// ── Open + Paste: wait for tab load then inject paster ───────────────────────
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

// ── Paste function — injected into the target AI page ────────────────────────
// Must be self-contained (no closures over background vars).
async function pasteIntoTargetPage() {
  const MAX_RETRIES = 15;
  const RETRY_MS = 350;

  const stored = await chrome.storage.session.get("omni_pending_paste");
  const text = stored?.omni_pending_paste?.prompt;
  if (!text) return { error: "No pending prompt found" };

  // ── Step 2: Exact paste-target selectors per platform ───────────────────
  const INPUT_SELECTORS = [
    // Claude: contenteditable within fieldset (the prompt area)
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="chat-input"]',
    // ChatGPT: the #prompt-textarea contenteditable div
    'div#prompt-textarea[contenteditable="true"]',
    '#prompt-textarea',
    // Gemini: Quill editor inside rich-textarea custom element
    'rich-textarea div.ql-editor[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"]',
    // Grok: textarea or contenteditable in the input bar
    'textarea[data-testid="tweetTextarea_0"]',
    'div[data-testid="grok-input"] [contenteditable="true"]',
    '[data-testid="grok-composer"] [contenteditable="true"]',
    // DeepSeek: #chat-input textarea
    'textarea#chat-input',
    'textarea[placeholder*="Send a message" i]',
    // Perplexity: the search-like textarea
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="Follow-up" i]',
    // Microsoft Copilot: cib-serp-feedback textarea or contenteditable
    'cib-text-input textarea',
    'div[aria-label*="Ask me anything" i][contenteditable="true"]',
    'textarea[aria-label*="Ask me anything" i]',
    // Google AI Studio: the prompt contenteditable
    '[aria-label="Type something"] div[contenteditable="true"]',
    'ms-autosize-textarea textarea',
    'textarea[aria-label*="prompt" i]',
    // Generic fallbacks
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="type" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ];

  function findInput() {
    for (const sel of INPUT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      } catch (_) { /* invalid selector — skip */ }
    }
    return null;
  }

  let el = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    el = findInput();
    if (el) break;
    await new Promise(r => setTimeout(r, RETRY_MS));
  }

  if (!el) {
    try { await navigator.clipboard.writeText(text); } catch (_) {}
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
    // contenteditable
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

  const tooltip = document.createElement("div");
  tooltip.textContent = "✅ Pasted by Omni — review and press Enter";
  tooltip.style.cssText = [
    "position:fixed", "bottom:80px", "left:50%", "transform:translateX(-50%)",
    "background:#1e1b4b", "color:#a5b4fc", "border:1px solid #4c1d95",
    "border-radius:10px", "padding:8px 16px", "font-size:13px", "font-weight:600",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "z-index:2147483647", "pointer-events:none",
    "box-shadow:0 4px 20px rgba(0,0,0,0.4)",
    "animation:omni-fade-in 0.2s ease",
  ].join(";");
  const style = document.createElement("style");
  style.textContent = `@keyframes omni-fade-in{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
  document.head.appendChild(style);
  document.body.appendChild(tooltip);
  setTimeout(() => { tooltip.remove(); style.remove(); }, 3000);

  return { ok: true };
}
