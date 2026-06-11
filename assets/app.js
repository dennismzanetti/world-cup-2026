// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions, updateMatchResult, saveBracketPicks, getBracketPicks } from './db.js';

(function () {

  // ─── State ────────────────────────────────────────────────────────────────
  let currentUser      = null;
  let authResolved     = false;
  let activeTab        = 'groups';
  let activePredSubtab = 'my-picks';
  let userPredictions  = {};  // matchId → {homeScorePred, awayScorePred}
  let liveMatches      = WC_MATCHES.slice(); // mutable working copy
  let bracketPicks     = {};  // matchId → 'home' | 'away'
  let bracketView      = 'overlay'; // 'my' | 'actual' | 'overlay'

  // ─── Admin UIDs ───────────────────────────────────────────────────────────
  const ADMIN_UIDS = ['EAi3lYhlSFYGaqm9F87BdJb1Vrg1'];

  // ─── Team name helper ─────────────────────────────────────────────────────
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
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('hidden');
      else        panel.setAttribute('hidden', '');
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
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.view').forEach(view => {
      const active = view.id === `view-${id}`;
      view.classList.toggle('active', active);
    });
    if (id === 'groups')      renderGroups();
    if (id === 'matches')     renderMatches();
    if (id === 'standings')   renderStandings();
    if (id === 'predictions') {
      switchPredSubtab(activePredSubtab);
    }
  }

  // ─── Auth watcher ─────────────────────────────────────────────────────────
  watchAuth(user => {
    currentUser = user;
    authResolved = true;
    const bar  = document.getElementById('user-bar');
    const greet = document.getElementById('user-greeting');
    if (user) {
      bar?.removeAttribute('hidden');
      if (greet) greet.textContent = `Hello, ${user.displayName || user.email}`;
      loadUserData();
    } else {
      bar?.setAttribute('hidden', '');
      userPredictions = {};
      bracketPicks    = {};
    }
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
  });

  // ─── Data loading ─────────────────────────────────────────────────────────
  function loadUserData() {
    if (!currentUser) return;

    // getUserPredictions returns an array of docs — convert to a matchId-keyed map
    getUserPredictions(currentUser.uid).then(predsArray => {
      const map = {};
      (predsArray || []).forEach(p => {
        if (p.matchId) map[p.matchId] = p;
      });
      userPredictions = map;
      if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
    });

    getBracketPicks(currentUser.uid).then(picks => {
      bracketPicks = picks || {};
      if (activeTab === 'predictions' && activePredSubtab === 'pred-bracket') renderKnockoutBracket();
    });
  }

  watchMatches(matches => {
    liveMatches = matches;
    if (activeTab === 'matches')   renderMatches();
    if (activeTab === 'standings') renderStandings();
    if (activeTab === 'groups')    renderGroups();
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
  });

  // ─── Nav buttons ─────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });
  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab));
  });

  // ─── Auth form ────────────────────────────────────────────────────────────
  const signInForm  = document.getElementById('sign-in-form');
  const signUpForm  = document.getElementById('sign-up-form');
  const authError   = document.getElementById('auth-error');
  const authToggle  = document.getElementById('auth-toggle-link');
  const authSubmit  = document.getElementById('auth-submit-btn');
  const authHeading = document.getElementById('auth-heading');
  let authMode = 'signin';

  document.getElementById('auth-open-btn')?.addEventListener('click', openModal);
  document.getElementById('auth-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('auth-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());

  authToggle?.addEventListener('click', e => {
    e.preventDefault();
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    signInForm?.classList.toggle('hidden', authMode !== 'signin');
    signUpForm?.classList.toggle('hidden', authMode !== 'signup');
    if (authHeading) authHeading.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
    if (authSubmit)  authSubmit.textContent  = authMode === 'signin' ? 'Sign In' : 'Sign Up';
    if (authToggle)  authToggle.textContent  = authMode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In';
    if (authError)   authError.textContent   = '';
  });

  document.getElementById('auth-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (authError) authError.textContent = '';
    if (authSubmit) authSubmit.disabled = true;
    try {
      if (authMode === 'signin') {
        const email = document.getElementById('signin-email')?.value.trim();
        const pass  = document.getElementById('signin-password')?.value;
        await signIn(email, pass);
      } else {
        const name  = document.getElementById('signup-name')?.value.trim();
        const email = document.getElementById('signup-email')?.value.trim();
        const pass  = document.getElementById('signup-password')?.value;
        await signUp(email, pass, name);
      }
      closeModal();
    } catch (err) {
      if (authError) authError.textContent = err.message || 'Authentication failed';
    } finally {
      if (authSubmit) authSubmit.disabled = false;
    }
  });

  // ─── Theme toggle ─────────────────────────────────────────────────────────
  (function () {
    const toggle = document.querySelector('[data-theme-toggle]');
    const html   = document.documentElement;
    let savedTheme = null;
    try { savedTheme = localStorage.getItem('theme'); } catch(e) {}
    let theme = savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    html.setAttribute('data-theme', theme);
    function updateIcon() {
      if (!toggle) return;
      toggle.innerHTML = theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }
    updateIcon();
    toggle?.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', theme);
      try { localStorage.setItem('theme', theme); } catch(e) {}
      updateIcon();
    });
  })();

  // ─── Match filter helpers ──────────────────────────────────────────────────
  let matchFilters = { group: 'all', date: 'all', search: '' };
  let predFilters  = { group: 'all', status: 'all' };

  function populateMatchFilters() {
    const sel = document.getElementById('match-group-filter');
    if (!sel) return;
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = `Group ${g.id}`;
      sel.appendChild(opt);
    });
  }
  function populatePredFilters() {
    const sel = document.getElementById('pred-group-filter');
    if (!sel) return;
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = `Group ${g.id}`;
      sel.appendChild(opt);
    });
  }

  document.getElementById('match-group-filter')?.addEventListener('change', e => {
    matchFilters.group = e.target.value; renderMatches();
  });
  document.getElementById('match-date-filter')?.addEventListener('change', e => {
    matchFilters.date = e.target.value; renderMatches();
  });
  document.getElementById('match-search')?.addEventListener('input', e => {
    matchFilters.search = e.target.value.toLowerCase(); renderMatches();
  });
  document.getElementById('pred-group-filter')?.addEventListener('change', e => {
    predFilters.group = e.target.value; renderPredictions();
  });
  document.getElementById('pred-status-filter')?.addEventListener('change', e => {
    predFilters.status = e.target.value; renderPredictions();
  });

  // ─── Groups tab ───────────────────────────────────────────────────────────
  function calcPoints(teams, matches) {
    const table = {};
    teams.forEach(t => { table[t.name] = { team: t, pts: 0, gd: 0, gf: 0, ga: 0, played: 0, w: 0, d: 0, l: 0 }; });
    matches.forEach(m => {
      if (m.homeScore == null || m.awayScore == null) return;
      const h = table[teamName(m.home)], a = table[teamName(m.away)];
      if (!h || !a) return;
      h.gf += m.homeScore; h.ga += m.awayScore; h.gd = h.gf - h.ga; h.played++;
      a.gf += m.awayScore; a.ga += m.homeScore; a.gd = a.gf - a.ga; a.played++;
      if (m.homeScore > m.awayScore) { h.pts += 3; h.w++; a.l++; }
      else if (m.homeScore < m.awayScore) { a.pts += 3; a.w++; h.l++; }
      else { h.pts += 1; a.pts += 1; h.d++; a.d++; }
    });
    return Object.values(table).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }

  function calcPredPoints(teams, matches) {
    const table = {};
    teams.forEach(t => { table[t.name] = { team: t, pts: 0, gd: 0, gf: 0, ga: 0, played: 0 }; });
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred == null || pred.awayScorePred == null) return;
      const h = table[teamName(m.home)], a = table[teamName(m.away)];
      if (!h || !a) return;
      const hs = pred.homeScorePred, as = pred.awayScorePred;
      h.gf += hs; h.ga += as; h.gd = h.gf - h.ga; h.played++;
      a.gf += as; a.ga += hs; a.gd = a.gf - a.ga; a.played++;
      if (hs > as) { h.pts += 3; } else if (hs < as) { a.pts += 3; } else { h.pts += 1; a.pts += 1; }
    });
    return Object.values(table).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }

  function renderGroups() {
    const container = document.getElementById('groups-container');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const gm = liveMatches.filter(m => m.group === group.id);
      const standings = calcPoints(group.teams, gm);
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <h3 class="group-title">Group ${group.id}</h3>
        <table class="group-table">
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${standings.map((row, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td class="team-cell"><span class="team-flag">${row.team.flag}</span>${row.team.name}</td>
              <td>${row.played}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td>
              <td>${row.gd > 0 ? '+' : ''}${row.gd}</td>
              <td class="pts-cell">${row.pts}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Matches tab ──────────────────────────────────────────────────────────
  function renderMatches() {
    const container = document.getElementById('matches-container');
    if (!container) return;
    let matches = liveMatches.filter(m => m.group); // group stage only in matches tab
    if (matchFilters.group !== 'all') matches = matches.filter(m => m.group === matchFilters.group);
    if (matchFilters.date !== 'all')  matches = matches.filter(m => m.date === matchFilters.date);
    if (matchFilters.search) {
      matches = matches.filter(m =>
        teamName(m.home).toLowerCase().includes(matchFilters.search) ||
        teamName(m.away).toLowerCase().includes(matchFilters.search)
      );
    }
    if (!matches.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches found.</div>';
      return;
    }
    const byDate = {};
    matches.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    container.innerHTML = '';
    Object.keys(byDate).sort().forEach(date => {
      const section = document.createElement('div');
      section.className = 'match-date-section';
      const d = new Date(date + 'T12:00:00');
      section.innerHTML = `<h3 class="match-date-header">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h3>`;
      byDate[date].forEach(m => section.appendChild(buildMatchCard(m)));
      container.appendChild(section);
    });
  }

  function buildMatchCard(m) {
    const pred = userPredictions[m.id] || {};
    const played = m.homeScore != null;
    const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);
    const card = document.createElement('div');
    card.className = 'match-card' + (played ? ' match-played' : '');
    const broadcastHtml = [
      ...(m.tvEnglish||[]).map(ch=>`<span class="bc-chip bc-tv">${ch}</span>`),
      ...(m.tvSpanish||[]).map(ch=>`<span class="bc-chip bc-esp">${ch}</span>`),
      ...(m.streaming||[]).map(s=>`<span class="bc-chip bc-stream">${s}</span>`),
    ].join('');
    card.innerHTML = `
      <div class="match-meta">
        <span class="match-group-badge">Group ${m.group}</span>
        <span class="match-time">${m.timeLocal} ${m.tz}</span>
        <span class="match-venue">${m.venue}, ${m.city}</span>
      </div>
      <div class="match-teams">
        <div class="match-team match-team--home">
          <span class="match-flag">${teamFlag(m.home)}</span>
          <span class="match-name">${teamName(m.home)}</span>
        </div>
        <div class="match-score-block">
          ${played
            ? `<span class="match-score">${m.homeScore} \u2013 ${m.awayScore}</span>`
            : `<span class="match-score-dash">vs</span>`}
        </div>
        <div class="match-team match-team--away">
          <span class="match-name">${teamName(m.away)}</span>
          <span class="match-flag">${teamFlag(m.away)}</span>
        </div>
      </div>
      ${broadcastHtml ? `<div class="match-broadcast">${broadcastHtml}</div>` : ''}
      ${isAdmin ? `<div class="match-admin" data-match-id="${m.id}">
        <input type="number" class="score-input" placeholder="Home" min="0" value="${m.homeScore ?? ''}" data-field="home">
        <span>\u2013</span>
        <input type="number" class="score-input" placeholder="Away" min="0" value="${m.awayScore ?? ''}" data-field="away">
        <button class="btn btn-sm btn-primary save-score-btn">Save</button>
      </div>` : ''}`;
    if (isAdmin) {
      card.querySelector('.save-score-btn')?.addEventListener('click', () => {
        const homeVal = card.querySelector('[data-field="home"]')?.value;
        const awayVal = card.querySelector('[data-field="away"]')?.value;
        const hs = homeVal !== '' ? parseInt(homeVal) : null;
        const as = awayVal !== '' ? parseInt(awayVal) : null;
        updateMatchResult(m.id, hs, as);
      });
    }
    return card;
  }

  // ─── Standings tab ────────────────────────────────────────────────────────
  function renderStandings() {
    const container = document.getElementById('standings-container');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const gm = liveMatches.filter(m => m.group === group.id);
      const standings = calcPoints(group.teams, gm);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <h3 class="standings-group-title">Group ${group.id}</h3>
        <table class="standings-table">
          <thead><tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th></tr></thead>
          <tbody>${standings.map((row, i) => `
            <tr class="${i < 2 ? 'qualify-row' : 'eliminated-row'}">
              <td>${i + 1}</td>
              <td><span>${row.team.flag}</span> ${row.team.name}</td>
              <td><strong>${row.pts}</strong></td>
              <td>${row.gd > 0 ? '+' : ''}${row.gd}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Predictions: My Picks ────────────────────────────────────────────────
  function renderPredictions() {
    const container = document.getElementById('pred-picks-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to make predictions.</p>
        <button class="btn btn-primary pred-signin-btn">Sign In</button></div>`;
      container.querySelector('.pred-signin-btn')?.addEventListener('click', openModal);
      return;
    }
    let matches = liveMatches.filter(m => m.group);
    if (predFilters.group !== 'all') matches = matches.filter(m => m.group === predFilters.group);
    if (predFilters.status === 'unpredicted') matches = matches.filter(m => !userPredictions[m.id]);
    if (predFilters.status === 'predicted')   matches = matches.filter(m =>  userPredictions[m.id]);
    if (!matches.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches to show.</div>';
      return;
    }
    const byDate = {};
    matches.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    container.innerHTML = '';
    Object.keys(byDate).sort().forEach(date => {
      const section = document.createElement('div');
      section.className = 'pred-date-section';
      const d = new Date(date + 'T12:00:00');
      section.innerHTML = `<h3 class="pred-date-header">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h3>`;
      byDate[date].forEach(m => section.appendChild(buildPredCard(m)));
      container.appendChild(section);
    });
  }

  function buildPredCard(m) {
    const pred = userPredictions[m.id] || {};
    const played = m.homeScore != null;
    const card = document.createElement('div');
    card.className = 'pred-card';
    const homeScore = pred.homeScorePred ?? '';
    const awayScore = pred.awayScorePred ?? '';
    card.innerHTML = `
      <div class="pred-card-teams">
        <span class="pred-flag">${teamFlag(m.home)}</span>
        <span class="pred-team-name">${teamName(m.home)}</span>
        <input type="number" class="pred-input" min="0" max="20" value="${homeScore}" placeholder="-" data-field="home">
        <span class="pred-sep">:</span>
        <input type="number" class="pred-input" min="0" max="20" value="${awayScore}" placeholder="-" data-field="away">
        <span class="pred-team-name pred-team-name--away">${teamName(m.away)}</span>
        <span class="pred-flag">${teamFlag(m.away)}</span>
      </div>
      ${played ? `<div class="pred-result-row">Result: <strong>${m.homeScore} \u2013 ${m.awayScore}</strong></div>` : ''}`;
    const saveInput = async () => {
      if (!currentUser) return;
      const h = card.querySelector('[data-field="home"]')?.value;
      const a = card.querySelector('[data-field="away"]')?.value;
      if (h === '' && a === '') return;
      const hs = h !== '' ? parseInt(h) : null;
      const as = a !== '' ? parseInt(a) : null;
      await savePrediction(currentUser.uid, m.id, { homeScorePred: hs, awayScorePred: as });
      userPredictions[m.id] = { homeScorePred: hs, awayScorePred: as };
    };
    card.querySelectorAll('.pred-input').forEach(inp => {
      inp.addEventListener('change', saveInput);
      inp.addEventListener('blur',   saveInput);
    });
    return card;
  }

  // ─── Predictions: Predicted Group Standings ───────────────────────────────
  function renderPredGroupStandings() {
    const container = document.getElementById('pred-group-standings-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to see your predicted standings.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button></div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const gm = liveMatches.filter(m => m.group === group.id);
      const standings = calcPredPoints(group.teams, gm);
      const hasPreds = standings.some(r => r.played > 0);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <h3 class="standings-group-title">Group ${group.id} <span style="font-weight:400;font-size:0.75em;color:var(--color-text-muted)">(predicted)</span></h3>
        ${!hasPreds
          ? '<p class="empty-filter-msg" style="padding:var(--space-4)">No predictions yet</p>'
          : `<table class="standings-table">
              <thead><tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th></tr></thead>
              <tbody>${standings.map((row, i) => `
                <tr class="${i < 2 ? 'qualify-row' : 'eliminated-row'}">
                  <td>${i + 1}</td>
                  <td><span>${row.team.flag}</span> ${row.team.name}</td>
                  <td><strong>${row.pts}</strong></td>
                  <td>${row.gd > 0 ? '+' : ''}${row.gd}</td>
                </tr>`).join('')}
              </tbody>
            </table>`}
      `;
      container.appendChild(card);
    });
  }

  // ─── Predictions: Leaderboard ─────────────────────────────────────────────
  function renderPredStandings() {
    const container = document.getElementById('pred-standings-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to see the leaderboard.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button></div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }
    const groupMatches = liveMatches.filter(m => m.group && m.homeScore != null);
    let correct = 0, correctExact = 0, total = 0;
    groupMatches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred == null) return;
      total++;
      const predWinner = pred.homeScorePred > pred.awayScorePred ? 'home'
                       : pred.homeScorePred < pred.awayScorePred ? 'away' : 'draw';
      const realWinner = m.homeScore > m.awayScore ? 'home'
                       : m.homeScore < m.awayScore ? 'away' : 'draw';
      if (predWinner === realWinner) correct++;
      if (pred.homeScorePred === m.homeScore && pred.awayScorePred === m.awayScore) correctExact++;
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    container.innerHTML = `
      <div class="pred-stats-grid">
        <div class="pred-stat-card">
          <div class="pred-stat-value">${total}</div>
          <div class="pred-stat-label">Matches Predicted</div>
        </div>
        <div class="pred-stat-card">
          <div class="pred-stat-value">${correct}</div>
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

  async function persistBracketPicks() {
    if (!currentUser) return;
    await saveBracketPicks(currentUser.uid, bracketPicks);
  }

  function getActualWinner(matchId) {
    const m = liveMatches.find(m => m.id === matchId);
    if (!m || m.homeScore == null || m.awayScore == null) return null;
    if (m.homeScore > m.awayScore) return 'home';
    if (m.awayScore > m.homeScore) return 'away';
    return null;
  }

  function resolveSlot(slot, mode, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 10 || !slot) return null;

    if (typeof slot === 'string') {
      const groupMatch = slot.match(/^(\d)([A-L])$/);
      if (groupMatch) {
        const rank = parseInt(groupMatch[1]);
        const gid  = groupMatch[2];
        const group = WC_GROUPS.find(g => g.id === gid);
        if (!group) return null;
        const gm = liveMatches.filter(m => m.group === gid);
        if (mode === 'actual') {
          if (gm.some(m => m.homeScore == null)) return null;
          return calcPoints(group.teams, gm)[rank - 1]?.team || null;
        } else {
          if (!gm.some(m => userPredictions[m.id]?.homeScorePred != null)) return null;
          return calcPredPoints(group.teams, gm)[rank - 1]?.team || null;
        }
      }
    }

    const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === slot);
    if (!fixture) return null;

    if (mode === 'actual') {
      const w = getActualWinner(slot);
      if (!w) return null;
      const src = w === 'home' ? fixture.homeSource : fixture.awaySource;
      if (!src) return w === 'home' ? fixture.home : fixture.away;
      if (src.type === 'group') return resolveSlot(`${src.pos}${src.group}`, mode, depth + 1);
      if (src.type === 'winner') return resolveSlot(src.matchId, mode, depth + 1);
      return w === 'home' ? fixture.home : fixture.away;
    } else {
      const pick = bracketPicks[slot];
      if (!pick) return null;
      const src = pick === 'home' ? fixture.homeSource : fixture.awaySource;
      if (!src) return pick === 'home' ? fixture.home : fixture.away;
      if (src.type === 'group') return resolveSlot(`${src.pos}${src.group}`, mode, depth + 1);
      if (src.type === 'winner') return resolveSlot(src.matchId, mode, depth + 1);
      return pick === 'home' ? fixture.home : fixture.away;
    }
  }

  function resolveFixtureTeams(fixture, mode) {
    function resolveSource(src, fallback) {
      if (!src) return fallback;
      if (src.type === 'group') return resolveSlot(`${src.pos}${src.group}`, mode) || fallback;
      if (src.type === 'winner') return resolveSlot(src.matchId, mode) || fallback;
      return fallback;
    }
    return {
      homeTeam: resolveSource(fixture.homeSource, fixture.home),
      awayTeam: resolveSource(fixture.awaySource, fixture.away),
    };
  }

  function clearDownstreamPicks(matchId) {
    const queue = [matchId], visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      delete bracketPicks[id];
      WC_KNOCKOUT_FIXTURES.forEach(f => {
        if (f.homeSource?.matchId === id || f.awaySource?.matchId === id) queue.push(f.id);
      });
    }
  }

  function bracketAccuracy() {
    let correct = 0, total = 0;
    WC_KNOCKOUT_FIXTURES.forEach(f => {
      const actual = getActualWinner(f.id);
      if (!actual) return;
      total++;
      if (bracketPicks[f.id] && bracketPicks[f.id] === actual) correct++;
    });
    return { correct, total };
  }

  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view your predicted bracket.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button></div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }
    container.innerHTML = '';

    const acc = bracketAccuracy();
    const totalPossible = WC_KNOCKOUT_FIXTURES.length;
    const madePicks = WC_KNOCKOUT_FIXTURES.filter(f => bracketPicks[f.id]).length;
    const pct = totalPossible > 0 ? Math.round((madePicks / totalPossible) * 100) : 0;
    const accPct = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : null;

    const roundDefs = [
      { label:'R32',   prefix:'r32-' },
      { label:'R16',   prefix:'r16-' },
      { label:'QF',    prefix:'qf-'  },
      { label:'SF',    prefix:'sf-'  },
      { label:'Final', prefix:'final' },
    ];

    const banner = document.createElement('div');
    banner.className = 'bracket-accuracy-banner';
    banner.innerHTML = `
      <div class="bab-main">
        <div class="bab-picks-group">
          <span class="bab-icon">&#x1F4CB;</span>
          <div class="bab-text">
            <div class="bab-stat-value">${madePicks}<span class="bab-of">/${totalPossible}</span></div>
            <div class="bab-stat-label">Picks Made</div>
          </div>
          <div class="bab-progress-wrap">
            <div class="bab-progress-bar"><div class="bab-progress-fill" style="width:${pct}%"></div></div>
            <span class="bab-pct">${pct}%</span>
          </div>
        </div>
        ${acc.total > 0 ? `
        <div class="bab-divider"></div>
        <div class="bab-accuracy-group">
          <span class="bab-icon">&#x1F3AF;</span>
          <div class="bab-text">
            <div class="bab-stat-value bab-correct">${acc.correct}<span class="bab-of">/${acc.total}</span></div>
            <div class="bab-stat-label">Correct</div>
          </div>
          ${accPct !== null ? `<div class="bab-accuracy-ring">${accPct}%</div>` : ''}
        </div>` : ''}
      </div>
      <div class="bab-rounds">
        ${roundDefs.map(({ label, prefix }) => {
          const ids = prefix === 'final'
            ? WC_KNOCKOUT_FIXTURES.filter(f => f.id === 'final')
            : WC_KNOCKOUT_FIXTURES.filter(f => f.id.startsWith(prefix));
          const done = ids.filter(f => bracketPicks[f.id]).length;
          const full = done === ids.length && ids.length > 0;
          return `<span class="bab-round-chip ${full ? 'bab-round-chip--done' : ''}">${label} ${done}/${ids.length}</span>`;
        }).join('')}
      </div>`;
    container.appendChild(banner);

    const toolbar = document.createElement('div');
    toolbar.className = 'bracket-toolbar';
    toolbar.innerHTML = `
      <div class="bracket-view-toggle" role="group" aria-label="Bracket view mode">
        <button class="bvt-btn${bracketView==='my'?' bvt-active':''}" data-bview="my">My Picks</button>
        <button class="bvt-btn${bracketView==='actual'?' bvt-active':''}" data-bview="actual">Actual</button>
        <button class="bvt-btn${bracketView==='overlay'?' bvt-active':''}" data-bview="overlay">Overlay &#x2728;</button>
      </div>
      <div class="bracket-actions">
        <button class="btn btn-sm btn-ghost" id="bracket-seed-btn">Seed from Groups</button>
        <button class="btn btn-sm btn-ghost" id="bracket-reset-all-btn">Reset All</button>
      </div>`;
    container.appendChild(toolbar);

    toolbar.querySelectorAll('.bvt-btn').forEach(btn => {
      btn.addEventListener('click', () => { bracketView = btn.dataset.bview; renderKnockoutBracket(); });
    });

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'bracket-scroll';
    container.appendChild(scrollWrap);

    const bracketEl = document.createElement('div');
    bracketEl.className = 'bracket';
    scrollWrap.appendChild(bracketEl);

    const rounds = [
      { label: 'Round of 32',    ids: ['r32-1','r32-2','r32-3','r32-4','r32-5','r32-6','r32-7','r32-8','r32-9','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'] },
      { label: 'Round of 16',    ids: ['r16-1','r16-2','r16-3','r16-4','r16-5','r16-6','r16-7','r16-8'] },
      { label: 'Quarter-Finals', ids: ['qf-1','qf-2','qf-3','qf-4'] },
      { label: 'Semi-Finals',    ids: ['sf-1','sf-2'] },
      { label: 'Final',          ids: ['final'] },
    ];

    rounds.forEach(round => {
      const roundEl = document.createElement('div');
      roundEl.className = 'bracket-round';
      if (round.ids[0] === 'final') roundEl.classList.add('bracket-round--final');

      const labelEl = document.createElement('div');
      labelEl.className = 'bracket-round-label';
      const resetBtn = document.createElement('button');
      resetBtn.className = 'bracket-reset-round';
      resetBtn.textContent = '\u21BA';
      resetBtn.title = `Reset ${round.label}`;
      resetBtn.addEventListener('click', () => {
        round.ids.forEach(id => clearDownstreamPicks(id));
        persistBracketPicks(); renderKnockoutBracket();
      });
      labelEl.appendChild(document.createTextNode(round.label));
      labelEl.appendChild(resetBtn);
      roundEl.appendChild(labelEl);

      const matchesEl = document.createElement('div');
      matchesEl.className = 'bracket-matches';
      roundEl.appendChild(matchesEl);
      bracketEl.appendChild(roundEl);

      round.ids.forEach(matchId => {
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;

        const myTeams      = resolveFixtureTeams(fixture, 'pick');
        const actualTeams  = resolveFixtureTeams(fixture, 'actual');
        const myPick       = bracketPicks[matchId];
        const actualResult = getActualWinner(matchId);

        const matchEl = document.createElement('div');
        matchEl.className = 'bracket-match';
        if (actualResult) matchEl.classList.add('bracket-match--played');
        if (bracketView === 'overlay') matchEl.classList.add('bracket-match--overlay');

        const buildTeamRow = (side) => {
          const myTeam    = side === 'home' ? myTeams.homeTeam    : myTeams.awayTeam;
          const actTeam   = side === 'home' ? actualTeams.homeTeam : actualTeams.awayTeam;
          const isMyPick  = myPick === side;
          const isActWin  = actualResult === side;

          const isTbd = (t) => !t || (t.name && (
            t.name.startsWith('W ') ||
            t.name.startsWith('Best') ||
            /^[12][A-L]$/.test(t.name)
          ));

          let rowState = '';
          if (bracketView === 'overlay' && actualResult) {
            if (isMyPick && isActWin)  rowState = 'correct';
            else if (isMyPick)         rowState = 'wrong';
            else if (isActWin)         rowState = 'actual-winner';
          }

          const row = document.createElement('button');
          row.className = 'bracket-team bracket-team--' + side;
          if (isMyPick) row.classList.add('bracket-team--picked');
          if (isActWin && bracketView !== 'my') row.classList.add('bracket-team--winner');
          if (rowState) row.classList.add('bracket-team--' + rowState);
          if (actualResult && !isActWin && bracketView === 'actual') row.classList.add('bracket-team--eliminated');

          if (bracketView === 'overlay') {
            const myName  = isTbd(myTeam)  ? '\u2014' : teamName(myTeam);
            const myFlag  = isTbd(myTeam)  ? '' : teamFlag(myTeam);
            const actName = isTbd(actTeam) ? 'TBD' : teamName(actTeam);
            const actFlag = isTbd(actTeam) ? '' : teamFlag(actTeam);
            row.innerHTML = `
              <div class="bt-overlay-row">
                <div class="bt-pred-side ${isMyPick?'bt-pred-side--picked':''}">
                  <span class="bt-col-label">Pred</span>
                  <span class="bt-flag">${myFlag}</span>
                  <span class="bt-name">${myName}</span>
                  ${isMyPick ? '<span class="bt-pick-indicator"></span>' : ''}
                </div>
                <div class="bt-divider-v"></div>
                <div class="bt-actual-side ${isActWin?'bt-actual-side--winner':''}">
                  <span class="bt-col-label">Actual</span>
                  <span class="bt-flag">${actFlag}</span>
                  <span class="bt-name">${actName}</span>
                  ${rowState === 'correct' ? '<span class="bt-result bt-result--correct">&#x2713;</span>' :
                    rowState === 'wrong'   ? '<span class="bt-result bt-result--wrong">&#x2717;</span>' :
                    isActWin              ? '<span class="bt-result bt-result--win">W</span>' : ''}
                </div>
              </div>`;
          } else if (bracketView === 'actual') {
            const name = isTbd(actTeam) ? (side==='home' ? fixture.home?.name : fixture.away?.name) || 'TBD' : teamName(actTeam);
            const flag = isTbd(actTeam) ? '' : teamFlag(actTeam);
            row.innerHTML = `
              <span class="bracket-flag">${flag}</span>
              <span class="bracket-name ${isTbd(actTeam)?'bracket-team--tbd':''}">${name}</span>
              ${isActWin ? '<span class="bracket-check">&#x2713;</span>' : ''}`;
          } else {
            const name = isTbd(myTeam) ? (side==='home' ? fixture.home?.name : fixture.away?.name) || 'TBD' : teamName(myTeam);
            const flag = isTbd(myTeam) ? '' : teamFlag(myTeam);
            row.innerHTML = `
              <span class="bracket-flag">${flag}</span>
              <span class="bracket-name ${isTbd(myTeam)?'bracket-team--tbd':''}">${name}</span>
              ${isMyPick ? '<span class="bracket-check">&#x2713;</span>' : ''}`;
          }

          row.addEventListener('click', () => {
            if (bracketView === 'actual') return;
            if (bracketPicks[matchId] !== side) clearDownstreamPicks(matchId);
            bracketPicks[matchId] = side;
            persistBracketPicks(); renderKnockoutBracket();
          });
          return row;
        };

        const homeRow = buildTeamRow('home');
        const vsEl = document.createElement('div');
        vsEl.className = 'bracket-vs';
        vsEl.textContent = 'vs';
        const awayRow = buildTeamRow('away');

        const dateEl = document.createElement('div');
        dateEl.className = 'bracket-date';
        if (fixture.date) {
          const d = new Date(fixture.date + 'T12:00:00');
          dateEl.textContent = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
        }

        matchEl.appendChild(homeRow);
        matchEl.appendChild(vsEl);
        matchEl.appendChild(awayRow);
        if (fixture.date) matchEl.appendChild(dateEl);
        matchesEl.appendChild(matchEl);
      });
    });

    // Champion column
    const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === 'final');
    let myChamp = null, actualChamp = null;
    if (finalFixture) {
      const myPick = bracketPicks['final'];
      if (myPick) {
        const src = myPick === 'home' ? finalFixture.homeSource : finalFixture.awaySource;
        if (src?.type === 'winner') myChamp = resolveSlot(src.matchId, 'pick');
        else if (src?.type === 'group') myChamp = resolveSlot(`${src.pos}${src.group}`, 'pick');
        if (!myChamp) myChamp = myPick === 'home' ? finalFixture.home : finalFixture.away;
      }
      const actualWin = getActualWinner('final');
      if (actualWin) {
        const src = actualWin === 'home' ? finalFixture.homeSource : finalFixture.awaySource;
        if (src?.type === 'winner') actualChamp = resolveSlot(src.matchId, 'actual');
        else if (src?.type === 'group') actualChamp = resolveSlot(`${src.pos}${src.group}`, 'actual');
        if (!actualChamp) actualChamp = actualWin === 'home' ? finalFixture.home : finalFixture.away;
      }
    }

    const champRound = document.createElement('div');
    champRound.className = 'bracket-round bracket-round--champion';
    const champLabel = document.createElement('div');
    champLabel.className = 'bracket-round-label';
    champLabel.textContent = 'Champion';
    champRound.appendChild(champLabel);

    const champCard = document.createElement('div');
    champCard.className = 'bracket-champion';

    if (bracketView === 'overlay') {
      const myName  = myChamp     ? teamName(myChamp)     : null;
      const myFlag  = myChamp     ? teamFlag(myChamp)     : '';
      const actName = actualChamp ? teamName(actualChamp) : null;
      const actFlag = actualChamp ? teamFlag(actualChamp) : '';
      const isCorrect = myName && actName && myName === actName;
      champCard.innerHTML = `
        <div class="bracket-champion-trophy">&#x1F3C6;</div>
        <div class="champion-overlay-grid">
          <div class="champion-col champion-col--pred">
            <div class="champion-col-label">Your Pick</div>
            ${myChamp ? `<div class="champion-flag">${myFlag}</div><div class="champion-name">${myName}</div>` : '<div class="champion-tbd">Make picks &#x2192;</div>'}
          </div>
          ${actualChamp ? `
          <div class="champion-col champion-col--actual">
            <div class="champion-col-label">Champion &#x1F947;</div>
            <div class="champion-flag">${actFlag}</div>
            <div class="champion-name champion-name--actual">${actName}</div>
            ${isCorrect ? '<div class="champion-correct-badge">&#x1F389; Correct!</div>' : ''}
          </div>` : ''}
        </div>`;
    } else if (bracketView === 'actual') {
      champCard.innerHTML = actualChamp
        ? `<div class="bracket-champion-trophy">&#x1F3C6;</div>
           <div class="bracket-champion-flag">${teamFlag(actualChamp)}</div>
           <div class="bracket-champion-name">${teamName(actualChamp)}</div>`
        : `<div class="bracket-champion-trophy" style="opacity:0.3">&#x1F3C6;</div>
           <div class="bracket-champion-empty">To be determined</div>`;
    } else {
      champCard.innerHTML = myChamp
        ? `<div class="bracket-champion-trophy">&#x1F3C6;</div>
           <div class="bracket-champion-flag">${teamFlag(myChamp)}</div>
           <div class="bracket-champion-name">${teamName(myChamp)}</div>`
        : `<div class="bracket-champion-trophy" style="opacity:0.3">&#x1F3C6;</div>
           <div class="bracket-champion-empty">Pick a champion</div>`;
    }

    champRound.appendChild(champCard);
    bracketEl.appendChild(champRound);

    container.querySelector('#bracket-reset-all-btn')?.addEventListener('click', () => {
      if (confirm('Reset all bracket picks?')) {
        bracketPicks = {}; persistBracketPicks(); renderKnockoutBracket();
      }
    });

    container.querySelector('#bracket-seed-btn')?.addEventListener('click', () => {
      const r32ids = ['r32-1','r32-2','r32-3','r32-4','r32-5','r32-6','r32-7','r32-8',
                      'r32-9','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'];
      r32ids.forEach(id => {
        if (bracketPicks[id]) return;
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === id);
        if (!fixture) return;
        const { homeTeam, awayTeam } = resolveFixtureTeams(fixture, 'pick');
        if (homeTeam && !homeTeam.name?.match(/^[12][A-L]$/) && !homeTeam.name?.startsWith('W ')) {
          bracketPicks[id] = 'home';
        } else if (awayTeam && !awayTeam.name?.match(/^[12][A-L]$/) && !awayTeam.name?.startsWith('W ')) {
          bracketPicks[id] = 'away';
        } else {
          bracketPicks[id] = 'home';
        }
      });
      persistBracketPicks(); renderKnockoutBracket();
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
