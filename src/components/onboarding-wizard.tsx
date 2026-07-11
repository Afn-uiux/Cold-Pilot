"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then(d => { setShow(!d.completed); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function complete() {
    await fetch("/api/onboarding", { method: "POST" });
    setShow(false);
  }

  if (loading || !show) return null;

  const steps = [
    {
      title: "Connect an Email Account",
      desc: "Add your first sending mailbox so coldpilot can send emails on your behalf.",
      action: () => { router.push("/dashboard/email-accounts"); complete(); },
      btn: "Connect Account",
    },
    {
      title: "Import Leads",
      desc: "Upload a CSV or paste emails to build your contact list.",
      action: () => { router.push("/dashboard/leads"); complete(); },
      btn: "Import Leads",
    },
    {
      title: "Create Your First Campaign",
      desc: "Build a multi-step sequence and start reaching out.",
      action: () => { router.push("/dashboard/campaigns/new"); complete(); },
      btn: "Create Campaign",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl mx-4">
        <div className="flex items-center gap-1 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-blue-accent" : "bg-gray-200"}`} />
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-2">{steps[step].title}</h2>
        <p className="text-sm text-muted mb-6">{steps[step].desc}</p>

        <div className="flex justify-between items-center">
          <button
            onClick={() => { complete(); }}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-cream transition-colors">
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Next
              </button>
            ) : (
              <button onClick={() => { complete(); }} className="bg-blue-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
