// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions } from './db.js';

(function () {

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentUser  = null;
  let authResolved = false;
  let activeTab       = 'groups';
  let activePredSubtab = 'pred-matches';
  let userPredictions = {};

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function openModal()  { document.getElementById('auth-modal')?.removeAttribute('hidden'); }
  function closeModal() { document.getElementById('auth-modal')?.setAttribute('hidden', ''); }

  // ─── Sub-tab routing (Predictions) ────────────────────────────────────────
  function switchPredSubtab(id) {
    activePredSubtab = id;
    document.querySelectorAll('.sub-tab').forEach(btn => {
      const active = btn.dataset.subtab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('.sub-tab-panel').forEach(panel => {
      panel.hidden = panel.id !== `subtab-${id}`;
    });
    // Show/hide the match filters only for the pred-matches sub-tab
    const predFilters = document.getElementById('pred-filters');
    if (predFilters) predFilters.hidden = (id !== 'pred-matches');

    if (id === 'pred-matches')           renderPredictions();
    if (id === 'pred-group-standings')   renderPredGroupStandings();
    if (id === 'pred-standings')         renderPredStandings();
    if (id === 'pred-bracket')           renderKnockoutBracket();
  }

  // ─── Tab routing ──────────────────────────────────────────────────────────
  function switchTab(id) {
    activeTab = id;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      const active = btn.dataset.tab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.hidden = panel.id !== `tab-${id}`;
    });
    if (id === 'groups')      renderGroups();
    if (id === 'matches')     renderMatches();
    if (id === 'standings')   renderStandings();
    if (id === 'predictions') {
      switchPredSubtab(activePredSubtab);
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  watchAuth(async (user) => {
    currentUser = user;
    authResolved = true;
    const userInfo = document.getElementById('user-info');
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');

    if (user) {
      if (userInfo)  userInfo.textContent = user.email;
      if (signInBtn)  signInBtn.hidden = true;
      if (signOutBtn) signOutBtn.hidden = false;

      // Load this user's predictions from Firestore
      getUserPredictions(user.uid, (preds) => {
        if (preds && preds.length) {
          userPredictions = {};
          preds.forEach(p => { userPredictions[p.matchId] = p; });
        } else {
          userPredictions = {};
        }
        renderAll();
      });
    } else {
      if (userInfo)  userInfo.textContent = '';
      if (signInBtn)  signInBtn.hidden = false;
      if (signOutBtn) signOutBtn.hidden = true;
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
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab));
  });

  document.getElementById('sign-in-btn')?.addEventListener('click', openModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());

  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  document.getElementById('auth-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  const authForm = document.getElementById('auth-form');
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const isSignUp = document.getElementById('auth-mode').value === 'signup';
    const errEl = document.getElementById('auth-error');
    try {
      if (isSignUp) await signUp(email, password);
      else          await signIn(email, password);
      closeModal();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  });

  document.getElementById('auth-toggle')?.addEventListener('click', () => {
    const modeEl = document.getElementById('auth-mode');
    const submitBtn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-toggle');
    const titleEl = document.getElementById('auth-modal-title');
    if (modeEl.value === 'signin') {
      modeEl.value = 'signup';
      if (titleEl)   titleEl.textContent = 'Create Account';
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign In';
    } else {
      modeEl.value = 'signin';
      if (titleEl)   titleEl.textContent = 'Sign In';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign Up";
    }
  });

  // ─── Match filters (Matches tab) ──────────────────────────────────────────
  document.getElementById('date-filter')?.addEventListener('change', renderMatches);
  document.getElementById('group-filter')?.addEventListener('change', renderMatches);
  document.getElementById('team-filter')?.addEventListener('input', renderMatches);

  // ─── Pred Match filters ────────────────────────────────────────────────────
  document.getElementById('pred-date-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-team-filter')?.addEventListener('input', renderPredictions);

  // ─── Live match data ──────────────────────────────────────────────────────
  watchMatches((updatedMatches) => {
    updatedMatches.forEach(um => {
      const idx = WC_MATCHES.findIndex(m => m.id === um.id);
      if (idx !== -1) {
        WC_MATCHES[idx] = { ...WC_MATCHES[idx], ...um };
      }
    });
    renderAll();
  });

  // ─── Admin UID ────────────────────────────────────────────────────────────
  const ADMIN_UID = 'EAi3lYhlSFYGaqm9F87BdJb1Vrg1';

  // ─── Groups ───────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-container');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const standings = calcPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr class="${i < 2 ? 'qualify' : ''}">
                <td>${s.team}</td>
                <td>${s.played}</td>
                <td>${s.won}</td>
                <td>${s.drawn}</td>
                <td>${s.lost}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
                <td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
                <td><strong>${s.pts}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Points calculator ────────────────────────────────────────────────────
  function calcPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      stats[t] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    matches.forEach(m => {
      if (m.homeScore === null || m.homeScore === undefined ||
          m.awayScore === null || m.awayScore === undefined) return;
      const h = m.homeScore, a = m.awayScore;
      stats[m.home].played++; stats[m.away].played++;
      stats[m.home].gf += h;  stats[m.away].gf += a;
      stats[m.home].ga += a;  stats[m.away].ga += h;
      if (h > a)      { stats[m.home].won++;   stats[m.home].pts += 3; stats[m.away].lost++; }
      else if (h < a) { stats[m.away].won++;   stats[m.away].pts += 3; stats[m.home].lost++; }
      else            { stats[m.home].drawn++; stats[m.home].pts += 1; stats[m.away].drawn++; stats[m.away].pts += 1; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
    );
  }

  // ─── Matches ──────────────────────────────────────────────────────────────
  function populateMatchFilters() {
    const dateSelect  = document.getElementById('date-filter');
    const stageSelect = document.getElementById('group-filter');
    if (!dateSelect || !stageSelect) return;
    const dates = [...new Set(WC_MATCHES.map(m => m.date).filter(Boolean))].sort();
    dateSelect.innerHTML = '<option value="">All Dates</option>' +
      dates.map(d => `<option value="${d}">${d}</option>`).join('');
    const stages = [...new Set(WC_MATCHES.map(m => m.group || m.stage).filter(Boolean))];
    stageSelect.innerHTML = '<option value="">All Stages</option>' +
      stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
  }

  function populatePredFilters() {
    const dateSelect  = document.getElementById('pred-date-filter');
    const stageSelect = document.getElementById('pred-group-filter');
    if (!dateSelect || !stageSelect) return;
    const dates = [...new Set(WC_MATCHES.map(m => m.date).filter(Boolean))].sort();
    dateSelect.innerHTML = '<option value="">All Dates</option>' +
      dates.map(d => `<option value="${d}">${d}</option>`).join('');
    const stages = [...new Set(WC_MATCHES.map(m => m.group || m.stage).filter(Boolean))];
    stageSelect.innerHTML = '<option value="">All Stages</option>' +
      stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
  }

  const stageKeyToLabel = (key) => {
    const labels = {
      R32: 'Round of 32', R16: 'Round of 16',
      QF: 'Quarter-Finals', SF: 'Semi-Finals',
      '3P': 'Third Place', F: 'Final'
    };
    if (labels[key]) return labels[key];
    if (/^[A-Z]$/.test(key)) return `Group ${key}`;
    return key;
  };

  function renderMatches() {
    const container = document.getElementById('matches-container');
    if (!container) return;
    const dateVal  = document.getElementById('date-filter')?.value  || '';
    const stageVal = document.getElementById('group-filter')?.value || '';
    const teamVal  = (document.getElementById('team-filter')?.value || '').toLowerCase();
    let matches = WC_MATCHES.slice();
    if (dateVal)  matches = matches.filter(m => m.date === dateVal);
    if (stageVal) matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (teamVal)  matches = matches.filter(m =>
      m.home.toLowerCase().includes(teamVal) || m.away.toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) {
      container.innerHTML = '<p class="muted">No matches found.</p>';
      return;
    }
    matches.forEach(m => container.appendChild(buildMatchCard(m, false)));
  }

  function buildMatchCard(m, isPred) {
    const card = document.createElement('div');
    card.className = 'match-card';
    const stageLabel = m.group ? `Group ${m.group}` : stageKeyToLabel(m.stage || '');
    const isAdmin = currentUser && currentUser.uid === ADMIN_UID;
    let scoreHtml = '';
    if (isPred) {
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
    } else if (isAdmin) {
      scoreHtml = `
        <div class="score-inputs">
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="home"
            value="${m.homeScore !== undefined && m.homeScore !== null ? m.homeScore : ''}">
          <span class="score-sep">–</span>
          <input type="number" class="score-input" min="0" max="99"
            data-match="${m.id}" data-side="away"
            value="${m.awayScore !== undefined && m.awayScore !== null ? m.awayScore : ''}">
        </div>
        <div class="score-save-row">
          <button class="btn btn-sm btn-primary save-score-btn" data-match="${m.id}">Save</button>
        </div>`;
    } else {
      const hs = m.homeScore !== undefined && m.homeScore !== null ? m.homeScore : '–';
      const as = m.awayScore !== undefined && m.awayScore !== null ? m.awayScore : '–';
      scoreHtml = `<div class="score-display">${hs} – ${as}</div>`;
    }
    card.innerHTML = `
      <div class="match-card-header">
        <span class="match-meta">${stageLabel}</span>
        <span class="match-meta">${m.date || ''} ${m.time || ''}</span>
      </div>
      <div class="match-teams">
        <span class="team home-team">${m.home}</span>
        ${scoreHtml}
        <span class="team away-team">${m.away}</span>
      </div>
      ${m.venue ? `<div class="match-venue">${m.venue}</div>` : ''}`;
    if (isPred && currentUser) {
      card.querySelector('.save-pred-btn')?.addEventListener('click', () => {
        const homeInput = card.querySelector('[data-side="home"]');
        const awayInput = card.querySelector('[data-side="away"]');
        const home = parseInt(homeInput?.value);
        const away = parseInt(awayInput?.value);
        if (isNaN(home) || isNaN(away)) return;
        const matchId = m.id;
        userPredictions[matchId] = { ...userPredictions[matchId], homeScorePred: home, awayScorePred: away };
        savePrediction(currentUser.uid, matchId, home, away);
      });
    }
    if (!isPred && isAdmin) {
      card.querySelector('.save-score-btn')?.addEventListener('click', async () => {
        const { saveScore } = await import('./db.js');
        const homeInput = card.querySelector('[data-side="home"]');
        const awayInput = card.querySelector('[data-side="away"]');
        const home = parseInt(homeInput?.value);
        const away = parseInt(awayInput?.value);
        if (isNaN(home) || isNaN(away)) return;
        await saveScore(m.id, home, away);
      });
    }
    return card;
  }

  // ─── Standings ────────────────────────────────────────────────────────────
  function renderStandings() {
    const container = document.getElementById('standings-container');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const standings = calcPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr class="${i < 2 ? 'qualify' : ''}">
                <td>${s.team}</td>
                <td>${s.played}</td>
                <td>${s.won}</td>
                <td>${s.drawn}</td>
                <td>${s.lost}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
                <td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
                <td><strong>${s.pts}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Predictions ──────────────────────────────────────────────────────────
  function renderPredictions() {
    const container = document.getElementById('predictions-container');
    if (!container) return;

    const authPrompt = document.getElementById('predictions-auth-prompt');
    if (!currentUser) {
      if (authPrompt) authPrompt.hidden = false;
      container.innerHTML = '';
      return;
    }
    if (authPrompt) authPrompt.hidden = true;

    const dateVal  = document.getElementById('pred-date-filter')?.value  || '';
    const stageVal = document.getElementById('pred-group-filter')?.value || '';
    const teamVal  = (document.getElementById('pred-team-filter')?.value || '').toLowerCase();
    let matches = WC_MATCHES.filter(m => m.group || m.stage === 'R32');
    if (dateVal)  matches = matches.filter(m => m.date === dateVal);
    if (stageVal) matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (teamVal)  matches = matches.filter(m =>
      m.home.toLowerCase().includes(teamVal) || m.away.toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) {
      container.innerHTML = '<p class="muted">No matches found.</p>';
      return;
    }
    matches.forEach(m => container.appendChild(buildMatchCard(m, true)));
  }

  // ─── Predicted Group Standings ────────────────────────────────────────────
  function calcPredPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      stats[t] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred === undefined || pred.awayScorePred === undefined) return;
      const h = pred.homeScorePred, a = pred.awayScorePred;
      if (!stats[m.home] || !stats[m.away]) return;
      stats[m.home].played++; stats[m.away].played++;
      stats[m.home].gf += h;  stats[m.away].gf += a;
      stats[m.home].ga += a;  stats[m.away].ga += h;
      if (h > a)      { stats[m.home].won++;   stats[m.home].pts += 3; stats[m.away].lost++; }
      else if (h < a) { stats[m.away].won++;   stats[m.away].pts += 3; stats[m.home].lost++; }
      else            { stats[m.home].drawn++; stats[m.home].pts += 1; stats[m.away].drawn++; stats[m.away].pts += 1; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
    );
  }

  function renderPredGroupStandings() {
    const container = document.getElementById('pred-group-standings-container');
    if (!container) return;
    const authPrompt = document.getElementById('pred-group-standings-auth-prompt');
    if (!currentUser) {
      if (authPrompt) authPrompt.hidden = false;
      container.innerHTML = '';
      return;
    }
    if (authPrompt) authPrompt.hidden = true;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const standings = calcPredPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr class="${i < 2 ? 'qualify' : ''}">
                <td>${s.team}</td>
                <td>${s.played}</td>
                <td>${s.won}</td>
                <td>${s.drawn}</td>
                <td>${s.lost}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
                <td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
                <td><strong>${s.pts}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
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

  function calcActualPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => stats[t] = { team: t, pts: 0, gd: 0, gf: 0 });
    for (const m of matches) {
      if (m.homeScore == null || m.awayScore == null) return null; // incomplete
      const h = m.homeScore, a = m.awayScore;
      stats[m.home].gf += h; stats[m.home].gd += h - a;
      stats[m.away].gf += a; stats[m.away].gd += a - h;
      if (h > a)      { stats[m.home].pts += 3; }
      else if (h < a) { stats[m.away].pts += 3; }
      else            { stats[m.home].pts += 1; stats[m.away].pts += 1; }
    }
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
    );
  }

  function getActualGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    const standings = calcActualPoints(group.teams, groupMatches);
    if (!standings) return null; // incomplete results
    return standings[rank - 1]?.team || null;
  }

  function getPredictedGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    // Only use predictions if at least one match is predicted
    const hasPredictions = groupMatches.some(m => {
      const pred = userPredictions[m.id];
      return pred && pred.homeScorePred !== undefined;
    });
    if (!hasPredictions) return null;
    const standings = calcPredPoints(group.teams, groupMatches);
    return standings[rank - 1]?.team || null;
  }

  function resolveKnockoutTeam(slot, depth = 0) {
    if (depth > 10) return slot; // guard against infinite loops
    if (!slot || typeof slot !== 'string') return slot;
    // Already a team name (not a slot code)
    const slotPattern = /^(\d+)([A-Z])$|^(W|L)(\d+)$|^B3([A-Z]{3,})$/;
    if (!slotPattern.test(slot)) return slot;

    // e.g. "1A" → winner of group A
    const groupMatch = slot.match(/^(\d)([A-Z])$/);
    if (groupMatch) {
      const rank = parseInt(groupMatch[1]);
      const groupId = groupMatch[2];
      return getActualGroupFinisher(groupId, rank)
          || getPredictedGroupFinisher(groupId, rank)
          || slot;
    }
    // e.g. "W49" → winner of match 49
    const winnerMatch = slot.match(/^W(\d+)$/);
    if (winnerMatch) {
      const matchId = parseInt(winnerMatch[1]);
      const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
      if (!fixture) return slot;
      const pick = bracketPicks[matchId];
      if (!pick) return slot;
      const homeTeam = resolveKnockoutTeam(fixture.home, depth + 1);
      const awayTeam = resolveKnockoutTeam(fixture.away, depth + 1);
      return pick === 'home' ? homeTeam : awayTeam;
    }
    return slot;
  }

  function clearDownstreamPicks(matchId) {
    const toVisit = [matchId];
    const visited = new Set();
    while (toVisit.length) {
      const id = toVisit.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      delete bracketPicks[id];
      // Find fixtures that reference this match's winner
      WC_KNOCKOUT_FIXTURES.forEach(f => {
        if (f.home === `W${id}` || f.away === `W${id}`) {
          toVisit.push(f.id);
        }
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
      { label: 'Round of 32', ids: [49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64] },
      { label: 'Round of 16', ids: [65,66,67,68,69,70,71,72] },
      { label: 'Quarter-Finals', ids: [73,74,75,76] },
      { label: 'Semi-Finals', ids: [77,78] },
      { label: 'Final', ids: [79] },
    ];

    const totalPicks = rounds.reduce((sum, r) => sum + r.ids.length, 0);
    const madePicksCount = rounds.reduce((sum, r) =>
      sum + r.ids.filter(id => bracketPicks[id]).length, 0);
    const pct = Math.round((madePicksCount / totalPicks) * 100);

    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'bracket-header';
    header.innerHTML = `
      <div class="bracket-progress">
        <span>${madePicksCount}/${totalPicks} picks made</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bracket-actions">
        <button class="btn btn-sm btn-secondary" id="bracket-seed-btn">Seed from Results</button>
        <button class="btn btn-sm btn-ghost" id="bracket-reset-all-btn">Reset All</button>
      </div>`;
    container.appendChild(header);

    // Bracket scroll area
    const scrollArea = document.createElement('div');
    scrollArea.className = 'bracket-scroll';
    container.appendChild(scrollArea);

    rounds.forEach(round => {
      const roundEl = document.createElement('div');
      roundEl.className = 'bracket-round';
      roundEl.innerHTML = `<div class="bracket-round-label">${round.label}</div>`;

      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-xs btn-ghost bracket-round-reset';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', () => {
        round.ids.forEach(id => clearDownstreamPicks(id));
        saveBracketPicks(); renderKnockoutBracket();
      });
      roundEl.querySelector('.bracket-round-label').appendChild(resetBtn);

      round.ids.forEach(matchId => {
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;
        const homeTeam = resolveKnockoutTeam(fixture.home);
        const awayTeam = resolveKnockoutTeam(fixture.away);
        const pick = bracketPicks[matchId];

        const matchEl = document.createElement('div');
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

    // Champion column
    const finalPick = bracketPicks[79];
    let champion = null;
    if (finalPick) {
      const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === 79);
      if (finalFixture) {
        const homeTeam = resolveKnockoutTeam(finalFixture.home);
        const awayTeam = resolveKnockoutTeam(finalFixture.away);
        champion = finalPick === 'home' ? homeTeam : awayTeam;
      }
    }
    const champEl = document.createElement('div');
    champEl.className = 'bracket-round bracket-champion';
    champEl.innerHTML = `
      <div class="bracket-round-label">Champion</div>
      <div class="champion-card">${champion ? `<span class="trophy">🏆</span><span>${champion}</span>` : '<span class="muted">TBD</span>'}</div>`;
    scrollArea.appendChild(champEl);

    // Wire up header buttons
    container.querySelector('#bracket-reset-all-btn')?.addEventListener('click', () => {
      bracketPicks = {};
      saveBracketPicks(); renderKnockoutBracket();
    });

    const seedBtn = container.querySelector('#bracket-seed-btn');
    if (seedBtn) {
      seedBtn.addEventListener('click', () => {
        WC_KNOCKOUT_FIXTURES.forEach(fixture => {
          const hr = resolveKnockoutTeam(fixture.home);
          const ar = resolveKnockoutTeam(fixture.away);
          if (hr && ar && !bracketPicks[fixture.id]) bracketPicks[fixture.id] = 'home';
        });
        saveBracketPicks(); renderKnockoutBracket();
      });
    }
  }

  // ─── Pred Standings ──────────────────────────────────────────────────────────
  function renderPredStandings() {
    const container = document.getElementById('pred-standings-container');
    if (!container) return;
    const authPrompt = document.getElementById('pred-standings-auth-prompt');

    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      if (authPrompt) authPrompt.hidden = false;
      return;
    }
    if (authPrompt) authPrompt.hidden = true;

    container.innerHTML = '';
    let correctExact = 0, correctResult = 0, total = 0;

    WC_MATCHES.forEach(match => {
      const pred = userPredictions[match.id];
      if (!pred || pred.homeScorePred === undefined) return;
      if (match.homeScore === undefined || match.homeScore === null ||
          match.awayScore === undefined || match.awayScore === null) return;
      total++;
      const predResult   = pred.homeScorePred > pred.awayScorePred ? 'H' : pred.homeScorePred < pred.awayScorePred ? 'A' : 'D';
      const actualResult = match.homeScore > match.awayScore ? 'H' : match.homeScore < match.awayScore ? 'A' : 'D';
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

  // ─── Init ────────────────────────────────────────────────────────────────────
  function init() {
    populateMatchFilters();
    populatePredFilters();
    renderGroups();
    renderMatches();
    renderStandings();
  }
  init();

  window._wc = { getAllMatches() { return [...WC_MATCHES]; } };

})();
