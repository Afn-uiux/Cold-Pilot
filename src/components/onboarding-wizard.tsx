"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FlashIcon } from "@/components/icons/flash";
import { SmileIcon } from "@/components/icons/smile";
import { Search01Icon } from "@/components/icons/search-01";
import { SentIcon } from "@/components/icons/sent";
import { UserGroupIcon } from "@/components/icons/user-group";
import { Mail01Icon } from "@/components/icons/mail-01";
import { EyeIcon } from "@/components/icons/eye";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { GridViewIcon } from "@/components/icons/grid-view";
import { CompassIcon } from "@/components/icons/compass";
import { TrendUpIcon } from "@/components/icons/trend-up";
import { DotIcon } from "@/components/icons/dot";

const SOURCES = [
  "YouTube",
  "ChatGPT / AI",
  "Instagram",
  "Reddit",
  "Email",
  "G2 / Review Site",
  "Blog / Article",
  "X",
  "Prefer Not to Say",
  "Google",
  "TikTok",
  "Facebook",
  "Through a Friend",
  "LinkedIn",
  "Podcast",
  "Other",
];

const GOALS = [
  { label: "Cold email outreach", icon: "paper-plane" },
  { label: "Lead generation", icon: "user" },
  { label: "Campaign management", icon: "compass" },
  { label: "Email analytics", icon: "chart" },
  { label: "AI agents", icon: "bolt" },
  { label: "Automation", icon: "trend" },
  { label: "Unified Inbox", icon: "envelope" },
];

const CHECKLIST = [
  "Reading your website",
  "Understanding what you sell",
  "Building your ideal customer profile",
  "Scanning your competitors",
  "Finding the angles that get replies",
  "Drafting your outreach playbook",
  "Briefing your AI copilot",
];

const PROGRESS = [
  { width: "15%", credits: "150 of 1,000 credits", sub: "Complete setup to unlock all 1,000 free credits." },
  { width: "30%", credits: "300 of 1,000 credits", sub: "+150 credits unlocked. Keep going." },
  { width: "50%", credits: "500 of 1,000 credits", sub: "+200 credits unlocked. Keep going." },
  { width: "70%", credits: "700 of 1,000 credits", sub: "Last step — 300 credits still to unlock." },
  { width: "100%", credits: "1,000 of 1,000 credits", sub: "1,000 free Coldpilot credits unlocked" },
];

