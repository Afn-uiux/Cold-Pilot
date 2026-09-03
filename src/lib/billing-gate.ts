// Bachs billing is currently in development against the Bachs sandbox. While
// it is not ready for production, it must stay dormant on the live app: no
// checkout, no webhook fulfillment, no buy/upgrade UI.
//
// A single flag (`BILLING_ENABLED`) parks the whole feature without removing
// the code from the repo. When the Bachs integration is out of sandbox, set
// `BILLING_ENABLED=true` (plus the real BACHS_* secrets) on the server and the
// existing billing code activates — no redeploy of billing logic required.

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}
