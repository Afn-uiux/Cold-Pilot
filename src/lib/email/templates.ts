// Email templates metadata (no fs — used in both server and client contexts)

export interface EmailTemplate {
  id: string;
  subject: string;
  category: string;
  filename: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // Auth & Account
  { id: "welcome", subject: "Welcome to Coldpilot", category: "Auth & Account", filename: "auth-welcome.html" },
  { id: "email-verification", subject: "Verify your email address", category: "Auth & Account", filename: "auth-email-verification.html" },
  { id: "password-reset", subject: "Reset your password", category: "Auth & Account", filename: "auth-password-reset.html" },
  { id: "password-changed", subject: "Your password was changed", category: "Auth & Account", filename: "auth-password-changed.html" },

  // Billing
  { id: "trial-started", subject: "Your trial has started", category: "Billing", filename: "billing-trial-started.html" },
  { id: "trial-expiring-3", subject: "Your trial ends in 3 days", category: "Billing", filename: "billing-trial-expiring-3.html" },
  { id: "trial-expiring-1", subject: "Your trial ends tomorrow", category: "Billing", filename: "billing-trial-expiring-1.html" },
  { id: "trial-ended", subject: "Your trial has ended", category: "Billing", filename: "billing-trial-ended.html" },
  { id: "plan-expiring-3", subject: "Your plan ends in 3 days", category: "Billing", filename: "billing-plan-expiring-3.html" },
  { id: "plan-expiring-1", subject: "Your plan ends tomorrow", category: "Billing", filename: "billing-plan-expiring-1.html" },
  { id: "plan-ended", subject: "Your plan has ended — renew to keep access", category: "Billing", filename: "billing-plan-ended.html" },
  { id: "payment-succeeded", subject: "Payment confirmed", category: "Billing", filename: "billing-payment-succeeded.html" },
  { id: "payment-failed", subject: "Payment failed — action needed", category: "Billing", filename: "billing-payment-failed.html" },
  { id: "subscription-cancelled", subject: "Subscription cancelled", category: "Billing", filename: "billing-subscription-cancelled.html" },
  { id: "plan-changed", subject: "Plan updated", category: "Billing", filename: "billing-plan-changed.html" },
  { id: "card-expiring", subject: "Your card is expiring soon", category: "Billing", filename: "billing-card-expiring.html" },

  // Campaign Activity
  { id: "campaign-launched", subject: "Campaign launched", category: "Campaign Activity", filename: "campaign-launched.html" },
  { id: "campaign-paused", subject: "Campaign paused", category: "Campaign Activity", filename: "campaign-paused.html" },
  { id: "campaign-completed", subject: "Campaign completed", category: "Campaign Activity", filename: "campaign-completed.html" },
  { id: "account-disconnected", subject: "Email account disconnected", category: "Campaign Activity", filename: "campaign-disconnected.html" },
  { id: "bounce-rate-alert", subject: "High bounce rate detected", category: "Campaign Activity", filename: "campaign-bounce-alert.html" },

  // Digests
  { id: "weekly-digest", subject: "Your weekly report", category: "Digests", filename: "digest-weekly.html" },
  { id: "monthly-summary", subject: "Your monthly summary", category: "Digests", filename: "digest-monthly.html" },

  // Warmup
  { id: "warmup-health-dropped", subject: "Warmup health warning", category: "Warmup", filename: "warmup-health-dropped.html" },

  // Limits
  { id: "approaching-limit", subject: "Approaching your sending limit", category: "Limits", filename: "limits-approaching.html" },
  { id: "domain-reputation-warning", subject: "Domain reputation warning", category: "Limits", filename: "limits-domain-reputation.html" },

  // Onboarding
  { id: "onboarding-connect-account", subject: "Connect your first email account", category: "Onboarding", filename: "onboarding-connect-account.html" },
  { id: "onboarding-create-campaign", subject: "Create your first campaign", category: "Onboarding", filename: "onboarding-create-campaign.html" },
  { id: "onboarding-import-leads", subject: "Import your first leads", category: "Onboarding", filename: "onboarding-import-leads.html" },

  // Re-engagement
  { id: "we-miss-you", subject: "We miss you", category: "Re-engagement", filename: "reengagement-we-miss-you.html" },

  // Waitlist
  { id: "waitlist-notify", subject: "New waitlist signup", category: "Waitlist", filename: "waitlist-notify.html" },

  // Support
  { id: "support-chat-escalation", subject: "Support chat needs a human", category: "Support", filename: "support-chat-escalation.html" },
];

export type EmailTemplateId = (typeof EMAIL_TEMPLATES)[number]["id"];

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id);
}
