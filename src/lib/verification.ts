// How long a one-click email-verification link stays valid. The token is
// consumed on first click (deleted in the verify route), so this only bounds
// the window in which a stale/leaked link works. 24h is the practical sweet
// spot: forgiving for users who return later, but never persistently valid.
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
