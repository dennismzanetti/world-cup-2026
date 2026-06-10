// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions, updateMatchResult } from './db.js';

(function () {

  // ─── State ────────────────────────────────────────────────────────────────
  let currentUser      = null;
  let authResolved     = false;
  let activeTab        = 'groups';
  let activePredSubtab = 'my-picks';
  let userPredictions  = {};  // matchId → {homeScorePred, awayScorePred}
  let liveMatches      = WC_MATCHES.slice(); // mutable working copy

  // ─── Admin UIDs ───────────────────────────────────────────────────────────
  const ADMIN_UIDS = ['EAi3lYhlSFYGaqm9F87BdJb1Vrg1'];

  // ─── Team name helper ─────────────────────────────────────────────────────
  // data.js teams are objects {name, flag} — always use .name for display/compare
  function teamName(t) { return (t && typeof t === 'object') ? t.name : (t || ''); }
  function teamFlag(t) { return (t && typeof t === 'object') ? (t.flag || '') : ''; }
  function teamDisplay(t) { return teamFlag(t) ? `${teamFlag(t)} ${teamName(t)}` : teamName(t); }

  // ─── Modal helpers ────────────────────────────────────────────────────────
  function openModal() {
    document.getElementById('auth-modal')?.removeAttribute('hidden');
    document.getElementById('auth-backdrop')?.removeAttribute('hidden');
  }
  function closeModal() {
    document.getElementById('auth-modal')?.setAttribute('hidden', '');
    document.getElementById('auth-backdrop')?.setAttribute('hidden', '');
  }

  // ─── Sub-tab switching ────────────────────────────────────────────────────
  function switchPredSubtab(id) {
    activePredSubtab = id;
    document.querySelectorAll('.sub-tab').forEach(btn => {
      const active = btn.dataset.subtab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.sub-tab-panel').forEach(panel => {
      const active = panel.id === `subtab-${id}`;
      active ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
    });
    const predFilters = document.getElementById('pred-filters');
    if (predFilters) predFilters.hidden = (id !== 'my-picks');
    if (id === 'my-picks')             renderPredictions();
    if (id === 'pred-group-standings') renderPredGroupStandings();
    if (id === 'pred-standings')       renderPredStandings();
    if (id === 'pred-bracket')         renderKnockoutBracket();
  }

  // ─── Main tab switching ───────────────────────────────────────────────────
  function switchTab(id) {
    activeTab = id;
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const active = btn.dataset.view === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.view').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${id}`);
    });
    if (id === 'groups')      renderGroups();
    if (id === 'matches')     renderMatches();
    if (id === 'standings')   renderStandings();
    if (id === 'predictions') switchPredSubtab(activePredSubtab);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  watchAuth(async (user) => {
    currentUser  = user;
    authResolved = true;
    const userGreeting = document.getElementById('user-greeting');
    const userBar      = document.getElementById('user-bar');
    const authBtn      = document.getElementById('auth-btn');
    const signOutBtn   = document.getElementById('sign-out-btn');
    if (user) {
      if (userGreeting) userGreeting.textContent = user.email;
      userBar?.removeAttribute('hidden');
      authBtn?.setAttribute('hidden', '');
      signOutBtn?.removeAttribute('hidden');
      try {
        const preds = await getUserPredictions(user.uid);
        userPredictions = {};
        (preds || []).forEach(p => { userPredictions[p.matchId] = p; });
      } catch (e) {
        console.warn('[app] getUserPredictions error', e);
      }
      renderAll();
    } else {
      if (userGreeting) userGreeting.textContent = '';
      userBar?.setAttribute('hidden', '');
      authBtn?.removeAttribute('hidden');
      signOutBtn?.setAttribute('hidden', '');
      userPredictions = {};
      renderAll();
    }
  });

  function renderAll() {
    if (activeTab === 'groups')      renderGroups();
    if (activeTab === 'matches')     renderMatches();
    if (activeTab === 'standings')   renderStandings();
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.view)));
  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab)));

  document.getElementById('auth-btn')?.addEventListener('click', openModal);
  document.getElementById('predict-signin-btn')?.addEventListener('click', openModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());
  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn =>
    btn.addEventListener('click', openModal));
  document.getElementById('auth-close')?.addEventListener('click', closeModal);
  document.getElementById('auth-backdrop')?.addEventListener('click', closeModal);

  const authForm = document.getElementById('auth-form');
  let authFormMode = 'signin';
  authForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    if (errEl) errEl.textContent = '';
    try {
      if (authFormMode === 'signup') await signUp(email, password);
      else                           await signIn(email, password);
      closeModal();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  });

  document.getElementById('auth-switch')?.addEventListener('click', () => {
    const submitBtn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-switch');
    const titleEl   = document.getElementById('auth-title');
    const subEl     = document.getElementById('auth-sub');
    if (authFormMode === 'signin') {
      authFormMode = 'signup';
      if (titleEl)   titleEl.textContent   = 'Create Account';
      if (subEl)     subEl.textContent     = 'Create an account to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign in';
    } else {
      authFormMode = 'signin';
      if (titleEl)   titleEl.textContent   = 'Sign In';
      if (subEl)     subEl.textContent     = 'Sign in to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign up";
    }
  });

  // ─── Match filters ────────────────────────────────────────────────────────
  document.getElementById('match-date-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-group-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-venue-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-team-filter')?.addEventListener('input', renderMatches);
  document.getElementById('pred-date-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-team-filter')?.addEventListener('input', renderPredictions);

  // ─── Live match data ──────────────────────────────────────────────────────
  // watchMatches delivers ALL matches each poll — merge scores into liveMatches
  watchMatches(allMatches => {
    allMatches.forEach(um => {
      const idx = liveMatches.findIndex(m => m.id === um.id);
      if (idx !== -1) {
        liveMatches[idx] = { ...liveMatches[idx], ...um };
      }
    });
    renderAll();
  });

  // ─── Points calculator ────────────────────────────────────────────────────
  function calcPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      const n = teamName(t);
      stats[n] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
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
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      teamName(a.team).localeCompare(teamName(b.team)));
  }

  // ─── Stage label ──────────────────────────────────────────────────────────
  const stageKeyToLabel = key => ({
    R32: 'Round of 32', R16: 'Round of 16',
    QF: 'Quarter-Finals', SF: 'Semi-Finals',
    '3P': 'Third Place', F: 'Final'
  }[key] || (/^[A-Z]$/.test(key) ? `Group ${key}` : key));

  // ─── Populate filters ─────────────────────────────────────────────────────
  function populateMatchFilters() {
    const dateEl  = document.getElementById('match-date-filter');
    const stageEl = document.getElementById('match-group-filter');
    const venueEl = document.getElementById('match-venue-filter');
    if (dateEl) {
      const dates = [...new Set(liveMatches.map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${d}</option>`).join('');
    }
    if (stageEl) {
      const stages = [...new Set(liveMatches.map(m => m.group || m.stage).filter(Boolean))];
      stageEl.innerHTML = '<option value="all">All Stages</option>' +
        stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
    if (venueEl) {
      const venues = [...new Set(liveMatches.map(m => m.venue).filter(Boolean))].sort();
      venueEl.innerHTML = '<option value="all">All Venues</option>' +
        venues.map(v => `<option value="${v}">${v}</option>`).join('');
    }
  }

  function populatePredFilters() {
    const dateEl  = document.getElementById('pred-date-filter');
    const stageEl = document.getElementById('pred-group-filter');
    if (dateEl) {
      const dates = [...new Set(liveMatches.map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${d}</option>`).join('');
    }
    if (stageEl) {
      const stages = [...new Set(liveMatches.map(m => m.group || m.stage).filter(Boolean))];
      stageEl.innerHTML = '<option value="all">All Stages</option>' +
        stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
  }

  // ─── Groups ───────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = liveMatches.filter(m => m.group === group.id);
      const standings    = calcPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Matches ──────────────────────────────────────────────────────────────
  function renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    const dateVal  = document.getElementById('match-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('match-group-filter')?.value || 'all';
    const venueVal = document.getElementById('match-venue-filter')?.value || 'all';
    const teamVal  = (document.getElementById('match-team-filter')?.value || '').toLowerCase().trim();
    let matches = liveMatches.slice();
    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (venueVal !== 'all') matches = matches.filter(m => m.venue === venueVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) ||
      teamName(m.away).toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
    matches.forEach(m => container.appendChild(buildMatchCard(m, false)));
  }

  // ─── Match card ───────────────────────────────────────────────────────────
  function buildMatchCard(m, isPred) {
    const card       = document.createElement('div');
    card.className   = 'match-card';
    const stageLabel = m.group ? `Group ${m.group}` : stageKeyToLabel(m.stage || '');
    const isAdmin    = currentUser && ADMIN_UIDS.includes(currentUser.uid);
    const hn         = teamName(m.home);
    const an         = teamName(m.away);
    let scoreHtml    = '';

    if (isPred && currentUser) {
      const pred = userPredictions[m.id] || {};
      scoreHtml = `
        <div class="score-inputs">
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="home"
            value="${pred.homeScorePred !== undefined ? pred.homeScorePred : ''}">
          <span class="score-sep">–</span>
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="away"
            value="${pred.awayScorePred !== undefined ? pred.awayScorePred : ''}">
        </div>
        <div class="score-save-row">
          <button class="btn btn-sm btn-primary save-pred-btn" data-match="${m.id}">Save</button>
        </div>`;
    } else if (!isPred && isAdmin) {
      scoreHtml = `
        <div class="score-inputs">
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="home"
            value="${m.homeScore != null ? m.homeScore : ''}">
          <span class="score-sep">–</span>
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="away"
            value="${m.awayScore != null ? m.awayScore : ''}">
        </div>
        <div class="score-save-row">
          <button class="btn btn-sm btn-primary save-score-btn" data-match="${m.id}">Save</button>
        </div>`;
    } else {
      const hs = m.homeScore != null ? m.homeScore : '–';
      const as = m.awayScore != null ? m.awayScore : '–';
      scoreHtml = `<div class="score-display">${hs} – ${as}</div>`;
    }

    card.innerHTML = `
      <div class="match-card-header">
        <span class="match-meta">${stageLabel}</span>
        <span class="match-meta">${m.date || ''} ${m.timeLocal || ''} ${m.tz || ''}</span>
      </div>
      <div class="match-teams">
        <span class="team home-team">${teamDisplay(m.home)}</span>
        ${scoreHtml}
        <span class="team away-team">${teamDisplay(m.away)}</span>
      </div>
      ${m.venue ? `<div class="match-venue">${m.venue}${m.city ? ', ' + m.city : ''}</div>` : ''}`;

    if (isPred && currentUser) {
      card.querySelector('.save-pred-btn')?.addEventListener('click', async () => {
        const homeVal = parseInt(card.querySelector('[data-side="home"]')?.value);
        const awayVal = parseInt(card.querySelector('[data-side="away"]')?.value);
        if (isNaN(homeVal) || isNaN(awayVal)) return;
        userPredictions[m.id] = { homeScorePred: homeVal, awayScorePred: awayVal };
        try {
          await savePrediction(currentUser.uid, m.id, { homeScorePred: homeVal, awayScorePred: awayVal });
        } catch (e) { console.warn('[app] savePrediction error', e); }
      });
    }
    if (!isPred && isAdmin) {
      card.querySelector('.save-score-btn')?.addEventListener('click', async () => {
        const homeVal = parseInt(card.querySelector('[data-side="home"]')?.value);
        const awayVal = parseInt(card.querySelector('[data-side="away"]')?.value);
        if (isNaN(homeVal) || isNaN(awayVal)) return;
        try {
          await updateMatchResult(m.id, { homeScore: homeVal, awayScore: awayVal, status: 'final' });
        } catch (e) { console.warn('[app] updateMatchResult error', e); }
      });
    }
    return card;
  }

  // ─── Standings ────────────────────────────────────────────────────────────
  function renderStandings() {
    const container = document.getElementById('standings-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = liveMatches.filter(m => m.group === group.id);
      const standings    = calcPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Predictions (My Picks) ───────────────────────────────────────────────
  function renderPredictions() {
    const container  = document.getElementById('predictions-list');
    const authPrompt = document.getElementById('predictions-auth-prompt');
    if (!container) return;
    if (!currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    populatePredFilters();
    const dateVal  = document.getElementById('pred-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('pred-group-filter')?.value || 'all';
    const teamVal  = (document.getElementById('pred-team-filter')?.value || '').toLowerCase().trim();
    let matches = liveMatches.filter(m => m.group); // group-stage only
    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) ||
      teamName(m.away).toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
    matches.forEach(m => container.appendChild(buildMatchCard(m, true)));
  }

  // ─── Predicted Group Standings ────────────────────────────────────────────
  function calcPredPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      const n = teamName(t);
      stats[n] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred == null || pred.awayScorePred == null) return;
      const hn = teamName(m.home), an = teamName(m.away);
      if (!stats[hn] || !stats[an]) return;
      const h = pred.homeScorePred, a = pred.awayScorePred;
      stats[hn].played++; stats[an].played++;
      stats[hn].gf += h;  stats[an].gf += a;
      stats[hn].ga += a;  stats[an].ga += h;
      if (h > a)      { stats[hn].won++;   stats[hn].pts += 3; stats[an].lost++; }
      else if (h < a) { stats[an].won++;   stats[an].pts += 3; stats[hn].lost++; }
      else            { stats[hn].drawn++; stats[hn].pts++;    stats[an].drawn++; stats[an].pts++; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      teamName(a.team).localeCompare(teamName(b.team)));
  }

  function renderPredGroupStandings() {
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
    WC_GROUPS.forEach(group => {
      const groupMatches = liveMatches.filter(m => m.group === group.id);
      const standings    = calcPredPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Prediction Accuracy ──────────────────────────────────────────────────
  function renderPredStandings() {
    const container  = document.getElementById('pred-standings-container');
    const authPrompt = document.getElementById('pred-standings-auth-prompt');
    if (!container) return;
    if (!authResolved || !currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    let correctExact = 0, correctResult = 0, total = 0;
    liveMatches.forEach(match => {
      const pred = userPredictions[match.id];
      if (!pred || pred.homeScorePred == null || pred.awayScorePred == null) return;
      if (match.homeScore == null || match.awayScore == null) return;
      total++;
      const predResult   = pred.homeScorePred > pred.awayScorePred ? 'H'
                         : pred.homeScorePred < pred.awayScorePred ? 'A' : 'D';
      const actualResult = match.homeScore > match.awayScore ? 'H'
                         : match.homeScore < match.awayScore ? 'A' : 'D';
      if (pred.homeScorePred === match.homeScore && pred.awayScorePred === match.awayScore) {
        correctExact++; correctResult++;
      } else if (predResult === actualResult) {
        correctResult++;
      }
    });
    const pct = total > 0 ? Math.round((correctResult / total) * 100) : 0;
    container.innerHTML = `
      <div class="pred-stats-grid">
        <div class="pred-stat-card">
          <div class="pred-stat-value">${total}</div>
          <div class="pred-stat-label">Matches Predicted</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-value">${correctResult}</div>
          <div class="pred-stat-label">Correct Results</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-value">${correctExact}</div>
          <div class="pred-stat-label">Exact Scores</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-value">${pct}%</div>
          <div class="pred-stat-label">Accuracy</div>
        </div>
      </div>`;
  }

  // ─── Knockout Bracket ─────────────────────────────────────────────────────
  let bracketPicks = {};

  function saveBracketPicks() {
    if (!currentUser) return;
    try { localStorage.setItem(`bracketPicks_${currentUser.uid}`, JSON.stringify(bracketPicks)); } catch(e) {}
  }
  function loadBracketPicks() {
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(`bracketPicks_${currentUser.uid}`);
      bracketPicks = raw ? JSON.parse(raw) : {};
    } catch(e) { bracketPicks = {}; }
  }

  function getActualGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    // Only show result if all group matches have scores
    if (gm.some(m => m.homeScore == null)) return null;
    const standings = calcPoints(group.teams, gm);
    return standings[rank - 1]?.team || null;
  }

  function getPredictedGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    if (!gm.some(m => userPredictions[m.id]?.homeScorePred != null)) return null;
    return calcPredPoints(group.teams, gm)[rank - 1]?.team || null;
  }

  function resolveKnockoutTeam(slot, depth = 0) {
    if (depth > 10 || !slot) return slot;
    const groupMatch = slot.match(/^(\d)([A-Z])$/);
    if (groupMatch) {
      const t = getActualGroupFinisher(groupMatch[2], parseInt(groupMatch[1]))
             || getPredictedGroupFinisher(groupMatch[2], parseInt(groupMatch[1]));
      return t ? teamName(t) : slot;
    }
    const winnerMatch = slot.match(/^W(\d+)$/);
    if (winnerMatch) {
      const matchId = parseInt(winnerMatch[1]);
      const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
      const pick    = bracketPicks[matchId];
      if (!fixture || !pick) return slot;
      return pick === 'home'
        ? resolveKnockoutTeam(fixture.home, depth + 1)
        : resolveKnockoutTeam(fixture.away, depth + 1);
    }
    return slot;
  }

  function clearDownstreamPicks(matchId) {
    const toVisit = [matchId], visited = new Set();
    while (toVisit.length) {
      const id = toVisit.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      delete bracketPicks[id];
      WC_KNOCKOUT_FIXTURES.forEach(f => {
        if (f.home === `W${id}` || f.away === `W${id}`) toVisit.push(f.id);
      });
    }
  }

  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view your predicted bracket.</p><button class="btn btn-primary pred-standings-signin-btn">Sign In</button></div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }
    loadBracketPicks();
    const rounds = [
      { label: 'Round of 32',    ids: [49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64] },
      { label: 'Round of 16',    ids: [65,66,67,68,69,70,71,72] },
      { label: 'Quarter-Finals', ids: [73,74,75,76] },
      { label: 'Semi-Finals',    ids: [77,78] },
      { label: 'Final',          ids: [79] },
    ];
    const totalPicks = rounds.reduce((s, r) => s + r.ids.length, 0);
    const madePicks  = rounds.reduce((s, r) => s + r.ids.filter(id => bracketPicks[id]).length, 0);
    const pct        = Math.round((madePicks / totalPicks) * 100);
    container.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'bracket-header';
    header.innerHTML = `
      <div class="bracket-progress">
        <span>${madePicks}/${totalPicks} picks made</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bracket-actions">
        <button class="btn btn-sm btn-ghost" id="bracket-seed-btn">Seed from Results</button>
        <button class="btn btn-sm btn-ghost" id="bracket-reset-all-btn">Reset All</button>
      </div>`;
    container.appendChild(header);
    const scrollArea = document.createElement('div');
    scrollArea.className = 'bracket-scroll';
    container.appendChild(scrollArea);
    rounds.forEach(round => {
      const roundEl  = document.createElement('div');
      roundEl.className = 'bracket-round';
      const labelEl = document.createElement('div');
      labelEl.className = 'bracket-round-label';
      labelEl.textContent = round.label;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-xs btn-ghost bracket-round-reset';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', () => {
        round.ids.forEach(id => clearDownstreamPicks(id));
        saveBracketPicks(); renderKnockoutBracket();
      });
      labelEl.appendChild(resetBtn);
      roundEl.appendChild(labelEl);
      round.ids.forEach(matchId => {
        const fixture  = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;
        const homeTeam = resolveKnockoutTeam(fixture.home);
        const awayTeam = resolveKnockoutTeam(fixture.away);
        const pick     = bracketPicks[matchId];
        const matchEl  = document.createElement('div');
        matchEl.className = 'bracket-match';
        const homeEl = document.createElement('div');
        homeEl.className = 'bracket-team' + (pick === 'home' ? ' picked' : '');
        homeEl.textContent = homeTeam || fixture.home;
        homeEl.addEventListener('click', () => {
          if (bracketPicks[matchId] !== 'home') clearDownstreamPicks(matchId);
          bracketPicks[matchId] = 'home';
          saveBracketPicks(); renderKnockoutBracket();
        });
        const awayEl = document.createElement('div');
        awayEl.className = 'bracket-team' + (pick === 'away' ? ' picked' : '');
        awayEl.textContent = awayTeam || fixture.away;
        awayEl.addEventListener('click', () => {
          if (bracketPicks[matchId] !== 'away') clearDownstreamPicks(matchId);
          bracketPicks[matchId] = 'away';
          saveBracketPicks(); renderKnockoutBracket();
        });
        matchEl.appendChild(homeEl);
        matchEl.appendChild(awayEl);
        roundEl.appendChild(matchEl);
      });
      scrollArea.appendChild(roundEl);
    });
    const finalPick    = bracketPicks[79];
    const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === 79);
    let champion = null;
    if (finalPick && finalFixture) {
      champion = finalPick === 'home'
        ? resolveKnockoutTeam(finalFixture.home)
        : resolveKnockoutTeam(finalFixture.away);
    }
    const champEl = document.createElement('div');
    champEl.className = 'bracket-round bracket-champion';
    champEl.innerHTML = `
      <div class="bracket-round-label">Champion</div>
      <div class="champion-card">${champion
        ? `<span class="trophy">🏆</span><span>${champion}</span>`
        : '<span class="muted">TBD</span>'}</div>`;
    scrollArea.appendChild(champEl);
    container.querySelector('#bracket-reset-all-btn')?.addEventListener('click', () => {
      bracketPicks = {}; saveBracketPicks(); renderKnockoutBracket();
    });
    container.querySelector('#bracket-seed-btn')?.addEventListener('click', () => {
      WC_KNOCKOUT_FIXTURES.forEach(f => { if (!bracketPicks[f.id]) bracketPicks[f.id] = 'home'; });
      saveBracketPicks(); renderKnockoutBracket();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    populateMatchFilters();
    populatePredFilters();
    renderGroups();
  }
  init();

  window._wc = { getAllMatches() { return [...liveMatches]; } };

})();
