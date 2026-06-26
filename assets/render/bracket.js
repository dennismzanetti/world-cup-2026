import { teamDisplay, teamFlag } from '../utils/teamData.js';
import { isFinished } from '../utils/filters.js';
import { calcPoints } from '../utils/stats.js';
import { resolveBest3rd } from '../utils/stats.js';
import { savePrediction } from '../db.js';

// ─── Slot / resolve helpers ─────────────────────────────────────────────────
export function slotLabel(source) {
  if (!source) return 'TBD';
  if (typeof source === 'string') return source;
  if (source.type === 'group')   return `${source.pos === 1 ? '1st' : source.pos === 2 ? '2nd' : '3rd'} Grp ${source.group}`;
  if (source.type === 'best3rd') return `Best 3rd #${source.rank}`;
  if (source.type === 'winner')  return `W: ${source.matchId || source.match}`;
  if (source.type === 'loser')   return `L: ${source.matchId || source.match}`;
  return 'TBD';
}

/**
 * Derive the winning side from a finished knockout fixture.
 * Checks regulation score first, then falls back to PK shootout scores.
 * Returns 'home', 'away', or null if still undetermined.
 */
function resolveFinishedWinnerSide(fixture) {
  if (fixture.homeScore > fixture.awayScore) return 'home';
  if (fixture.awayScore > fixture.homeScore) return 'away';
  // Tied after 90/120 min — use PK scores if available
  if (fixture.homePkScore != null && fixture.awayPkScore != null) {
    if (fixture.homePkScore > fixture.awayPkScore) return 'home';
    if (fixture.awayPkScore > fixture.homePkScore) return 'away';
  }
  return null; // PK scores not yet entered
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

    // ── Finished match: use actual result (regulation + PK) ────────────────────
    if (isFinished(fixture) && fixture.homeScore != null && fixture.awayScore != null) {
      const winnerSide = resolveFinishedWinnerSide(fixture);
      if (!winnerSide) return null; // tie result with no PK scores yet
      const ctx = { groupMatches, buildGroups, userPredictions, getKnockoutFixture };
      const winnerSource = winnerSide === 'home' ? fixture.homeSource : fixture.awaySource;
      return resolveKnockoutTeamForPreds(winnerSource, ctx)
        || (winnerSide === 'home' ? teamDisplay(fixture.home) : teamDisplay(fixture.away));
    }

    // ── Unfinished match: use user's prediction ────────────────────────────
    const pred = userPredictions[srcMatchId];
    if (!pred || pred.home === undefined || pred.away === undefined) return null;

    let winnerSide;
    if (pred.home > pred.away) winnerSide = 'home';
    else if (pred.away > pred.home) winnerSide = 'away';
    else {
      // Tied prediction: prefer derived PK score winner, fall back to pk toggle
      if (pred.homePkScore != null && pred.awayPkScore != null) {
        if (pred.homePkScore > pred.awayPkScore) winnerSide = 'home';
        else if (pred.awayPkScore > pred.homePkScore) winnerSide = 'away';
      }
      if (!winnerSide) {
        if (!pred.pk) return null;
        winnerSide = pred.pk;
      }
    }

    const pickedSource = winnerSide === 'home' ? fixture.homeSource : fixture.awaySource;
    const ctx = { groupMatches, buildGroups, userPredictions, getKnockoutFixture };
    return resolveKnockoutTeamForPreds(pickedSource, ctx)
      || (winnerSide === 'home' ? teamDisplay(fixture.home) : teamDisplay(fixture.away))
      || null;
  }

  return null;
}

