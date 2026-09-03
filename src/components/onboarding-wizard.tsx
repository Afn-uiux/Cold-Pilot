"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Logo from "@/components/logo";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";
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
import { Shield02Icon } from "@/components/icons/shield-02";
import { FlameIcon } from "@/components/icons/flame";
import { SparklesIcon } from "@/components/icons/sparkles";
import { Target01Icon } from "@/components/icons/target-01";

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
  { label: "Email verification", icon: "shield" },
  { label: "Campaign management", icon: "compass" },
  { label: "Email analytics", icon: "trend" },
  { label: "AI-powered sequences", icon: "bolt" },
  { label: "Warmup & deliverability", icon: "flame" },
  { label: "Unified Coldbox", icon: "envelope" },
];

const PROGRESS = [
  { width: "15%", credits: "150 of 1,000 credits", sub: "Complete setup to unlock all 1,000 free credits." },
  { width: "30%", credits: "300 of 1,000 credits", sub: "+150 credits unlocked. Keep going." },
  { width: "50%", credits: "500 of 1,000 credits", sub: "+200 credits unlocked. Keep going." },
  { width: "70%", credits: "700 of 1,000 credits", sub: "Last step — 300 credits still to unlock." },
  { width: "100%", credits: "1,000 of 1,000 credits", sub: "1,000 free Coldpilot credits unlocked" },
];

// The animated-icons skill pattern: every glyph is a motion icon exposing an
// AnimatedIconHandle via ref, and IconTarget fires its draw animation when the
// surrounding content is hovered/clicked. AnimatedIcon forwards the ref so
// IconTarget can attach to the real icon through the name map.
const ICON_COMPONENTS = {
  bolt: FlashIcon,
  smile: SmileIcon,
  search: Search01Icon,
  "paper-plane": SentIcon,
  user: UserGroupIcon,
  envelope: Mail01Icon,
  eye: EyeIcon,
  check: CircleCheckIcon,
  chart: GridViewIcon,
  compass: CompassIcon,
  trend: TrendUpIcon,
  shield: Shield02Icon,
  flame: FlameIcon,
  sparkles: SparklesIcon,
  target: Target01Icon,
} as const;

const AnimatedIcon = forwardRef<AnimatedIconHandle, { name: string; size?: number }>(
  function AnimatedIcon({ name, size = 16 }, ref) {
    const Cmp = ICON_COMPONENTS[name as keyof typeof ICON_COMPONENTS];
    if (!Cmp) return null;
    return <Cmp ref={ref} size={size} />;
  },
);

function useIconTrigger() {
  const ref = useRef<AnimatedIconHandle>(null);
  return { triggerRef: ref, trigger: () => ref.current?.startAnimation() };
}

