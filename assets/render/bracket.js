import { teamDisplay } from '../utils/teamData.js';
import { isFinished } from '../utils/filters.js';
import { calcPoints } from '../utils/stats.js';
import { resolveBest3rd } from '../utils/stats.js';

// ─── Slot / resolve helpers ───────────────────────────────────────────────────
export function slotLabel(source) {
  if (!source) return 'TBD';
  if (typeof source === 'string') return source;
  if (source.type === 'group')   return `${source.pos === 1 ? '1st' : source.pos === 2 ? '2nd' : '3rd'} Grp ${source.group}`;
  if (source.type === 'best3rd') return `Best 3rd #${source.rank}`;
  if (source.type === 'winner')  return `W: ${source.matchId || source.match}`;
  if (source.type === 'loser')   return `L: ${source.matchId || source.match}`;
  return 'TBD';
}

export function resolveKnockoutTeamForPreds(source, {
  groupMatches, buildGroups, userPredictions, getKnockoutFixture,
}) {
  if (!source || typeof source === 'string') return null;

  if (source.type === 'group') {
    const gm     = groupMatches().filter(m => m.group === source.group);
    const groups = buildGroups();
    const group  = groups.find(g => g.id === source.group);
    if (!group) return null;
    const standings = calcPoints(group.teams, gm.map(m => {
      const pred = userPredictions[m.id];
      return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
    }));
    const team = standings[source.pos - 1]?.team;
    return team ? teamDisplay(team) : null;
  }

  if (source.type === 'best3rd') {
    return resolveBest3rd(source.rank, buildGroups, groupMatches, userPredictions);
  }

  if (source.type === 'winner') {
    const srcMatchId = source.matchId || source.match;
    if (!srcMatchId) return null;
    const fixture = getKnockoutFixture(srcMatchId);
    if (!fixture) return null;

    if (isFinished(fixture) && fixture.homeScore != null && fixture.awayScore != null) {
      const ctx = { groupMatches, buildGroups, userPredictions, getKnockoutFixture };
      if (fixture.homeScore > fixture.awayScore) return resolveKnockoutTeamForPreds(fixture.homeSource, ctx) || teamDisplay(fixture.home);
      if (fixture.awayScore > fixture.homeScore) return resolveKnockoutTeamForPreds(fixture.awaySource, ctx) || teamDisplay(fixture.away);
      return null;
    }

    const pred = userPredictions[srcMatchId];
    if (!pred || pred.home === undefined || pred.away === undefined) return null;

    let winnerSide;
    if (pred.home > pred.away) winnerSide = 'home';
    else if (pred.away > pred.home) winnerSide = 'away';
    else {
      if (!pred.pk) return null;
      winnerSide = pred.pk;
    }

    const pickedSource = winnerSide === 'home' ? fixture.homeSource : fixture.awaySource;
    const ctx = { groupMatches, buildGroups, userPredictions, getKnockoutFixture };
    return resolveKnockoutTeamForPreds(pickedSource, ctx)
      || (winnerSide === 'home' ? teamDisplay(fixture.home) : teamDisplay(fixture.away))
      || null;
  }

  return null;
}

