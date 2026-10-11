# Qubators Miner — User Definitions (Personas & Roles)

- **Date:** October 2026
- **Status:** Internal (like PRD/feasibility — not for the site)
- **Product:** v1.1

## 1. Primary user: The Curious Beginner ("Adaeze")

- **Who:** 16–35, smartphone-first, little or no crypto knowledge. Hears about "mining" from friends, social media, or "earn daily" adverts.
- **Goals:** Understand what cloud mining is; avoid being scammed; earn a certificate to show for the effort.
- **Pains:** Jargon-heavy content; can't tell legit platforms from scams; expensive data — hates wasting MBs on walls of text.
- **Behaviors:** Learns in short bursts; prefers tapping and sliders over reading; shares achievements (certificate) on WhatsApp/status.
- **What the product gives her:** 4 bite-size lessons, hands-on simulator, quiz with instant feedback, personalized Mr./Ms. certificate, offline-capable app.

## 2. Secondary user: The Hustling Youth ("Tunde")

- **Who:** 18–30, actively looking for digital income/skills; may already have been burned (or nearly burned) by a Ponzi-style "investment" scheme.
- **Goals:** Verifiable proof of skill for CVs/gig profiles; practical judgment about mining offers.
- **Pains:** Paid courses are unaffordable; free content rarely comes with proof of completion.
- **Behaviors:** Compares options fast; asks "will this help me earn?"; will pay small amounts for credentials that look credible.
- **What the product gives him:** Free certificate now; verified-certificate path (v1.2) as the upsell; scam red-flag training that directly protects his wallet.

## 3. Institutional user: The Trainer ("Mrs. Okafor / Hub Lead")

- **Who:** Runs a school, tech hub, NYSC CDS group, cooperative or church youth program; needs ready-made training content.
- **Goals:** Deliver a complete mini-course with zero prep; track who finished; show outcomes to funders.
- **Pains:** No curriculum, no devices budget, unreliable internet at venue.
- **Behaviors:** Adopts tools that work offline and need no trainer expertise; reports completions upward.
- **What the product gives her:** Offline apps (EXE/DMG/APK), structured 5-step learner journey, printable certificates; (v2.0: dashboard + ID verification).

## 4. Economic user: The Partner / Sponsor ("The Backer")

- **Who:** Individual supporter, diaspora donor, legit educator/exchange, or foundation officer funding digital literacy / fraud prevention.
- **Goals:** Fund something real and visible; reach youth audiences; measurable impact (learners, completions).
- **Pains:** Can't verify small projects are legitimate or active.
- **Behaviors:** Checks the live product, repo activity, and demo before committing; prefers mobile-money rails (OPAY).
- **What the product gives him:** Public repo + live site + demo video as due-diligence pack; proposal with tiers; OPAY 8130522995 rail; release-note credits.

## 5. Verifier ("The Employer")

- **Who:** Anyone handed a Qubators certificate — employer, client, admissions officer.
- **Goals:** Confirm the certificate is genuine in under 30 seconds.
- **Behaviors:** Opens the verify link, pastes the ID, expects a clear VALID/INVALID answer.
- **What the product gives them:** `verify.html` with checksum validation and deep links (`?id=`).

## 6. Roles vs. accounts (v1.1 reality)

| Role | Account type | Capabilities |
|---|---|---|
| Learner | Local signup (name/gender/email) | Lessons, simulator, quiz, own certificate |
| Holder | None needed | Holds/shares certificate + verify link |
| Verifier | None needed | Paste ID on verify page |
| Builder | Repo access (Kingsley) | Ships releases |
| Backer | None (OPAY transfer) | Funds roadmap, credited in releases |

No admin/institution roles exist yet — that is v2.0 (dashboard) scope.

## 7. Anti-personas (who this is NOT for)

- **Real miners** seeking live pool software or profit dashboards — we simulate only.
- **Investors** looking to buy hash power or returns through the app — explicitly out of scope (NG1).
- **Credential fraudsters** — checksum verification + future server registry exist to stop them.
