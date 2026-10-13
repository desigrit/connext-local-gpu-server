export const CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const STALE_AFTER_MS = CHECK_INTERVAL_MS + 30 * 1000;

export function checkedAge(checkedAtMs: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - checkedAtMs) / 60000));
  return minutes < 2 ? 'Just now' : minutes + ' minutes ago';
}
