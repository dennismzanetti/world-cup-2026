// World Cup 2026 App — Firebase-connected
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions } from './db.js';

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentUser = null;
  let authResolved = false;
  let firstAuthFire = true;
  let userPredictions = {};
  let authMode = 'signin';
  let unsubscribeMatches = null;
  let activePredSubtab = 'my-picks';

  // ─── Theme ───────────────────────────────────────────────────────────────────
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const html = document.documentElement;
  function setTheme(t) {
    html.setAttribute('data-theme', t);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' mode');
      themeToggle.innerHTML = t === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }
  let currentTheme = 'dark';
  setTheme(currentTheme);
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(currentTheme);
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const navBtns = document.querySelectorAll('.nav-btn');
  const views   = document.querySelectorAll('.view');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      renderAll();
    });
  });

  // ─── Predictions Sub-Tabs ─────────────────────────────────────────────────────
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activePredSubtab = tab.dataset.subtab;
      document.querySelectorAll('.sub-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.sub-tab-panel').forEach(p => {
        const isActive = p.id === 'subtab-' + activePredSubtab;
        p.classList.toggle('active', isActive);
        p.hidden = !isActive;
      });
      renderAll();
    });
  });

  // ─── Auth Modal ──────────────────────────────────────────────────────────────
  const authModal     = document.getElementById('auth-modal');
  const authBackdrop  = document.getElementById('auth-backdrop');
  const authForm      = document.getElementById('auth-form');
  const authTitle     = document.getElementById('auth-title');
  const authSub       = document.getElementById('auth-sub');
  const authSubmit    = document.getElementById('auth-submit');
  const authSwitch    = document.getElementById('auth-switch');
  const authClose     = document.getElementById('auth-close');
  const authError     = document.getElementById('auth-error');
  const authNameWrap  = document.getElementById('auth-name');
  const authNameInput = document.getElementById('auth-name-input');
  const authNameLabel = document.getElementById('name-label');
  const authBtn       = document.getElementById('auth-btn');
  const userBar       = document.getElementById('user-bar');
  const userGreeting  = document.getElementById('user-greeting');
  const signOutBtn    = document.getElementById('sign-out-btn');
  const predictSignin = document.getElementById('predict-signin-btn');
  const predictPrompt = document.getElementById('predictions-auth-prompt');
  const predStandingsAuthPrompt = document.getElementById('pred-standings-auth-prompt');

  function openAuthModal() {
    authModal.hidden = false;
    authBackdrop.hidden = false;
    authError.textContent = '';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    if (authNameInput) authNameInput.value = '';
  }
  function closeAuthModal() {
    authModal.hidden = true;
    authBackdrop.hidden = true;
  }
  function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === 'signup';
    authTitle.textContent  = isSignup ? 'Create Account' : 'Sign In';
    authSub.textContent    = isSignup ? 'Sign up to save and track your predictions.' : 'Sign in to save your predictions.';
    authSubmit.textContent = isSignup ? 'Sign Up' : 'Sign In';
    authSwitch.textContent = isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up";
    if (authNameWrap)  authNameWrap.style.display  = isSignup ? 'block' : 'none';
    if (authNameLabel) authNameLabel.style.display = isSignup ? 'block' : 'none';
    authError.textContent = '';
  }

  if (authBtn)       authBtn.addEventListener('click', () => { setAuthMode('signin'); openAuthModal(); });
  if (predictSignin) predictSignin.addEventListener('click', () => { setAuthMode('signin'); openAuthModal(); });
  if (authClose)     authClose.addEventListener('click', closeAuthModal);
  if (authBackdrop)  authBackdrop.addEventListener('click', closeAuthModal);
  if (authSwitch)    authSwitch.addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  if (signOutBtn)    signOutBtn.addEventListener('click', () => logOut());

  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn => {
    btn.addEventListener('click', () => { setAuthMode('signin'); openAuthModal(); });
  });

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.textContent = '';
      const email    = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const name     = authNameInput ? authNameInput.value.trim() : '';
      authSubmit.disabled = true;
      authSubmit.textContent = authMode === 'signup' ? 'Creating...' : 'Signing in...';
      try {
        authMode === 'signup' ? await signUp(email, password, name) : await signIn(email, password);
        closeAuthModal();
      } catch (err) {
        console.error('[Auth error]', err.code, err.message);
        authError.textContent = friendlyAuthError(err.code);
      } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = authMode === 'signup' ? 'Sign Up' : 'Sign In';
      }
    });
  }

  function friendlyAuthError(code) {
    const map = {
      'auth/user-not-found':         'No account found with that email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/email-already-in-use':   'An account already exists for that email.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
      'auth/invalid-credential':     'Invalid email or password.',
      'auth/operation-not-allowed':  'Email sign-in is not enabled. Contact the app admin.',
      'auth/network-request-failed': 'Network error — check your connection and try again.',
      'auth/missing-password':       'Please enter a password.',
      'auth/missing-email':          'Please enter your email address.',
      'auth/popup-blocked':          'A popup was blocked by your browser.',
      'auth/user-disabled':          'This account has been disabled.',
      'auth/requires-recent-login':  'Please sign out and sign in again to continue.',
    };
    return map[code] || `Something went wrong (${code || 'unknown'}). Please try again.`;
  }

  // ─── Auth State Observer ─────────────────────────────────────────────────────
  watchAuth(async (user) => {
    if (firstAuthFire && user === null) {
      firstAuthFire = false;
      return;
    }
    firstAuthFire = false;
    currentUser = user;
    authResolved = true;
    if (user) {
      if (authBtn)      authBtn.hidden = true;
      if (userBar)      userBar.hidden = false;
      if (userGreeting) userGreeting.textContent = 'Hi, ' + (user.displayName || user.email);
      try {
        const preds = await getUserPredictions(user.uid);
        userPredictions = {};
        preds.forEach(p => { userPredictions[p.matchId] = p; });
      } catch (err) {
        console.warn('Could not load predictions:', err);
      }
    } else {
      if (authBtn)  { authBtn.hidden = false; authBtn.textContent = 'Sign In'; }
      if (userBar)  userBar.hidden = true;
      userPredictions = {};
    }
    renderAll();
  });

  // ─── Live Firestore Match Listener ───────────────────────────────────────────
  function startMatchListener() {
    if (unsubscribeMatches) unsubscribeMatches();
    unsubscribeMatches = watchMatches((liveMatches) => {
      liveMatches.forEach(fm => {
        const local = WC_MATCHES.find(
          m => m.home.name === fm.homeTeam && m.away.name === fm.awayTeam
        );
        if (local) {
          if (fm.homeScore !== undefined && fm.homeScore !== null) local.homeScore = fm.homeScore;
          if (fm.awayScore !== undefined && fm.awayScore !== null) local.awayScore = fm.awayScore;
          if (fm.status)    local.status    = fm.status;
          if (fm.minute)    local.minute    = fm.minute;
          if (fm.date)      local.date      = fm.date;
          if (fm.timeLocal) local.timeLocal = fm.timeLocal;
          if (fm.timezone)  local.tz        = fm.timezone.replace('America/', '').split('/')[0];
        }
      });
      renderAll();
    });
  }
  startMatchListener();

  // ─── Points Helpers ───────────────────────────────────────────────────────────
  function calcActualPoints(matches, teamName) {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      const isHome = m.home.name === teamName;
      const isAway = m.away.name === teamName;
      if (!isHome && !isAway) return;
      const hs = m.homeScore, as_ = m.awayScore;
      if (hs === null || hs === undefined || as_ === null || as_ === undefined) return;
      const tg  = isHome ? hs  : as_;
      const og  = isHome ? as_ : hs;
      gf += tg; ga += og;
      if (tg > og) w++;
      else if (tg === og) d++;
      else l++;
    });
    return { w, d, l, gf, ga, gd: gf - ga, pts: w * 3 + d };
  }

  function calcPredictionPoints(matches, teamName) {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred) return;
      const isHome = m.home.name === teamName;
      const isAway = m.away.name === teamName;
      if (!isHome && !isAway) return;
      const hs = pred.homeScorePred, as_ = pred.awayScorePred;
      if (hs === undefined || as_ === undefined) return;
      const tg = isHome ? hs : as_;
      const og = isHome ? as_ : hs;
      gf += tg; ga += og;
      if (tg > og) w++;
      else if (tg === og) d++;
      else l++;
    });
    return { w, d, l, gf, ga, gd: gf - ga, pts: w * 3 + d };
  }

  // ─── Predicted Group Standings ────────────────────────────────────────────────
  // Returns predicted standings for a group; callers that need a stable order
  // get a stable array they can index by position (0 = 1st, 1 = 2nd, …).
  function getPredictedGroupStandings(groupId) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return [];
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    return group.teams
      .map(t => ({ ...t, ...calcPredictionPoints(groupMatches, t.name) }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }

  // ─── Resolve Knockout Team ────────────────────────────────────────────────────
  // Given a homeSource / awaySource descriptor from WC_KNOCKOUT_FIXTURES,
  // returns { name, flag } for display — or null if not yet resolvable.
  // Does NOT mutate any match objects.
  function resolveKnockoutTeam(source, fallbackTeam) {
    if (!source) return null;

    if (source.type === 'group') {
      const standings = getPredictedGroupStandings(source.group);
      const groupMatches = WC_MATCHES.filter(m => m.group === source.group);
      const hasPreds = groupMatches.some(m => userPredictions[m.id]);
      if (!hasPreds) return null; // no predictions yet — keep placeholder
      const team = standings[source.pos - 1];
      return team ? { name: team.name, flag: team.flag } : null;
    }

    if (source.type === 'winner' || source.type === 'loser') {
      // Reserved for Step 5 — winnerPred not yet stored
      return null;
    }

    if (source.type === 'best3rd') {
      // Best 3rd-place teams TBD until group stage completes
      return null;
    }

    return null;
  }

  // ─── Build Display Match ──────────────────────────────────────────────────────
  // For knockout matches in the Predictions tab, replace home/away with resolved
  // team names based on predicted standings.  Falls back to the original team
  // object (placeholder name) if no predictions exist yet.
  // The original match object is never mutated.
  function buildDisplayMatch(match) {
    if (!match.stage) return match; // group stage — no resolution needed
    const resolvedHome = resolveKnockoutTeam(match.homeSource, match.home);
    const resolvedAway = resolveKnockoutTeam(match.awaySource, match.away);
    if (!resolvedHome && !resolvedAway) return match;
    return {
      ...match,
      home: resolvedHome || match.home,
      away: resolvedAway || match.away,
    };
  }

  // ─── Broadcast Badges ────────────────────────────────────────────────────────
  function broadcastBadgesHTML(match) {
    const tv  = match.tvEnglish || [];
    const esp = match.tvSpanish || [];
    const str = match.streaming || [];
    if (!tv.length && !esp.length && !str.length) return '';
    return [
      ...tv.map(s  => `<span class="bc-badge bc-tv">${s}</span>`),
      ...esp.map(s => `<span class="bc-badge bc-esp">${s}</span>`),
      ...str.map(s => `<span class="bc-badge bc-stream">${s}</span>`),
    ].join('');
  }

  // ─── Match Card HTML (shared) ─────────────────────────────────────────────────
  function matchCardHTML(match, scoreColHTML, stripLabel) {
    const dateStr = match.date
      ? new Date(match.date + 'T12:00:00').toLocaleDateString('en-US',
          { weekday: 'short', month: 'short', day: 'numeric' })
      : null;
    const time  = match.timeLocal ? `${match.timeLocal} ${match.tz || 'ET'}` : null;
    const venue = match.venue || null;
    const city  = match.city  || null;

    const header = `
      <div class="card-header">
        <span class="card-header-group">${stripLabel || 'Match'}</span>
        <span class="card-header-matchup">
          <span class="card-header-home">${match.home.name}</span>
          <span class="card-header-vs">vs</span>
          <span class="card-header-away">${match.away.name}</span>
        </span>
      </div>`;

    const teamsRow = `
      <div class="card-teams">
        <div class="card-team home-team">
          <span class="team-flag">${match.home.flag}</span>
        </div>
        <div class="card-score-col">${scoreColHTML}</div>
        <div class="card-team away-team">
          <span class="team-flag">${match.away.flag}</span>
        </div>
      </div>`;

    const metaItems = [];
    if (dateStr || time) {
      metaItems.push(`<span class="card-meta-item">
        <svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6h12M5 1v3M11 1v3"/>
        </svg>
        ${[dateStr, time].filter(Boolean).join(' &middot; ')}
      </span>`);
    }
    if (venue || city) {
      metaItems.push(`<span class="card-meta-item">
        <svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6C12.5 3.51 10.49 1.5 8 1.5z"/>
          <circle cx="8" cy="6" r="1.5"/>
        </svg>
        ${[venue, city].filter(Boolean).join(', ')}
      </span>`);
    }
    const metaRow = metaItems.length
      ? `<div class="card-meta">${metaItems.join('')}</div>`
      : '';

    const badges = broadcastBadgesHTML(match);
    const broadcastRow = badges ? `<div class="card-broadcast-row">${badges}</div>` : '';

    return header + teamsRow + metaRow + broadcastRow;
  }

  // ─── Build match card (Matches view) ─────────────────────────────────────────
  function buildMatchCard(match) {
    const status = (match.status || 'scheduled').toLowerCase();
    const isLive     = status === 'live' || status === 'ht';
    const isFinished = status === 'finished';
    const hasScore   = match.homeScore !== null && match.homeScore !== undefined
                    && match.awayScore !== null && match.awayScore !== undefined;

    let scoreColHTML;
    if (isLive || isFinished) {
      const scoreDisplay = hasScore
        ? `<div class="score-final ${isLive ? 'score-live' : ''}">${match.homeScore} : ${match.awayScore}</div>`
        : `<div class="score-final score-pending">- : -</div>`;
      scoreColHTML = scoreDisplay + statusBadgeHTML(match);
    } else {
      const kickoff = match.timeLocal
        ? `<div class="score-kickoff">${match.timeLocal} ${match.tz || 'ET'}</div>`
        : `<div class="score-kickoff score-pending">TBD</div>`;
      scoreColHTML = kickoff;
    }

    const stripLabel = match.group ? 'Group ' + match.group : (match.stage || 'Match');
    const card = document.createElement('div');
    card.className = 'match-card' + (isLive ? ' match-card-live' : '');
    card.innerHTML = matchCardHTML(match, scoreColHTML, stripLabel);
    return card;
  }

  // ─── Render Groups ────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-card-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-team">Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''} ${i === 2 ? 'borderline' : ''}">
                <td class="col-rank">${i + 1}</td>
                <td class="col-team"><span class="team-flag">${t.flag}</span>${t.name}</td>
                <td>${t.w + t.d + t.l}</td>
                <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.ga}</td>
                <td class="${t.gd > 0 ? 'gd-pos' : t.gd < 0 ? 'gd-neg' : ''}">${t.gd > 0 ? '+' : ''}${t.gd}</td>
                <td class="col-pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Status Badge ─────────────────────────────────────────────────────────────
  function statusBadgeHTML(match) {
    const status = (match.status || 'scheduled').toLowerCase();
    if (status === 'live')     return `<div class="status-badge status-live">LIVE${match.minute ? ' ' + match.minute + "'" : ''}</div>`;
    if (status === 'ht')       return `<div class="status-badge status-live">HT</div>`;
    if (status === 'finished') return `<div class="status-badge status-finished">FT</div>`;
    return '';
  }

  // ─── Shared Filter Utilities ──────────────────────────────────────────────────

  // Canonical stage labels — single source of truth for both Matches and Predictions
  const STAGE_LABELS = {
    R32: 'Round of 32', R16: 'Round of 16',
    QF:  'Quarterfinal', SF: 'Semifinal',
    '3P': 'Third Place', F: 'Final'
  };
  const KNOCKOUT_STAGES = ['R32', 'R16', 'QF', 'SF', '3P', 'F'];

  /** Populate a <select> with date options derived from WC_MATCHES.
   *  Skips population if the element already has more than 1 option. */
  function populateDateSelect(el) {
    if (!el || el.options.length > 1) return;
    const allDates = [...new Set(WC_MATCHES.map(m => m.date).filter(Boolean))].sort();
    allDates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = new Date(d + 'T12:00:00').toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric' });
      el.appendChild(opt);
    });
  }

  /** Populate a <select> with Group + Knockout stage options. */
  function populateStageSelect(el) {
    if (!el || el.options.length > 1) return;
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = 'Group ' + g.id;
      el.appendChild(opt);
    });
    const sep = document.createElement('option');
    sep.disabled = true; sep.textContent = '── Knockout ──';
    el.appendChild(sep);
    KNOCKOUT_STAGES.forEach(stage => {
      const opt = document.createElement('option');
      opt.value = stage;
      opt.textContent = STAGE_LABELS[stage] || stage;
      el.appendChild(opt);
    });
  }

  /** Populate a <select> with venue options derived from WC_MATCHES. */
  function populateVenueSelect(el) {
    if (!el || el.options.length > 1) return;
    const allVenues = [...new Set(WC_MATCHES.map(m => m.venue).filter(Boolean))].sort();
    allVenues.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.appendChild(opt);
    });
  }

  /** Apply group/stage + venue + date filters to a match array. */
  function applyMatchFilters(matches, { group = 'all', venue = 'all', date = 'all' } = {}) {
    let filtered = matches.slice();
    if (group !== 'all') {
      const isGroup = WC_GROUPS.some(g => g.id === group);
      filtered = isGroup
        ? filtered.filter(m => m.group === group)
        : filtered.filter(m => m.stage === group);
    }
    if (venue !== 'all') filtered = filtered.filter(m => m.venue === venue);
    if (date  !== 'all') filtered = filtered.filter(m => m.date  === date);
    return filtered;
  }

  // ─── Render Matches ───────────────────────────────────────────────────────────
  function renderMatches(groupFilter = 'all', venueFilter = 'all', dateFilter = 'all') {
    const container = document.getElementById('matches-list');
    if (!container) return;
    container.innerHTML = '';

    populateDateSelect(document.getElementById('date-filter'));
    populateStageSelect(document.getElementById('group-filter'));
    populateVenueSelect(document.getElementById('venue-filter'));

    const filtered = applyMatchFilters(WC_MATCHES, { group: groupFilter, venue: venueFilter, date: dateFilter });

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches found for the selected filters.</div>';
      return;
    }

    filtered.forEach(match => {
      const card = buildMatchCard(match);

      // Admin score inputs (only for finished/live)
      const status = (match.status || 'scheduled').toLowerCase();
      if (status === 'finished' || status === 'live' || status === 'ht') {
        const scoreInputRow = document.createElement('div');
        scoreInputRow.className = 'admin-score-row';
        scoreInputRow.innerHTML = `
          <input type="number" min="0" max="99" class="admin-score-input" data-match-id="${match.id}" data-side="home"
            value="${match.homeScore ?? ''}" placeholder="H" aria-label="${match.home.name} score">
          <span class="score-sep">:</span>
          <input type="number" min="0" max="99" class="admin-score-input" data-match-id="${match.id}" data-side="away"
            value="${match.awayScore ?? ''}" placeholder="A" aria-label="${match.away.name} score">
          <button class="btn btn-sm btn-ghost save-score-btn" data-match-id="${match.id}">Save</button>`;
        card.appendChild(scoreInputRow);

        const saveBtn = scoreInputRow.querySelector('.save-score-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            const homeInput = scoreInputRow.querySelector('.admin-score-input[data-side="home"]');
            const awayInput = scoreInputRow.querySelector('.admin-score-input[data-side="away"]');
            const homeScore = homeInput ? parseInt(homeInput.value, 10) : NaN;
            const awayScore = awayInput ? parseInt(awayInput.value, 10) : NaN;
            if (isNaN(homeScore) || isNaN(awayScore)) { console.warn('Invalid score input'); return; }
            saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
            try {
              const { saveMatchResult } = await import('./db.js');
              await saveMatchResult(match.id, {
                homeTeam: match.home.name,
                awayTeam: match.away.name,
                homeScore, awayScore, status: 'finished'
              });
              saveBtn.textContent = 'Saved!';
            } catch (err) {
              console.error('Save error:', err);
              saveBtn.textContent = 'Error';
            } finally {
              setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
            }
          });
        }
      }
      container.appendChild(card);
    });
  }

  // ─── Render Predictions ───────────────────────────────────────────────────────
  function populatePredFilters() {
    populateDateSelect(document.getElementById('pred-date-filter'));
    populateStageSelect(document.getElementById('pred-group-filter'));
  }

  function getPredFilters() {
    const predDateEl  = document.getElementById('pred-date-filter');
    const predGroupEl = document.getElementById('pred-group-filter');
    const predTeamEl  = document.getElementById('pred-team-filter');
    return {
      date:  predDateEl  ? predDateEl.value  : 'all',
      group: predGroupEl ? predGroupEl.value : 'all',
      team:  predTeamEl  ? predTeamEl.value.trim().toLowerCase() : '',
    };
  }

  function onPredFilterChange() { renderPredictions(); }

  const predDateFilterEl  = document.getElementById('pred-date-filter');
  const predGroupFilterEl = document.getElementById('pred-group-filter');
  const predTeamFilterEl  = document.getElementById('pred-team-filter');
  if (predDateFilterEl)  predDateFilterEl.addEventListener('change', onPredFilterChange);
  if (predGroupFilterEl) predGroupFilterEl.addEventListener('change', onPredFilterChange);
  if (predTeamFilterEl)  predTeamFilterEl.addEventListener('input',  onPredFilterChange);

  function renderPredictions() {
    const container   = document.getElementById('predictions-list');
    const filtersDiv  = document.getElementById('pred-filters');
    const authPrompt  = document.getElementById('predictions-auth-prompt');
    if (!container) return;

    // Always show filters; auth prompt is shown separately below
    if (filtersDiv) filtersDiv.hidden = false;
    populatePredFilters();

    if (!authResolved || !currentUser) {
      if (authPrompt)  authPrompt.hidden  = false;
      container.innerHTML = '';
      return;
    }
    if (authPrompt)  authPrompt.hidden  = true;

    const { date, group, team } = getPredFilters();
    let filtered = applyMatchFilters(WC_MATCHES, { group, date });

    // Apply display-match resolution (team name substitution) before team text filter
    // so filtering by e.g. "Mexico" also matches resolved knockout slots.
    const displayMatches = filtered.map(buildDisplayMatch);

    if (team) {
      filtered = filtered.filter((m, i) => {
        const dm = displayMatches[i];
        return dm.home.name.toLowerCase().includes(team) ||
               dm.away.name.toLowerCase().includes(team);
      });
    }

    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches found for the selected filters.</div>';
      return;
    }

    filtered.forEach((match, idx) => {
      // Use resolved display version for rendering; keep original match for save logic
      const dm = team
        ? buildDisplayMatch(match)  // re-resolve if filtered (filtered array is subset)
        : displayMatches[filtered.indexOf(match)] || buildDisplayMatch(match);

      const status = (match.status || 'scheduled').toLowerCase();
      const isLive     = status === 'live' || status === 'ht';
      const isFinished = status === 'finished';
      const pred = userPredictions[match.id];
      const hasPred = pred && pred.homeScorePred !== undefined && pred.awayScorePred !== undefined;

      const scoreColHTML = `
        <div class="score-inputs-wrap">
          <input type="number" min="0" max="99" class="pred-input" data-match-id="${match.id}" data-side="home"
            value="${hasPred ? pred.homeScorePred : ''}" placeholder="-" aria-label="${dm.home.name} predicted score"
            ${isFinished ? 'disabled title="Match has finished"' : ''}>
          <span class="score-sep">:</span>
          <input type="number" min="0" max="99" class="pred-input" data-match-id="${match.id}" data-side="away"
            value="${hasPred ? pred.awayScorePred : ''}" placeholder="-" aria-label="${dm.away.name} predicted score"
            ${isFinished ? 'disabled title="Match has finished"' : ''}>
        </div>
        ${isFinished
          ? `<div class="pred-result-badge ${hasPred ? 'pred-saved' : 'pred-missed'}">` +
            `${hasPred ? '&#x2713; Picked' : '&#x2715; No pick'}</div>`
          : `<button class="btn btn-sm btn-ghost save-pred-btn" data-match-id="${match.id}">Save</button>`
        }`;

      const stripLabel = match.group ? 'Group ' + match.group : (match.stage || 'Match');
      const card = document.createElement('div');
      card.className = 'match-card' + (isLive ? ' match-card-live' : '');
      card.innerHTML = matchCardHTML(dm, scoreColHTML, stripLabel);

      if (!isFinished) {
        const saveBtn = card.querySelector('.save-pred-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            const homeInput = card.querySelector('.pred-input[data-side="home"]');
            const awayInput = card.querySelector('.pred-input[data-side="away"]');
            const homeScorePred = homeInput ? parseInt(homeInput.value, 10) : NaN;
            const awayScorePred = awayInput ? parseInt(awayInput.value, 10) : NaN;
            if (isNaN(homeScorePred) || isNaN(awayScorePred)) {
              console.warn('Invalid prediction input'); return;
            }
            saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
            try {
              await savePrediction(currentUser.uid, match.id, {
                homeTeam: match.home.name, awayTeam: match.away.name,
                homeScorePred, awayScorePred
              });
              userPredictions[match.id] = { matchId: match.id, homeScorePred, awayScorePred };
              saveBtn.textContent = 'Saved!';
              renderPredictionStandings();
              renderKnockoutBracket();
            } catch (err) {
              console.error('Save pred error:', err);
              saveBtn.textContent = 'Error';
            } finally {
              setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
            }
          });
        }
      }
      container.appendChild(card);
    });
  }

  // ─── Render Prediction Standings ─────────────────────────────────────────────
  function renderPredictionStandings() {
    const container  = document.getElementById('pred-standings-grid');
    const authPrompt = document.getElementById('pred-standings-auth-prompt');
    if (!container) return;

    if (!authResolved || !currentUser) {
      if (authPrompt) authPrompt.hidden = false;
      container.innerHTML = '';
      return;
    }
    if (authPrompt) authPrompt.hidden = true;

    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const hasPreds = groupMatches.some(m => userPredictions[m.id]);

      const teams = group.teams
        .map(t => ({ ...t, ...calcPredictionPoints(groupMatches, t.name) }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'group-card' + (hasPreds ? '' : ' group-card-empty');
      card.innerHTML = `
        <div class="group-card-header">Group ${group.id}</div>
        ${hasPreds ? `
        <table class="standings-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-team">Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''} ${i === 2 ? 'borderline' : ''}">
                <td class="col-rank">${i + 1}</td>
                <td class="col-team"><span class="team-flag">${t.flag}</span>${t.name}</td>
                <td>${t.w + t.d + t.l}</td>
                <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.ga}</td>
                <td class="${t.gd > 0 ? 'gd-pos' : t.gd < 0 ? 'gd-neg' : ''}">${t.gd > 0 ? '+' : ''}${t.gd}</td>
                <td class="col-pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : `
        <div class="empty-filter-msg">No predictions yet for this group.</div>`}`;
      container.appendChild(card);
    });
  }

  // ─── Render Knockout Bracket ──────────────────────────────────────────────────
  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      return;
    }

    const stages = [
      { key: 'R32', label: 'Round of 32' },
      { key: 'R16', label: 'Round of 16' },
      { key: 'QF',  label: 'Quarterfinals' },
      { key: 'SF',  label: 'Semifinals' },
      { key: 'F',   label: 'Final' },
    ];

    container.innerHTML = '';
    stages.forEach(({ key, label }) => {
      const stageMatches = WC_MATCHES.filter(m => m.stage === key);
      if (!stageMatches.length) return;

      const section = document.createElement('div');
      section.className = 'bracket-stage';
      section.innerHTML = `<h3 class="bracket-stage-title">${label}</h3>`;

      stageMatches.forEach(match => {
        const dm = buildDisplayMatch(match);
        const pred = userPredictions[match.id];
        const hasPred = pred && pred.homeScorePred !== undefined && pred.awayScorePred !== undefined;

        const card = document.createElement('div');
        card.className = 'bracket-match-card';
        card.innerHTML = `
          <div class="bracket-team">
            <span class="team-flag">${dm.home.flag}</span>
            <span class="bracket-team-name">${dm.home.name}</span>
            ${hasPred ? `<span class="bracket-score">${pred.homeScorePred}</span>` : ''}
          </div>
          <div class="bracket-team">
            <span class="team-flag">${dm.away.flag}</span>
            <span class="bracket-team-name">${dm.away.name}</span>
            ${hasPred ? `<span class="bracket-score">${pred.awayScorePred}</span>` : ''}
          </div>
          ${!hasPred ? '<div class="bracket-no-pred">No prediction yet</div>' : ''}`;
        section.appendChild(card);
      });

      container.appendChild(section);
    });

    if (!container.children.length) {
      container.innerHTML = `
        <div class="empty-filter-msg">
          No knockout matches scheduled yet.<br>
          <span style="font-size:var(--text-xs);opacity:0.7">Bracket populates after the group stage.</span>
        </div>`;
    }
  }

  // ─── Render Standings ─────────────────────────────────────────────────────────
  function renderStandings() {
    const container = document.getElementById('standings-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-card-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-team">Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''} ${i === 2 ? 'borderline' : ''}">
                <td class="col-rank">${i + 1}</td>
                <td class="col-team"><span class="team-flag">${t.flag}</span>${t.name}</td>
                <td>${t.w + t.d + t.l}</td>
                <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.ga}</td>
                <td class="${t.gd > 0 ? 'gd-pos' : t.gd < 0 ? 'gd-neg' : ''}">${t.gd > 0 ? '+' : ''}${t.gd}</td>
                <td class="col-pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── renderAll ────────────────────────────────────────────────────────────────
  function renderAll() {
    const activeView = document.querySelector('.nav-btn.active')?.dataset.view;
    const f = getFilters();
    if (activeView === 'groups')      renderGroups();
    if (activeView === 'matches')     renderMatches(f.group, f.venue, f.date);
    if (activeView === 'predictions') {
      if (activePredSubtab === 'my-picks')       renderPredictions();
      if (activePredSubtab === 'pred-standings') renderPredictionStandings();
      if (activePredSubtab === 'pred-bracket')   renderKnockoutBracket();
    }
    if (activeView === 'standings')   renderStandings();
  }

  // ─── Filters ─────────────────────────────────────────────────────────────────
  function getFilters() {
    const groupFilterEl = document.getElementById('group-filter');
    const venueFilterEl = document.getElementById('venue-filter');
    const dateFilterEl  = document.getElementById('date-filter');
    return {
      group: groupFilterEl ? groupFilterEl.value : 'all',
      venue: venueFilterEl ? venueFilterEl.value : 'all',
      date:  dateFilterEl  ? dateFilterEl.value  : 'all',
    };
  }

  const groupFilterEl = document.getElementById('group-filter');
  const venueFilterEl = document.getElementById('venue-filter');
  const dateFilterEl  = document.getElementById('date-filter');
  if (groupFilterEl) groupFilterEl.addEventListener('change', () => renderMatches(...Object.values(getFilters())));
  if (venueFilterEl) venueFilterEl.addEventListener('change', () => renderMatches(...Object.values(getFilters())));
  if (dateFilterEl)  dateFilterEl.addEventListener('change',  () => renderMatches(...Object.values(getFilters())));

  // ─── Initial Render ──────────────────────────────────────────────────────────
  renderGroups();

})();