// ─── Resolve actual (real) team name for a knockout slot ───────────────────
function resolveActualTeam(source, { groupMatches, buildGroups, getKnockoutFixture }) {
  if (!source) return null;
  if (typeof source === 'string') return source;

  if (source.type === 'group') {
    const gm     = groupMatches().filter(m => m.group === source.group);
    const groups = buildGroups();
    const group  = groups.find(g => g.id === source.group);
    if (!group) return null;
    // Only use actual finished results — no predictions
    const standings = calcPoints(group.teams, gm.filter(m => isFinished(m)));
    const team = standings[source.pos - 1]?.team;
    return team ? teamDisplay(team) : null;
  }

  if (source.type === 'best3rd') {
    // Use actual results only
    return resolveBest3rd(source.rank, buildGroups, groupMatches, {});
  }

  if (source.type === 'winner') {
    const srcMatchId = source.matchId || source.match;
    if (!srcMatchId) return null;
    const fixture = getKnockoutFixture(srcMatchId);
    if (!fixture) return null;
    if (!isFinished(fixture) || fixture.homeScore == null) return null;
    const winnerSide = resolveFinishedWinnerSide(fixture);
    if (!winnerSide) return null;
    const ctx = { groupMatches, buildGroups, getKnockoutFixture };
    const winnerSource = winnerSide === 'home' ? fixture.homeSource : fixture.awaySource;
    return resolveActualTeam(winnerSource, ctx)
      || (winnerSide === 'home' ? teamDisplay(fixture.home) : teamDisplay(fixture.away));
  }

  return null;
}

// ─── Actual Bracket renderer (results-only, no predictions) ────────────────
export function renderActualBracket({
  BRACKET_ROUNDS,
  getKnockoutFixture,
  groupMatches,
  buildGroups,
  userPredictions,
}) {
  const container = document.getElementById('actual-bracket-container');
  if (!container) return;
  container.innerHTML = '';

  const ctx = { groupMatches, buildGroups, getKnockoutFixture };

  // Count played knockout matches for the legend
  const allIds    = BRACKET_ROUNDS.flatMap(r => r.ids);
  const played    = allIds.filter(id => { const f = getKnockoutFixture(id); return f && isFinished(f); }).length;
  const remaining = allIds.length - played;

  // Legend bar
  const legend = document.createElement('div');
  legend.className = 'bracket-actual-legend';
  legend.innerHTML = `
    <span class="bracket-legend-item">
      <span class="bracket-legend-dot bracket-legend-dot--winner"></span> Winner / Advances
    </span>
    <span class="bracket-legend-item">
      <span class="bracket-legend-dot bracket-legend-dot--tbd"></span> Not yet played (${remaining} remaining)
    </span>
    ${played > 0 ? `<span class="bracket-legend-played">${played} match${played !== 1 ? 'es' : ''} played</span>` : ''}
  `;
  container.appendChild(legend);

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
      const finished = fixture ? isFinished(fixture) : false;

      // Resolve display names
      const homeDisplay = fixture
        ? (resolveActualTeam(fixture.homeSource, ctx) || slotLabel(fixture.homeSource))
        : 'TBD';
      const awayDisplay = fixture
        ? (resolveActualTeam(fixture.awaySource, ctx) || slotLabel(fixture.awaySource))
        : 'TBD';

      const winnerSide = finished && fixture ? resolveFinishedWinnerSide(fixture) : null;

      // Build score display
      let homeScoreStr = '';
      let awayScoreStr = '';
      let pkLabel = '';

      if (finished && fixture && fixture.homeScore != null) {
        homeScoreStr = String(fixture.homeScore);
        awayScoreStr = String(fixture.awayScore);
        if (fixture.homeScore === fixture.awayScore && fixture.homePkScore != null) {
          pkLabel = `(${fixture.homePkScore}–${fixture.awayPkScore} pens)`;
        }
      }

      const card = document.createElement('div');
      card.className = 'bracket-match bracket-match--actual';
      if (finished) card.classList.add('bracket-match--finished');

      // Home team row
      const homeEl = document.createElement('div');
      homeEl.className = 'bracket-team' +
        (winnerSide === 'home' ? ' actual-winner' : '') +
        (homeDisplay === 'TBD' || homeDisplay.startsWith('1st') || homeDisplay.startsWith('2nd') || homeDisplay.startsWith('3rd') || homeDisplay.startsWith('W:') || homeDisplay.startsWith('Best') ? ' tbd' : '');
      homeEl.setAttribute('title', homeDisplay);
      homeEl.innerHTML =
        `<span class="bracket-team-name">${homeDisplay}</span>` +
        (homeScoreStr !== '' ? `<span class="bracket-team-score actual-score${winnerSide === 'home' ? ' winner-score' : ''}">${homeScoreStr}</span>` : '');

      // Divider
      const divider = document.createElement('div');
      divider.className = 'bracket-divider';
      divider.setAttribute('aria-hidden', 'true');
      if (pkLabel) {
        divider.innerHTML = `<span class="bracket-pk-badge bracket-pk-badge--actual">${pkLabel}</span>`;
      }

      // Away team row
      const awayEl = document.createElement('div');
      awayEl.className = 'bracket-team' +
        (winnerSide === 'away' ? ' actual-winner' : '') +
        (awayDisplay === 'TBD' || awayDisplay.startsWith('1st') || awayDisplay.startsWith('2nd') || awayDisplay.startsWith('3rd') || awayDisplay.startsWith('W:') || awayDisplay.startsWith('Best') ? ' tbd' : '');
      awayEl.setAttribute('title', awayDisplay);
      awayEl.innerHTML =
        `<span class="bracket-team-name">${awayDisplay}</span>` +
        (awayScoreStr !== '' ? `<span class="bracket-team-score actual-score${winnerSide === 'away' ? ' winner-score' : ''}">${awayScoreStr}</span>` : '');

      card.appendChild(homeEl);
      card.appendChild(divider);
      card.appendChild(awayEl);
      col.appendChild(card);
    });

    rail.appendChild(col);
  });

  container.appendChild(rail);
}

