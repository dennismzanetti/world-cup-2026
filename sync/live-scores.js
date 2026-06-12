// sync/live-scores.js
// Fetches live World Cup 2026 scores from ESPN and updates Firestore match docs.
// Primary lookup: espnId field (set at seed time) — direct, unambiguous.
// Fallback: home+away field query (both orderings).
// No API key needed.
// Requires: FIREBASE_SERVICE_ACCOUNT_JSON (GitHub Secret)

import fetch from 'node-fetch';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─── Firebase Admin Init ──────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

console.log(`[init] project_id   : ${serviceAccount.project_id}`);
console.log(`[init] client_email : ${serviceAccount.client_email}`);
console.log(`[init] Firestore DB : wc2026`);

const app = initializeApp({ credential: cert(serviceAccount) });
const db  = getFirestore(app, 'wc2026');

const HEADERS = { 'User-Agent': 'world-cup-2026-sync/1.0' };

const SCOREBOARD_URL      = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SCOREBOARD_DATE_URL = date => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`;
const SUMMARY_URL         = id   => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`;

// ─── Team name normalisation (must match seed.js) ────────────────────────────
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
  'USA':                      'United States',
  'United States':            'United States',
  'Paraguay':                 'Paraguay',
  'Australia':                'Australia',
  'Turkey':                   'Türkiye',
  'Türkiye':                  'Türkiye',
  'Germany':                  'Germany',
  'Curaçao':                  'Curaçao',
  'Curacao':                  'Curaçao',
  "Cote d'Ivoire":            'Ivory Coast',
  "Çôte d'Ivoire":            'Ivory Coast',
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
  'Cabo Verde':               'Cape Verde',
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

// ─── Find Firestore doc for an ESPN event ─────────────────────────────────────
// Strategy 1 (preferred): look up by espnId field — set at seed time.
// Strategy 2 (fallback):  field query home+away in both orderings.
// Returns { docRef, docData, flipped } or null.
async function findMatchDoc(espnEventId, home, away) {
  // Strategy 1: direct espnId lookup
  const byId = await db.collection('matches')
    .where('espnId', '==', espnEventId)
    .limit(1)
    .get();
  if (!byId.empty) {
    const d = byId.docs[0];
    const data = d.data();
    const flipped = data.home !== home; // ESPN home differs from stored home
    return { docRef: d.ref, docData: data, flipped };
  }

  console.log(`     (espnId ${espnEventId} not found — falling back to name query)`);

  // Strategy 2: name-based query, both orderings
  for (const [h, a] of [[home, away], [away, home]]) {
    const snap = await db.collection('matches')
      .where('home', '==', h)
      .where('away', '==', a)
      .limit(1)
      .get();
    if (!snap.empty) {
      const d = snap.docs[0];
      const flipped = h !== home;
      return { docRef: d.ref, docData: d.data(), flipped };
    }
  }

  return null;
}

// ─── Update a single Firestore match from an ESPN competition object ──────────
async function updateMatchFromEvent(event) {
  const comp    = event.competitions?.[0] ?? event; // summary uses comp directly
  const eventId = event.id ?? comp.id;

  const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
  const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
  if (!homeComp || !awayComp) return false;

  const home      = normalise(homeComp.team.displayName);
  const away      = normalise(awayComp.team.displayName);
  const statusObj = comp.status;
  const status    = parseStatus(statusObj);
  const minute    = parseMinute(statusObj);

  console.log(`  -> ${home} vs ${away} | espnId=${eventId} | state=${statusObj?.type?.state} | clock=${statusObj?.displayClock} | score=${homeComp.score}-${awayComp.score}`);

  if (status === 'scheduled') {
    console.log(`     Skipping (not started).`);
    return false;
  }

  const homeScore = parseInt(homeComp.score ?? '0', 10);
  const awayScore = parseInt(awayComp.score ?? '0', 10);

  const result = await findMatchDoc(eventId, home, away);

  if (!result) {
    console.warn(`  ⚠ No Firestore doc found for: ${home} vs ${away} (espnId=${eventId})`);
    return false;
  }

  const { docRef, docData, flipped } = result;
  const finalHomeScore = flipped ? awayScore : homeScore;
  const finalAwayScore = flipped ? homeScore : awayScore;

  const update = {
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
    status,
    minute,
    updatedAt: FieldValue.serverTimestamp(),
  };
  // Persist espnId if it wasn't already set (pre-reseed docs)
  if (!docData.espnId) update.espnId = eventId;

  await docRef.update(update);

  console.log(`  ✓ Updated: ${docData.home} ${finalHomeScore}–${finalAwayScore} ${docData.away}  [${status}${minute ? ` ${minute}'` : ''}]`);
  return true;
}

// ─── Fetch ESPN events for a YYYYMMDD date string ────────────────────────────
async function fetchEventsByDate(dateStr) {
  const url = SCOREBOARD_DATE_URL(dateStr);
  console.log(`  Fetching scoreboard for date ${dateStr}…`);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) { console.warn(`  Scoreboard error ${res.status} for date ${dateStr}`); return []; }
  const data = await res.json();
  return data.events ?? [];
}

