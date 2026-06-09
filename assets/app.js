// World Cup 2026 App — Firebase-connected
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions } from './db.js';

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentUser = null;
  let authResolved = false;
  let firstAuthFire = true;   // Firebase always fires null first on page load
  let userPredictions = {};
  let authMode = 'signin';
  let unsubscribeMatches = null;

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
  // Firebase always fires onAuthStateChanged twice on page load when a session
  // exists: first with user=null (before IndexedDB token is restored), then with
  // the real user. We skip the first null fire entirely so the sign-in prompt
  // never flashes for an already-authenticated user.
  //
  // Safe because:
  //  - If the user is truly signed out, the second fire also comes with null,
  //    so we still render the prompt correctly on that second fire.
  //  - If the user is signed in, the second fire comes with the real user object.
  //  - firstAuthFire is reset to false after the first call, so subsequent
  //    sign-in / sign-out events (which are single fires) are never skipped.
  watchAuth(async (user) => {
    // Skip the very first null fire — it's always a false negative on page load
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
          if (fm.venue)     local.venue     = fm.venue;
          if (fm.city)      local.city      = fm.city;
          if (fm.tvEnglish) local.tvEnglish = fm.tvEnglish;
          if (fm.tvSpanish) local.tvSpanish = fm.tvSpanish;
          if (fm.streaming) local.streaming = fm.streaming;
        }
      });
      populateDateFilter();
      populatePredDateFilter();
      renderAll();
    });
  }

  // ─── Shared sort helper ───────────────────────────────────────────────────────
  function sortByDateTime(a, b) {
    const ka = (a.date || '9999-99-99') + 'T' + (a.timeLocal || '99:99');
    const kb = (b.date || '9999-99-99') + 'T' + (b.timeLocal || '99:99');
    return ka.localeCompare(kb);
  }

  // ─── Date divider helper ─────────────────────────────────────────────────────
  function insertDateDividers(container, matches) {
    let lastDate = null;
    matches.forEach(match => {
      if (match.date && match.date !== lastDate) {
        lastDate = match.date;
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.textContent = new Date(match.date + 'T12:00:00').toLocaleDateString('en-US',
          { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        container.appendChild(divider);
      }
      const card = buildMatchCard(match);
      container.appendChild(card);
    });
  }

  // ─── Status badge helper ─────────────────────────────────────────────────────
  function statusBadgeHTML(match) {
    const s = (match.status || 'scheduled').toLowerCase();
    if (s === 'live') {
      const min = match.minute ? `${match.minute}'` : 'LIVE';
      return `<span class="status-badge status-live"><span class="live-dot"></span>${min}</span>`;
    }
    if (s === 'ht')       return `<span class="status-badge status-ht">HT</span>`;
    if (s === 'finished') return `<span class="status-badge status-ft">FT</span>`;
    return '';
  }

  // ─── Points Calculation ───────────────────────────────────────────────────────
  function calcPoints(matches, teamName) {
    let pts = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      if (m.homeScore === null || m.awayScore === null) return;
      const hs = parseInt(m.homeScore), as_ = parseInt(m.awayScore);
      if (m.home.name === teamName) {
        gf += hs; ga += as_;
        if (hs > as_) { pts += 3; w++; } else if (hs === as_) { pts += 1; d++; } else { l++; }
      } else if (m.away.name === teamName) {
        gf += as_; ga += hs;
        if (as_ > hs) { pts += 3; w++; } else if (as_ === hs) { pts += 1; d++; } else { l++; }
      }
    });
    return { pts, played: w + d + l, w, d, l, gf, ga, gd: gf - ga };
  }

  // ─── Broadcast Badges ─────────────────────────────────────────────────────────
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
      const teamsWithPts = group.teams
        .map(t => ({ ...t, ...calcPoints(groupMatches, t.name) }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-card-header">
          <span class="group-name">Group ${group.id}</span>
          <span class="group-count">${group.teams.length} teams</span>
        </div>
        <div class="group-teams">
          ${teamsWithPts.map(t => `
            <div class="group-team-row">
              <span class="team-flag">${t.flag}</span>
              <span class="team-name">${t.name}</span>
              <span class="team-pts" title="Points">${t.pts} pts</span>
            </div>`).join('')}
        </div>`;
      container.appendChild(card);
    });
  }

  // ─── Date Filter Population (Matches) ────────────────────────────────────────
  function populateDateFilter() {
    const el = document.getElementById('date-filter');
    if (!el) return;
    const dates = [...new Set(WC_MATCHES.map(m => m.date).filter(Boolean))].sort();
    while (el.options.length > 1) el.remove(1);
    dates.forEach(d => {
      const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric' });
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = label;
      el.appendChild(opt);
    });
  }

  // ─── Render Matches ───────────────────────────────────────────────────────────
  function renderMatches(groupFilter = 'all', venueFilter = 'all', dateFilter = 'all') {
    const container = document.getElementById('matches-list');
    if (!container) return;
    container.innerHTML = '';

    let filtered = WC_MATCHES.slice();
    if (groupFilter !== 'all') filtered = filtered.filter(m => m.group === groupFilter);
    if (venueFilter !== 'all') filtered = filtered.filter(m => m.venue === venueFilter);
    if (dateFilter  !== 'all') filtered = filtered.filter(m => m.date  === dateFilter);

    filtered.sort((a, b) => {
      const liveA = (a.status === 'live' || a.status === 'ht') ? 0 : 1;
      const liveB = (b.status === 'live' || b.status === 'ht') ? 0 : 1;
      if (liveA !== liveB) return liveA - liveB;
      return sortByDateTime(a, b);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-filter-msg">No matches found for the selected filters.</p>';
      return;
    }
    insertDateDividers(container, filtered);
  }

  // ─── Canonical match key ─────────────────────────────────────────────────────
  function matchKey(match) { return match.id; }

  // ─── Save with timeout ───────────────────────────────────────────────────────
  function withTimeout(promise, ms, label) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms — ${label}`)), ms)
    );
    return Promise.race([promise, timeout]);
  }

  // ─── Prediction Filters ───────────────────────────────────────────────────────
  // Declared early (before watchAuth/renderAll) to avoid the initialization-order
  // bug where const declarations after the auth observer were null at boot time.
  const predDateFilterEl  = document.getElementById('pred-date-filter');
  const predGroupFilterEl = document.getElementById('pred-group-filter');
  const predTeamFilterEl  = document.getElementById('pred-team-filter');
  const predFiltersBar    = document.getElementById('pred-filters');

  // Populate group + knockout stage options eagerly on boot
  if (predGroupFilterEl) {
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = 'Group ' + g.id;
      predGroupFilterEl.appendChild(opt);
    });
    ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Third Place', 'Final'].forEach(stage => {
      const opt = document.createElement('option');
      opt.value = stage;
      opt.textContent = stage;
      predGroupFilterEl.appendChild(opt);
    });
  }

  function populatePredDateFilter() {
    if (!predDateFilterEl) return;
    const currentValue = predDateFilterEl.value;
    const dates = [...new Set(WC_MATCHES.map(m => m.date).filter(Boolean))].sort();
    while (predDateFilterEl.options.length > 1) predDateFilterEl.remove(1);
    dates.forEach(d => {
      const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric' });
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = label;
      predDateFilterEl.appendChild(opt);
    });
    // Restore selection if it still exists after repopulation
    if ([...predDateFilterEl.options].some(o => o.value === currentValue)) {
      predDateFilterEl.value = currentValue;
    }
  }

  function getPredFilters() {
    return {
      group: predGroupFilterEl?.value || 'all',
      date:  predDateFilterEl?.value  || 'all',
      team:  predTeamFilterEl?.value?.trim().toLowerCase() || '',
    };
  }

  function getFilteredPredictionMatches() {
    const { group, date, team } = getPredFilters();
    return WC_MATCHES.slice()
      .sort(sortByDateTime)
      .filter(match => {
        const matchGroup = match.group || match.stage || '';
        if (group !== 'all' && matchGroup !== group) return false;
        if (date  !== 'all' && (match.date || '') !== date) return false;
        if (team) {
          const home = (match.home?.name || '').toLowerCase();
          const away = (match.away?.name || '').toLowerCase();
          if (!home.includes(team) && !away.includes(team)) return false;
        }
        return true;
      });
  }

  function onPredFilterChange() {
    renderPredictions();
  }

  if (predDateFilterEl)  predDateFilterEl.addEventListener('change', onPredFilterChange);
  if (predGroupFilterEl) predGroupFilterEl.addEventListener('change', onPredFilterChange);
  if (predTeamFilterEl)  predTeamFilterEl.addEventListener('input',  onPredFilterChange);

  // Populate date filter options on boot
  populatePredDateFilter();

  // ─── Render Predictions ───────────────────────────────────────────────────────
  // predictPrompt is only ever shown after authResolved=true AND currentUser=null.
  // The firstAuthFire guard in watchAuth ensures we never render with the false
  // null that Firebase emits before restoring a cached session.
  function renderPredictions() {
    const container = document.getElementById('predictions-list');
    if (!container) return;

    // Auth not yet resolved — keep everything hidden, wait for watchAuth
    if (!authResolved) {
      if (predictPrompt)  predictPrompt.hidden = true;
      if (predFiltersBar) predFiltersBar.hidden = true;
      container.innerHTML = '';
      return;
    }

    // Resolved: no user — show sign-in prompt, hide filters
    if (!currentUser) {
      if (predictPrompt)  predictPrompt.hidden = false;
      if (predFiltersBar) predFiltersBar.hidden = true;
      container.innerHTML = '';
      return;
    }

    // Signed in — hide prompt, show filters, render filtered prediction cards
    if (predictPrompt)  predictPrompt.hidden = true;
    if (predFiltersBar) predFiltersBar.hidden = false;

    const filtered = getFilteredPredictionMatches();
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-filter-msg">No matches found for the selected prediction filters.</p>';
      return;
    }

    let lastDate = null;
    filtered.forEach(match => {
      if (match.date && match.date !== lastDate) {
        lastDate = match.date;
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.textContent = new Date(match.date + 'T12:00:00').toLocaleDateString('en-US',
          { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        container.appendChild(divider);
      }

      const key    = matchKey(match);
      const pred   = userPredictions[key] || null;
      const status = (match.status || 'scheduled').toLowerCase();
      const isLive     = status === 'live' || status === 'ht';
      const isFinished = status === 'finished';
      const hasResult  = match.homeScore !== null && match.homeScore !== undefined
                      && match.awayScore !== null && match.awayScore !== undefined;

      let scoreColHTML;
      if (isFinished || (isLive && hasResult)) {
        scoreColHTML = `
          <div class="score-final ${isLive ? 'score-live' : ''}">${match.homeScore} : ${match.awayScore}</div>
          ${statusBadgeHTML(match)}
          ${pred ? `<div class="pred-was">Your pick: ${pred.homeScorePred}\u2013${pred.awayScorePred}</div>` : '<div class="pred-was">No prediction</div>'}`;
      } else if (isLive) {
        scoreColHTML = `
          <div class="score-final score-pending">- : -</div>
          ${statusBadgeHTML(match)}
          ${pred ? `<div class="pred-was">Your pick: ${pred.homeScorePred}\u2013${pred.awayScorePred}</div>` : ''}`;
      } else {
        scoreColHTML = `
          <div class="score-inputs-wrap">
            <input class="pred-input" type="number" min="0" max="20"
              value="${pred ? pred.homeScorePred : ''}" placeholder="?"
              data-pred="${key}" data-side="home">
            <span class="score-sep">:</span>
            <input class="pred-input" type="number" min="0" max="20"
              value="${pred ? pred.awayScorePred : ''}" placeholder="?"
              data-pred="${key}" data-side="away">
          </div>
          <button class="btn-save pred-btn" data-pred-save="${key}">Predict</button>
          <span class="pred-saving" id="pred-saving-${key}" hidden>Saving\u2026</span>
          <span class="pred-error" id="pred-error-${key}" hidden></span>`;
      }

      const stripLabel = match.group ? 'Group ' + match.group : (match.stage || 'Match');
      const card = document.createElement('div');
      card.className = 'match-card' + (isLive ? ' match-card-live' : '');
      card.innerHTML = matchCardHTML(match, scoreColHTML, stripLabel);
      container.appendChild(card);
    });

    container.querySelectorAll('[data-pred-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId  = btn.dataset.predSave;
        const hInput   = container.querySelector(`input[data-pred="${matchId}"][data-side="home"]`);
        const aInput   = container.querySelector(`input[data-pred="${matchId}"][data-side="away"]`);
        const saving   = document.getElementById('pred-saving-' + matchId);
        const errorEl  = document.getElementById('pred-error-' + matchId);

        if (!hInput || !aInput || hInput.value === '' || aInput.value === '') return;
        const homeScorePred = parseInt(hInput.value);
        const awayScorePred = parseInt(aInput.value);

        btn.disabled = true;
        btn.textContent = 'Saving\u2026';
        if (saving)  saving.hidden = true;
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

        try {
          await withTimeout(
            savePrediction(currentUser.uid, matchId, { homeScorePred, awayScorePred }),
            8000, `savePrediction(${matchId})`
          );
          userPredictions[matchId] = { matchId, homeScorePred, awayScorePred };
          btn.textContent = 'Saved \u2713';
          setTimeout(() => { btn.textContent = 'Predict'; btn.disabled = false; }, 1500);
        } catch (err) {
          console.error('[Predict] save failed', matchId, err);
          const msg = err.code === 'permission-denied'
            ? 'Permission denied — are you signed in?'
            : err.message || 'Save failed — retry';
          if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
          btn.textContent = 'Retry';
          btn.disabled = false;
        }
      });
    });
  }

  // ─── Render Standings ─────────────────────────────────────────────────────────
  function renderStandings() {
    const container = document.getElementById('standings-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches   = WC_MATCHES.filter(m => m.group === group.id);
      const teamsWithStats = group.teams
        .map(t => ({ ...t, ...calcPoints(groupMatches, t.name) }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead>
            <tr><th></th><th>Team</th>
              <th title="Played">P</th><th title="Won">W</th><th title="Drawn">D</th>
              <th title="Lost">L</th><th title="Goals For">GF</th>
              <th title="Goals Against">GA</th><th title="Goal Difference">GD</th>
              <th title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teamsWithStats.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''}">
                <td>${t.flag}</td><td>${t.name}</td>
                <td>${t.played}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.ga}</td>
                <td>${t.gd > 0 ? '+' + t.gd : t.gd}</td>
                <td class="pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Matches Filters ─────────────────────────────────────────────────────────
  const groupFilterEl = document.getElementById('group-filter');
  const venueFilterEl = document.getElementById('venue-filter');
  const dateFilterEl  = document.getElementById('date-filter');

  if (groupFilterEl) {
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = 'Group ' + g.id;
      groupFilterEl.appendChild(opt);
    });
  }
  if (venueFilterEl) {
    const venues = [...new Set(WC_MATCHES.map(m => m.venue).filter(Boolean))];
    venues.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      venueFilterEl.appendChild(opt);
    });
  }

  populateDateFilter();

  function getFilters() {
    return {
      group: groupFilterEl ? groupFilterEl.value : 'all',
      venue: venueFilterEl ? venueFilterEl.value : 'all',
      date:  dateFilterEl  ? dateFilterEl.value  : 'all',
    };
  }

  if (groupFilterEl) groupFilterEl.addEventListener('change', () => renderMatches(...Object.values(getFilters())));
  if (venueFilterEl) venueFilterEl.addEventListener('change', () => renderMatches(...Object.values(getFilters())));
  if (dateFilterEl)  dateFilterEl.addEventListener('change',  () => renderMatches(...Object.values(getFilters())));

  // ─── Render All ───────────────────────────────────────────────────────────────
  function renderAll() {
    const activeView = document.querySelector('.nav-btn.active')?.dataset.view;
    const f = getFilters();
    if (activeView === 'groups')      renderGroups();
    if (activeView === 'matches')     renderMatches(f.group, f.venue, f.date);
    if (activeView === 'predictions') renderPredictions();
    if (activeView === 'standings')   renderStandings();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  renderGroups();
  startMatchListener();

})();
