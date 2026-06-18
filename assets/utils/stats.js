import { teamName, teamDisplay } from './teamData.js';

// ─── Points calculator ────────────────────────────────────────────────────────
// Used for GROUP STAGE standings only. Never receives PK data — no changes needed.
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
/**
 * Evaluate how accurate a prediction was against the actual match result.
 *
 * Return values:
 *   'none'       — no prediction was made
 *   'exact'      — correct scoreline (outright win/loss, no PK involved)
 *   'exact-pk'   — correct tied scoreline AND correct PK winner (knockout only)
 *   'correct'    — correct result direction (H/A/D) but not the exact score
 *   'correct-pk' — predicted a tie, actual was a tie, and predicted the correct
 *                  PK winner — but the tied scoreline itself was wrong
 *   'wrong'      — wrong result direction, OR tied + wrong/missing PK winner
 *
 * Group-stage draws (no PK):
 *   A predicted draw that matches an actual draw still returns 'exact' or
 *   'correct' as before — the pk/PK-score fields are simply absent/null so
 *   the new PK branches are never entered. Fully backward-compatible.
 */
export function predOutcome(pred, match) {
  if (!pred || pred.home === undefined || pred.away === undefined) return 'none';
  if (match.homeScore == null || match.awayScore == null) return 'none';

  const ph = Number(pred.home),  pa = Number(pred.away);
  const ah = Number(match.homeScore), aa = Number(match.awayScore);

  // ── Determine the actual result direction ──────────────────────────────────
  const actualResult = ah > aa ? 'H' : ah < aa ? 'A' : 'D';
  const predResult   = ph > pa ? 'H' : ph < pa ? 'A' : 'D';

  // ── Knockout tie: actual match ended in a draw (went to PK) ───────────────
  //    Only applies when the match document has PK scores saved.
  const isKnockoutTie = actualResult === 'D' &&
    match.homePkScore != null && match.awayPkScore != null;

  if (isKnockoutTie) {
    // Determine actual PK winner ('home' or 'away')
    const actualPkWinner = match.homePkScore > match.awayPkScore ? 'home' : 'away';

    // Determine predicted PK winner — prefer score-derived, fall back to toggle
    let predPkWinner = null;
    if (pred.homePkScore != null && pred.awayPkScore != null) {
      predPkWinner = pred.homePkScore > pred.awayPkScore ? 'home' : 'away';
    } else if (pred.pk === 'home' || pred.pk === 'away') {
      predPkWinner = pred.pk;
    }

    if (predResult !== 'D') {
      // Predicted an outright winner but the match went to PK — wrong
      return 'wrong';
    }

    // Predicted a draw — check scoreline then PK winner
    const exactScore = ph === ah && pa === aa;

    if (predPkWinner === actualPkWinner) {
      return exactScore ? 'exact-pk' : 'correct-pk';
    }
    // Predicted draw but wrong/missing PK winner
    return 'wrong';
  }

  // ── Standard (non-PK-tie) path — unchanged from original ─────────────────
  if (ph === ah && pa === aa) return 'exact';
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
