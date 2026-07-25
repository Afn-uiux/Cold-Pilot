const BRAND = {
  ink: "#0F1929",
  muted: "#5A6B87",
  light: "#8A9BB5",
  bg: "#F8FAFC",
  border: "#E8E5E0",
  white: "#FFFFFF",
  blue: "#2563EB",
  green: "#16A34A",
  red: "#DC2626",
  orange: "#F59E0B",
};

function wrap(title: string, previewText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Geist',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Logo -->
<tr><td style="padding-bottom:32px;">
  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldpilot.io'}" style="text-decoration:none;font-size:20px;font-weight:500;color:${BRAND.ink};letter-spacing:-0.01em;font-family:'Geist',system-ui,sans-serif;">Coldpilot</a>
</td></tr>

<!-- Card -->
<tr><td style="background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;padding:40px 36px;">
${bodyHtml}
</td></tr>

<!-- Footer -->
<tr><td style="padding:28px 0;text-align:center;">
  <p style="margin:0;font-size:12px;color:${BRAND.light};line-height:1.6;">
    Coldpilot — Cold email that lands in the inbox.<br/>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldpilot.io'}/dashboard/settings" style="color:${BRAND.light};text-decoration:underline;">Email preferences</a> &middot;
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldpilot.io'}/legal/unsubscribe" style="color:${BRAND.light};text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string, primary = true): string {
  const bg = primary ? BRAND.ink : BRAND.white;
  const color = primary ? BRAND.white : BRAND.ink;
  const border = primary ? "" : `border:1px solid ${BRAND.border};`;
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:500;color:${color};background:${bg};border-radius:8px;text-decoration:none;font-family:'Geist',system-ui,sans-serif;${border}">${label}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />`;
}

function para(text: string, opts?: { size?: string; color?: string; mt?: string; mb?: string }): string {
  const size = opts?.size || "15";
  const color = opts?.color || BRAND.muted;
  const mt = opts?.mt || "0";
  const mb = opts?.mb || "16";
  return `<p style="margin:${mt} 0 ${mb} 0;font-size:${size}px;color:${color};line-height:1.7;">${text}</p>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px 0;font-size:28px;font-weight:400;letter-spacing:-0.02em;color:${BRAND.ink};line-height:1.2;font-family:'Geist',system-ui,sans-serif;">${text}</h1>`;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 16px 0;font-size:18px;font-weight:500;color:${BRAND.ink};font-family:'Geist',system-ui,sans-serif;">${text}</h2>`;
}

function statBlock(label: string, value: string, color?: string): string {
  return `<td style="text-align:center;padding:12px 16px;">
    <div style="font-size:28px;font-weight:400;color:${color || BRAND.ink};font-family:'Geist',system-ui,sans-serif;">${value}</div>
    <div style="font-size:12px;color:${BRAND.light};margin-top:4px;">${label}</div>
  </td>`;
}

// ─── Templates ──────────────────────────────────────────────

