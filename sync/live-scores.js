// sync/live-scores.js
// Fetches live World Cup 2026 scores from ESPN and updates existing Firestore match docs.
// Matches must already exist in Firestore (seeded via seed.html).
// Backfills any past matches still marked "scheduled" by querying ESPN by date.
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

// ─── Slug helper (mirrors seed.js makeMatchId) ────────────────────────────────
function slug(s) {
  return (s || '').toLowerCase()
    .replace(/[çć]/g, 'c').replace(/[üú]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function makeMatchId(date, home, away) {
  return [date, slug(home), 'vs', slug(away)].join('-');
}

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

// ─── Find Firestore doc for a match ──────────────────────────────────────────
// Strategy (in order):
//   1. Field query: home == A, away == B
//   2. Field query: home == B, away == A  (ESPN/seed home-away swap)
//   3. Direct doc ID lookup: {date}-{slug(A)}-vs-{slug(B)}
//   4. Direct doc ID lookup: {date}-{slug(B)}-vs-{slug(A)}
// Returns { docRef, docData, flipped } or null.
async function findMatchDoc(home, away, dateStr) {
  // 1 & 2: field queries
  for (const [h, a] of [[home, away], [away, home]]) {
    const snap = await db.collection('matches')
      .where('home', '==', h)
      .where('away', '==', a)
      .limit(1)
      .get();
    if (!snap.empty) {
      const d = snap.docs[0];
      return { docRef: d.ref, docData: d.data(), flipped: h !== home };
    }
  }

  // 3 & 4: slug-based doc ID lookup (works even when field names are stale)
  if (dateStr) {
    for (const [h, a] of [[home, away], [away, home]]) {
      const id  = makeMatchId(dateStr, h, a);
      const ref = db.collection('matches').doc(id);
      const d   = await ref.get();
      if (d.exists) {
        console.log(`     (matched via doc ID: ${id})`);
        const data = d.data();
        // flipped = the ESPN "home" team is stored as "away" in the doc
        const flipped = data.home !== home && data.away === home;
        return { docRef: ref, docData: data, flipped };
      }
    }
  }

  return null;
}

// ─── Update a single Firestore match from an ESPN competition object ──────────
async function updateMatchFromComp(comp, dateStr) {
  const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
  const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
  if (!homeComp || !awayComp) return false;

  const home      = normalise(homeComp.team.displayName);
  const away      = normalise(awayComp.team.displayName);
  const statusObj = comp.status;
  const status    = parseStatus(statusObj);
  const minute    = parseMinute(statusObj);

  console.log(`  -> ${home} vs ${away} | state=${statusObj?.type?.state} | clock=${statusObj?.displayClock} | score=${homeComp.score}-${awayComp.score}`);

  if (status === 'scheduled') {
    console.log(`     Skipping (not started).`);
    return false;
  }

  const homeScore = parseInt(homeComp.score ?? '0', 10);
  const awayScore = parseInt(awayComp.score ?? '0', 10);

  const result = await findMatchDoc(home, away, dateStr);

  if (!result) {
    console.warn(`  ⚠ No Firestore doc found for: ${home} vs ${away} (date: ${dateStr})`);
    return false;
  }

  const { docRef, docData, flipped } = result;
  const finalHomeScore = flipped ? awayScore : homeScore;
  const finalAwayScore = flipped ? homeScore : awayScore;

  await docRef.update({
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
    status,
    minute,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`  ✓ Updated: ${docData.home} ${finalHomeScore}–${finalAwayScore} ${docData.away}  [${status}${minute ? ` ${minute}'` : ''}]`);
  return true;
}

// ─── Fetch ESPN events for a YYYYMMDD date string ────────────────────────────
async function fetchEventsByDate(dateStr) {
  const url = SCOREBOARD_DATE_URL(dateStr);
  console.log(`  Fetching scoreboard for date ${dateStr}…`);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`  Scoreboard error ${res.status} for date ${dateStr}`);
    return [];
  }
  const data = await res.json();
  return data.events ?? [];
}

// ─── Extract YYYY-MM-DD from an ESPN event object ────────────────────────────
function eventDate(event) {
  // event.date is ISO like "2026-06-11T19:00Z"
  return (event.date ?? '').slice(0, 10) || null;
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

  if (!pastMatches.length) {
    console.log('  No past unresolved matches to backfill.');
    return;
  }

  const dateSet = new Set(pastMatches.map(doc => doc.data().date));
  console.log(`  Backfilling ${pastMatches.length} past match(es) across ${dateSet.size} date(s)…`);

  let backfilled = 0;

  for (const date of dateSet) {
    const espnDate = date.replace(/-/g, '');
    const events   = await fetchEventsByDate(espnDate);

    for (const event of events) {
      const sumRes = await fetch(SUMMARY_URL(event.id), { headers: HEADERS });
      if (!sumRes.ok) { console.warn(`  Summary error ${sumRes.status} for event ${event.id}`); continue; }
      const sumData = await sumRes.json();
      const comp    = sumData.header?.competitions?.[0];
      if (!comp) continue;
      const updated = await updateMatchFromComp(comp, date);
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

  if (!events.length) {
    console.log('  No matches today.');
    return;
  }

  let updated = 0;

  for (const event of events) {
    const eventId = event.id;
    const date    = eventDate(event);
    console.log(`  Fetching summary for event ${eventId} (${event.name})…`);

    const sumRes = await fetch(SUMMARY_URL(eventId), { headers: HEADERS });
    if (!sumRes.ok) { console.warn(`  Summary error ${sumRes.status} for event ${eventId}`); continue; }

    const sumData = await sumRes.json();
    const comp    = sumData.header?.competitions?.[0];
    if (!comp) { console.warn('  No competition found in summary.'); continue; }

    const didUpdate = await updateMatchFromComp(comp, date);
    if (didUpdate) updated++;
  }

  console.log(`  Done — ${updated} document(s) updated.`);
}

syncScores().catch(err => { console.error('Sync failed:', err); process.exit(1); });