// ─── Backfill: update past matches still "scheduled" in Firestore ─────────────
async function backfillPastMatches() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const snap = await db.collection('matches')
    .where('status', '==', 'scheduled')
    .get();

  const pastMatches = snap.docs.filter(doc => {
    const d = doc.data();
    return d.date && d.date < todayStr;
  });

  if (!pastMatches.length) { console.log('  No past unresolved matches to backfill.'); return; }

  const dateSet = new Set(pastMatches.map(doc => doc.data().date));
  console.log(`  Backfilling ${pastMatches.length} past match(es) across ${dateSet.size} date(s)…`);

  let backfilled = 0;

  for (const date of dateSet) {
    const events = await fetchEventsByDate(date.replace(/-/g, ''));
    for (const event of events) {
      const sumRes = await fetch(SUMMARY_URL(event.id), { headers: HEADERS });
      if (!sumRes.ok) { console.warn(`  Summary error ${sumRes.status} for event ${event.id}`); continue; }
      const sumData = await sumRes.json();
      // Attach event.id to the competition object for lookup
      const comp = sumData.header?.competitions?.[0];
      if (!comp) continue;
      const syntheticEvent = { id: event.id, competitions: [comp] };
      const updated = await updateMatchFromEvent(syntheticEvent);
      if (updated) backfilled++;
    }
  }

  console.log(`  Backfill done — ${backfilled} document(s) updated.`);
}

// ─── Main sync ────────────────────────────────────────────────────────────────
async function syncScores() {
  console.log(`[${new Date().toISOString()}] Starting live-scores sync…`);

  await backfillPastMatches();

  console.log("  Fetching today's scoreboard from ESPN…");
  const sbRes = await fetch(SCOREBOARD_URL, { headers: HEADERS });
  if (!sbRes.ok) { console.error(`Scoreboard fetch failed: ${sbRes.status}`); process.exit(1); }

  const sbData = await sbRes.json();
  const events = sbData.events ?? [];
  console.log(`  Scoreboard returned ${events.length} event(s).`);

  if (!events.length) { console.log('  No matches today.'); return; }

  let updated = 0;

  for (const event of events) {
    console.log(`  Fetching summary for event ${event.id} (${event.name})…`);
    const sumRes = await fetch(SUMMARY_URL(event.id), { headers: HEADERS });
    if (!sumRes.ok) { console.warn(`  Summary error ${sumRes.status} for event ${event.id}`); continue; }
    const sumData = await sumRes.json();
    const comp    = sumData.header?.competitions?.[0];
    if (!comp) { console.warn('  No competition found in summary.'); continue; }
    const syntheticEvent = { id: event.id, competitions: [comp] };
    const didUpdate = await updateMatchFromEvent(syntheticEvent);
    if (didUpdate) updated++;
  }

  console.log(`  Done — ${updated} document(s) updated.`);
}

syncScores().catch(err => { console.error('Sync failed:', err); process.exit(1); });
