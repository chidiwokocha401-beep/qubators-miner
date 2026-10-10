# Qubators Miner — Product Requirements Document (PRD)

- **Version:** v1.1 (as-shipped)
- **Date:** October 2026
- **Owner:** Kingsley Chidi Wokocha, Head of Qubators Team
- **Live product:** https://chidiwokocha401-beep.github.io/qubators-miner/
- **Source:** https://github.com/chidiwokocha401-beep/qubators-miner (public)

## 1. Overview

Qubators Miner is a free, interactive educational app that teaches how **cloud mining** works: renting hash power from remote data centres instead of owning hardware. Learners complete lessons, experiment with a profit simulator, pass a quiz, and earn a **personalized Certificate of Completion**. It ships on Android, Windows, macOS and the web.

## 2. Goals and non-goals

**Goals**

- G1: Teach cloud-mining fundamentals (hash rate, contracts, fees, halving, difficulty, scam awareness) to total beginners.
- G2: Learning must be interactive — no walls of text.
- G3: Every learner who passes can prove it with a personalized certificate.
- G4: Available on the devices learners already own, including offline.
- G5: Free forever; sustainability via voluntary partnerships, never paywalls.

**Non-goals**

- NG1: No real mining, earnings, wallets, or payments inside the app.
- NG2: No server-side accounts or cross-device sync (demo-grade local login only).
- NG3: No Play Store / App Store listings yet (direct APK/EXE/DMG distribution).

## 3. Target users

| Persona | Need |
|---|---|
| Crypto-curious beginner | Plain-language explanation of mining |
| Student / youth | Free skill + shareable certificate |
| At-risk user seeing "earn daily" schemes | Scam red-flag literacy |
| Educator / community trainer | Ready-made, offline-capable teaching tool |

## 4. Functional requirements

### 4.1 Login & accounts

- **FR-101:** Sign-up collects full name, gender (Male/Female), email, password (min 4 chars), with inline validation errors.
- **FR-102:** Sign-in verifies email + password; wrong credentials show an error, never which field failed beyond the pair.
- **FR-103:** Session persists across visits on the same browser/device; header shows `👤 Name` + Logout.
- **FR-104:** Logout clears the session and returns to the login screen.
- **FR-105:** Quiz and Certificate tabs are gated — logged-out users are routed to login with an explanatory message.
- **FR-106:** On first login, the account name + gender pre-fill the certificate form.

### 4.2 Learn

- **FR-201:** 4 expandable lessons: (1) Cloud Mining Explained, (2) How Contracts Work, (3) Costs/Halving/Difficulty, (4) Risks & Scam Spotting.
- **FR-202:** Each lesson has a "Mark as Complete" action; progress persists (`0/4` → `4/4`).
- **FR-203:** A progress bar aggregates lessons + quiz + certificate states.

### 4.3 Simulate

