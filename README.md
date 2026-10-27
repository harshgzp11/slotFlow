# SlotFlow

A smarter way to manage appointments, waitlists, and walk-in customers.

SlotFlow is an appointment scheduling and business operations web app built with the MERN stack. It helps service-based businesses manage bookings and staff schedules, while giving customers a way to find available appointments and join a waitlist.

## Features

- **Appointment booking** — view services and available appointment times.
- **15-minute reservation slots** — represent booking time as small reservation cells to help prevent overlapping bookings.
- **Cancellation recovery** — when an appointment is cancelled, eligible waitlist customers can be offered the newly available time.
- **Waitlist matching** — consider customer date flexibility and preferred time of day.
- **Staff operations** — manage appointment status and view the daily queue.
- **Walk-in queue** — register walk-in customers and track their queue status.
- **Business analytics** — view operational and booking metrics.

## Tech Stack

| Area | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, React Router, Tailwind CSS |
| **Backend** | Node.js, Express |
| **Database** | MongoDB, Mongoose |
| **Validation and sessions** | Zod, Express Session, connect-mongo |
| **Testing** | Vitest, Supertest |

The project uses JavaScript ES Modules.

## Run Locally

### 1. Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB configured as a replica set so database transactions are supported (you can use MongoDB Atlas or a local replica-set deployment)

### 2. Clone and install

```bash
git clone https://github.com/harshgzp11/slotFlow.git
cd slotFlow
npm install
```

### 3. Configure environment variables

Create `backend/.env` and add your local configuration:

```env
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/slotflow?replicaSet=rs0
SESSION_SECRET=replace_this_with_a_random_secret_at_least_32_characters_long
```

Update `MONGODB_URI` to match your MongoDB setup. If you use MongoDB Atlas, paste your Atlas connection URI instead.

Keep `.env` files and real credentials out of Git. Use a unique, strong `SESSION_SECRET` outside local development.

### 4. Create demo data

```bash
npm run seed
```

The seed script creates a sample business, services, staff, bookings, waitlist entries, and walk-in queue tickets. It also resets selected demo records, so use it only with a development database.

Demo login after seeding:
- **Email:** `owner@slotflow.io`
- **Password:** `Password123!`
- **Public booking page:** [http://localhost:5173/book/luxe-studio](http://localhost:5173/book/luxe-studio)

These credentials are for the local seeded demo only. Do not use them in a production deployment.

### 5. Start the app

Open two terminals from the project root.

**Terminal 1 — backend:**
```bash
npm run dev:backend
```

**Terminal 2 — frontend:**
```bash
npm run dev:frontend
```

Then open [http://localhost:5173](http://localhost:5173).

## Testing and Build

Run the backend tests:
```bash
npm test
```

Build the frontend for production:
```bash
npm run build:frontend
```

Test counts and build status are intentionally not hard-coded here because they can change as the project evolves.

## API Overview

The API is organized around public booking flows and staff operations. Core areas include:
- Business and service information
- Appointment availability, booking, and cancellation
- Waitlist registration and recovery offers
- Staff authentication and appointment status updates
- Walk-in queue management
- Business analytics

The backend API uses the `/api/v1` route prefix. Check the backend source for the current route definitions. Detailed endpoint specifications are documented in [docs/API.md](docs/API.md).

## Project Structure

```text
slotFlow/
├── backend/    # Express API, database models, services, and tests
├── frontend/   # React application
├── package.json
└── README.md
```

## Current Status

SlotFlow is an actively developed project. Features and behavior may change as development and testing continue. Review the code and run the test suite before using it with real business or customer data.

## License

This project is open source under the ISC License.

## Author

Created by Harsh Srivastava

## DemoVideo
https://drive.google.com/drive/folders/1dVw7-Id1GuTOTKus4gdhoKLTwKOnoTTx?usp=sharing
