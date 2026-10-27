# SlotFlow — Implementation Plan & Technical Specification (JavaScript ESM Edition)

## 1. Overview of JavaScript (ESM) Transition

Per your requirements, the entire SlotFlow codebase is transitioning from TypeScript to **modern JavaScript using standard ES Modules (`import`/`export`)**.

### Guiding Principles:
1. **Full Modern JavaScript (ES Modules)**: Both client and server will use standard `"type": "module"` with explicit `.js` / `.jsx` file extensions on imports.
2. **Frontend Stack**: React 18 + Vite using `.jsx` and `.js` files, Tailwind CSS, Lucide React, and React Router.
3. **Backend Stack**: Node.js LTS (v24 native ESM) + Express using `.js` files, Mongoose for MongoDB models, and Winston for structured logging.
4. **Runtime Validation & Contracts**: Replace compile-time TypeScript interfaces with:
   - **Zod schemas** for all API inputs, query parameters, mutations, and environment variable validation.
   - Comprehensive **JSDoc type annotations** (`@typedef`, `@param`, `@returns`) for rich IDE autocompletion and developer documentation without build-time compilation overhead.
   - **Mongoose Schema validators** for database integrity, uniqueness, and custom multi-cell reservation validation.
5. **No Loss of Quality or Requirements**: Retains 100% of the architecture, algorithms, atomic transactions, 15-minute discrete cell reservations, zero-gap cancellation recovery holds, and multi-tenant security boundaries.
6. **Zero TypeScript Overhead**: Eliminates `typescript`, `tsc`, `ts-node-dev`, `@types/*`, and `tsconfig.json` files entirely.

---

## 2. Dependency & Configuration Changes

### 2.1 Dependencies to Remove
| Location | Package Name | Reason |
| :--- | :--- | :--- |
| `server` | `typescript` | Replaced by native Node.js ESM execution (`node src/server.js`) |
| `server` | `tsx` | No longer needed for `.js` execution |
| `server` | `@types/express`, `@types/express-session`, `@types/bcrypt`, `@types/cors`, `@types/node`, `@types/supertest` | TypeScript type declarations removed |
| `client` | `typescript` | Client uses Babel/Vite JSX transform directly without `tsc` |
| `client` | `@types/react`, `@types/react-dom` | TypeScript type declarations removed |

### 2.2 Configurations to Remove or Update
- **Remove**: `server/tsconfig.json`
- **Remove**: `client/tsconfig.json`
- **Update `package.json` (Root)**:
  - `"dev:server": "node --watch src/server.js"` (Native Node 24 file watching)
  - `"build:server": "echo 'No build step required for JavaScript server'"`
  - `"build:client": "vite build"` (pure Vite bundling)
- **Update `server/package.json`**:
  - Add `"type": "module"`
  - Scripts:
    ```json
    "scripts": {
      "dev": "node --watch src/server.js",
      "start": "node src/server.js",
      "test": "vitest run",
      "test:watch": "vitest",
      "seed": "node src/scripts/seed.js"
    }
    ```
- **Update `client/package.json`**:
  - Ensure `"type": "module"`
  - Scripts:
    ```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    }
    ```

---

## 3. Comprehensive File Migration List

### 3.1 Server File Mapping (`.ts` $\rightarrow$ `.js`)
All server files use ES module syntax with explicit `.js` import extensions.

