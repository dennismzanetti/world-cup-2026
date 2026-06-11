// sync/debug-espn.js
// One-shot script to dump the raw ESPN API response so we can inspect
// the exact status fields for today's matches.
// Run manually: node debug-espn.js

import fetch from 'node-fetch';

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const res = await fetch(ESPN_URL, { headers: { 'User-Agent': 'world-cup-2026-debug/1.0' } });
const data = await res.json();

for (const event of data.events ?? []) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  console.log('\n---');
  console.log('name:         ', event.name);
  console.log('status.type:  ', JSON.stringify(event.status?.type));
  console.log('status.clock: ', event.status?.displayClock);
  console.log('status.period:', event.status?.period);
  console.log('home score:   ', home?.score);
  console.log('away score:   ', away?.score);
}
