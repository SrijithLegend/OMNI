import { useState } from 'react';
import { PLAN_CONFIGS, formatLimit } from '@/config/plans';
import {
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Shield,
  Globe,
  MessageSquare,
  FolderOpen,
  Cloud,
  RefreshCw,
  Link2,
  Chrome,
  Github,
  GitBranch,
  FileText,
  Search,
  Clock,
  Users,
  Star,
  ChevronDown,
  Play,
} from 'lucide-react';

export function LandingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SupportedModelsSection />
      <IntegrationsSection />
      <PricingSection interval={billingInterval} onIntervalChange={setBillingInterval} />
      <TestimonialsSection />
      <FAQSection />
      <RoadmapSection />
      <SecuritySection />
      <CTASection />
      <Footer />
    </div>
  );
}

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Omni</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Pricing</a>
            <a href="#integrations" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Integrations</a>
            <a href="#faq" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Sign in
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">
              Install Free
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm mb-8">
          <Sparkles className="w-4 h-4" />
          <span>Now with AI switching and cloud sync</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-center mb-6">
          Your AI conversations,
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            organized and portable
          </span>
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Omni captures, organizes, and syncs all your conversations across ChatGPT, Claude, Gemini, and Grok.
          Switch AI models without losing context.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button className="flex items-center gap-2 px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg shadow-blue-500/25">
            <Chrome className="w-6 h-6" />
            Add to Chrome — Free
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-8 py-4 text-lg text-slate-300 hover:text-white transition-colors">
            <Play className="w-5 h-5" />
            Watch Demo
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-sm text-slate-500 ml-2">Omni - Your AI Workspace</span>
            </div>
            <div className="p-8 h-96 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
              <div className="text-slate-600">[ App Screenshot Placeholder ]</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: 'Scattered Conversations',
      description: 'Your AI chats are trapped in different platforms with no way to organize or search them.',
    },
    {
      icon: <Link2 className="w-8 h-8" />,
      title: 'Locked In',
      description: 'Can\'t easily switch between ChatGPT, Claude, Gemini, or Grok without losing context.',
    },
    {
      icon: <Cloud className="w-8 h-8" />,
      title: 'No Sync',
      description: 'Your work is stuck on one device. No backup, no sync across machines.',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            The AI conversation problem
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            You use multiple AI tools daily, but they don't talk to each other.
            Your context is lost every time you switch.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, i) => (
            <div
              key={i}
              className="p-8 bg-slate-800/50 border border-slate-700 rounded-2xl text-center"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
              <p className="text-slate-400">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              One workspace for all your AI conversations
            </h2>
            <p className="text-xl text-slate-400 mb-8">
              Omni automatically captures your conversations, organizes them by project,
              and lets you transfer context between AI models seamlessly.
            </p>

            <div className="space-y-4">
              {[
                'Capture from ChatGPT, Claude, Gemini, Grok',
                'Organize with projects and tags',
                'Transfer context between AI models',
                'Sync across all your devices',
                'Search everything instantly',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            <div className="text-slate-600">[ Solution Visualization ]</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Universal Capture',
      description: 'Automatically capture conversations from ChatGPT, Claude, Gemini, and Grok.',
    },
    {
      icon: <Link2 className="w-6 h-6" />,
      title: 'AI Switching',
      description: 'Transfer conversation context between AI models with one click.',
    },
    {
      icon: <FolderOpen className="w-6 h-6" />,
      title: 'Project Organization',
      description: 'Organize conversations into projects with tags and metadata.',
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: 'Universal Search',
      description: 'Search across all conversations, notes, and files instantly.',
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: 'Cloud Sync',
      description: 'Sync your workspace across all devices with encrypted cloud storage.',
    },
    {
      icon: <RefreshCw className="w-6 h-6" />,
      title: 'Auto Backup',
      description: 'Automatic backups with version history and easy restore.',
    },
    {
      icon: <Github className="w-6 h-6" />,
      title: 'Integrations',
      description: 'Connect GitHub, Google Drive, Notion, and more.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Privacy First',
      description: 'Your data stays yours. Local-first with optional cloud sync.',
    },
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need for AI productivity
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Omni gives you control over all your AI conversations in one powerful workspace.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors"
            >
              <div className="w-12 h-12 mb-4 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      title: 'Install Extension',
      description: 'Add Omni to Chrome. Takes 10 seconds.',
    },
    {
      step: '02',
      title: 'Browse AI Platforms',
      description: 'Use ChatGPT, Claude, Gemini, or Grok as normal.',
    },
    {
      step: '03',
      title: 'Auto Capture',
      description: 'Omni automatically saves your conversations.',
    },
    {
      step: '04',
      title: 'Switch & Transfer',
      description: 'Transfer context to any AI model instantly.',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How Omni works
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Get started in seconds. No configuration needed.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
                {step.step}
              </div>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute -right-4 top-8">
                  <ArrowRight className="w-6 h-6 text-slate-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportedModelsSection() {
  const models = [
    {
      name: 'ChatGPT',
      provider: 'OpenAI',
      models: ['GPT-4o', 'GPT-4 Turbo', 'GPT-3.5'],
      logo: <MessageSquare className="w-8 h-8" />,
    },
    {
      name: 'Claude',
      provider: 'Anthropic',
      models: ['Claude 4', 'Claude 3.5 Sonnet', 'Claude 3 Opus'],
      logo: <Sparkles className="w-8 h-8" />,
    },
    {
      name: 'Gemini',
      provider: 'Google',
      models: ['Gemini Pro', 'Gemini Ultra'],
      logo: <Globe className="w-8 h-8" />,
    },
    {
      name: 'Grok',
      provider: 'xAI',
      models: ['Grok-1.5', 'Grok-2'],
      logo: <Zap className="w-8 h-8" />,
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            All your favorite AI models
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Capture from any supported platform and switch between them seamlessly.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {models.map((model, i) => (
            <div
              key={i}
              className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300">
                {model.logo}
              </div>
              <h3 className="text-lg font-semibold mb-1">{model.name}</h3>
              <p className="text-sm text-slate-500 mb-3">{model.provider}</p>
              <div className="flex flex-wrap justify-center gap-1">
                {model.models.map((m, j) => (
                  <span
                    key={j}
                    className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  const integrations = [
    { name: 'GitHub', icon: <Github className="w-6 h-6" /> },
    { name: 'Google Drive', icon: <Globe className="w-6 h-6" /> },
    { name: 'Notion', icon: <FileText className="w-6 h-6" /> },
    { name: 'GitLab', icon: <GitBranch className="w-6 h-6" /> },
    { name: 'Linear', icon: <Zap className="w-6 h-6" /> },
    { name: 'Slack', icon: <MessageSquare className="w-6 h-6" /> },
  ];

  return (
    <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Connect your tools
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Sync your work across GitHub, Google Drive, Notion, and more.
          </p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {integrations.map((int, i) => (
            <div
              key={i}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center hover:border-slate-600 transition-colors"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
                {int.icon}
              </div>
              <span className="text-sm text-slate-400">{int.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  interval,
  onIntervalChange,
}: {
  interval: 'monthly' | 'yearly';
  onIntervalChange: (v: 'monthly' | 'yearly') => void;
}) {
  const plans = Object.values(PLAN_CONFIGS);

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Start free. Upgrade when you need more.
          </p>

          <div className="inline-flex items-center gap-4 p-1 bg-slate-800 rounded-lg">
            <button
              onClick={() => onIntervalChange('monthly')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                interval === 'monthly'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => onIntervalChange('yearly')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                interval === 'yearly'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yearly
              <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.slice(0, 3).map((plan) => (
            <div
              key={plan.tier}
              className={`relative p-6 rounded-2xl ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-blue-500/20 to-purple-500/20 border-2 border-blue-500'
                  : 'bg-slate-800/50 border border-slate-700'
              }`}
            >
              {plan.badges.length > 0 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-blue-500 text-xs font-medium text-white rounded-full">
                    {plan.badges[0]}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              <div className="text-center mb-6">
                <span className="text-4xl font-bold">
                  ${interval === 'yearly' ? plan.priceYearly : plan.priceMonthly}
                </span>
                <span className="text-slate-400">
                  /{interval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <PricingRow checked>{formatLimit(plan.limits.projects)} projects</PricingRow>
                <PricingRow checked>{formatLimit(plan.limits.captures)} captures</PricingRow>
                <PricingRow checked>{formatLimit(plan.limits.cloudStorageMb)}MB storage</PricingRow>
                <PricingRow checked={plan.features.cloudSync}>Cloud sync</PricingRow>
                <PricingRow checked={plan.features.backup}>Auto backup</PricingRow>
                <PricingRow checked={plan.features.advancedAi}>AI switching</PricingRow>
              </div>

              <button
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  plan.highlighted
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingRow({ children, checked }: { children: React.ReactNode; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-4 h-4 rounded flex items-center justify-center ${checked ? 'bg-green-500/20' : 'bg-slate-700'}`}>
        {checked && <Check className="w-3 h-3 text-green-400" />}
      </div>
      <span className={checked ? 'text-slate-300' : 'text-slate-500'}>{children}</span>
    </div>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by AI enthusiasts
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl"
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 mb-4">
                "Omni has completely changed how I work with AI. Being able to
                transfer context between models is a game changer."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700" />
                <div>
                  <p className="font-medium text-slate-200">User Name</p>
                  <p className="text-sm text-slate-500">Software Engineer</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'Is Omni free to use?',
      answer: 'Yes! Omni has a generous free tier with 3 projects, 100 captures, and 50MB storage. Upgrade for cloud sync, AI switching, and more.',
    },
    {
      question: 'Does Omni read my conversations?',
      answer: 'No. Omni captures conversations locally in your browser. We never see or store your conversation content on our servers. Your data stays yours.',
    },
    {
      question: 'How does AI switching work?',
      answer: 'Omni extracts the context from your current conversation and reformats it for the target AI model. You can switch from ChatGPT to Claude, or any other supported model, while preserving the conversation context.',
    },
    {
      question: 'Can I use Omni on multiple devices?',
      answer: 'Yes! With Pro and higher plans, your workspace syncs across all your devices. Everything is encrypted in transit and at rest.',
    },
    {
      question: 'Which AI platforms are supported?',
      answer: 'Currently: ChatGPT, Claude, Gemini, and Grok. We\'re working on adding more platforms.',
    },
    {
      question: 'Does Omni work offline?',
      answer: 'Core features work offline. Conversations are captured locally first, then synced when you\'re back online.',
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium text-slate-200">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4">
                  <p className="text-slate-400">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoadmapSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What's coming next
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            We're building the future of AI productivity.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <RoadmapItem
            status="in-progress"
            title="Team Workspaces"
            description="Collaborate with your team on AI projects."
          />
          <RoadmapItem
            status="planned"
            title="API Access"
            description="Build on top of Omni with our API."
          />
          <RoadmapItem
            status="planned"
            title="More Integrations"
            description="Jira, Asana, Linear, and more connectors."
          />
        </div>
      </div>
    </section>
  );
}

function RoadmapItem({
  status,
  title,
  description,
}: {
  status: 'in-progress' | 'planned' | 'released';
  title: string;
  description: string;
}) {
  const statusColors = {
    'in-progress': 'bg-blue-500/20 text-blue-400',
    planned: 'bg-slate-700 text-slate-400',
    released: 'bg-green-500/20 text-green-400',
  };

  const statusLabels = {
    'in-progress': 'In Progress',
    planned: 'Planned',
    released: 'Released',
  };

  return (
    <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
      <span className={`text-xs px-2 py-1 rounded ${statusColors[status]}`}>
        {statusLabels[status]}
      </span>
      <h3 className="text-lg font-semibold mt-4 mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

function SecuritySection() {
  const features = [
    { icon: <Shield className="w-6 h-6" />, title: 'Local-first', description: 'Data stored locally by default' },
    { icon: <Cloud className="w-6 h-6" />, title: 'E2E Encryption', description: 'All sync data encrypted' },
    { icon: <Users className="w-6 h-6" />, title: 'No tracking', description: 'We don\'t sell your data' },
    { icon: <Clock className="w-6 h-6" />, title: 'GDPR compliant', description: 'Delete anytime' },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your privacy comes first
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Omni is designed with privacy as a core principle, not an afterthought.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                {feature.icon}
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="p-12 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to organize your AI conversations?
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Start free today. No credit card required.
          </p>
          <button className="inline-flex items-center gap-2 px-8 py-4 text-lg font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors">
            <Chrome className="w-6 h-6" />
            Add to Chrome — Free
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const links = {
    Product: ['Features', 'Pricing', 'Integrations', 'Changelog', 'Roadmap'],
    Resources: ['Documentation', 'Blog', 'Support', 'API'],
    Company: ['About', 'Privacy', 'Terms', 'Contact'],
  };

  return (
    <footer className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Omni</span>
            </div>
            <p className="text-sm text-slate-400 max-w-xs">
              Your AI conversations, organized and portable. One workspace for ChatGPT, Claude, Gemini, and Grok.
            </p>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © 2024 Omni. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
              <Globe className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
