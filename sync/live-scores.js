// sync/live-scores.js
// Polls football-data.org v4 for live/finished World Cup 2026 scores
// and writes them into Firestore so the front-end onSnapshot listener
// can push updates to all connected browsers in real time.
//
// Run via GitHub Actions (.github/workflows/sync-scores.yml) every 5 minutes.
// Requires two environment variables (set as GitHub Secrets):
//   FOOTBALL_DATA_API_KEY            — free tier key from football-data.org
//   FIREBASE_SERVICE_ACCOUNT_JSON    — full JSON of a Firebase service account

import fetch from 'node-fetch';
import admin from 'firebase-admin';

// ─── Firebase Admin Init ─────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── football-data.org API ────────────────────────────────────────────────────
const API_KEY  = process.env.FOOTBALL_DATA_API_KEY;
const API_URL  = 'https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED,FINISHED';

// Status mapping: football-data.org → app status tokens
const STATUS_MAP = {
  IN_PLAY:  'live',
  PAUSED:   'ht',       // half-time
  FINISHED: 'finished',
  TIMED:    'scheduled',
  SCHEDULED:'scheduled',
};

// ─── Team name normalisation ──────────────────────────────────────────────────
// Maps football-data.org team names → names used in WC_MATCHES / Firestore.
// Add entries here if the API uses different spellings.
const TEAM_NAME_MAP = {
  'Mexico':                     'Mexico',
  'South Africa':               'South Africa',
  'Korea Republic':             'South Korea',
  'Czech Republic':             'Czechia',
  'Czechia':                    'Czechia',
  'Canada':                     'Canada',
  'Bosnia and Herzegovina':     'Bosnia-Herzegovina',
  'Qatar':                      'Qatar',
  'Switzerland':                'Switzerland',
  'Brazil':                     'Brazil',
  'Morocco':                    'Morocco',
  'Haiti':                      'Haiti',
  'Scotland':                   'Scotland',
  'USA':                        'USA',
  'United States':              'USA',
  'Paraguay':                   'Paraguay',
  'Australia':                  'Australia',
  'Turkey':                     'Türkiye',
  'Türkiye':                    'Türkiye',
  'Germany':                    'Germany',
  'Curaçao':                    'Curaçao',
  'Curacao':                    'Curaçao',
  'Côte d\'Ivoire':             'Ivory Coast',
  'Ivory Coast':                'Ivory Coast',
  'Ecuador':                    'Ecuador',
  'Netherlands':                'Netherlands',
  'Japan':                      'Japan',
  'Sweden':                     'Sweden',
  'Tunisia':                    'Tunisia',
  'Belgium':                    'Belgium',
  'Egypt':                      'Egypt',
  'Iran':                       'Iran',
  'New Zealand':                'New Zealand',
  'Spain':                      'Spain',
  'Cape Verde':                 'Cape Verde',
  'Saudi Arabia':               'Saudi Arabia',
  'Uruguay':                    'Uruguay',
  'France':                     'France',
  'Senegal':                    'Senegal',
  'Iraq':                       'Iraq',
  'Norway':                     'Norway',
  'Argentina':                  'Argentina',
  'Algeria':                    'Algeria',
  'Austria':                    'Austria',
  'Jordan':                     'Jordan',
  'Portugal':                   'Portugal',
  'DR Congo':                   'Congo DR',
  'Congo DR':                   'Congo DR',
  'Uzbekistan':                 'Uzbekistan',
  'Colombia':                   'Colombia',
  'England':                    'England',
  'Croatia':                    'Croatia',
  'Ghana':                      'Ghana',
  'Panama':                     'Panama',
};

function normalise(apiName) {
  return TEAM_NAME_MAP[apiName] ?? apiName;
}

// ─── Main sync ────────────────────────────────────────────────────────────────
async function syncScores() {
  console.log(`[${new Date().toISOString()}] Fetching live/finished matches…`);

  const res = await fetch(API_URL, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    console.error(`API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const { matches } = await res.json();
  console.log(`  API returned ${matches.length} match(es).`);

  if (!matches.length) {
    console.log('  Nothing to update.');
    return;
  }

  let updated = 0;

  for (const m of matches) {
    const homeTeam = normalise(m.homeTeam.name);
    const awayTeam = normalise(m.awayTeam.name);

    // Look up the Firestore document by homeTeam + awayTeam fields
    const snap = await db.collection('matches')
      .where('homeTeam', '==', homeTeam)
      .where('awayTeam', '==', awayTeam)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(`  No Firestore doc found for: ${homeTeam} vs ${awayTeam}`);
      continue;
    }

    const docRef = snap.docs[0].ref;
    const status  = STATUS_MAP[m.status] ?? 'scheduled';

    // Prefer full-time score; fall back to half-time score during HT
    const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null;
    const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null;

    // minute is provided by the API during IN_PLAY
    const minute = m.minute ?? null;

    await docRef.update({
      homeScore,
      awayScore,
      status,
      minute,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  Updated: ${homeTeam} ${homeScore ?? '-'} : ${awayScore ?? '-'} ${awayTeam}  [${status}${minute ? ` ${minute}'` : ''}]`);
    updated++;
  }

  console.log(`  Done — ${updated} document(s) updated.`);
}

syncScores().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
