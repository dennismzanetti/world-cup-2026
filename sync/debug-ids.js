// sync/debug-ids.js
// Dumps ALL match doc IDs from Firestore and compares them against
// the IDs the sync code would generate for today's ESPN events.
// Run: node debug-ids.js

import fetch from 'node-fetch';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const app = initializeApp({ credential: cert(serviceAccount) });
const db  = getFirestore(app, 'wc2026');

const HEADERS = { 'User-Agent': 'world-cup-2026-debug/1.0' };
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SCOREBOARD_DATE_URL = d => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${d}`;
const SUMMARY_URL = id => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`;

const TEAM_NAME_MAP = {
  'Korea Republic': 'South Korea', 'Czech Republic': 'Czechia',
  'Bosnia & Herzegovina': 'Bosnia-Herzegovina', 'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'USA': 'United States', 'Turkey': 'T\u00fcrkiye', 'Curacao': 'Cura\u00e7ao',
  "Cote d'Ivoire": 'Ivory Coast', "\u00c7\u00f4te d'Ivoire": 'Ivory Coast',
  'Cabo Verde': 'Cape Verde', 'DR Congo': 'Congo DR', 'Congo, DR': 'Congo DR',
};
function normalise(name) { return TEAM_NAME_MAP[name] ?? name; }

function slug(s) {
  return (s || '').toLowerCase()
    .replace(/[\u00e7\u0107]/g, 'c').replace(/[\u00fc\u00fa]/g, 'u').replace(/[\u00f1]/g, 'n')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function makeMatchId(date, home, away) {
  return [date, slug(home), 'vs', slug(away)].join('-');
}

async function main() {
  // 1. Dump all Firestore doc IDs
  console.log('\n=== FIRESTORE MATCH DOC IDs ===');
  const snap = await db.collection('matches').orderBy('date').get();
  const firestoreIds = new Set();
  for (const d of snap.docs) {
    const data = d.data();
    firestoreIds.add(d.id);
    if (data.stage && data.stage.startsWith('Group')) {
      console.log(`  ${d.id}   home=${data.home}  away=${data.away}  status=${data.status}`);
    }
  }

  // 2. Fetch today's ESPN events and show what IDs we'd generate
  console.log('\n=== ESPN TODAY → GENERATED IDs ===');
  const sbRes = await fetch(SCOREBOARD_URL, { headers: HEADERS });
  const sbData = await sbRes.json();
  const todayEvents = sbData.events ?? [];

  for (const event of todayEvents) {
    const sumRes = await fetch(SUMMARY_URL(event.id), { headers: HEADERS });
    const sumData = await sumRes.json();
    const comp = sumData.header?.competitions?.[0];
    if (!comp) continue;
    const hc = comp.competitors?.find(c => c.homeAway === 'home');
    const ac = comp.competitors?.find(c => c.homeAway === 'away');
    if (!hc || !ac) continue;
    const rawHome = hc.team.displayName;
    const rawAway = ac.team.displayName;
    const home = normalise(rawHome);
    const away = normalise(rawAway);
    const date = (event.date ?? '').slice(0, 10);
    const idFwd = makeMatchId(date, home, away);
    const idRev = makeMatchId(date, away, home);
    const fwdHit = firestoreIds.has(idFwd) ? '✅ FOUND' : '❌ missing';
    const revHit = firestoreIds.has(idRev) ? '✅ FOUND' : '❌ missing';
    console.log(`  ESPN: "${rawHome}" vs "${rawAway}"`);
    console.log(`    normalised: ${home} vs ${away}  |  date: ${date}`);
    console.log(`    fwd ID: ${idFwd}  ${fwdHit}`);
    console.log(`    rev ID: ${idRev}  ${revHit}`);
  }

  // 3. Also check June 11 backfill
  console.log('\n=== ESPN 2026-06-11 BACKFILL → GENERATED IDs ===');
  const d11Res = await fetch(SCOREBOARD_DATE_URL('20260611'), { headers: HEADERS });
  const d11Data = await d11Res.json();
  for (const event of d11Data.events ?? []) {
    const sumRes = await fetch(SUMMARY_URL(event.id), { headers: HEADERS });
    const sumData = await sumRes.json();
    const comp = sumData.header?.competitions?.[0];
    if (!comp) continue;
    const hc = comp.competitors?.find(c => c.homeAway === 'home');
    const ac = comp.competitors?.find(c => c.homeAway === 'away');
    if (!hc || !ac) continue;
    const rawHome = hc.team.displayName;
    const rawAway = ac.team.displayName;
    const home = normalise(rawHome);
    const away = normalise(rawAway);
    const date = (event.date ?? '').slice(0, 10);
    const idFwd = makeMatchId(date, home, away);
    const idRev = makeMatchId(date, away, home);
    const fwdHit = firestoreIds.has(idFwd) ? '✅ FOUND' : '❌ missing';
    const revHit = firestoreIds.has(idRev) ? '✅ FOUND' : '❌ missing';
    console.log(`  ESPN: "${rawHome}" vs "${rawAway}"`);
    console.log(`    normalised: ${home} vs ${away}  |  date: ${date}`);
    console.log(`    fwd ID: ${idFwd}  ${fwdHit}`);
    console.log(`    rev ID: ${idRev}  ${revHit}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
