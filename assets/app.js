// World Cup 2026 App — Firebase-connected
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { getMatches, savePrediction, getUserPredictions } from './db.js';

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let currentUser = null;
  let userPredictions = {};
  let firestoreMatches = [];
  let authMode = 'signin';

  // ─── Theme ────────────────────────────────────────────────────────────────
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

  // ─── Navigation ───────────────────────────────────────────────────────────
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

  // ─── Auth Modal ───────────────────────────────────────────────────────────
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
      'auth/user-not-found':          'No account found with that email.',
      'auth/wrong-password':          'Incorrect password.',
      'auth/email-already-in-use':    'An account already exists for that email.',
      'auth/invalid-email':           'Please enter a valid email address.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/too-many-requests':       'Too many attempts. Please wait and try again.',
      'auth/invalid-credential':      'Invalid email or password.',
      'auth/operation-not-allowed':   'Email sign-in is not enabled. Contact the app admin.',
      'auth/network-request-failed':  'Network error — check your connection and try again.',
      'auth/missing-password':        'Please enter a password.',
      'auth/missing-email':           'Please enter your email address.',
      'auth/popup-blocked':           'A popup was blocked by your browser.',
      'auth/user-disabled':           'This account has been disabled.',
      'auth/requires-recent-login':   'Please sign out and sign in again to continue.',
    };
    return map[code] || `Something went wrong (${code || 'unknown'}). Please try again.`;
  }

  // ─── Auth State Observer ──────────────────────────────────────────────────
  watchAuth(async (user) => {
    currentUser = user;
    if (user) {
      if (authBtn)       authBtn.textContent = 'Account';
      if (userBar)       userBar.hidden = false;
      if (userGreeting)  userGreeting.textContent = 'Hi, ' + (user.displayName || user.email);
      if (predictPrompt) predictPrompt.hidden = true;
      try {
        const preds = await getUserPredictions(user.uid);
        userPredictions = {};
        preds.forEach(p => { userPredictions[p.matchId] = p; });
      } catch (err) {
        console.warn('Could not load predictions:', err);
      }
    } else {
      if (authBtn)       authBtn.textContent = 'Sign In';
      if (userBar)       userBar.hidden = true;
      if (predictPrompt) predictPrompt.hidden = false;
      userPredictions = {};
    }
    renderAll();
  });

  // ─── Load Matches from Firestore ──────────────────────────────────────────
  async function loadFirestoreMatches() {
    try {
      firestoreMatches = await getMatches();
      if (firestoreMatches.length > 0) {
        firestoreMatches.forEach(fm => {
          const local = WC_MATCHES.find(m => m.home.name === fm.homeTeam && m.away.name === fm.awayTeam);
          if (local) {
            if (fm.homeScore !== null) local.homeScore = fm.homeScore;
            if (fm.awayScore !== null) local.awayScore = fm.awayScore;
            if (fm.date)      local.date      = fm.date;
            if (fm.timeLocal) local.timeLocal = fm.timeLocal;
            if (fm.timezone)  local.tz        = fm.timezone.replace('America/', '').split('/')[0];
            if (fm.venue)     local.venue     = fm.venue;
            if (fm.city)      local.city      = fm.city;
            if (fm.tvEnglish) local.tvEnglish = fm.tvEnglish;
            if (fm.tvSpanish) local.tvSpanish = fm.tvSpanish;
            if (fm.streaming) local.streaming = fm.streaming;
            local.firestoreId = fm.id;
          }
        });
      }
    } catch (err) {
      console.warn('Firestore unavailable, using local data:', err);
    }
    renderAll();
  }

  // ─── Points Calculation ───────────────────────────────────────────────────
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

  // ─── Broadcast Badges ─────────────────────────────────────────────────────
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

  // ─── Match Card HTML ──────────────────────────────────────────────────────
  // Shared by both Matches and Predictions views.
  //
  // Card layout:
  //   Row 1 (.card-header):        Group/stage label  |  Home team name  vs  Away team name
  //   Row 2 (.card-teams):         home flag | score col | away flag
  //   Row 3 (.card-meta):          📅 date · time   📍 venue, city
  //   Row 4 (.card-broadcast-row): TV / streaming badges
  //
  // stripLabel  — e.g. 'Group A'  or  'Round of 16'
  // scoreColHTML — the action area in the centre (inputs, final score, etc.)
  function matchCardHTML(match, scoreColHTML, stripLabel) {
    const dateStr = match.date
      ? new Date(match.date + 'T12:00:00').toLocaleDateString('en-US',
          { weekday: 'short', month: 'short', day: 'numeric' })
      : null;
    const time  = match.timeLocal ? `${match.timeLocal}\u202f${match.tz || 'ET'}` : null;
    const venue = match.venue || null;
    const city  = match.city  || null;

    // Row 1: header — group/stage label on left, full team names on right
    const header = `
      <div class="card-header">
        <span class="card-header-group">${stripLabel || 'Match'}</span>
        <span class="card-header-matchup">
          <span class="card-header-home">${match.home.name}</span>
          <span class="card-header-vs">vs</span>
          <span class="card-header-away">${match.away.name}</span>
        </span>
      </div>`;

    // Row 2: flags + score column only
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

    // Row 3: date/time + venue
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

    // Row 4: broadcast badges
    const badges = broadcastBadgesHTML(match);
    const broadcastRow = badges ? `<div class="card-broadcast-row">${badges}</div>` : '';

    return header + teamsRow + metaRow + broadcastRow;
  }

  // ─── Render Groups ────────────────────────────────────────────────────────
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

  // ─── Render Matches ───────────────────────────────────────────────────────
  function renderMatches(groupFilter = 'all', venueFilter = 'all') {
    const container = document.getElementById('matches-list');
    if (!container) return;
    container.innerHTML = '';
    let filtered = groupFilter === 'all' ? WC_MATCHES : WC_MATCHES.filter(m => m.group === groupFilter);
    if (venueFilter !== 'all') filtered = filtered.filter(m => m.venue === venueFilter);

    filtered.forEach(match => {
      const scoreColHTML = `
        <div class="score-inputs-wrap">
          <input class="score-input" type="number" min="0" max="20"
            value="${match.homeScore !== null ? match.homeScore : ''}"
            placeholder="-" data-match="${match.id}" data-side="home">
          <span class="score-sep">:</span>
          <input class="score-input" type="number" min="0" max="20"
            value="${match.awayScore !== null ? match.awayScore : ''}"
            placeholder="-" data-match="${match.id}" data-side="away">
        </div>
        <button class="btn-save" data-save="${match.id}">Save Result</button>
        <span class="result-saved" id="saved-${match.id}">Saved ✓</span>`;

      const stripLabel = match.group ? 'Group ' + match.group : (match.stage || 'Match');
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = matchCardHTML(match, scoreColHTML, stripLabel);
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const id     = parseInt(btn.dataset.save);
        const match  = WC_MATCHES.find(m => m.id === id);
        const hInput = container.querySelector(`input[data-match="${id}"][data-side="home"]`);
        const aInput = container.querySelector(`input[data-match="${id}"][data-side="away"]`);
        if (hInput.value !== '' && aInput.value !== '') {
          match.homeScore = parseInt(hInput.value);
          match.awayScore = parseInt(aInput.value);
          const saved = document.getElementById('saved-' + id);
          if (saved) { saved.style.display = 'inline'; setTimeout(() => { saved.style.display = 'none'; }, 2000); }
          renderGroups();
          renderStandings();
        }
      });
    });
  }

  // ─── Render Predictions ───────────────────────────────────────────────────
  function renderPredictions() {
    const container = document.getElementById('predictions-list');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = '';
      if (predictPrompt) predictPrompt.hidden = false;
      return;
    }
    if (predictPrompt) predictPrompt.hidden = true;
    container.innerHTML = '';

    WC_MATCHES.forEach(match => {
      const key  = match.firestoreId || (match.home.name + '|' + match.away.name);
      const pred = userPredictions[key] || userPredictions[match.id] || null;
      const hasResult = match.homeScore !== null && match.awayScore !== null;

      let scoreColHTML;
      if (hasResult) {
        scoreColHTML = `
          <div class="score-final">${match.homeScore} : ${match.awayScore}</div>
          <span class="card-result-badge">Final</span>
          ${pred ? `<div class="pred-was">Your pick: ${pred.homeScorePred}–${pred.awayScorePred}</div>` : ''}`;
      } else {
        scoreColHTML = `
          <div class="score-inputs-wrap">
            <input class="pred-input" type="number" min="0" max="20"
              value="${pred ? pred.homeScorePred : ''}" placeholder="?"
              data-pred="${match.id}" data-side="home">
            <span class="score-sep">:</span>
            <input class="pred-input" type="number" min="0" max="20"
              value="${pred ? pred.awayScorePred : ''}" placeholder="?"
              data-pred="${match.id}" data-side="away">
          </div>
          <button class="btn-save pred-btn" data-pred-save="${match.id}" data-fsid="${match.firestoreId || ''}">Predict</button>
          <span class="pred-saving" id="pred-saving-${match.id}" hidden>Saving…</span>`;
      }

      const stripLabel = match.group ? 'Group ' + match.group : (match.stage || 'Match');
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = matchCardHTML(match, scoreColHTML, stripLabel);
      container.appendChild(card);
    });

    container.querySelectorAll('[data-pred-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = parseInt(btn.dataset.predSave);
        const fsId   = btn.dataset.fsid;
        const hInput = container.querySelector(`input[data-pred="${id}"][data-side="home"]`);
        const aInput = container.querySelector(`input[data-pred="${id}"][data-side="away"]`);
        if (!hInput || !aInput || hInput.value === '' || aInput.value === '') return;
        const saving = document.getElementById('pred-saving-' + id);
        btn.disabled = true;
        if (saving) saving.hidden = false;
        try {
          const matchId = fsId || String(id);
          await savePrediction(currentUser.uid, matchId, {
            homeScorePred: parseInt(hInput.value),
            awayScorePred: parseInt(aInput.value)
          });
          userPredictions[matchId] = { matchId, homeScorePred: parseInt(hInput.value), awayScorePred: parseInt(aInput.value) };
          btn.textContent = 'Updated ✓';
          setTimeout(() => { btn.textContent = 'Predict'; btn.disabled = false; }, 1500);
        } catch (err) {
          console.error('Save prediction failed:', err);
          btn.textContent = 'Error — retry';
          btn.disabled = false;
        } finally {
          if (saving) saving.hidden = true;
        }
      });
    });
  }

  // ─── Render Standings ─────────────────────────────────────────────────────
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

  // ─── Filters ──────────────────────────────────────────────────────────────
  const groupFilterEl = document.getElementById('group-filter');
  const venueFilterEl = document.getElementById('venue-filter');
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
  function getFilters() {
    return {
      group: groupFilterEl ? groupFilterEl.value : 'all',
      venue: venueFilterEl ? venueFilterEl.value : 'all',
    };
  }
  if (groupFilterEl) groupFilterEl.addEventListener('change', () => { const f = getFilters(); renderMatches(f.group, f.venue); });
  if (venueFilterEl) venueFilterEl.addEventListener('change', () => { const f = getFilters(); renderMatches(f.group, f.venue); });

  // ─── Render All ───────────────────────────────────────────────────────────
  function renderAll() {
    const activeView = document.querySelector('.nav-btn.active')?.dataset.view;
    const f = getFilters();
    if (activeView === 'groups')      renderGroups();
    if (activeView === 'matches')     renderMatches(f.group, f.venue);
    if (activeView === 'predictions') renderPredictions();
    if (activeView === 'standings')   renderStandings();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  renderGroups();
  loadFirestoreMatches();

})();