export const emailTemplates: Record<string, { subject: string; category: string; html: (p: any) => string }> = {

  // ── Auth & Account ──

  "welcome": {
    subject: "Welcome to Coldpilot",
    category: "Auth & Account",
    html: (p: { name?: string }) => wrap("Welcome to Coldpilot", "Your cold email engine is ready.", `
      ${h1(`Hey${p.name ? " " + p.name : ""}`)}
      ${para("Welcome to Coldpilot. Your account is set up and ready to go.")}
      ${para("Here's what you can do right now:")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        <tr><td style="padding:10px 0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
          <span style="color:${BRAND.ink};font-weight:500;">1.</span>&nbsp; Connect your first email account<br/>
          <span style="color:${BRAND.ink};font-weight:500;">2.</span>&nbsp; Import a list of leads<br/>
          <span style="color:${BRAND.ink};font-weight:500;">3.</span>&nbsp; Create and launch a campaign
        </td></tr>
      </table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard`, "Go to Dashboard")}
    `),
  },

  "email-verification": {
    subject: "Verify your email address",
    category: "Auth & Account",
    html: (p: { name?: string; token: string }) => wrap("Verify your email", "Confirm your email to get started.", `
      ${h1("Confirm your email")}
      ${para(`Hey${p.name ? " " + p.name : ""}, click the button below to verify your email address.`)}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/auth/verify?token=${p.token}`, "Verify Email")}
      ${para("This link expires in 24 hours.", { size: "13", color: BRAND.light, mt: "16" })}
      ${para("If you didn't create an account, you can safely ignore this email.", { size: "13", color: BRAND.light })}
    `),
  },

  "password-reset": {
    subject: "Reset your password",
    category: "Auth & Account",
    html: (p: { name?: string; token: string }) => wrap("Reset your password", "You requested a password reset.", `
      ${h1("Reset your password")}
      ${para(`Hey${p.name ? " " + p.name : ""}, we received a request to reset your password.`)}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/auth/reset?token=${p.token}`, "Reset Password")}
      ${para("This link expires in 1 hour.", { size: "13", color: BRAND.light, mt: "16" })}
      ${para("If you didn't request this, you can safely ignore this email. Your password won't change.", { size: "13", color: BRAND.light })}
    `),
  },

  "password-changed": {
    subject: "Your password was changed",
    category: "Auth & Account",
    html: (p: { name?: string }) => wrap("Password changed", "Your password was updated successfully.", `
      ${h1("Password updated")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your password was successfully changed.`)}
      ${para("If you didn't make this change, contact us immediately at hello@coldpilot.io.", { size: "13", color: BRAND.red })}
      ${divider()}
      ${para("For your security, we recommend enabling two-factor authentication in your settings.", { size: "13" })}
    `),
  },

  // ── Billing ──

  "trial-started": {
    subject: "Your trial has started",
    category: "Billing",
    html: (p: { name?: string; days?: number }) => wrap("Trial started", "Your free trial is now active.", `
      ${h1(`Hey${p.name ? " " + p.name : ""}`)}
      ${para(`Your ${p.days || 14}-day free trial is now active. You have full access to every feature.`)}
      ${para("No credit card required. Trial ends automatically.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard`, "Start Sending")}
    `),
  },

  "trial-expiring-3": {
    subject: "Your trial ends in 3 days",
    category: "Billing",
    html: (p: { name?: string; date?: string }) => wrap("Trial expiring", "Your trial ends in 3 days.", `
      ${h1("Trial ending soon")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your free trial ends in 3 days${p.date ? ` on ${p.date}` : ""}.`)}
      ${para("Upgrade now to keep your campaigns running without interruption.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Upgrade Now")}
      ${divider()}
      ${para("After your trial ends, your campaigns will be paused and leads will be preserved.", { size: "13" })}
    `),
  },

  "trial-expiring-1": {
    subject: "Your trial ends tomorrow",
    category: "Billing",
    html: (p: { name?: string }) => wrap("Trial ending tomorrow", "Your trial ends tomorrow.", `
      ${h1("Last day of your trial")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your free trial ends tomorrow. After that, your campaigns will be paused.`)}
      ${para("Upgrade now to keep everything running.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Upgrade Now", true)}
    `),
  },

  "trial-ended": {
    subject: "Your trial has ended",
    category: "Billing",
    html: (p: { name?: string }) => wrap("Trial ended", "Your free trial has ended.", `
      ${h1("Trial ended")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your free trial has ended. Your campaigns have been paused.`)}
      ${para("Your leads, templates, and settings are all preserved. Upgrade anytime to resume.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Upgrade to Pro")}
    `),
  },

  "payment-succeeded": {
    subject: "Payment confirmed",
    category: "Billing",
    html: (p: { name?: string; amount?: string; date?: string; nextBilling?: string }) => wrap("Payment confirmed", "Your payment was processed successfully.", `
      ${h1("Payment confirmed")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your payment of <strong style="color:${BRAND.ink}">${p.amount || "$29"}</strong> was processed successfully.`)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.bg};border-radius:8px;margin-bottom:20px;">
        <tr>
          ${statBlock("Amount", p.amount || "$29")}
          ${statBlock("Date", p.date || new Date().toLocaleDateString())}
          ${statBlock("Next billing", p.nextBilling || "—")}
        </tr>
      </table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "View Billing", false)}
    `),
  },

  "payment-failed": {
    subject: "Payment failed — action needed",
    category: "Billing",
    html: (p: { name?: string }) => wrap("Payment failed", "Your payment didn't go through.", `
      ${h1("Payment failed")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your recent payment didn't go through. Please update your payment method to avoid service interruption.`)}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Update Payment Method")}
      ${para("We'll retry in 3 days. If the payment fails again, your campaigns will be paused.", { size: "13", color: BRAND.red, mt: "16" })}
    `),
  },

  "subscription-cancelled": {
    subject: "Subscription cancelled",
    category: "Billing",
    html: (p: { name?: string; date?: string }) => wrap("Subscription cancelled", "Your subscription has been cancelled.", `
      ${h1("Subscription cancelled")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your subscription has been cancelled. Your access will continue until ${p.date || "the end of your billing period"}.`)}
      ${para("Your data is preserved for 30 days. You can resubscribe anytime.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Resubscribe")}
    `),
  },

  "plan-changed": {
    subject: "Plan updated",
    category: "Billing",
    html: (p: { name?: string; oldPlan?: string; newPlan?: string }) => wrap("Plan updated", "Your plan has been changed.", `
      ${h1("Plan updated")}
      ${para(`Hey${p.name ? " " + p.name : ""}, your plan has been updated from <strong style="color:${BRAND.ink}">${p.oldPlan || "Free"}</strong> to <strong style="color:${BRAND.ink}">${p.newPlan || "Pro"}</strong>.`)}
      ${para("Changes take effect immediately. Your next billing date remains the same.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "View Plan")}
    `),
  },

  "card-expiring": {
    subject: "Your card is expiring soon",
    category: "Billing",
    html: (p: { name?: string; expiry?: string }) => wrap("Card expiring", "Your card expires soon.", `
      ${h1("Card expiring soon")}
      ${para(`Hey${p.name ? " " + p.name : ""}, the card on file expires${p.expiry ? ` in ${p.expiry}` : " soon"}. Update it to avoid payment failures.`)}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Update Card")}
    `),
  },

  // ── Campaign Activity ──

  "campaign-launched": {
    subject: "Campaign launched",
    category: "Campaign Activity",
    html: (p: { name?: string; campaignName?: string; leadCount?: string }) => wrap("Campaign launched", "Your campaign is now sending.", `
      ${h1("Campaign launched")}
      ${para(`<strong style="color:${BRAND.ink}">${p.campaignName || "Your campaign"}</strong> is now live and sending to ${p.leadCount || "your leads"}.`)}
      ${para("You'll be notified of replies, bounces, and completions.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/campaigns`, "View Campaign")}
    `),
  },

  "campaign-paused": {
    subject: "Campaign paused",
    category: "Campaign Activity",
    html: (p: { name?: string; campaignName?: string; reason?: string }) => wrap("Campaign paused", "Your campaign was automatically paused.", `
      ${h1("Campaign paused")}
      ${para(`<strong style="color:${BRAND.ink}">${p.campaignName || "Your campaign"}</strong> was automatically paused.`)}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.red};line-height:1.6;">
          <strong>Reason:</strong> ${p.reason || "Bounce rate exceeded threshold"}
        </p>
      </div>
      ${para("Review your lead list and sending settings before relaunching.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/campaigns`, "Review Campaign")}
    `),
  },

  "campaign-completed": {
    subject: "Campaign completed",
    category: "Campaign Activity",
    html: (p: { name?: string; campaignName?: string; sent?: string; opened?: string; replied?: string }) => wrap("Campaign completed", "Your campaign has finished sending.", `
      ${h1("Campaign completed")}
      ${para(`<strong style="color:${BRAND.ink}">${p.campaignName || "Your campaign"}</strong> has finished sending.`)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.bg};border-radius:8px;margin-bottom:20px;">
        <tr>
          ${statBlock("Sent", p.sent || "0")}
          ${statBlock("Opened", p.opened || "0", BRAND.blue)}
          ${statBlock("Replied", p.replied || "0", BRAND.green)}
        </tr>
      </table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/campaigns`, "View Results")}
    `),
  },

  "account-disconnected": {
    subject: "Email account disconnected",
    category: "Campaign Activity",
    html: (p: { name?: string; email?: string }) => wrap("Account disconnected", "An email account lost connection.", `
      ${h1("Account disconnected")}
      ${para(`<strong style="color:${BRAND.ink}">${p.email || "Your email account"}</strong> has been disconnected from Coldpilot.`)}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.red};line-height:1.6;">
          Sending from this account is paused. Campaigns using it will skip leads assigned to this account.
        </p>
      </div>
      ${para("Reconnect the account to resume sending.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/email-accounts`, "Reconnect Account")}
    `),
  },

  "bounce-rate-alert": {
    subject: "High bounce rate detected",
    category: "Campaign Activity",
    html: (p: { name?: string; campaignName?: string; bounceRate?: string }) => wrap("Bounce rate alert", "Your bounce rate is above threshold.", `
      ${h1("Bounce rate alert")}
      ${para(`<strong style="color:${BRAND.ink}">${p.campaignName || "Your campaign"}</strong> has a bounce rate of <strong style="color:${BRAND.red}">${p.bounceRate || "12%"}</strong>, which is above the recommended 5% threshold.`)}
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${BRAND.red};line-height:1.6;">
          High bounce rates damage your sender reputation. Consider verifying your list before sending more emails.
        </p>
      </div>
      ${para("We recommend pausing the campaign and running email verification on your remaining leads.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/campaigns`, "Review Campaign")}
    `),
  },

  // ── Digests ──

  "weekly-digest": {
    subject: "Your weekly report",
    category: "Digests",
    html: (p: { name?: string; sent?: string; opened?: string; replied?: string; bounced?: string; period?: string }) => wrap("Weekly report", "Here's your campaign performance.", `
      ${h1(`Hey${p.name ? " " + p.name : ""}`)}
      ${para(`Here's how your campaigns performed ${p.period || "this week"}.`)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.bg};border-radius:8px;margin-bottom:24px;">
        <tr>
          ${statBlock("Sent", p.sent || "0")}
          ${statBlock("Opened", p.opened || "0", BRAND.blue)}
          ${statBlock("Replied", p.replied || "0", BRAND.green)}
          ${statBlock("Bounced", p.bounced || "0", BRAND.red)}
        </tr>
      </table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/analytics`, "View Analytics")}
    `),
  },

  "monthly-summary": {
    subject: "Your monthly summary",
    category: "Digests",
    html: (p: { name?: string; sent?: string; opened?: string; replied?: string; month?: string }) => wrap("Monthly summary", "Your monthly campaign overview.", `
      ${h1(`${p.month || "Monthly"} summary`)}
      ${para(`Hey${p.name ? " " + p.name : ""}, here's your overview for ${p.month || "this month"}.`)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.bg};border-radius:8px;margin-bottom:24px;">
        <tr>
          ${statBlock("Total Sent", p.sent || "0")}
          ${statBlock("Open Rate", p.opened || "0%", BRAND.blue)}
          ${statBlock("Reply Rate", p.replied || "0%", BRAND.green)}
        </tr>
      </table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/analytics`, "View Full Report")}
    `),
  },

  // ── Warmup ──

  "warmup-health-dropped": {
    subject: "Warmup health warning",
    category: "Warmup",
    html: (p: { name?: string; email?: string; health?: string }) => wrap("Warmup health warning", "An inbox health score has dropped.", `
      ${h1("Warmup health warning")}
      ${para(`<strong style="color:${BRAND.ink}">${p.email || "Your inbox"}</strong> warmup health score has dropped to <strong style="color:${BRAND.orange}">${p.health || "45"}</strong>.`)}
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#92400E;line-height:1.6;">
          A low health score means your inbox may have deliverability issues. Check for authentication errors or sending pattern problems.
        </p>
      </div>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/email-accounts`, "Check Account")}
    `),
  },

  // ── Limits ──

  "approaching-limit": {
    subject: "Approaching your sending limit",
    category: "Limits",
    html: (p: { name?: string; used?: string; limit?: string; resetDate?: string; percent?: string }) => wrap("Sending limit", "You're approaching your monthly limit.", `
      ${h1("Sending limit approaching")}
      ${para(`You've used <strong style="color:${BRAND.ink}">${p.used || "450"}</strong> of your ${p.limit || "500"} monthly sends.`)}
      <div style="background:${BRAND.bg};border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="background:${BRAND.border};border-radius:4px;height:8px;margin-bottom:8px;">
          <div style="background:${BRAND.ink};border-radius:4px;height:8px;width:${p.percent || "90"}%;"></div>
        </div>
        <p style="margin:0;font-size:12px;color:${BRAND.light};">Resets ${p.resetDate || "on the 1st of next month"}</p>
      </div>
      ${para("Upgrade your plan for more sends, or wait for your limit to reset.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/settings`, "Upgrade Plan")}
    `),
  },

  "domain-reputation-warning": {
    subject: "Domain reputation warning",
    category: "Limits",
    html: (p: { name?: string; domain?: string; score?: string }) => wrap("Domain reputation warning", "Your domain reputation has dropped.", `
      ${h1("Domain reputation warning")}
      ${para(`<strong style="color:${BRAND.ink}">${p.domain || "your domain"}</strong> has a reputation score of <strong style="color:${BRAND.orange}">${p.score || "Low"}</strong>.`)}
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#92400E;line-height:1.6;">
          A low reputation score means your emails are more likely to land in spam. Pause sending and focus on warmup.
        </p>
      </div>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/email-accounts`, "Check Accounts")}
    `),
  },

  // ── Onboarding ──

  "onboarding-connect-account": {
    subject: "Connect your first email account",
    category: "Onboarding",
    html: (p: { name?: string }) => wrap("Connect an email account", "Step 1: Connect your email.", `
      ${h1("Connect your first email account")}
      ${para(`Hey${p.name ? " " + p.name : ""}, to start sending campaigns, you'll need to connect an email account. This takes about 2 minutes.`)}
      ${para("We support Gmail, Outlook, Yahoo, and any IMAP/SMTP provider.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/email-accounts`, "Connect Account")}
      ${divider()}
      ${para("Need help? Reply to this email and we'll walk you through it.", { size: "13" })}
    `),
  },

  "onboarding-create-campaign": {
    subject: "Create your first campaign",
    category: "Onboarding",
    html: (p: { name?: string }) => wrap("Create a campaign", "Step 2: Set up your first campaign.", `
      ${h1("Create your first campaign")}
      ${para(`Hey${p.name ? " " + p.name : ""}, you've connected an email account — nice. Now it's time to create your first campaign.`)}
      ${para("Write your email, add leads, and launch. We'll handle the sending schedule and warmup automatically.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/campaigns/new`, "Create Campaign")}
    `),
  },

  "onboarding-import-leads": {
    subject: "Import your first leads",
    category: "Onboarding",
    html: (p: { name?: string }) => wrap("Import leads", "Step 3: Add people to email.", `
      ${h1("Import your leads")}
      ${para(`Hey${p.name ? " " + p.name : ""}, a campaign needs leads. Import a CSV, paste emails, or connect a Google Sheet.`)}
      ${para("We auto-detect columns like email, first name, company, and title — no formatting needed.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard/leads`, "Import Leads")}
    `),
  },

  // ── Re-engagement ──

  "we-miss-you": {
    subject: "We miss you",
    category: "Re-engagement",
    html: (p: { name?: string }) => wrap("We miss you", "Your campaigns are waiting.", `
      ${h1(`Hey${p.name ? " " + p.name : ""}, we miss you`)}
      ${para("It's been a while since you've logged in. Your campaigns and leads are still here, waiting for you.")}
      ${para("Log back in to check your results, reply to leads, or launch something new.")}
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL || "https://coldpilot.io"}/dashboard`, "Go to Dashboard")}
      ${divider()}
      ${para("If you have any feedback or need help, just reply to this email.", { size: "13" })}
    `),
  },
};

export type EmailTemplateId = keyof typeof emailTemplates;
