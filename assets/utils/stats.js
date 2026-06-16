import { teamName, teamDisplay } from './teamData.js';

// ─── Points calculator ────────────────────────────────────────────────────────
export function calcPoints(teams, matches) {
  const stats = {};
  teams.forEach(t => { const n = teamName(t); stats[n] = { team: t, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, pts:0 }; });
  matches.forEach(m => {
    if (m.homeScore == null || m.awayScore == null) return;
    const hn = teamName(m.home), an = teamName(m.away);
    if (!stats[hn] || !stats[an]) return;
    const h = m.homeScore, a = m.awayScore;
    stats[hn].played++; stats[an].played++;
    stats[hn].gf += h;  stats[an].gf += a;
    stats[hn].ga += a;  stats[an].ga += h;
    if (h > a)      { stats[hn].won++;   stats[hn].pts += 3; stats[an].lost++; }
    else if (h < a) { stats[an].won++;   stats[an].pts += 3; stats[hn].lost++; }
    else            { stats[hn].drawn++; stats[hn].pts++;    stats[an].drawn++; stats[an].pts++; }
  });
  Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
  return Object.values(stats).sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || teamName(a.team).localeCompare(teamName(b.team)));
}

// ─── Prediction outcome helper ────────────────────────────────────────────────
export function predOutcome(pred, match) {
  if (!pred || pred.home === undefined || pred.away === undefined) return 'none';
  if (match.homeScore == null || match.awayScore == null) return 'none';
  const ph = pred.home, pa = pred.away;
  const ah = match.homeScore, aa = match.awayScore;
  if (ph === ah && pa === aa) return 'exact';
  const predResult   = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
  const actualResult = ah > aa ? 'H' : ah < aa ? 'A' : 'D';
  return predResult === actualResult ? 'correct' : 'wrong';
}

// ─── Best 3rd-place team calculation ──────────────────────────────────────────
export function calcBest3rdTeams(buildGroups, groupMatches, userPredictions) {
  const allGroups = buildGroups();
  const thirdPlaceTeams = [];

  allGroups.forEach(group => {
    const gm = groupMatches().filter(m => m.group === group.id);
    const predMatches = gm.map(m => {
      const pred = userPredictions[m.id];
      return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
    });
    const standings = calcPoints(group.teams, predMatches);
    if (standings[2]) {
      thirdPlaceTeams.push({ ...standings[2], group: group.id });
    }
  });

  thirdPlaceTeams.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf  ||
    teamName(a.team).localeCompare(teamName(b.team))
  );

  return thirdPlaceTeams.slice(0, 8);
}

export function resolveBest3rd(rank, buildGroups, groupMatches, userPredictions) {
  const teams = calcBest3rdTeams(buildGroups, groupMatches, userPredictions);
  const entry = teams[rank - 1];
  if (!entry) return null;
  return teamDisplay(entry.team);
}
