import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { RecoveryJob } from '../models/RecoveryJob.js';
import { WaitlistOffer } from '../models/WaitlistOffer.js';
import { SlotReservation } from '../models/SlotReservation.js';
import {
  claimRecoveryJob,
  processClaimedRecoveryJob,
  handleOfferExpired
} from '../services/recovery.service.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';

export const MAX_RECOVERY_RETRIES = 5;

/**
 * Executes a single recovery worker pass:
 * 1. Finds and expires pending offers past their expiresAt deadline.
 * 2. Claims available RecoveryJobs using atomic lease fencing.
 * 3. Handles poison pills (retries > MAX_RECOVERY_RETRIES) by marking FAILED and cleaning up held cells.
 * 4. Processes the claimed job to find candidates or release capacity.
 *
 * @param {string} [workerId]
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function runWorkerIteration(workerId, options = {}) {
  const wid = workerId || `worker-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const leaseDurationMs = options.leaseDurationMs || 30000;
  const offerDurationMinutes = options.offerDurationMinutes || 15;

  let expiredOffersProcessed = 0;
  let jobsProcessed = 0;

  // 1. Sweep expired pending offers
  const now = new Date();
  const expiredOffers = await WaitlistOffer.find({
    status: 'PENDING',
    expiresAt: { $lte: now }
  });

  for (const offer of expiredOffers) {
    try {
      await handleOfferExpired(offer._id);
      expiredOffersProcessed++;
      logger.info(`[RecoveryWorker] Expired offer ${offer._id} processed and slot reassigned.`);
    } catch (err) {
      logger.error(`[RecoveryWorker] Failed to process expired offer ${offer._id}:`, err);
    }
  }

  // 2. Claim available RecoveryJob
  const job = await claimRecoveryJob(wid, leaseDurationMs);
  if (!job) {
    return { expiredOffersProcessed, jobsProcessed: 0, job: null };
  }

  // 3. Guard against poison pill jobs
  if (job.retryCount > MAX_RECOVERY_RETRIES) {
    logger.warn(
      `[RecoveryWorker] RecoveryJob ${job._id} exceeded max retries (${job.retryCount} > ${MAX_RECOVERY_RETRIES}). Marking FAILED.`
    );
    job.status = 'FAILED';
    job.lockedUntil = null;
    await job.save();

    // Release held cells to avoid holding capacity indefinitely
    await SlotReservation.deleteMany({
      recoveryJobId: job._id,
      reservationType: 'HOLD'
    });

    return {
      expiredOffersProcessed,
      jobsProcessed: 1,
      jobId: job._id,
      status: 'FAILED',
      reason: 'MAX_RETRIES_EXCEEDED'
    };
  }

  // 4. Process claimed job
  try {
    const result = await processClaimedRecoveryJob(job, wid, offerDurationMinutes);
    jobsProcessed++;
    logger.info(`[RecoveryWorker] Processed job ${job._id} with result:`, result);
    return {
      expiredOffersProcessed,
      jobsProcessed,
      jobId: job._id,
      result
    };
  } catch (err) {
    logger.error(`[RecoveryWorker] Failed to process job ${job._id}:`, err);
    throw err;
  }
}

/**
 * Starts continuous background recovery worker loop
 * @param {Object} [options]
 * @returns {{ workerId: string, isRunning: () => boolean, stop: () => void }}
 */
export function startRecoveryWorker(options = {}) {
  const intervalMs = options.intervalMs || env.WORKER_INTERVAL_MS || 15000;
  const workerId = options.workerId || `worker-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;

  let isRunning = true;
  let isExecuting = false;

  logger.info(`[RecoveryWorker] Initialized worker ${workerId} with interval ${intervalMs}ms.`);

  const intervalTimer = setInterval(async () => {
    if (!isRunning || isExecuting) return;
    isExecuting = true;
    try {
      await runWorkerIteration(workerId, options);
    } catch (err) {
      logger.error(`[RecoveryWorker] Error in iteration cycle:`, err);
    } finally {
      isExecuting = false;
    }
  }, intervalMs);

  return {
    workerId,
    isRunning: () => isRunning,
    stop: () => {
      isRunning = false;
      clearInterval(intervalTimer);
      logger.info(`[RecoveryWorker] Stopped worker ${workerId}.`);
    }
  };
}

// Standalone CLI execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  (async () => {
    try {
      logger.info('[RecoveryWorker] Starting standalone recovery worker process...');
      await connectDB(env.MONGODB_URI);
      const worker = startRecoveryWorker();

      const shutdown = async (sig) => {
        logger.info(`[RecoveryWorker] Received ${sig}, shutting down...`);
        worker.stop();
        await mongoose.connection.close();
        logger.info('[RecoveryWorker] Database connection closed.');
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
      logger.error('[RecoveryWorker] Fatal startup error:', err);
      process.exit(1);
    }
  })();
}
