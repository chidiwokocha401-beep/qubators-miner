# Qubators Miner — Commercial Feasibility Study ("How Buyable Is It?")

- **Date:** October 2026
- **Status:** Internal (like the PRD — not for the site)
- **Product:** v1.1 (free course app + certificate + 4 platforms)
- **Question:** Can this product earn money, who would pay, and what must change first?

## 0. Headline verdict

**As a paid consumer app: weakly buyable. As a freemium + institutional + donor-funded education product: genuinely viable.** The money is not in selling the app to learners — it is in (1) paid/verified certificates, (2) schools & hubs buying training deployments, and (3) grants for digital-literacy / fraud-prevention. Direct B2C payment should come last, not first.

## 1. Demand evidence (external, sourced)

- **Crypto fraud is massive and growing.** Chainalysis (2026 report) estimates a record **~$17B stolen in crypto scams in 2025**; FBI IC3 (2025) puts US cyber-enabled fraud near **$21B**; Interpol's 2025 Africa operation found **65,000 victims / ~$300M lost in a single Zambian scheme**; continent-wide reported cybercrime losses in Africa roughly **doubled year-on-year ($192M → $484M)**. Scam-literacy — our core content — is a real, painful, growing need.
- **African e-learning is a multi-billion market.** IMARC/Statista-style estimates put Africa e-learning at **~$4B in 2026, heading to ~$8B by the mid-2030s (~9–12% CAGR)**. Direction matters more than precision: steady growth, youth-driven.
- **The "free course, paid certificate" model is proven.** Major MOOC platforms (Coursera-style, UCT MOOCs) enroll free and charge only for the certificate — completion-credential monetization is the industry's standard freemium lever, and it maps 1:1 onto our certificate feature.

## 2. Buyability by channel (scored)

| # | Channel | Verdict | Why |
|---|---|---|---|
| 1 | B2C paid download / subscription | ⭐⭐ Weak | Learners expect free; low disposable income in core market; payment friction; free alternatives abound |
| 2 | Freemium verified certificates | ⭐⭐⭐⭐ Strong | Proven MOOC model; our certificate already exists — needs server-side verification to be worth paying for |
| 3 | B2B: schools, hubs, NYSC/CDS, cooperatives | ⭐⭐⭐⭐ Strong | Ready-made offline-capable curriculum; institutions pay for training content + completion records |
| 4 | Sponsorships (legit educators/exchanges) | ⭐⭐⭐ Moderate | Audience fit is good, but requires traffic numbers we don't have yet; start with lesson-slot sponsors |
| 5 | Grants / donor funding (digital literacy, fraud prevention) | ⭐⭐⭐⭐ Strong | Mission aligns perfectly with foundation mandates (youth skills, consumer protection); proposal already written |
| 6 | Referral/app-store revenue | ⭐⭐ Weak now | Needs Play Store listing + volume; revisit post-v2.0 |

## 3. Willingness-to-pay logic (Nigeria-first)

- Micro-payments via mobile money rails (OPAY is already our rail — good instinct) fit better than cards: think **₦500–₦2,000 for a verified certificate**, not subscriptions.
- Institutions pay 10–100x more per deal than individuals: one hub training 200 learners beats 200 individual conversions.
- Certificates only command money if **verifiable** (ID lookup page) — today ours is a self-printed PDF. Verification is the single highest-ROI build for buyability.

## 4. Blockers to fix before charging anyone

1. **Server-side auth + accounts** (today: localStorage only — can't sell cross-device anything).
2. **Certificate verification endpoint** (ID → record lookup; kills forgery objection).
3. **Play Store listing** (trust + discoverability + easy payments via Play billing later).
4. **Usage analytics** (sponsors/grants ask for learner numbers; currently zero instrumentation).
5. **Content freshness process** (BTC figures age; a stale simulator erodes institutional trust).

## 5. Recommended phasing

- **Phase 1 (now, ₦0 dev cost):** grant applications with existing proposal + demo video; pilot with 1–2 hubs for free in exchange for testimonials and completion data.
- **Phase 2 (v1.2):** verification page + analytics → launch paid verified certificates (₦500–₦2,000) while keeping basic certificates free.
- **Phase 3 (v2.0):** institution dashboard → B2B term licenses per cohort; Play Store listing → revisit consumer monetization.

## 6. Risks to watch

- Freemium backlash if the free certificate feels degraded — keep today's certificate exactly as free as now.
- Grant dependence without traction data — pilots must produce completion numbers.
- Regulatory: OPAY/personal-account rails are fine for donations but formal B2B needs a registered business account eventually.
- Competition: free YouTube/crypto content — our moat is interactivity + certification + offline, not content alone.

## 7. Bottom line

Don't sell the app. **Sell the proof (verified certificates), the deployment (institutions), and the mission (grants).** Do those three, in that order, and the product funds itself without ever charging a learner to learn.
