import { teamDisplay } from '../utils/teamData.js';
import { calcPoints } from '../utils/stats.js';

export function renderGroups(buildGroups, groupMatches, container) {
  if (!container) return;
  container.innerHTML = '';
  const groups = buildGroups();
  groups.forEach(group => {
    const gm = groupMatches().filter(m => m.group === group.id);
    const standings = calcPoints(group.teams, gm);
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <h2 class="group-title">Group ${group.id}</h2>
      <table class="standings-table" aria-label="Group ${group.id} standings">
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
  container.innerHTML = '';
  const groups = buildGroups();
  groups.forEach(group => {
    const groupMatchList = groupMatches().filter(m => m.group === group.id);
    const predMatches = groupMatchList.map(m => {
      const pred = userPredictions[m.id];
      return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
    });
    const standings = calcPoints(group.teams, predMatches);
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <h2 class="group-title">Group ${group.id}</h2>
      <table class="standings-table" aria-label="Predicted Group ${group.id} standings">
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
