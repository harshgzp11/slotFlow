# SlotFlow

> **Smart Appointment Scheduling & Zero-Gap Cancellation Recovery SaaS**  
> Built with modern JavaScript (ES Modules), MongoDB, Express, React, Node.js, Vite, and TailwindCSS.

[![JavaScript: ESM](https://img.shields.io/badge/Language-JavaScript%20ESM-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB%20Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tests: Vitest](https://img.shields.io/badge/Tests-13%20Passed%20%28100%25%29-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Frontend: React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://vitejs.dev/)

---

## ⚡ Key Features

* **15-Minute Atomic Slot Grid:** Every service interval (duration + pre/post buffers) is split into discrete 15-minute reservation cells protected by a MongoDB compound unique index (`{ businessId: 1, staffId: 1, slotStartTimeUtc: 1 }`). Completely eliminates double-booking race conditions with automatic HTTP 409 Conflict handling.
* **Zero-Gap Cancellation Recovery:** When an appointment is cancelled, its slots are atomically converted to `RECOVERY_PENDING` holds in the same transaction. The vacancy is immediately protected from public snatches.
* **Deterministic Waitlist Matching:** Background recovery workers match candidates by priority, date flexibility ($\pm N$ days), and time-of-day preferences, placing an exclusive hold with a countdown timer.
* **Fenced Worker Leases:** Durable worker leases with lease-token fencing prevent stale workers from executing out-of-order state transitions.
* **Walk-In Queue Management:** Integrated ticketing system (`Q-001`, `Q-002`) with real-time wait estimation and status tracking.
* **Staff Operations & Analytics:** Linear appointment state machine (`CONFIRMED` $\to$ `CHECKED_IN` $\to$ `IN_SERVICE` $\to$ `COMPLETED` / `NO_SHOW`) alongside MongoDB aggregation pipelines for staff utilization and revenue recovery metrics.

---

## 🛠️ Tech Stack

* **Backend:** Node.js (ESM), Express.js, Mongoose 8, Express-Session (`connect-mongo`), Zod validation.
* **Frontend:** React 18, Vite 5, React Router v6, TailwindCSS 3, Lucide React.
* **Testing:** Vitest, Supertest, in-memory MongoDB replica set with ACID transactions.

---

## 🚀 Quick Start

### 1. Prerequisites
* Node.js >= 20 LTS (v24 verified)
* npm >= 10
* MongoDB connection URI (Atlas or local)

### 2. Installation
```bash
git clone https://github.com/harshgzp11/slotFlow.git
cd slotFlow
npm install
```

### 3. Environment Configuration
Create a `.env` file in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/slotflow?retryWrites=true&w=majority
SESSION_SECRET=slotflow_super_secret_session_key_minimum_32_chars
```

### 4. Seed Demo Data
Populate the database with a complete demo workspace, services, specialists, and sample bookings:
```bash
npm run seed
```
* **Demo Login:** `owner@slotflow.io`
* **Demo Password:** `Password123!`
* **Public Booking Link:** `http://localhost:5173/book/luxe-studio`

### 5. Start the Application
Run both backend and frontend from the root directory:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:backend

# Terminal 2: Run directly with node from backend/
# cd backend && node index.js

# Terminal 3: Frontend Web App (port 5173)
npm run dev:frontend
```
* Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🧪 Testing

Run the automated test suite (unit, integration, concurrency, and tenant isolation):
```bash
npm test
```
* **6 test suites, 13 tests (100% passing)** with real transactional replication.

Build the frontend for production:
```bash
npm run build:frontend
```

---

## 📡 Core API Endpoints

### Public Endpoints (`/api/v1/public`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/businesses/:slug` | Business profile and catalog |
| `GET` | `/availability` | Available 15-minute start slots |
| `POST` | `/bookings` | Atomic slot reservation and booking |
| `POST` | `/bookings/:id/cancel` | Cancel booking with zero-gap hold conversion |
| `POST` | `/businesses/:slug/waitlist` | Join waitlist with date/time preferences |
| `POST` | `/businesses/:slug/queue` | Walk-in intake with wait estimation |
| `POST` | `/offers/:id/accept` | Claim waitlist recovery offer |

### Staff Operations (`/api/v1`)
| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Session authentication |
| `GET` | `/bookings` | Staff | Filter bookings by date/staff/status |
| `PATCH` | `/bookings/:id/status` | Staff | Advance appointment state machine |
| `GET` | `/queue` | Staff | Live walk-in queue board |
| `GET` | `/analytics/overview` | Staff | Real-time utilization & revenue metrics |

---

## 📄 License
ISC
