# Project NEXUS — Secured Student Examination Portal

An online examination platform built with a singular focus: **absolute integrity and session fairness**.

---

## 🚀 The Core Thesis & Promises

1. **No leak is useful.** By dynamically assembling customized test forms from a secure server-side bank and generating deterministic numerical parameters on-the-fly, no two papers are identical. Answer keys are strictly computed and validated on the backend.
2. **No shift is luckier.** High-stakes exams delivered across distinct shifts can vary in difficulty. NEXUS utilizes **Equipercentile Cross-Shift Normalization** (calculated on the server) to normalize outcomes—ensuring talent, rather than difficulty luck, determines placement.

---

## 🛠️ Stack & Architecture

- **Frontend:** React + Tailwind CSS, custom inline SVG capability charts, Web Crypto (for cryptographic credential illustration), and native `getUserMedia` camera monitoring.
- **Backend:** Express & Node.js serving as a high-fidelity server simulating Supabase Edge Functions & DB layers natively on port 3000.
- **Blockchain Tamper Logging:** Secure SHA-256 HMAC hash-chained event logging.

```
Browser Client (React)  ──────HTTPS/TLS──────>  Secure Backend (Express / /api/*)
  • Dynamic question rendering                    • Automated Test Assembly (ATA)
  • Keystroke biometric calculation               • Server-side Scoring & IRT Estimations
  • Focus boundary tracking                       • Hash-chained tamper logs
  • GDPR / DPDP Consent Controls                  • Equipercentile normalization equations
```

---

## 🌐 Alignment & Verification: Real vs. Simulated

| Security Protocol | Verification Status | Implementation & Architectural Details |
|---|---|---|
| **Focus Tracking** | **Real** | Fires a window `blur` / `focus` event and logs focus losses automatically to the server's database via the `/api/exams/log-event` endpoint. |
| **Keystroke Biometric** | **Real Metrics** | Tracks keydown/keyup timing metrics to compute standard deviation intervals, logging anomalies if speed variance diverges from expected normal range. |
| **Secure Watermarking** | **Real** | Generates a per-student hash containing the session seed, option lists layout indices, and candidate metadata to seamlessly traceback leaked snaps. |
| **Face & Retina Scan** | **Real / Local** | Queries camera video feeds locally (respecting DPDP consent frames and GDPR rules), visualizing overlays without leaking faces to third-party databases. |
| **Response-time & Collusion Scan** | **Real** | Detects collusion vectors by evaluating overlapping option matrix synergy and highlighting fast-answering anomalies inside proctor checklists. |
| **Exposure Control** | **Real** | Limits compromised banks by incrementing exposure counts and picking lesser-frequented item combinations dynamically during Automated Test Assembly (ATA). |
| **Stress Monitoring** | **Simulated Demo** | Visualizes conceptual stress trends based on response speeds and typing intervals with kind, accessible advice prompts. |

---

## ⚖️ Fairness: IRT Assembly + Equipercentile Normalization

### 1. Automated Test Assembly (ATA)
During entry (`/api/exams/assemble`), the server reads candidate accommodations (e.g., extra time multipliers) and filters questions by IRT Difficulty $b$ and Discrimination $a$ levels. The engine selects a balanced content quota (e.g., 2 numerical, 2 conceptual, 1 ethical) ensuring every candidate receives a statistically unique yet equivalent platform paper.

### 2. Equipercentile Regularization
Raw score totals alone introduce discrepancies when shift difficulties differ. NEXUS maps direct performance score counts against total peers on the exact same shift:

$$\text{Percentile} = \frac{\text{Number of attempts with raw score} \leq \text{your score}}{\text{Total Session Shift Attempts}} \times 100$$

This aligns shift outcomes to a standardized, common percentiles framework, resolving any session bias.

---

## ⚙️ Quickstart & Setup

### 1. Environments Config
Create a `.env` in the project root:
```env
GEMINI_API_KEY="YOUR_KEY"
APP_URL="http://localhost:3000"
```

### 2. Run Locally
Install resources and start full-stack workspace development:
```bash
npm install
npm run dev
```

Open `http://localhost:3000` to interact with both the student assessments sandbox and high-level proctor cockpit controls!
