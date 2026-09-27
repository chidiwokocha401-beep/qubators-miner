# Qubators Cloud Miner

An educational Bitcoin mining simulator — free, web-based, and explicitly **not** real mining. No real money or cryptocurrency changes hands.

## Overview

Qubators Cloud Miner teaches total beginners how Bitcoin mining works through a guided, 3-stage curriculum:

1. **Basics** — What mining is, hash rate, blocks, and rewards
2. **Economics** — Electricity costs, ROI, break-even, and the halving
3. **Network Effects** — Difficulty adjustment and pool vs. solo mining

Each stage includes interactive widgets, a short quiz, and a badge. Completing all three earns a shareable certificate.

## Project Structure

```
qubators-miner/
├── Features/
│   └── Qubators Cloud Miner (educational BTC mining simulator).md   # Feature spec
├── backend architecture/
│   └── Qubators Cloud Miner — Backend Architecture (1).html          # Architecture doc
├── prototype/
│   ├── Qubators Cloud Miner — Stage 1 Prototype.html                 # Standalone prototypes
│   ├── Qubators Cloud Miner — Stage 2 Prototype.html
│   └── Qubators Cloud Miner — Stage 3 Prototype.html
├── public/                                                           # ★ Full-stack frontend
│   ├── index.html                                                    # Dashboard
│   ├── login.html                                                    # Auth (sign in / sign up)
│   ├── stage1.html                                                   # Stage 1: Basics
│   ├── stage2.html                                                   # Stage 2: Economics
│   ├── stage3.html                                                   # Stage 3: Network Effects
│   ├── leaderboard.html                                              # Leaderboard
│   ├── certificate.html                                              # Certificate view
│   ├── css/
│   │   └── style.css                                                 # Shared styles
│   └── js/
│       └── app.js                                                    # Shared JS (auth, nav, API)
├── schema.sql/
│   └── schema.sql                                                    # Database schema (Postgres/Supabase)
├── server.js/
│   └── server.js                                                     # Backend API + static file server
└── README.md                                                         # This file
```

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS — no build step, served by the backend
- **Backend**: Node.js + Express
- **Database**: Postgres via Supabase
- **Auth**: Supabase Auth (email/password + social login)
- **Live Data**: CoinGecko API (BTC price), mempool.space API (difficulty + hash rate)

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL editor and run the contents of `schema.sql/schema.sql`
3. Note your project URL and service role key (Settings → API)

### 2. Set up the backend

```bash
cd server.js
npm install
```

Create a `.env` file in the `server.js/` directory:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
```

### 3. Run the app

```bash
cd server.js
npm start
```

The app will be available at `http://localhost:3001`

### 4. Set up Supabase Auth

1. In your Supabase dashboard, go to Authentication → Providers
2. Enable Email provider
3. (Optional) Enable Google, GitHub, or other social providers
4. Disable "Confirm email" for faster testing (or keep it on for production)

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/market-data` | GET | Cached BTC price, difficulty, network hash rate |
| `/api/progress` | GET | Current user's progress |
| `/api/progress` | POST | Upsert stage completion |
| `/api/farm-config` | GET | User's saved rig selections |
| `/api/farm-config` | POST | Save rig selections |
| `/api/leaderboard` | GET | Top N users by metric |
| `/api/certificate` | GET | Completion status + certificate data |

## Database Tables

- `profiles` — User display names
- `progress` — Stage completion + quiz scores
- `farm_config` — Saved rig selections
- `market_data_cache` — Cached live market data
- `leaderboard_cache` — Denormalized leaderboard
- `certificates` — Issued completion certificates

## Security

- Row Level Security (RLS) enabled on all tables
- Service role key used only server-side
- Rate limiting on all API routes (100 req / 15 min)
- Auth required for progress, farm config, and certificate endpoints
- Public read-only access for leaderboard and market data

## Development

### Running the prototypes standalone

The files in `prototype/` are standalone HTML files — open them directly in a browser to test the UI without the backend.

### Running the full stack

The `public/` directory is served by the Express backend. All API calls go through the same origin, so no CORS issues in production.

### Project structure

- `server.js/` — Backend API + static file server
- `public/` — Frontend (vanilla HTML/CSS/JS)
- `schema.sql/` — Database schema
- `prototype/` — Standalone UI prototypes
- `Features/` — Feature specification
- `backend architecture/` — Architecture documentation

## License

MIT
