import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Sparkle,
  Wand2,
  Workflow,
  Zap,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { transferConversation } from "@/lib/threadshift.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  component: Index,
});

const SOURCE_MODELS = [
  "Claude",
  "ChatGPT",
  "Gemini",
  "Microsoft Copilot",
  "Perplexity",
  "Grok",
  "DeepSeek",
  "Google AI Studio",
  "Other",
] as const;

const TARGET_MODELS = [
  { name: "ChatGPT", url: "https://chat.openai.com/" },
  { name: "Claude", url: "https://claude.ai/new" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
  { name: "Microsoft Copilot", url: "https://copilot.microsoft.com/" },
  { name: "Perplexity", url: "https://www.perplexity.ai/" },
  { name: "Grok", url: "https://grok.com/" },
  { name: "DeepSeek", url: "https://chat.deepseek.com/" },
] as const;

type TransferResult = {
  prompt: string;
  stats: {
    sourceChars: number;
    outputChars: number;
    compressionPercent: number;
    inputTokens: number | null;
    outputTokens: number | null;
  };
  targetModel: string;
};

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <Header />
      <main>
        <Hero />
        <TransferTool />
        <HowItWorks />
        <Footer />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">
            ThreadShift <span className="text-primary">AI</span>
          </span>
        </div>
        <nav className="hidden gap-7 text-sm text-muted-foreground sm:flex">
          <a href="#transfer" className="hover:text-foreground transition-colors">Transfer</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#models" className="hover:text-foreground transition-colors">Models</a>
        </nav>
        <a
          href="#transfer"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 transition"
        >
          Try it free <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div
      aria-hidden
      className="grid h-8 w-8 place-items-center rounded-lg"
      style={{
        background:
          "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 65%, var(--accent)))",
      }}
    >
      <Workflow className="h-4 w-4 text-primary-foreground" />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-24 sm:pb-14">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <Sparkle className="h-3 w-3 text-primary" />
          Universal AI conversation bridge
        </div>
        <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Continue your AI chat in{" "}
          <span className="text-primary">any other model</span>.
        </h1>
        <p className="mt-5 text-pretty text-lg text-muted-foreground sm:text-xl">
          Paste a conversation from Claude, ChatGPT, Gemini or any AI. ThreadShift compresses the
          context, keeps every decision, and hands a ready-to-paste prompt to the model of your choice.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#transfer"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lift hover:opacity-95 transition"
          >
            Transfer a conversation <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition"
          >
            See how it works
          </a>
        </div>
        <ModelStrip />
      </div>
    </section>
  );
}

function ModelStrip() {
  return (
    <div
      id="models"
      className="mt-12 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4 md:grid-cols-7"
    >
      {TARGET_MODELS.map((m) => (
        <div
          key={m.name}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-medium"
        >
          {m.name}
        </div>
      ))}
    </div>
  );
}

function TransferTool() {
  const router = useRouter();
  const transfer = useServerFn(transferConversation);
  const [conversation, setConversation] = useState("");
  const [sourceModel, setSourceModel] = useState<string>("Claude");
  const [targetModel, setTargetModel] = useState<(typeof TARGET_MODELS)[number]["name"]>("ChatGPT");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [copied, setCopied] = useState(false);

  const charCount = conversation.length;
  const canSubmit = charCount >= 20 && !loading;

  const targetUrl = useMemo(
    () => TARGET_MODELS.find((t) => t.name === targetModel)?.url ?? "#",
    [targetModel],
  );

  async function onTransfer() {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const res = (await transfer({
        data: {
          conversation,
          sourceModel,
          targetModel,
          intent: intent.trim() || undefined,
        },
      })) as TransferResult;
      setResult(res);
      // Scroll output into view
      setTimeout(() => {
        document.getElementById("output")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate continuation prompt. Try again in a moment.");
      router.invalidate();
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    toast.success("Prompt copied. Paste it into the new AI.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="transfer" className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-lift sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Transfer a conversation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste the chat, pick your destination, and get an optimized prompt in seconds.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{charCount.toLocaleString()} chars</span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <label className="text-sm font-medium">Paste your conversation</label>
            <Textarea
              value={conversation}
              onChange={(e) => setConversation(e.target.value)}
              placeholder={`Paste the full chat transcript here.\n\nYou:  ...\nClaude: ...\nYou:  ...\nClaude: ...`}
              className="mt-2 min-h-[280px] resize-y bg-background font-mono text-sm leading-relaxed"
            />
            <label className="mt-5 block text-sm font-medium">
              What's the next step? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. Help me refactor the auth middleware into a separate module"
              className="mt-2 bg-background"
            />
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium">From</label>
              <Select value={sourceModel} onValueChange={setSourceModel}>
                <SelectTrigger className="mt-2 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center text-primary">
              <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
            </div>

            <div>
              <label className="text-sm font-medium">To</label>
              <Select
                value={targetModel}
                onValueChange={(v) => setTargetModel(v as typeof targetModel)}
              >
                <SelectTrigger className="mt-2 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_MODELS.map((m) => (
                    <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={onTransfer}
              disabled={!canSubmit}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compressing context…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate prompt
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Minimum 20 characters. Your conversation is sent to ThreadShift's AI for processing.
            </p>
          </div>
        </div>

        {result && (
          <div id="output" className="mt-8 rounded-xl border border-primary-soft bg-primary-soft/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    Ready for {result.targetModel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.stats.outputChars.toLocaleString()} chars · {result.stats.compressionPercent}% smaller than source
                    {result.stats.outputTokens != null && (
                      <> · ~{result.stats.outputTokens} tokens</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyPrompt} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy prompt"}
                </Button>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95"
                >
                  Open {result.targetModel} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <pre className="mt-4 max-h-[480px] overflow-auto rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground">
              {result.prompt}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Capture",
      body: "Paste the conversation from your current AI. Full transcript, code blocks, file names — everything.",
    },
    {
      n: "02",
      title: "Compress",
      body: "Our Context Engine strips repetition and refusals, keeps every decision, constraint and artifact.",
    },
    {
      n: "03",
      title: "Continue",
      body: "Get a prompt optimized for the destination model's style. Paste it in. Pick up exactly where you left off.",
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          One bridge between every AI.
        </h2>
        <p className="mt-3 text-muted-foreground">
          ThreadShift understands the meaning of your chat — not just the text. It restructures and
          optimizes context for whichever AI you switch to next.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:shadow-lift"
          >
            <div className="font-mono text-xs text-primary">{s.n}</div>
            <div className="mt-2 text-lg font-semibold">{s.title}</div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 mt-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-medium text-foreground">ThreadShift AI</span>
        </div>
        <div>The universal AI conversation platform.</div>
      </div>
    </footer>
  );
}
