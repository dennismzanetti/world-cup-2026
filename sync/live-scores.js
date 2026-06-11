// sync/live-scores.js
// Polls the ESPN public scoreboard API for live/finished World Cup 2026 scores
// and writes them into Firestore so the front-end onSnapshot listener
// can push updates to all connected browsers in real time.
//
// Run via GitHub Actions (.github/workflows/sync-scores.yml) every 5 minutes.
// Requires one environment variable (set as GitHub Secret):
//   FIREBASE_SERVICE_ACCOUNT_JSON  — full JSON of a Firebase service account
//
// No API key needed for ESPN.

import fetch from 'node-fetch';
import admin from 'firebase-admin';

// ─── Firebase Admin Init ─────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── ESPN public scoreboard API ───────────────────────────────────────────────
const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// ─── Team name normalisation ──────────────────────────────────────────────────
const TEAM_NAME_MAP = {
  'Mexico':                   'Mexico',
  'South Africa':             'South Africa',
  'Korea Republic':           'South Korea',
  'South Korea':              'South Korea',
  'Czech Republic':           'Czechia',
  'Czechia':                  'Czechia',
  'Canada':                   'Canada',
  'Bosnia & Herzegovina':     'Bosnia-Herzegovina',
  'Bosnia and Herzegovina':   'Bosnia-Herzegovina',
  'Bosnia-Herzegovina':       'Bosnia-Herzegovina',
  'Qatar':                    'Qatar',
  'Switzerland':              'Switzerland',
  'Brazil':                   'Brazil',
  'Morocco':                  'Morocco',
  'Haiti':                    'Haiti',
  'Scotland':                 'Scotland',
  'USA':                      'USA',
  'United States':            'USA',
  'Paraguay':                 'Paraguay',
  'Australia':                'Australia',
  'Turkey':                   'Türkiye',
  'Türkiye':                  'Türkiye',
  'Germany':                  'Germany',
  'Curaçao':                  'Curaçao',
  'Curacao':                  'Curaçao',
  "Cote d'Ivoire":            'Ivory Coast',
  "Côte d'Ivoire":            'Ivory Coast',
  'Ivory Coast':              'Ivory Coast',
  'Ecuador':                  'Ecuador',
  'Netherlands':              'Netherlands',
  'Japan':                    'Japan',
  'Sweden':                   'Sweden',
  'Tunisia':                  'Tunisia',
  'Belgium':                  'Belgium',
  'Egypt':                    'Egypt',
  'Iran':                     'Iran',
  'New Zealand':              'New Zealand',
  'Spain':                    'Spain',
  'Cape Verde':               'Cape Verde',
  'Saudi Arabia':             'Saudi Arabia',
  'Uruguay':                  'Uruguay',
  'France':                   'France',
  'Senegal':                  'Senegal',
  'Iraq':                     'Iraq',
  'Norway':                   'Norway',
  'Argentina':                'Argentina',
  'Algeria':                  'Algeria',
  'Austria':                  'Austria',
  'Jordan':                   'Jordan',
  'Portugal':                 'Portugal',
  'DR Congo':                 'Congo DR',
  'Congo DR':                 'Congo DR',
  'Congo, DR':                'Congo DR',
  'Uzbekistan':               'Uzbekistan',
  'Colombia':                 'Colombia',
  'England':                  'England',
  'Croatia':                  'Croatia',
  'Ghana':                    'Ghana',
  'Panama':                   'Panama',
};

function normalise(name) {
  return TEAM_NAME_MAP[name] ?? name;
}

// ─── Parse ESPN status → app token ─────────────────────────────────────────────
// ESPN uses status.type.state: 'pre' | 'in' | 'post'
// status.type.name examples: STATUS_SECOND_HALF, STATUS_HALFTIME, STATUS_FULL_TIME
function parseStatus(event) {
  const state = event.status?.type?.state;
  const name  = event.status?.type?.name ?? '';
  if (state === 'post') return 'finished';
  if (state === 'in') {
    if (name === 'STATUS_HALFTIME') return 'ht';
    return 'live';
  }
  return 'scheduled';
}

// ESPN clock is like "61'" — strip the prime symbol and parse as int
function parseMinute(event) {
  const clock = event.status?.displayClock ?? '';
  const mins  = parseInt(clock.replace(/[^0-9]/g, ''), 10);
  return isNaN(mins) || mins === 0 ? null : mins;
}

// ─── Main sync ────────────────────────────────────────────────────────────────
async function syncScores() {
  console.log(`[${new Date().toISOString()}] Fetching scoreboard from ESPN…`);

  const res = await fetch(ESPN_URL, {
    headers: { 'User-Agent': 'world-cup-2026-sync/1.0' }
  });

  if (!res.ok) {
    console.error(`ESPN API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data   = await res.json();
  const events = data.events ?? [];
  console.log(`  ESPN returned ${events.length} event(s) today.`);

  if (!events.length) {
    console.log('  No matches today — nothing to update.');
    return;
  }

  let updated = 0;

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const homeTeam = normalise(homeComp.team.displayName);
    const awayTeam = normalise(awayComp.team.displayName);
    const status   = parseStatus(event);
    const minute   = parseMinute(event);

    if (status === 'scheduled') {
      console.log(`  Skipping (not started): ${homeTeam} vs ${awayTeam}`);
      continue;
    }

    const homeScore = parseInt(homeComp.score ?? '0', 10);
    const awayScore = parseInt(awayComp.score ?? '0', 10);

    const snap = await db.collection('matches')
      .where('homeTeam', '==', homeTeam)
      .where('awayTeam', '==', awayTeam)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(`  ⚠ No Firestore doc found for: ${homeTeam} vs ${awayTeam}`);
      continue;
    }

    await snap.docs[0].ref.update({
      homeScore,
      awayScore,
      status,
      minute,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✓ ${homeTeam} ${homeScore} : ${awayScore} ${awayTeam}  [${status}${minute ? ` ${minute}'` : ''}]`);
    updated++;
  }

  console.log(`  Done — ${updated} document(s) updated.`);
}

syncScores().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
