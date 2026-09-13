// Run `worker` over `items` with at most `cap` concurrent in-flight calls.
// The scheduler tick is fully serial today; anything that blocks on I/O
// (IMAP scans, SMTP sends, DeepSeek calls) queues up one-at-a-time and can
// blow the 2-minute tick budget once the user base grows. Batching with a
// cap overlaps that waiting without hammering providers or the AI API.
// Errors are isolated per-item (logged, not thrown) so one bad mailbox or
// message can never take down the rest of the batch.
export async function runConcurrent<T>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<void>,
  cap = 15,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers: Promise<void>[] = [];
  const active = Math.min(cap, items.length);
  for (let i = 0; i < active; i++) {
    workers.push((async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) break;
        try {
          await worker(items[index], index);
        } catch (err) {
          console.error("[concurrent] worker failed:", err);
        }
      }
    })());
  }
  await Promise.all(workers);
}