"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function TrialBanner() {
  const [trial, setTrial] = useState<{ active: boolean; expired: boolean; daysLeft: number; endsAt: string | null } | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/user")
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setBillingEnabled(data.billingEnabled !== false);
        if (data.trial) setTrial(data.trial);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const upgradeCta = billingEnabled ? (
    <Link href="/dashboard/settings?tab=Billing" className="btn btn-primary btn-sm">Upgrade now</Link>
  ) : null;

  if (!trial) return null;

  if (trial.expired) {
    return (
      <div className="mb-6 rounded-lg border border-blue-accent/30 bg-blue-accent/5 px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">Your 14-day trial has ended</p>
            <p className="text-xs text-muted mt-0.5">Your data is safe and still visible — upgrade to keep sending, importing, verifying, and using AI.</p>
          </div>
          {upgradeCta}
        </div>
      </div>
    );
  }

  if (trial.endsAt && trial.daysLeft <= 3) {
    return (
      <div className="mb-6 rounded-lg border border-amber-300/50 bg-amber-50 px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">{trial.daysLeft === 0 ? "Last day of your trial" : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left in your trial`}</p>
            <p className="text-xs text-muted mt-0.5">After day 14 you&apos;ll be able to view your data but not use the service.</p>
          </div>
          {upgradeCta}
        </div>
      </div>
    );
  }

  return null;
}