export function renderKnockoutBracket({
  BRACKET_ROUNDS,
  currentUser,
  userPredictions,
  getKnockoutFixture,
  groupMatches,
  buildGroups,
  openModal,
}) {
  const container = document.getElementById('pred-bracket-container');
  if (!container) return;
  container.innerHTML = '';

  const ctx = { groupMatches, buildGroups, userPredictions, getKnockoutFixture };

  const header = document.createElement('div');
  header.className = 'bracket-header';
  const totalSlots = BRACKET_ROUNDS.reduce((n, r) => n + r.ids.length, 0);
  const picked     = BRACKET_ROUNDS.flatMap(r => r.ids).filter(id => {
    const pred = userPredictions[id];
    return pred && pred.home !== undefined && pred.away !== undefined;
  }).length;
  const pct        = totalSlots ? Math.round((picked / totalSlots) * 100) : 0;
  header.innerHTML = `
    <div class="bracket-progress">
      <span>${picked} / ${totalSlots} matches predicted</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span>${pct}%</span>
    </div>`;
  container.appendChild(header);

  if (!currentUser) {
    const prompt = document.createElement('div');
    prompt.className = 'auth-prompt';
    prompt.innerHTML = `<p>Sign in to make your bracket predictions.</p>
      <button class="btn btn-primary bracket-signin-btn">Sign In</button>`;
    prompt.querySelector('.bracket-signin-btn').addEventListener('click', openModal);
    container.appendChild(prompt);
    return;
  }

  const rail = document.createElement('div');
  rail.className = 'bracket-scroll';

  BRACKET_ROUNDS.forEach(round => {
    const col = document.createElement('div');
    col.className = 'bracket-round';

    const label = document.createElement('div');
    label.className = 'bracket-round-label';
    label.textContent = round.label;
    col.appendChild(label);

    round.ids.forEach(matchId => {
      const fixture = getKnockoutFixture(matchId);

      const homeDisplay = fixture
        ? (resolveKnockoutTeamForPreds(fixture.homeSource, ctx) || slotLabel(fixture.homeSource))
        : 'TBD';
      const awayDisplay = fixture
        ? (resolveKnockoutTeamForPreds(fixture.awaySource, ctx) || slotLabel(fixture.awaySource))
        : 'TBD';

      const finished = fixture ? isFinished(fixture) : false;
      const actualWinner = finished && fixture
        ? (fixture.homeScore > fixture.awayScore ? 'home' : fixture.awayScore > fixture.homeScore ? 'away' : null)
        : null;

      const predScore = userPredictions[matchId];
      let predWinner = null;
      let predScoreLabel = '';
      let predPkLabel = '';
      if (predScore && predScore.home !== undefined && predScore.away !== undefined) {
        if (predScore.home > predScore.away) predWinner = 'home';
        else if (predScore.away > predScore.home) predWinner = 'away';
        else if (predScore.pk) {
          predWinner = predScore.pk;
          predPkLabel = 'PK';
        }
        predScoreLabel = `${predScore.home}–${predScore.away}`;
      }

      const card = document.createElement('div');
      card.className = 'bracket-match';
      if (predWinner) card.classList.add('bracket-match--predicted');

      const homeTbd = homeDisplay === 'TBD' || homeDisplay.startsWith('Best 3rd') || homeDisplay.startsWith('W:');
      const awayTbd = awayDisplay === 'TBD' || awayDisplay.startsWith('Best 3rd') || awayDisplay.startsWith('W:');

      const homeEl = document.createElement('div');
      homeEl.className = 'bracket-team' +
        (predWinner === 'home' ? ' picked' : '') +
        (homeTbd ? ' tbd' : '') +
        (actualWinner === 'home' ? ' actual-winner' : '');
      homeEl.setAttribute('title', homeDisplay);
      homeEl.innerHTML = `<span class="bracket-team-name">${homeDisplay}</span>` +
        (predScoreLabel && !finished ? `<span class="bracket-pred-score">${predScore.home}</span>` : '');

      const divider = document.createElement('div');
      divider.className = 'bracket-divider';
      divider.setAttribute('aria-hidden', 'true');
      if (predScoreLabel && !finished) {
        divider.innerHTML = predPkLabel ? `<span class="bracket-pk-badge">PK</span>` : '';
      }

      const awayEl = document.createElement('div');
      awayEl.className = 'bracket-team' +
        (predWinner === 'away' ? ' picked' : '') +
        (awayTbd ? ' tbd' : '') +
        (actualWinner === 'away' ? ' actual-winner' : '');
      awayEl.setAttribute('title', awayDisplay);
      awayEl.innerHTML = `<span class="bracket-team-name">${awayDisplay}</span>` +
        (predScoreLabel && !finished ? `<span class="bracket-pred-score">${predScore.away}</span>` : '');

      card.appendChild(homeEl);
      card.appendChild(divider);
      card.appendChild(awayEl);
      col.appendChild(card);
    });

    rail.appendChild(col);
  });

  container.appendChild(rail);
}