function Icon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "bolt":
      return <FlashIcon size={16} className={className} />;
    case "smile":
      return <SmileIcon size={16} className={className} />;
    case "search":
      return <Search01Icon size={16} className={className} />;
    case "paper-plane":
      return <SentIcon size={16} className={className} />;
    case "user":
      return <UserGroupIcon size={16} className={className} />;
    case "envelope":
      return <Mail01Icon size={16} className={className} />;
    case "eye":
      return <EyeIcon size={16} className={className} />;
    case "check":
      return <CircleCheckIcon size={16} className={className} />;
    case "chart":
      return <GridViewIcon size={16} className={className} />;
    case "compass":
      return <CompassIcon size={16} className={className} />;
    case "trend":
      return <TrendUpIcon size={16} className={className} />;
    case "dot":
      return <DotIcon size={16} className={className} />;
    case "spinner":
      return <svg className={`animate-spin ${className || ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
    default:
      return null;
  }
}

export default function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const router = useRouter();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timersRef = timers.current;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => {
        if (!d.completed) {
          if (d.website) setWebsite(d.website);
          if (Array.isArray(d.goals)) setGoals(d.goals.slice(0, 3));
          setShow(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => timersRef.forEach(clearTimeout);
  }, []);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextStep() {
    setStep((s) => s + 1);
    scrollTop();
  }

  async function complete() {
    if (completing) return;
    setCompleting(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, website, goals }),
      });
    } catch {}
    setShow(false);
    router.push("/dashboard");
    router.refresh();
  }

  function toggleGoal(g: string) {
    setGoals((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) return prev;
      return [...prev, g];
    });
  }

  // "Analyzing" step auto-advances through the checklist, then completes.
  useEffect(() => {
    const timersRef = timers.current;
    if (step !== 5) return;
    if (analyzingStep < CHECKLIST.length) {
      const t = setTimeout(() => setAnalyzingStep((s) => s + 1), analyzingStep === 0 ? 500 : 360);
      timersRef.push(t);
      return;
    }
    const t = setTimeout(complete, 700);
    timersRef.push(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, analyzingStep]);

  if (loading || !show) return null;

  const progress = PROGRESS[step - 1];
  const websiteDomain = website.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "") || "your site";
  const btn1Disabled = !source;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream overflow-y-auto">
      {/* Navbar */}
      <nav className="bg-white border-b border-border py-4 px-6 md:px-12 flex items-center">
        <div className="flex items-center gap-2 text-blue-accent font-semibold text-lg">
          <Icon name="bolt" className="w-5 h-5" />
          <span>Coldpilot</span>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-grow flex items-start md:items-center justify-center p-4 md:p-6 py-8">
        <div className="w-full max-w-3xl bg-white p-6 md:p-12 rounded-xl shadow-sm border border-border relative">
          {/* Progress header */}
          <div className="mb-8 md:mb-10">
            <div className="flex justify-between items-center mb-2 text-sm font-semibold text-ink">
              <span>{progress.credits}</span>
              <span>Step {Math.min(step, 4)} of 4</span>
            </div>
            <div className="w-full bg-blue-light h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-accent h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: progress.width }}
              />
            </div>
            <div className="mt-2 text-xs text-muted font-medium">{progress.sub}</div>
          </div>

          {/* Step 1 — how did you find us */}
          {step === 1 && (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-blue-light rounded-full flex items-center justify-center text-blue-accent">
                  <Icon name="smile" className="w-7 h-7" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-8">How Did You Find Us?</h2>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {SOURCES.map((opt) => {
                  const selected = source === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setSource(opt)}
                      className={`px-4 py-2 border rounded-full text-sm transition-colors ${
                        selected
                          ? "border-blue-accent bg-blue-light text-blue-accent"
                          : "border-border text-muted hover:bg-cream"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={nextStep}
                disabled={btn1Disabled}
                className={`btn w-full md:w-64 ${btn1Disabled ? "bg-muted-2 text-white cursor-not-allowed opacity-50" : "btn-primary hover:bg-blue-accent-hover"}`}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2 — Coldpilot AI intro */}
          {step === 2 && (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-14 h-14 bg-blue-light rounded-xl flex items-center justify-center text-blue-accent border border-blue-accent/20">
                  <Icon name="eye" className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-2">Hey there, I&apos;m Coldpilot AI</h2>
              <p className="text-muted mb-8 text-sm max-w-lg mx-auto">
                I&apos;m your AI sales assistant for finding leads, crafting campaigns, and closing deals faster. Here is what I can help you with:
              </p>
              <div className="space-y-4 mb-8 text-left max-w-xl mx-auto">
                {[
                  { icon: "search", color: "bg-blue-accent", title: "Find & Engage Leads", desc: "Import and verify contacts, then reach out with personalized campaigns at scale." },
                  { icon: "bolt", color: "bg-blue-accent", title: "AI-powered Sequences", desc: "Let AI write, optimize, and personalize your email sequences for maximum response rates." },
                  { icon: "chart", color: "bg-blue-accent", title: "Track & Optimize", desc: "Monitor opens, clicks, and replies in real time. Get insights to improve performance." },
                ].map((f) => (
                  <div key={f.title} className="flex items-start gap-4 p-4 border border-border rounded-lg bg-white hover:shadow-sm transition cursor-default">
                    <div className={`w-10 h-10 ${f.color} rounded-lg flex items-center justify-center text-white shrink-0`}>
                      <Icon name={f.icon} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink text-sm">{f.title}</h4>
                      <p className="text-xs text-muted mt-1">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={nextStep} className="btn btn-primary hover:bg-blue-accent-hover w-full md:w-64">
                Get started
              </button>
            </div>
          )}

          {/* Step 3 — company website */}
          {step === 3 && (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-14 h-14 bg-blue-light rounded-xl flex items-center justify-center text-blue-accent border border-blue-accent/20">
                  <Icon name="eye" className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-2">What&apos;s your company website?</h2>
              <p className="text-muted mb-8 text-sm">This helps me personalize your outreach</p>
              <div className="mb-8 text-left max-w-lg mx-auto">
                <label htmlFor="website" className="block text-sm font-semibold text-ink mb-2">URL</label>
                <input
                  type="text"
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-accent/40 focus:border-blue-accent text-ink"
                />
              </div>
              <button onClick={nextStep} className="btn btn-primary hover:bg-blue-accent-hover w-full md:w-64">
                Continue
              </button>
            </div>
          )}

          {/* Step 4 — goals */}
          {step === 4 && (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-14 h-14 bg-blue-light rounded-xl flex items-center justify-center text-blue-accent border border-blue-accent/20">
                  <Icon name="eye" className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-1">What are you looking to accomplish?</h2>
              <p className="text-muted mb-8 text-sm">Pick up to three.</p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {GOALS.map((g) => {
                  const selected = goals.includes(g.label);
                  return (
                    <button
                      key={g.label}
                      onClick={() => toggleGoal(g.label)}
                      className={`px-4 py-2 border rounded-full text-sm transition-colors inline-flex items-center gap-2 ${
                        selected
                          ? "border-blue-accent bg-blue-light text-blue-accent"
                          : "border-border text-muted hover:bg-cream"
                      }`}
                    >
                      <Icon name={g.icon} />
                      {g.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={nextStep}
                disabled={goals.length === 0}
                className={`btn w-full md:w-64 ${goals.length === 0 ? "bg-muted-2 text-white cursor-not-allowed opacity-50" : "btn-primary hover:bg-blue-accent-hover"}`}
              >
                Let&apos;s go
              </button>
            </div>
          )}

          {/* Step 5 — analyzing */}
          {step === 5 && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <Icon name="spinner" className="w-14 h-14 text-blue-accent" />
              </div>
              <h2 className="text-2xl font-semibold text-ink mb-2">Analyzing {websiteDomain}</h2>
              <p className="text-muted mb-8 text-sm max-w-md mx-auto">
                Your copilot is reading your site and sizing up your market. We&apos;ll drop you straight into it the moment it&apos;s ready.
              </p>
              <div className="text-left max-w-md mx-auto bg-cream/60 p-6 rounded-xl border border-border">
                {CHECKLIST.map((item, i) => {
                  const done = i < analyzingStep;
                  const active = i === analyzingStep;
                  return (
                    <div
                      key={item}
                      className={`flex items-center gap-3 mb-3 text-sm ${
                        done ? "text-muted" : active ? "text-blue-accent font-medium" : "text-muted-2"
                      }`}
                    >
                      <Icon name={done ? "check" : "dot"} className="text-blue-accent" />
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skip */}
          {step < 5 && (
            <div className="mt-6 text-center">
              <button
                onClick={complete}
                disabled={completing}
                className="text-xs text-muted hover:text-blue-accent transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
