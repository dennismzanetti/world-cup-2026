// sync/live-scores.js
// Fetches live World Cup 2026 scores via ESPN APIs and writes to Firestore.
// Gets event IDs from scoreboard, then fetches each summary for fresh status.
// No API key needed.
// Requires: FIREBASE_SERVICE_ACCOUNT_JSON (GitHub Secret)

import fetch from 'node-fetch';
import admin from 'firebase-admin';

// ─── Firebase Admin Init ─────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'wc2026' });

const HEADERS = { 'User-Agent': 'world-cup-2026-sync/1.0' };

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY_URL    = id => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`;

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

function normalise(name) { return TEAM_NAME_MAP[name] ?? name; }

function parseStatus(statusObj) {
  const state = statusObj?.type?.state;
  const name  = statusObj?.type?.name ?? '';
  if (state === 'post') return 'finished';
  if (state === 'in') return name === 'STATUS_HALFTIME' ? 'ht' : 'live';
  return 'scheduled';
}

function parseMinute(statusObj) {
  const clock = statusObj?.displayClock ?? '';
  const mins  = parseInt(clock.replace(/[^0-9]/g, ''), 10);
  return isNaN(mins) || mins === 0 ? null : mins;
}

async function syncScores() {
  console.log(`[${new Date().toISOString()}] Fetching scoreboard from ESPN…`);

  const sbRes = await fetch(SCOREBOARD_URL, { headers: HEADERS });
  if (!sbRes.ok) { console.error(`Scoreboard error: ${sbRes.status}`); process.exit(1); }
  const sbData  = await sbRes.json();
  const events  = sbData.events ?? [];
  console.log(`  Scoreboard returned ${events.length} event(s).`);
  if (!events.length) { console.log('  No matches today.'); return; }

  let updated = 0;

  for (const event of events) {
    const eventId = event.id;
    console.log(`  Fetching summary for event ${eventId} (${event.name})…`);

    const sumRes = await fetch(SUMMARY_URL(eventId), { headers: HEADERS });
    if (!sumRes.ok) { console.warn(`  Summary error ${sumRes.status} for event ${eventId}`); continue; }
    const sumData = await sumRes.json();

    const comp = sumData.header?.competitions?.[0];
    if (!comp) { console.warn('  No competition found in summary'); continue; }

    const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const homeTeam = normalise(homeComp.team.displayName);
    const awayTeam = normalise(awayComp.team.displayName);
    const statusObj = comp.status;
    const status    = parseStatus(statusObj);
    const minute    = parseMinute(statusObj);

    console.log(`  -> ${homeTeam} vs ${awayTeam} | state=${statusObj?.type?.state} | name=${statusObj?.type?.name} | clock=${statusObj?.displayClock} | score=${homeComp.score}-${awayComp.score}`);

    if (status === 'scheduled') {
      console.log(`  Skipping (not started).`);
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
      console.warn(`  ⚠ No Firestore doc: ${homeTeam} vs ${awayTeam}`);
      continue;
    }

    await snap.docs[0].ref.update({
      homeScore, awayScore, status, minute,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✓ ${homeTeam} ${homeScore} : ${awayScore} ${awayTeam}  [${status}${minute ? ` ${minute}'` : ''}]`);
    updated++;
  }

  console.log(`  Done — ${updated} document(s) updated.`);
}

syncScores().catch(err => { console.error('Sync failed:', err); process.exit(1); });