| Old TypeScript Path | New JavaScript (ESM) Path | Responsibilities & Changes |
| :--- | :--- | :--- |
| `server/src/config/env.ts` | `server/src/config/env.js` | Zod schema validating env vars; JSDoc comments |
| `server/src/config/logger.ts` | `server/src/config/logger.js` | Winston logger configuration |
| `server/src/config/db.ts` | `server/src/config/db.js` | Mongoose connection and disconnection |
| `server/src/config/session.ts` | `server/src/config/session.js` | `express-session` with `connect-mongo` |
| `server/src/models/User.ts` | `server/src/models/User.js` | Mongoose schema with JSDoc `@typedef {Object} User` |
| `server/src/models/Business.ts` | `server/src/models/Business.js` | Mongoose schema with default 7-day schedule |
| `server/src/models/Membership.ts` | `server/src/models/Membership.js` | Mongoose schema with compound unique index |
| `server/src/models/Service.ts` | `server/src/models/Service.js` | 15-minute multiple validators; qualified staff references |
| `server/src/models/Staff.ts` | `server/src/models/Staff.js` | Weekly shift and break schedules |
| `server/src/models/Booking.ts` | `server/src/models/Booking.js` | Immutable snapshots + SHA-256 token hash |
| `server/src/models/SlotReservation.ts` | `server/src/models/SlotReservation.js` | Compound unique index `(businessId, staffId, slotStartTimeUtc)` |
| `server/src/models/RecoveryJob.ts` | `server/src/models/RecoveryJob.js` | Durable outbox job schema with `leaseToken` and `lockedUntil` |
| `server/src/models/WaitlistEntry.ts` | `server/src/models/WaitlistEntry.js` | Preferred date (`YYYY-MM-DD`) and local time window |
| `server/src/models/WaitlistOffer.ts` | `server/src/models/WaitlistOffer.js` | Candidate offer with SHA-256 token hash and expiry |
| `server/src/models/QueueEntry.ts` | `server/src/models/QueueEntry.js` | FIFO queue entry with status and wait estimation |
| `server/src/models/Notification.js` | `server/src/models/Notification.js` | Transparent delivery status (`SENT_SIMULATED`, `PROVIDER_ACCEPTED`) |
| `server/src/middleware/errorHandler.ts` | `server/src/middleware/errorHandler.js` | Custom AppError classes, Zod handler, Mongo 11000 handler |
| `server/src/middleware/auth.ts` | `server/src/middleware/auth.js` | `requireAuth`, `tenantGuard`, and `requireRole` middleware |
| `server/src/services/availability.service.ts` | `server/src/services/availability.service.js` | Availability calculation algorithm with both-side buffers |
| `server/src/services/booking.service.ts` | `server/src/services/booking.service.js` | Transactional reservation, zero-gap cancellation, and reschedule |
| `server/src/services/recovery.service.ts` | `server/src/services/recovery.service.js` | Waitlist candidate matching algorithm & offer lifecycle |
| `server/src/controllers/auth.controller.ts` | `server/src/controllers/auth.controller.js` | Register, login, logout, me, switchBusiness |
| `server/src/controllers/business.controller.ts` | `server/src/controllers/business.controller.js` | Create, get current, update business, public slug profile |
| `server/src/controllers/service.controller.ts` | `server/src/controllers/service.controller.js` | CRUD for services with staff qualification sync |
| `server/src/controllers/staff.controller.ts` | `server/src/controllers/staff.controller.js` | CRUD for staff with schedule & services sync |
| `server/src/controllers/booking.controller.ts` | `server/src/controllers/booking.controller.js` | Public booking, guest management, staff list/cancel |
| `server/src/routes/*.ts` | `server/src/routes/*.js` | Express router modules |
| `server/src/app.ts` | `server/src/app.js` | Express application factory with health check |
| `server/src/server.ts` | `server/src/server.js` | Server startup and graceful shutdown |
| `server/tests/setup.ts` | `server/tests/setup.js` | Vitest setup with `MongoMemoryReplSet` |
| `server/tests/integration/*.ts` | `server/tests/integration/*.test.js` | Supertest integration tests in pure JS |
| `server/tests/unit/*.ts` | `server/tests/unit/*.test.js` | Unit tests for availability and algorithms |
| `server/tests/concurrency/*.ts` | `server/tests/concurrency/*.test.js` | Concurrency and race condition tests |

---

### 3.2 Client File Mapping (`.tsx`/`.ts` $\rightarrow$ `.jsx`/`.js`)

| Old TypeScript Path | New JavaScript / JSX Path | Responsibilities & Changes |
| :--- | :--- | :--- |
| `client/vite.config.ts` | `client/vite.config.js` | Vite bundler config with React plugin and proxy |
| `client/index.html` | `client/index.html` | Updated `<script>` tag referencing `/src/main.jsx` |
| `client/src/main.tsx` | `client/src/main.jsx` | React root mount |
| `client/src/App.tsx` | `client/src/App.jsx` | React Router route configuration |
| `client/src/context/AuthContext.tsx` | `client/src/context/AuthContext.jsx` | Auth React Context & custom `useAuth()` hook |
| `client/src/lib/api.ts` | `client/src/lib/api.js` | Fetch helper with session cookie handling |
| `client/src/components/layout/*.tsx` | `client/src/components/layout/*.jsx` | Navbar, Sidebar, and DashboardLayout |
| `client/src/pages/auth/*.tsx` | `client/src/pages/auth/*.jsx` | Login, Register, and Onboarding pages |
| `client/src/pages/dashboard/*.tsx` | `client/src/pages/dashboard/*.jsx` | Overview, Services, Staff, Settings, and Placeholders |
| `client/src/pages/public/PublicBookingPage.tsx` | `client/src/pages/public/PublicBookingPage.jsx` | Public booking UI (service, staff, calendar, slots) |
| `client/src/pages/public/ManageBookingPage.tsx` | `client/src/pages/public/ManageBookingPage.jsx` | Guest cancel and reschedule UI |