// ─── Inline prediction form for a bracket card ─────────────────────────────────
function buildBracketPredForm({
  matchId, fixture, homeDisplay, awayDisplay,
  currentUser, userPredictions,
  onSaved,
}) {
  const pred   = userPredictions[matchId] || {};
  const hVal   = pred.home !== undefined ? pred.home : '';
  const aVal   = pred.away !== undefined ? pred.away : '';
  const isTied = hVal !== '' && aVal !== '' && Number(hVal) === Number(aVal);

  // Existing PK score predictions (from the new score-based inputs)
  const hPkVal = pred.homePkScore !== undefined ? pred.homePkScore : '';
  const aPkVal = pred.awayPkScore !== undefined ? pred.awayPkScore : '';

  const hFlag  = fixture ? teamFlag(fixture.home) || '' : '';
  const aFlag  = fixture ? teamFlag(fixture.away) || '' : '';

  const form = document.createElement('div');
  form.className = 'bracket-pred-form';
  form.innerHTML = `
    <div class="bracket-form-scores">
      <span class="bracket-form-team-name">${homeDisplay}</span>
      <input type="number" class="score-input bracket-score-input" min="0" max="99"
             data-side="home" value="${hVal}" aria-label="${homeDisplay} predicted score">
      <span class="score-sep">–</span>
      <input type="number" class="score-input bracket-score-input" min="0" max="99"
             data-side="away" value="${aVal}" aria-label="${awayDisplay} predicted score">
      <span class="bracket-form-team-name">${awayDisplay}</span>
    </div>

    <div class="pk-score-row bracket-pk-row" style="display:${isTied ? '' : 'none'}">
      <span class="pk-label">🥅 PK Score:</span>
      <span class="pk-team-name pk-team-home">${hFlag} ${homeDisplay}</span>
      <input type="number" class="score-input bracket-pk-input" min="0" max="20"
             data-pk-side="home" value="${hPkVal}"
             aria-label="${homeDisplay} PK goals">
      <span class="score-sep">–</span>
      <input type="number" class="score-input bracket-pk-input" min="0" max="20"
             data-pk-side="away" value="${aPkVal}"
             aria-label="${awayDisplay} PK goals">
      <span class="pk-team-name pk-team-away">${awayDisplay} ${aFlag}</span>
      <div class="pk-derived-winner" aria-live="polite"></div>
    </div>

    <div class="bracket-form-footer">
      <button class="btn-save pred-btn save-pred-btn">Save</button>
      <span class="pred-saving" hidden>Saving…</span>
      <span class="pred-saved"  hidden>Saved ✓</span>
      <span class="pred-error"  hidden></span>
    </div>`;

  const homeInput   = form.querySelector('[data-side="home"]');
  const awayInput   = form.querySelector('[data-side="away"]');
  const homePkInput = form.querySelector('[data-pk-side="home"]');
  const awayPkInput = form.querySelector('[data-pk-side="away"]');
  const pkRow       = form.querySelector('.bracket-pk-row');
  const pkWinnerEl  = form.querySelector('.pk-derived-winner');

  // Update the derived-winner hint so users see who would advance as they type
  function updatePkWinnerHint() {
    const hpk = parseInt(homePkInput.value);
    const apk = parseInt(awayPkInput.value);
    if (isNaN(hpk) || isNaN(apk)) { pkWinnerEl.textContent = ''; return; }
    if (hpk === apk)               { pkWinnerEl.textContent = '⚠️ PK scores must differ'; return; }
    const winner = hpk > apk ? homeDisplay : awayDisplay;
    pkWinnerEl.innerHTML = `→ <strong>${winner}</strong> advances`;
  }

  // Show/hide PK row and reset PK inputs when regulation tie status changes
  function updatePkRowVisibility() {
    const hv = parseInt(homeInput.value);
    const av = parseInt(awayInput.value);
    const tied = !isNaN(hv) && !isNaN(av) && hv === av;
    pkRow.style.display = tied ? '' : 'none';
    if (!tied) {
      homePkInput.value = '';
      awayPkInput.value = '';
      pkWinnerEl.textContent = '';
      if (userPredictions[matchId]) {
        delete userPredictions[matchId].homePkScore;
        delete userPredictions[matchId].awayPkScore;
        delete userPredictions[matchId].pk; // clear legacy toggle too
      }
    }
  }

  homeInput.addEventListener('input', updatePkRowVisibility);
  awayInput.addEventListener('input', updatePkRowVisibility);
  homePkInput.addEventListener('input', updatePkWinnerHint);
  awayPkInput.addEventListener('input', updatePkWinnerHint);

  // Show hint on load if PK scores are already set
  if (isTied && hPkVal !== '' && aPkVal !== '') updatePkWinnerHint();

  form.querySelector('.save-pred-btn').addEventListener('click', async () => {
    const savingEl = form.querySelector('.pred-saving');
    const savedEl  = form.querySelector('.pred-saved');
    const errEl    = form.querySelector('.pred-error');
    const btn      = form.querySelector('.save-pred-btn');

    const hv = parseInt(homeInput.value);
    const av = parseInt(awayInput.value);
    if (isNaN(hv) || isNaN(av)) {
      errEl.textContent = 'Enter both scores.';
      errEl.hidden = false;
      return;
    }

    const isTie = hv === av;
    const hpk = isTie ? parseInt(homePkInput.value) : NaN;
    const apk = isTie ? parseInt(awayPkInput.value) : NaN;

    // Require valid, differing PK scores on a predicted tie
    if (isTie) {
      if (isNaN(hpk) || isNaN(apk)) {
        errEl.textContent = 'Enter PK scores for a tied result.';
        errEl.hidden = false;
        return;
      }
      if (hpk === apk) {
        errEl.textContent = 'PK scores must differ — there must be a winner.';
        errEl.hidden = false;
        return;
      }
    }

    // Derive pk field from PK scores so legacy resolver still works
    const pkFromScores = isTie && !isNaN(hpk) && !isNaN(apk)
      ? (hpk > apk ? 'home' : 'away')
      : undefined;

    errEl.hidden    = true;
    savingEl.hidden = false;
    btn.disabled    = true;

    const predPayload = {
      home: hv,
      away: av,
      ...(isTie && !isNaN(hpk) ? { homePkScore: hpk } : {}),
      ...(isTie && !isNaN(apk) ? { awayPkScore: apk } : {}),
      ...(pkFromScores          ? { pk: pkFromScores } : {}),
    };
    userPredictions[matchId] = predPayload;

    try {
      await savePrediction(
        currentUser.uid, matchId, hv, av, pkFromScores,
        isTie && !isNaN(hpk) ? { homePkScore: hpk, awayPkScore: apk } : undefined,
      );
      savingEl.hidden = true;
      savedEl.hidden  = false;
      setTimeout(() => { savedEl.hidden = true; }, 2000);
      if (onSaved) onSaved();
    } catch (err) {
      savingEl.hidden = true;
      errEl.textContent = 'Save failed.';
      errEl.hidden = false;
      console.warn('[bracket] savePrediction error', err);
    }
    btn.disabled = false;
  });

  return form;
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
      const actualWinner = finished && fixture ? resolveFinishedWinnerSide(fixture) : null;

      const predScore = userPredictions[matchId];
      let predWinner = null;
      let predHomeScore = '';
      let predAwayScore = '';
      let predPkLabel = '';

      if (predScore && predScore.home !== undefined && predScore.away !== undefined) {
        predHomeScore = predScore.home;
        predAwayScore = predScore.away;
        if (predScore.home > predScore.away) predWinner = 'home';
        else if (predScore.away > predScore.home) predWinner = 'away';
        else if (predScore.homePkScore != null && predScore.awayPkScore != null) {
          predWinner = predScore.homePkScore > predScore.awayPkScore ? 'home' : 'away';
          predPkLabel = `${predScore.homePkScore}–${predScore.awayPkScore}`;
        } else if (predScore.pk) {
          predWinner = predScore.pk;
          predPkLabel = 'PK';
        }
      }

      const hasPred = predHomeScore !== '';

      const card = document.createElement('div');
      card.className = 'bracket-match';
      if (predWinner) card.classList.add('bracket-match--predicted');
      if (!finished) card.classList.add('bracket-match--clickable');

      const homeTbd = homeDisplay === 'TBD' || homeDisplay.startsWith('Best 3rd') || homeDisplay.startsWith('W:');
      const awayTbd = awayDisplay === 'TBD' || awayDisplay.startsWith('Best 3rd') || awayDisplay.startsWith('W:');

      // ── Home team row ──
      const homeEl = document.createElement('div');
      homeEl.className = 'bracket-team' +
        (predWinner === 'home' ? ' picked' : '') +
        (homeTbd ? ' tbd' : '') +
        (actualWinner === 'home' ? ' actual-winner' : '');
      homeEl.setAttribute('title', homeDisplay);
      homeEl.innerHTML =
        `<span class="bracket-team-name">${homeDisplay}</span>` +
        (hasPred && !finished ? `<span class="bracket-team-score">${predHomeScore}</span>` : '');

      // ── Divider row (shows PK badge if applicable) ──
      const divider = document.createElement('div');
      divider.className = 'bracket-divider';
      divider.setAttribute('aria-hidden', 'true');
      if (hasPred && !finished && predPkLabel) {
        divider.innerHTML = `<span class="bracket-pk-badge">${predPkLabel}</span>`;
      }

      // ── Away team row ──
      const awayEl = document.createElement('div');
      awayEl.className = 'bracket-team' +
        (predWinner === 'away' ? ' picked' : '') +
        (awayTbd ? ' tbd' : '') +
        (actualWinner === 'away' ? ' actual-winner' : '');
      awayEl.setAttribute('title', awayDisplay);
      awayEl.innerHTML =
        `<span class="bracket-team-name">${awayDisplay}</span>` +
        (hasPred && !finished ? `<span class="bracket-team-score">${predAwayScore}</span>` : '');

      // ── Expandable prediction form ──────────────────────────────────────────
      const formWrap = document.createElement('div');
      formWrap.className = 'bracket-form-wrap';
      formWrap.hidden = true;

      if (!finished) {
        const form = buildBracketPredForm({
          matchId, fixture, homeDisplay, awayDisplay,
          currentUser, userPredictions,
          onSaved: () => {
            formWrap.hidden = true;
            card.classList.remove('bracket-match--open');
            document.dispatchEvent(new CustomEvent('bracket:predSaved'));
          },
        });
        formWrap.appendChild(form);

        card.addEventListener('click', e => {
          if (e.target.closest('.bracket-form-wrap')) return;
          const isOpen = !formWrap.hidden;
          formWrap.hidden = isOpen;
          card.classList.toggle('bracket-match--open', !isOpen);
        });
      }

      card.appendChild(homeEl);
      card.appendChild(divider);
      card.appendChild(awayEl);
      card.appendChild(formWrap);
      col.appendChild(card);
    });

    rail.appendChild(col);
  });

  container.appendChild(rail);
}
