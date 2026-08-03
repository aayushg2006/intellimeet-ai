import Summary from '../models/Summary.js';
import { stateStore } from '../lib/stateStore.js';
import { keys } from '../lib/stateKeys.js';

/**
 * Rescues summaries orphaned by a restart.
 *
 * Generation is a long-running background job. If the process dies partway
 * through — which on a free Render dyno happens routinely — the Summary row is
 * left in `generating` forever, and the UI polls it indefinitely with no way
 * for the user to retry.
 *
 * This sweeps for such rows and either resets them so they can be re-claimed,
 * or gives up and marks them failed with an actionable message.
 */

const DEFAULTS = {
  intervalMs: 2 * 60 * 1000,
  // Must comfortably exceed the slowest realistic generation.
  staleAfterMs: 10 * 60 * 1000,
  maxAttempts: 3,
  batchSize: 20,
};

const reapOnce = async ({ staleAfterMs, maxAttempts, batchSize }) => {
  // One instance per sweep.
  const lock = await stateStore.acquireLock(keys.jobLock('reaper'), 90_000);
  if (!lock) return { skipped: true };

  try {
    const stale = await Summary.find({
      generationStatus: 'generating',
      generationStartedAt: { $lt: new Date(Date.now() - staleAfterMs) },
    })
      .select('_id meetingId generationAttempts')
      .limit(batchSize)
      .lean();

    if (stale.length === 0) return { reset: 0, failed: 0 };

    let reset = 0;
    let failed = 0;

    for (const doc of stale) {
      if ((doc.generationAttempts || 0) < maxAttempts) {
        // Back to 'pending' so the next explicit retry can claim it.
        await Summary.updateOne(
          { _id: doc._id, generationStatus: 'generating' },
          {
            $set: {
              generationStatus: 'pending',
              generationError: 'Generation was interrupted and will be retried.',
            },
          }
        );
        reset += 1;
      } else {
        await Summary.updateOne(
          { _id: doc._id, generationStatus: 'generating' },
          {
            $set: {
              generationStatus: 'failed',
              generationError:
                'Generation was interrupted by a server restart. Use "Regenerate" to try again.',
            },
          }
        );
        failed += 1;
      }
    }

    console.log(`[Reaper] Recovered ${reset} stale summaries, gave up on ${failed}`);
    return { reset, failed };
  } catch (error) {
    console.error('[Reaper] Sweep failed:', error.message);
    return { error: error.message };
  } finally {
    await stateStore.releaseLock(keys.jobLock('reaper'), lock);
  }
};

export const startStaleSummaryReaper = (options = {}) => {
  const config = { ...DEFAULTS, ...options };

  // Run once immediately: a restart is the most likely reason anything is
  // stuck, and this process starting is the clearest signal one just happened.
  reapOnce({ ...config, staleAfterMs: 60_000 }).catch(() => {});

  const timer = setInterval(() => {
    reapOnce(config).catch(() => {});
  }, config.intervalMs);

  timer.unref();
  return timer;
};

export { reapOnce };
export default startStaleSummaryReaper;
