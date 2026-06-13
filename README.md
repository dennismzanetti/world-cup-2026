# 🏆 World Cup 2026 Tracker

A web app to predict and track the results of the 2026 FIFA World Cup — 48 teams, 12 groups, 104 matches.

🔗 **Live app:** [dennismzanetti.github.io/world-cup-2026](https://dennismzanetti.github.io/world-cup-2026)

---

## Features

### Groups
- Browse all 12 groups with their 4 teams each
- Live group standings auto-calculated from match results (P / W / D / L / GF / GA / GD / Pts)
- Qualification indicators showing which teams advance

### Matches
- Full schedule of all 104 matches (group stage + knockout rounds)
- Venue, date/time, and broadcast info for every match
- Filter by date, stage/group, venue, or team name search
- Enter final scores for completed matches — standings update in real time
- Scores persist to Firestore and sync across all users instantly

### Predictions
Four sub-tabs under the Predictions view:

| Sub-tab | Description |
|---|---|
| **My Predictions** | Enter your predicted score for every match before kickoff |
| **Group Standings** | See how the standings would look based on your predicted results |
| **Prediction Accuracy** | Track your score — exact results, correct outcomes, and total points |
| **Knockout Bracket** | Visual bracket showing your predicted path to the final |

**Prediction scoring on finished matches:** each prediction card shows the final score alongside your predicted score and a color-coded outcome badge — 🎯 Exact!, ✅ Correct result, or ❌ Wrong.

### User Accounts
- Sign in / sign up via Firebase Authentication (email + password)
- Predictions are saved per-user in Firestore and available across devices
- Sign-in prompt shown inline when unauthenticated; predictions require login to save

### Live Score Sync
- `sync/live-scores.js` — Node.js script that polls the ESPN API and writes results back to Firestore
- Match IDs in `data/matches.json` are aligned with Firestore document IDs for reliable correlation
- `sync/debug-espn.js` and `sync/debug-ids.js` — diagnostic tools for verifying ESPN ↔ Firestore ID mapping

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Pure HTML + CSS + ES Modules (no framework, no build step) |
| Fonts | Satoshi (Fontshare) + Bebas Neue (Google Fonts) |
| Backend / DB | Firebase Firestore (real-time sync) |
| Auth | Firebase Authentication |
| Hosting | GitHub Pages |
| Score sync | Node.js script (`sync/live-scores.js`) via ESPN API |

---

## Project Structure

```
world-cup-2026/
├── index.html              # Single-page app shell
├── favicon.svg / .ico      # Custom soccer-ball logo
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
├── firebase.json           # Firebase hosting config
├── seed.html / seed.js     # One-time Firestore data seeder
│
├── assets/
│   ├── app.js              # Main app logic (views, cards, filters, predictions)
│   ├── db.js               # Firestore read/write helpers
│   ├── firebase.js         # Firebase initialization
│   ├── auth.js             # Auth state helpers
│   ├── style.css           # All styles (design tokens, dark/light mode, components)
│   └── version.js          # Build badge shown in the footer
│
├── data/
│   └── matches.json        # All 104 matches — IDs match Firestore documents
│
└── sync/
    ├── live-scores.js      # ESPN → Firestore score sync script
    ├── debug-espn.js       # Inspect ESPN API responses
    ├── debug-ids.js        # Verify match ID alignment across data sources
    └── package.json        # Node dependencies for sync scripts
```

---

## Firestore Data Model

```
matches/{matchId}           # Match document (id, teams, date, venue, scores, status)
predictions/{userId}/picks/{matchId}   # Per-user predictions
```

Match IDs in `data/matches.json` are the canonical source and must stay in sync with Firestore document IDs. The `sync/` scripts depend on this alignment to write scores to the correct documents.

---

## Setup

### Run locally
1. Clone the repo
2. Open `index.html` in a browser — or serve with any static file server
3. The app connects to the shared Firebase project; no local Firebase emulator required

### Seed Firestore (one-time)
1. Open `seed.html` in a browser while authenticated as an admin user
2. Click **Seed Matches** — this writes all 104 match documents to Firestore

### Run the score sync script
```bash
cd sync
npm install
node live-scores.js
```
The script polls the ESPN API on a configurable interval and writes final scores to Firestore.

---

## Roadmap

- [ ] Admin panel for entering scores directly in the UI (without the sync script)
- [ ] Prediction leaderboard across all registered users
- [ ] Push notifications when a predicted match kicks off
- [ ] Knockout stage predictions (not just group stage)
- [ ] PWA / installable on mobile