---

## 4. JSDoc & Runtime Validation Patterns

In place of TypeScript compile-time interfaces, we use a two-tiered validation and documentation strategy:

### 4.1 JSDoc Type Definitions for Domain Entities
For developer ergonomic clarity and autocomplete:

```javascript
/**
 * @typedef {Object} CustomerDetails
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 */

/**
 * @typedef {Object} BookingSnapshot
 * @property {number} durationMinutes
 * @property {number} bufferBefore
 * @property {number} bufferAfter
 * @property {number} reservationCellCount
 */

/**
 * Creates a new booking with immutable reservation cell snapshots.
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId} params.businessId
 * @param {import('mongoose').Types.ObjectId} params.serviceId
 * @param {import('mongoose').Types.ObjectId} params.staffId
 * @param {Date} params.startTimeUtc
 * @param {CustomerDetails} params.customer
 * @param {string} [params.source]
 * @returns {Promise<{ booking: Object, rawManageToken: string }>}
 */
export async function createBooking(params) {
  // Implementation with Zod & Mongoose validation
}
```

### 4.2 Zod Runtime Validation on Inputs
Every request body, query parameter, and environment variable is strictly parsed and sanitized by Zod schemas:
- Validates 15-minute duration constraints (`val % 15 === 0`).
- Validates email formats and non-empty strings.
- Validates ISO-8601 UTC date-time strings.
- Formats and surfaces structured error messages with field paths and HTTP 400 status.

---

## 5. Execution Roadmap for Language Migration

Once approved, the migration will proceed methodically:

1. **Package Cleanups**:
   - Update `server/package.json` to `"type": "module"`, remove TypeScript dependencies.
   - Update `client/package.json`, remove TypeScript dependencies.
   - Remove `server/tsconfig.json` and `client/tsconfig.json`.
2. **Server Migration to `.js`**:
   - Convert all files in `server/src` to `.js` with explicit ESM import paths.
   - Convert tests in `server/tests` to `.js`.
   - Run `npm test` to verify 100% test pass on native JavaScript.
3. **Client Migration to `.js` / `.jsx`**:
   - Convert all files in `client/src` to `.js` and `.jsx`.
   - Update `client/index.html` script reference.
   - Run `npm run build:client` to verify flawless JSX bundling.
4. **Git Commit**:
   - Commit cleanly: `refactor: migrate entire application from TypeScript to modern JavaScript (ESM)`.
5. **Resume Milestone 2**:
   - Implement availability engine, 15-minute discrete cell reservations, cancellation outbox, and public booking interface in pure JavaScript.

---

## 7. Migration Safeguards & Verifiable Execution Protocol

To ensure 100% feature preservation and zero regression:
1. **Complete Inventory Check**: Audit and delete all `.ts`, `.tsx`, and `tsconfig*.json` files. Verify that no obsolete `.ts` import paths or typings remain.
2. **Behavioral Invariance**: All atomic transactions, multi-cell discrete reservations, outbox recovery workflows, deterministic matching, and server-side RBAC remain identical in logic.
3. **Immutable Snapshots**: `durationMinutesSnapshot`, `bufferBeforeSnapshot`, `bufferAfterSnapshot`, and `reservationCellCountSnapshot` remain permanently stored on bookings and used for cancellation assertions.
4. **Exact-Match Interval Rule**: Waitlist candidate matching strictly enforces exact interval fit (`candidateService.duration + buffers === vacatedSlot.duration`).
5. **Atomic Fenced Lease Fencing**: Recovery job worker checks `{ _id: job._id, leaseToken: job.leaseToken }` within the same transaction as side effects; any mismatch aborts the transaction.
6. **Empirical Verification**: Run unit tests, integration tests, and Vite client build at each stage; log and report actual terminal output.
7. **Node.js Compatibility**: Tested on Node v24 LTS with native ES module execution.
8. **Git Checkpoint Integrity**: Clean commits before and after migration with descriptive commit messages.
9. **Transparent Reporting**: Provide complete list of files migrated, dependencies removed, test execution outputs, and build artifacts.
10. **Milestone Continuity**: Transition Milestone 1 and current Milestone 2 components seamlessly to JavaScript without losing work.

---

## 8. Review & Approval
Please review this updated plan and file change specification. Once you approve, we will immediately execute the package adjustments, file conversions, test verification, and clean git commit.
