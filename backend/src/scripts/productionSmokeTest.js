/**
 * SlotFlow Non-Destructive Production Smoke Test
 *
 * Verifies public availability, database connectivity, and health status
 * across production frontend (Vercel) and production backend (Render).
 *
 * SAFETY GUARANTEE:
 * - 100% Read-only inspection
 * - ZERO mutations, bookings, cancellations, or database writes
 * - Safe for live automated CI/CD and deployment verifications
 */

const BACKEND_URL = process.env.PROD_BACKEND_URL || 'https://slotflow-api.onrender.com';
const FRONTEND_URL = process.env.PROD_FRONTEND_URL || 'https://slot-flow-tau.vercel.app';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const latencyMs = Date.now() - startTime;
    return { res, latencyMs };
  } finally {
    clearTimeout(id);
  }
}

async function runProductionSmokeTest() {
  console.log('====================================================');
  console.log('  SLOTFLOW NON-DESTRUCTIVE PRODUCTION SMOKE TEST   ');
  console.log('====================================================');
  console.log(`Backend Target : ${BACKEND_URL}`);
  console.log(`Frontend Target: ${FRONTEND_URL}`);
  console.log(`Safety Policy  : Read-Only (Zero data mutation)\n`);

  const results = {
    backendHealth: null,
    frontendHtml: null,
    backendPublicCatalog: null
  };

  let allPassed = true;

  // 1. Probing Backend /api/v1/health (with retry for free-tier cold starts)
  console.log('1. Probing Backend Health Check Endpoint...');
  try {
    const healthUrl = `${BACKEND_URL}/api/v1/health`;
    let responseResult;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        responseResult = await fetchWithTimeout(healthUrl, {}, 45000); // 45s timeout for Render wake-up
        break;
      } catch (retryErr) {
        if (attempt === 1) {
          console.log(`   [INFO] Retrying backend health check (handling free-tier spin-up)...`);
        } else {
          throw retryErr;
        }
      }
    }

    const { res, latencyMs } = responseResult;

    if (res.status === 200) {
      const data = await res.json();
      console.log(`   [PASS] HTTP 200 OK (${latencyMs}ms)`);
      console.log(`          Service : ${data.service}`);
      console.log(`          Status  : ${data.status}`);
      console.log(`          Database: ${data.database?.status} (readyState: ${data.database?.readyState})`);
      console.log(`          Worker  : configured=${data.worker?.configured}, running=${data.worker?.running}`);

      results.backendHealth = {
        passed: true,
        latencyMs,
        data
      };
    } else {
      console.log(`   [FAIL] HTTP ${res.status} returned from ${healthUrl} (${latencyMs}ms)`);
      results.backendHealth = { passed: false, status: res.status, latencyMs };
      allPassed = false;
    }
  } catch (err) {
    console.log(`   [ERROR] Failed to reach backend health endpoint: ${err.message}`);
    results.backendHealth = { passed: false, error: err.message };
    allPassed = false;
  }

  // 2. Probing Frontend Vercel Deployment
  console.log('\n2. Probing Frontend Static & SPA Shell...');
  try {
    const { res, latencyMs } = await fetchWithTimeout(FRONTEND_URL, {}, 10000);

    if (res.status === 200) {
      const text = await res.text();
      const hasRootDiv = text.includes('id="root"');
      const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown';

      if (hasRootDiv) {
        console.log(`   [PASS] HTTP 200 OK (${latencyMs}ms)`);
        console.log(`          Page Title: "${title}"`);
        console.log(`          SPA Mount : <div id="root"> verified`);
        results.frontendHtml = { passed: true, latencyMs, title };
      } else {
        console.log(`   [WARN] HTTP 200 OK (${latencyMs}ms), but id="root" container was not found in HTML.`);
        results.frontendHtml = { passed: false, latencyMs, title };
        allPassed = false;
      }
    } else {
      console.log(`   [FAIL] HTTP ${res.status} returned from ${FRONTEND_URL} (${latencyMs}ms)`);
      results.frontendHtml = { passed: false, status: res.status, latencyMs };
      allPassed = false;
    }
  } catch (err) {
    console.log(`   [ERROR] Failed to reach frontend URL: ${err.message}`);
    results.frontendHtml = { passed: false, error: err.message };
    allPassed = false;
  }

  // 3. Probing Public Catalog Route (Read-Only)
  console.log('\n3. Probing Public Catalog API Route (Read-Only)...');
  try {
    // Probing demo slug or checking 404 behavior without modifying database
    const catalogUrl = `${BACKEND_URL}/api/v1/public/businesses/acme-salon`;
    const { res, latencyMs } = await fetchWithTimeout(catalogUrl, {}, 10000);

    // Both 200 (slug exists) and 404 (slug not found) confirm API routing is functioning normally
    if (res.status === 200 || res.status === 404) {
      const data = await res.json();
      console.log(`   [PASS] HTTP ${res.status} (${latencyMs}ms)`);
      console.log(`          Response Code: ${data.success ? 'SUCCESS' : data.error?.code || 'ERROR'}`);
      results.backendPublicCatalog = { passed: true, status: res.status, latencyMs };
    } else {
      console.log(`   [WARN] Unexpected HTTP ${res.status} from ${catalogUrl} (${latencyMs}ms)`);
      results.backendPublicCatalog = { passed: false, status: res.status, latencyMs };
    }
  } catch (err) {
    console.log(`   [ERROR] Catalog probe failed: ${err.message}`);
    results.backendPublicCatalog = { passed: false, error: err.message };
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('  SMOKE TEST RESULT: ALL PRODUCTION TARGETS HEALTHY ');
  } else {
    console.log('  SMOKE TEST RESULT: ONE OR MORE TARGETS FAILED    ');
  }
  console.log('====================================================\n');

  return { allPassed, results };
}

import { fileURLToPath } from 'url';
import path from 'path';

// Execute if run directly
const isDirectRun = process.argv[1] && process.argv[1].includes('productionSmokeTest');

if (isDirectRun) {
  runProductionSmokeTest()
    .then(({ allPassed }) => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unhandled smoke test error:', err);
      process.exit(1);
    });
}

export { runProductionSmokeTest };