- **FR-301:** Sliders for contract price, rented hash rate, BTC forecast, maintenance fee, contract length.
- **FR-302:** Live outputs: daily revenue, daily fee, daily profit, total profit, plus a verdict (profitable / won't break even / losing daily).
- **FR-303:** Animated mining visual scales with hash rate.
- **FR-304:** A static "red flags of fake cloud mining" panel is always visible.

### 4.4 Quiz

- **FR-401:** 8 questions, one at a time, with progress bar.
- **FR-402:** Instant correct/incorrect feedback with the correct answer highlighted.
- **FR-403:** Final score as %; pass mark 50%. Below 50% blocks certification and offers retake.
- **FR-404:** Passing auto-fills the score into the certificate form and links to it.

### 4.5 Certificate of Completion

- **FR-501:** Form: full name, gender (Male/Female radio), score (editable, 0–100).
- **FR-502:** Live preview renders `Mr. <Name>` / `Ms. <Name>`, `Score: X% • Gender`, grade (A ≥90, B ≥75, C ≥50, F <50), date, unique ID (`QCM-…`).
- **FR-503:** Issue requires: name ≥2 chars, gender selected, score 0–100 and ≥50. Each failure shows a specific message.
- **FR-504:** Issued certificates persist; Print / Save-as-PDF works via print stylesheet.
- **FR-505:** Signatory line reads **Pastor Yemisi Kudehinbu**.

### 4.6 Partner with the developer

- **FR-601:** Partner buttons (header, floating, section, certificate page) open a modal showing **OPAY 8130522995** (Qubators Developer) with one-tap copy and a keep-your-receipt note.

### 4.7 Install & platforms

- **FR-701:** PWA: manifest, 192/512/maskable icons, offline service worker, `📲 Install App` prompt button, safe-area support, iOS touch icon.
- **FR-702:** Native builds via GitHub Actions: Android APK (`android/` WebView wrapper), Windows portable EXE + macOS DMG (Electron, offline local server).
- **FR-703:** On-site install card offers Android / Windows / macOS / browser-install options with per-OS install notes.
- **FR-704:** Releases carry stable download URLs (`…/releases/download/vX.Y/…`).

### 4.8 Demo, About, Proposal (site pages)

- **FR-801:** Demo page: auto-playing 5-step illustrated phone-mockup tour (manual prev/next/pause) + embedded 67-sec product video + platform buttons.
- **FR-802:** In-app Demo tab: video player + guided-tour jump buttons (no login required).
- **FR-803:** About page: product story, full feature list, learner journey, downloads table, team, partner account, FAQ, version history; cross-linked from app/demo footers.
- **FR-804:** Proposal page: 9-section product & partnership proposal with print stylesheet, linked from About.

## 5. Core user flows

1. **First run:** login screen → Sign up → lessons → simulator → quiz (≥50%) → certificate issued → print/PDF.
2. **Return visit:** session restored → progress bar reflects saved lessons/quiz/certificate.
3. **Install:** site install card → platform file → OS-specific install → app icon launches product.

## 6. Data model (client-side)

| Key | Content |
|---|---|
| `qm_users` | `{ email: { name, gender, email, ph (SHA-256, djb2 fallback) } }` |
| `qm_user` | Active session (same shape as one user) |
| `qm_lessons` | Array of completed lesson indexes |
| `qm_score` | Last quiz score (%) |
| `qm_cert` | `{ name, gender, score, title, date, id }` |

All data lives in the browser/device `localStorage`. Clearing site data resets the app.

## 7. Acceptance criteria (release checklist)

- [ ] Fresh visitor sees login first; signup validation messages appear for each bad field.
- [ ] All 4 lessons complete and persist after reload.
- [ ] Simulator verdict flips correctly (profitable / break-even-miss / daily-loss).
- [ ] Score <50% cannot issue; ≥50% issues with correct title, grade and ID.
- [ ] Partner modal shows 8130522995 with working copy on all pages.
- [ ] `manifest.webmanifest`, `sw.js`, all icons return HTTP 200 on the live site.
- [ ] Release assets (APK/EXE/DMG/MP4) return HTTP 200 with correct byte sizes.
- [ ] Video plays in the in-app Demo tab and demo page.
- [ ] No console-blocking JS errors on any page (single script block parses).

## 8. Constraints & assumptions

- Auth is demo-grade (local only); anyone with device access can read stored data. Documented in-app and FAQ.
- Desktop/mobile binaries are unsigned: Windows SmartScreen and macOS Gatekeeper need documented bypass steps.
- Single-file web app (`qubators-miner.html`); no build step, no backend.
- Market figures (BTC price figures in-app) are teaching defaults, not live data.

## 9. Out of scope / roadmap

- **v1.2:** more questions, Hausa/Yoruba/Igbo, reminders, shareable certificate links.
- **v2.0:** institution dashboard + ID verification, classroom mode, scam-report board.
- **Long term:** Play Store / Microsoft Store listings, school partnerships.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Learner clears browser data → progress lost | Documented; export/print certificate advised |
| Unsigned binaries trigger OS warnings | Per-OS install notes on site + About |
| Stale teaching defaults as BTC changes | Simulator inputs are user-editable; periodic content pass |
| Slow networks for ~170 MB desktop downloads | PWA (KBs) offered as the light path; resume-able release CDN links |
