import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import {
  startRecoveryWorker,
  stopRecoveryWorker,
  getRecoveryWorkerStatus
} from '../../src/workers/recovery.worker.js';

describe('Health Check Discrepancy & Worker Status Regression Tests', () => {
  let app;

  beforeEach(() => {
    stopRecoveryWorker();
    app = createApp(mongoose.connection.client?.s?.url || 'mongodb://localhost:27017/slotflow_test');
  });

  afterEach(() => {
    stopRecoveryWorker();
  });

  it('correctly reports worker configured as enabled without string-type mismatch', async () => {
    // Worker is configured (env.ENABLE_BACKGROUND_WORKER defaults to true) but NOT yet started in memory
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database.status).toBe('connected');

    // Confirm boolean type and value
    expect(res.body.worker.configured).toBe(true);
    expect(res.body.worker.enabled).toBe(true);
    expect(typeof res.body.worker.enabled).toBe('boolean');

    // Confirms worker is NOT running solely because configured is true
    expect(res.body.worker.running).toBe(false);
    expect(res.body.worker.workerId).toBeNull();
  });

  it('accurately distinguishes between worker configured vs actively running', async () => {
    // 1. Initial state: configured=true, running=false
    let res = await request(app).get('/api/v1/health');
    expect(res.body.worker.enabled).toBe(true);
    expect(res.body.worker.running).toBe(false);

    // 2. Start worker in memory
    const worker = startRecoveryWorker({ intervalMs: 25000, workerId: 'test-health-worker' });
    expect(worker.isRunning()).toBe(true);

    // 3. Health check should now reflect worker is running
    res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.worker.enabled).toBe(true);
    expect(res.body.worker.running).toBe(true);
    expect(res.body.worker.workerId).toBe('test-health-worker');
    expect(res.body.worker.intervalMs).toBe(25000);

    // 4. Stop worker
    worker.stop();

    // 5. Health check should reflect worker is no longer running
    res = await request(app).get('/api/v1/health');
    expect(res.body.worker.enabled).toBe(true);
    expect(res.body.worker.running).toBe(false);

    // 6. Restart worker with a new instance
    const restartedWorker = startRecoveryWorker({ intervalMs: 30000, workerId: 'restarted-worker' });
    expect(restartedWorker.isRunning()).toBe(true);
    expect(restartedWorker.workerId).toBe('restarted-worker');

    res = await request(app).get('/api/v1/health');
    expect(res.body.worker.running).toBe(true);
    expect(res.body.worker.workerId).toBe('restarted-worker');
    expect(res.body.worker.intervalMs).toBe(30000);

    restartedWorker.stop();
  });

  it('verifies lastIterationAt reflects actual iterations rather than merely initialization', async () => {
    // 1. Upon initialization, lastIterationAt is null
    const worker = startRecoveryWorker({ intervalMs: 50, workerId: 'iteration-check-worker' });
    expect(worker.lastIterationAt).toBeNull();

    let status = getRecoveryWorkerStatus();
    expect(status.lastIterationAt).toBeNull();

    // 2. Wait briefly for at least one iteration cycle to fire
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(worker.lastIterationAt).not.toBeNull();
    expect(typeof worker.lastIterationAt).toBe('string');

    const res = await request(app).get('/api/v1/health');
    expect(res.body.worker.lastIterationAt).toBe(worker.lastIterationAt);

    worker.stop();
  });

  it('redirects root /health probe to /api/v1/health with 307', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(307);
    expect(res.headers.location).toBe('/api/v1/health');
  });
});