function GoalPill({ label, icon, selected, onToggle }: { label: string; icon: string; selected: boolean; onToggle: () => void }) {
  const { triggerRef, trigger } = useIconTrigger();
  return (
    <button
      onClick={(e) => { trigger(); onToggle(); }}
      onMouseEnter={trigger}
      className={`px-4 py-2 border rounded-full text-sm transition-colors inline-flex items-center gap-2 ${
        selected
          ? "border-blue-accent bg-blue-light text-blue-accent"
          : "border-border text-muted hover:bg-cream"
      }`}
    >
      <IconTarget triggerRef={triggerRef} className="inline-flex items-center">
        <AnimatedIcon name={icon} size={16} />
      </IconTarget>
      {label}
    </button>
  );
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const { triggerRef, trigger } = useIconTrigger();
  return (
    <div
      className="flex items-start gap-4 p-4 border border-border rounded-lg bg-white hover:shadow-sm transition cursor-default"
      onMouseEnter={trigger}
      onClick={trigger}
    >
      <div className="w-10 h-10 bg-blue-accent rounded-lg flex items-center justify-center text-white shrink-0">
        <IconTarget triggerRef={triggerRef}>
          <AnimatedIcon name={icon} size={24} />
        </IconTarget>
      </div>
      <div>
        <h4 className="font-semibold text-ink text-sm">{title}</h4>
        <p className="text-xs text-muted mt-1">{desc}</p>
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();

  useEffect(() => {
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
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, website, goals }),
    }).catch(() => {});
    setTimeout(() => {
      setClosing(true);
    }, 200);
    setTimeout(() => {
      setNavigating(true);
      router.push("/dashboard");
      router.refresh();
    }, 3000);
  }

  function toggleGoal(g: string) {
    setGoals((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) return prev;
      return [...prev, g];
    });
  }

  if (navigating) return null;

  const progress = PROGRESS[step - 1];
  const btn1Disabled = !source;

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loading"
          className="fixed inset-0 z-50 bg-cream"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      ) : !show ? null : closing ? (
        <motion.div
          key="checkmark"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Confetti particles */}
          {[
            { color: "#3B82F6", x: -120, y: -140, r: 45, d: 0.6 },
            { color: "#F59E0B", x: 100, y: -120, r: 30, d: 0.7 },
            { color: "#10B981", x: -80, y: 100, r: 60, d: 0.5 },
            { color: "#EF4444", x: 130, y: 80, r: 40, d: 0.65 },
            { color: "#8B5CF6", x: -140, y: -40, r: 35, d: 0.55 },
            { color: "#EC4899", x: 60, y: -160, r: 25, d: 0.75 },
            { color: "#3B82F6", x: 150, y: -20, r: 30, d: 0.6 },
            { color: "#F59E0B", x: -50, y: 140, r: 20, d: 0.7 },
            { color: "#10B981", x: 110, y: 130, r: 28, d: 0.58 },
            { color: "#EF4444", x: -130, y: 60, r: 22, d: 0.68 },
            { color: "#8B5CF6", x: 40, y: -100, r: 18, d: 0.72 },
            { color: "#EC4899", x: -100, y: -80, r: 32, d: 0.53 },
          ].map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{ width: p.r, height: p.r, backgroundColor: p.color }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0, 1.2, 0.8],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.2, delay: p.d, ease: "easeOut" }}
            />
          ))}

          {/* Checkmark circle */}
          <motion.div
            className="w-24 h-24 bg-blue-accent rounded-full flex items-center justify-center relative z-10"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <motion.path
                d="M5 12l5 5L20 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
              />
            </svg>
          </motion.div>

          <motion.p
            className="mt-8 text-ink font-semibold text-xl relative z-10"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
          >
            You&apos;re all set!
          </motion.p>
          <motion.p
            className="mt-2 text-muted text-sm relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.3 }}
          >
            Taking you to your dashboard...
          </motion.p>
        </motion.div>
      ) : (
        <motion.div
          key="wizard"
          className="fixed inset-0 z-50 flex flex-col bg-cream overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Navbar */}
          <nav className="bg-white border-b border-border py-4 px-6 md:px-12 flex items-center">
            <div className="flex items-center gap-2 text-blue-accent font-semibold text-lg">
              <IconTarget className="inline-flex items-center">
                <AnimatedIcon name="bolt" size={18} />
              </IconTarget>
              <Logo height={18} />
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
                <IconTarget className="text-blue-accent" aria-hidden>
                  <AnimatedIcon name="smile" size={64} />
                </IconTarget>
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
                <IconTarget className="text-blue-accent" aria-hidden>
                  <AnimatedIcon name="sparkles" size={64} />
                </IconTarget>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-2">Hey there, I&apos;m Coldpilot AI</h2>
              <p className="text-muted mb-8 text-sm max-w-lg mx-auto">
                I&apos;m your AI sales assistant for finding leads, crafting campaigns, and closing deals faster. Here is what I can help you with:
              </p>
              <div className="space-y-4 mb-8 text-left max-w-xl mx-auto">
                {[
                  { icon: "search", title: "Import & Verify Contacts", desc: "Upload your contact lists and verify emails before sending to protect your deliverability." },
                  { icon: "bolt", title: "AI-powered Sequences", desc: "Let AI write, optimize, and personalize your email sequences for maximum response rates." },
                  { icon: "trend", title: "Track & Optimize", desc: "Monitor opens, clicks, and replies in real time. Get insights to improve performance." },
                ].map((f) => (
                  <FeatureRow key={f.title} icon={f.icon} title={f.title} desc={f.desc} />
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
                <IconTarget className="text-blue-accent" aria-hidden>
                  <AnimatedIcon name="search" size={64} />
                </IconTarget>
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
                <IconTarget className="text-blue-accent" aria-hidden>
                  <AnimatedIcon name="target" size={64} />
                </IconTarget>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-1">What are you looking to accomplish?</h2>
              <p className="text-muted mb-8 text-sm">Pick up to three.</p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {GOALS.map((g) => (
                  <GoalPill
                    key={g.label}
                    label={g.label}
                    icon={g.icon}
                    selected={goals.includes(g.label)}
                    onToggle={() => toggleGoal(g.label)}
                  />
                ))}
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

          {/* Step 5 — all set */}
          {step === 5 && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <IconTarget className="text-blue-accent" aria-hidden>
                  <AnimatedIcon name="check" size={64} />
                </IconTarget>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-ink mb-2">You&apos;re all set!</h2>
              <p className="text-muted mb-8 text-sm max-w-md mx-auto">
                You&apos;ve unlocked <span className="font-semibold text-ink">1,000 free credits</span>.
              </p>
              <button onClick={complete} disabled={completing} className="btn btn-primary hover:bg-blue-accent-hover w-full md:w-64 mt-8">
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Skip */}
          {step < 5 && (
            <div className="mt-6 text-center">
              <button
                onClick={nextStep}
                className="text-xs text-muted hover:text-blue-accent transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </main>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
