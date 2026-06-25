import { teamDisplay } from '../utils/teamData.js';
import { calcPoints, calcBest3rdTeams } from '../utils/stats.js';

// Shared table builder.
// Pass userPredictions object to overlay predicted scores; pass null for live standings.
function renderStandingsGrid(container, buildGroups, groupMatches, userPredictions) {
  if (!container) return;
  container.innerHTML = '';
  const isPred = !!userPredictions;
  const groups = buildGroups();
  groups.forEach(group => {
    const rawMatches = groupMatches().filter(m => m.group === group.id);
    const matches = isPred
      ? rawMatches.map(m => {
          const pred = userPredictions[m.id];
          return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
        })
      : rawMatches;
    const standings = calcPoints(group.teams, matches);
    const ariaLabel = isPred
      ? `Predicted Group ${group.id} standings`
      : `Group ${group.id} standings`;
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <h2 class="group-title">Group ${group.id}</h2>
      <table class="standings-table" aria-label="${ariaLabel}">
        <thead>
          <tr>
            <th scope="col" class="col-team">Team</th>
            <th scope="col" class="col-num" title="Played">P</th>
            <th scope="col" class="col-num" title="Won">W</th>
            <th scope="col" class="col-num" title="Drawn">D</th>
            <th scope="col" class="col-num" title="Lost">L</th>
            <th scope="col" class="col-num" title="Goals For">GF</th>
            <th scope="col" class="col-num" title="Goals Against">GA</th>
            <th scope="col" class="col-num" title="Goal Difference">GD</th>
            <th scope="col" class="col-num" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, i) => `
            <tr class="${i < 2 ? 'advancing' : ''}">
              <td class="col-team">${teamDisplay(s.team)}</td>
              <td class="col-num">${s.played}</td>
              <td class="col-num">${s.won}</td>
              <td class="col-num">${s.drawn}</td>
              <td class="col-num">${s.lost}</td>
              <td class="col-num">${s.gf}</td>
              <td class="col-num">${s.ga}</td>
              <td class="col-num">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td class="col-num pts">${s.pts}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    container.appendChild(card);
  });
}

export function renderGroups(buildGroups, groupMatches, container) {
  renderStandingsGrid(container, buildGroups, groupMatches, null);
  renderBest3rdTeams(buildGroups, groupMatches, null);
}

export function renderPredGroupStandings(buildGroups, groupMatches, userPredictions, currentUser) {
  const container  = document.getElementById('pred-group-standings-container');
  const authPrompt = document.getElementById('pred-group-standings-auth-prompt');
  if (!container) return;
  if (!currentUser) {
    authPrompt?.removeAttribute('hidden');
    container.innerHTML = '';
    return;
  }
  authPrompt?.setAttribute('hidden', '');
  renderStandingsGrid(container, buildGroups, groupMatches, userPredictions);
}

// Renders the "Best 3rd Place Teams" section below the groups grid.
// userPredictions is null for live data, or an object for predicted standings.
export function renderBest3rdTeams(buildGroups, groupMatches, userPredictions) {
  const section = document.getElementById('best-3rd-section');
  if (!section) return;

  const allGroups = buildGroups();
  if (!allGroups.length) { section.hidden = true; return; }

  const thirdPlaceTeams = calcBest3rdTeams(buildGroups, groupMatches, userPredictions || {});

  if (!thirdPlaceTeams.length) { section.hidden = true; return; }
  section.hidden = false;

  const rows = thirdPlaceTeams.map((s, i) => `
    <tr>
      <td class="col-rank">${i + 1}</td>
      <td class="col-team">${teamDisplay(s.team)}</td>
      <td class="col-group-badge"><span class="group-badge">Group ${s.group}</span></td>
      <td class="col-num">${s.played}</td>
      <td class="col-num">${s.won}</td>
      <td class="col-num">${s.drawn}</td>
      <td class="col-num">${s.lost}</td>
      <td class="col-num">${s.gf}</td>
      <td class="col-num">${s.ga}</td>
      <td class="col-num">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
      <td class="col-num pts">${s.pts}</td>
    </tr>`);

  section.innerHTML = `
    <div class="best-3rd-header">
      <h2 class="best-3rd-title">Best 3rd Place Teams</h2>
      <p class="best-3rd-subtitle">Top 8 third-place finishers advance to the Round of 32</p>
    </div>
    <div class="best-3rd-table-wrap">
      <table class="best-3rd-table" aria-label="Best 3rd place teams">
        <thead>
          <tr>
            <th scope="col" class="col-rank">#</th>
            <th scope="col" class="col-team">Team</th>
            <th scope="col" class="col-group-badge">Group</th>
            <th scope="col" class="col-num" title="Played">P</th>
            <th scope="col" class="col-num" title="Won">W</th>
            <th scope="col" class="col-num" title="Drawn">D</th>
            <th scope="col" class="col-num" title="Lost">L</th>
            <th scope="col" class="col-num" title="Goals For">GF</th>
            <th scope="col" class="col-num" title="Goals Against">GA</th>
            <th scope="col" class="col-num" title="Goal Difference">GD</th>
            <th scope="col" class="col-num" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}
