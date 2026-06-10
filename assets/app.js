// World Cup 2026 App — Firebase-connected
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions } from './db.js';

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────
  const STAGE_LABELS = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF:  'Quarterfinals',
    SF:  'Semifinals',
    '3P': 'Third Place',
    F:   'Final',
  };

  // Replace with real admin Firebase UIDs to enable the score-entry UI
  const ADMIN_UIDS = [
    'REPLACE_WITH_YOUR_FIREBASE_UID',
  ];

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

  // ─── getAllMatches ────────────────────────────────────────────────────────────
  function getAllMatches() {
    return WC_MATCHES.concat(WC_KNOCKOUT_FIXTURES);
  }

  // ─── Shared Filter Utilities ─────────────────────────────────────────────────
  function getUniqueDates(matches) {
    const seen = new Set();
    matches.forEach(m => { if (m.date) seen.add(m.date); });
    return [...seen].sort();
  }

  function getUniqueStages(matches) {
    const seen = new Set();
    matches.forEach(m => {
      if (m.group) seen.add('Group ' + m.group);
      else if (m.stage) seen.add(m.stage);
    });
    const stageOrder = Object.values(STAGE_LABELS);
    return [...seen].sort((a, b) => {
      const aIsGroup = a.startsWith('Group');
      const bIsGroup = b.startsWith('Group');
      if (aIsGroup && bIsGroup) return a.localeCompare(b);
      if (aIsGroup) return -1;
      if (bIsGroup) return 1;
      return stageOrder.indexOf(a) - stageOrder.indexOf(b);
    });
  }

  function populateDateSelect(selectEl, matches) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = '<option value="all">All Dates</option>';
    getUniqueDates(matches).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = formatDate(d);
      selectEl.appendChild(opt);
    });
    if ([...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
  }

  function populateStageSelect(selectEl, matches, allLabel = 'All Matches') {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = `<option value="all">${allLabel}</option>`;
    getUniqueStages(matches).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      selectEl.appendChild(opt);
    });
    if ([...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
  }

  function populateVenueSelect(selectEl, matches) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = '<option value="all">All Venues</option>';
    const seen = new Set();
    matches.forEach(m => { if (m.venue) seen.add(m.venue); });
    [...seen].sort().forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
    if ([...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
  }

  function applyMatchFilters(matches, date, stage, team) {
    return matches.filter(m => {
      if (date !== 'all' && m.date !== date) return false;
      if (stage !== 'all') {
        const matchStageLabel = m.group ? 'Group ' + m.group : (m.stage || '');
        if (matchStageLabel !== stage) return false;
      }
      if (team) {
        const q = team.toLowerCase();
        const homeName = (m.home && m.home.name) ? m.home.name.toLowerCase() : '';
        const awayName = (m.away && m.away.name) ? m.away.name.toLowerCase() : '';
        if (!homeName.includes(q) && !awayName.includes(q)) return false;
      }
      return true;
    });
  }

  // ─── Filters: Matches page ────────────────────────────────────────────────────
  const matchDateFilter  = document.getElementById('match-date-filter');
  const matchGroupFilter = document.getElementById('match-group-filter');
  const matchVenueFilter = document.getElementById('match-venue-filter');
  const matchTeamFilter  = document.getElementById('match-team-filter');

  // ─── Filters: Predictions page ───────────────────────────────────────────────
  const predDateFilter  = document.getElementById('pred-date-filter');
  const predGroupFilter = document.getElementById('pred-group-filter');
  const predTeamFilter  = document.getElementById('pred-team-filter');

  function initMatchFilters() {
    populateDateSelect(matchDateFilter, WC_MATCHES);
    populateStageSelect(matchGroupFilter, WC_MATCHES, 'All Groups');
    populateVenueSelect(matchVenueFilter, getAllMatches());
    if (matchDateFilter)  matchDateFilter.addEventListener('change',  renderMatches);
    if (matchGroupFilter) matchGroupFilter.addEventListener('change', renderMatches);
    if (matchVenueFilter) matchVenueFilter.addEventListener('change', renderMatches);
    if (matchTeamFilter)  matchTeamFilter.addEventListener('input',   renderMatches);
  }

  function initPredFilters() {
    if (!predDateFilter && !predGroupFilter && !predTeamFilter) return;
    populateDateSelect(predDateFilter, getAllMatches());
    populateStageSelect(predGroupFilter, getAllMatches(), 'All Matches');
    if (predDateFilter)  predDateFilter.addEventListener('change',  renderPredictions);
    if (predGroupFilter) predGroupFilter.addEventListener('change', renderPredictions);
    if (predTeamFilter)  predTeamFilter.addEventListener('input',   renderPredictions);
  }

  initMatchFilters();
  initPredFilters();

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function buildDisplayMatch(match) {
    const isKnockout = !match.group;
    const homeResolved = isKnockout ? resolveKnockoutTeam(match.home) : match.home;
    const awayResolved = isKnockout ? resolveKnockoutTeam(match.away) : match.away;
    return {
      id:        match.id,
      date:      match.date,
      timeLocal: match.timeLocal,
      tz:        match.tz,
      venue:     match.venue,
      group:     match.group,
      stage:     match.stage,
      status:    match.status,
      minute:    match.minute,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      home:      homeResolved,
      away:      awayResolved,
    };
  }

  function resolveKnockoutTeam(teamRef) {
    if (!teamRef || teamRef.flag !== '?') return teamRef;
    const name = teamRef.name || '';
    const posMatch = name.match(/^(\d+)(?:st|nd|rd|th) Group ([A-L])$/i);
    if (posMatch) {
      const pos   = parseInt(posMatch[1], 10) - 1;
      const grpId = posMatch[2].toUpperCase();
      const group = WC_GROUPS.find(g => g.id === grpId);
      if (group) {
        const groupMatches = WC_MATCHES.filter(m => m.group === grpId);
        const ranked = group.teams.map(t => ({
          ...t,
          ...calcActualPoints(groupMatches, t.name)
        })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
        if (ranked[pos]) return { name: ranked[pos].name, flag: ranked[pos].flag };
      }
    }
    return teamRef;
  }

  function calcActualPoints(matches, teamName) {
    let pts = 0, gf = 0, ga = 0, w = 0, d = 0, l = 0;
    matches.forEach(m => {
      const isHome = m.home.name === teamName;
      const isAway = m.away.name === teamName;
      if (!isHome && !isAway) return;
      if (m.homeScore === undefined || m.homeScore === null ||
          m.awayScore === undefined || m.awayScore === null) return;
      const ts = isHome ? m.homeScore : m.awayScore;
      const os = isHome ? m.awayScore : m.homeScore;
      gf += ts; ga += os;
      if (ts > os)       { pts += 3; w++; }
      else if (ts === os){ pts += 1; d++; }
      else               { l++; }
    });
    return { pts, gf, ga, gd: gf - ga, w, d, l };
  }

  // ─── Match Card HTML — aligned with style.css class names ────────────────────
  function matchCardHTML(dm, scoreColContent, groupOrStage) {
    const dateStr = dm.date      ? formatDate(dm.date) : '';
    const timeStr = dm.timeLocal ? dm.timeLocal + (dm.tz ? ' ' + dm.tz : '') : '';
    const venue   = dm.venue     || '';
    const label   = groupOrStage || '';
    const status  = (dm.status || '').toLowerCase();
    const isLive  = status === 'live' || status === 'ht';

    const metaParts = [dateStr, timeStr, venue].filter(Boolean);

    return `
      <div class="card-header">
        <span class="card-header-group">${label}</span>
        <div class="card-header-matchup">
          <span class="card-header-home">${dm.home.flag} ${dm.home.name}</span>
          <span class="card-header-vs">vs</span>
          <span class="card-header-away">${dm.away.name} ${dm.away.flag}</span>
        </div>
        ${isLive ? `<span class="status-badge status-live"><span class="live-dot"></span>LIVE${dm.minute ? ' ' + dm.minute + "'" : ''}</span>` : ''}
      </div>
      <div class="card-teams">
        <div class="card-team home-team">
          <span class="team-flag">${dm.home.flag}</span>
          <span class="team-name">${dm.home.name}</span>
        </div>
        <div class="card-score-col">
          ${scoreColContent}
        </div>
        <div class="card-team away-team">
          <span class="team-name">${dm.away.name}</span>
          <span class="team-flag">${dm.away.flag}</span>
        </div>
      </div>
      ${metaParts.length ? `
      <div class="card-meta">
        ${dateStr  ? `<span class="card-meta-item">${dateStr}</span>` : ''}
        ${timeStr  ? `<span class="card-meta-item">${timeStr}</span>` : ''}
        ${venue    ? `<span class="card-meta-item">${venue}</span>`   : ''}
      </div>` : ''}`;
  }

  // ─── Render All ──────────────────────────────────────────────────────────────
  function renderAll() {
    renderGroups();
    renderMatches();
    if (activePredSubtab === 'my-picks')       renderPredictions();
    if (activePredSubtab === 'pred-bracket')   renderKnockoutBracket();
    if (activePredSubtab === 'pred-standings') renderPredStandings();
    renderStandings();
  }

  // ─── Render Groups ────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-card-header">
          <span class="group-name">Group ${group.id}</span>
          <span class="group-count">${group.teams.length} teams</span>
        </div>
        <div class="group-teams">
          ${group.teams.map(t => `
            <div class="group-team-row">
              <span class="team-flag">${t.flag}</span>
              <span class="team-name">${t.name}</span>
              <span class="team-pts">${t.pts !== undefined ? t.pts : 0} pts</span>
            </div>`).join('')}
        </div>`;
      container.appendChild(card);
    });
  }

  // ─── Render Matches ───────────────────────────────────────────────────────────
  function renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;

    const dateVal  = matchDateFilter  ? matchDateFilter.value        : 'all';
    const groupVal = matchGroupFilter ? matchGroupFilter.value       : 'all';
    const venueVal = matchVenueFilter ? matchVenueFilter.value       : 'all';
    const teamVal  = matchTeamFilter  ? matchTeamFilter.value.trim() : '';

    let filtered = applyMatchFilters(WC_MATCHES, dateVal, groupVal, teamVal);
    if (venueVal !== 'all') filtered = filtered.filter(m => m.venue === venueVal);

    container.innerHTML = '';

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches found for the selected filters.</div>';
      return;
    }

    const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);

    filtered.forEach(match => {
      const dm     = buildDisplayMatch(match);
      const status = (match.status || 'scheduled').toLowerCase();
      const isLive     = status === 'live' || status === 'ht';
      const isFinished = status === 'finished';

      let scoreColContent;
      if (isAdmin) {
        const hv = (match.homeScore !== undefined && match.homeScore !== null) ? match.homeScore : '';
        const av = (match.awayScore !== undefined && match.awayScore !== null) ? match.awayScore : '';
        scoreColContent = `
          <div class="score-inputs-wrap">
            <input type="number" min="0" max="99" class="score-input admin-score"
              data-match-id="${match.id}" data-side="home" value="${hv}" placeholder="-"
              aria-label="${dm.home.name} score">
            <span class="score-sep">:</span>
            <input type="number" min="0" max="99" class="score-input admin-score"
              data-match-id="${match.id}" data-side="away" value="${av}" placeholder="-"
              aria-label="${dm.away.name} score">
          </div>
          <select class="score-input admin-status" data-match-id="${match.id}" aria-label="Match status" style="width:auto;height:auto;font-size:var(--text-xs);margin-top:var(--space-1)">
            <option value="scheduled" ${status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="live"      ${status === 'live'      ? 'selected' : ''}>Live</option>
            <option value="ht"        ${status === 'ht'        ? 'selected' : ''}>Half Time</option>
            <option value="finished"  ${status === 'finished'  ? 'selected' : ''}>Finished</option>
          </select>
          <button class="btn-save save-score-btn" data-match-id="${match.id}" style="margin-top:var(--space-1)">Save</button>`;
      } else if (isFinished || isLive) {
        const hs  = (match.homeScore !== undefined && match.homeScore !== null) ? match.homeScore : '?';
        const as_ = (match.awayScore !== undefined && match.awayScore !== null) ? match.awayScore : '?';
        scoreColContent = `<div class="score-final${isLive ? ' score-live' : ''}">${hs}<span class="score-sep"> : </span>${as_}</div>`;
      } else {
        scoreColContent = `<div class="score-final score-pending">vs</div>`;
      }

      const groupLabel = match.group ? 'Group ' + match.group : (match.stage || '');
      const card = document.createElement('div');
      card.className = 'match-card' + (isLive ? ' match-card-live' : '');
      card.innerHTML = matchCardHTML(dm, scoreColContent, groupLabel);

      if (isAdmin) {
        const saveBtn = card.querySelector('.save-score-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            const homeInput   = card.querySelector('.admin-score[data-side="home"]');
            const awayInput   = card.querySelector('.admin-score[data-side="away"]');
            const statusInput = card.querySelector('.admin-status');
            const homeScore = homeInput ? parseInt(homeInput.value, 10) : NaN;
            const awayScore = awayInput ? parseInt(awayInput.value, 10) : NaN;
            const newStatus = statusInput ? statusInput.value : 'scheduled';
            if (isNaN(homeScore) || isNaN(awayScore)) { alert('Enter both scores.'); return; }
            saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
            try {
              const { saveMatchResult } = await import('./db.js');
              await saveMatchResult(match.id, { homeScore, awayScore, status: newStatus,
                homeTeam: match.home.name, awayTeam: match.away.name });
              saveBtn.textContent = 'Saved!';
            } catch (err) {
              console.error('Save score error:', err); saveBtn.textContent = 'Error';
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
  function renderPredictions() {
    const container   = document.getElementById('predictions-list');
    const predFilters = document.getElementById('pred-filters');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      if (predictPrompt) predictPrompt.hidden = false;
      if (predFilters)   predFilters.hidden   = true;
      return;
    }
    if (predictPrompt) predictPrompt.hidden = true;
    if (predFilters)   predFilters.hidden   = false;

    const dateVal  = predDateFilter  ? predDateFilter.value        : 'all';
    const groupVal = predGroupFilter ? predGroupFilter.value       : 'all';
    const teamVal  = predTeamFilter  ? predTeamFilter.value.trim() : '';

    const filtered = applyMatchFilters(getAllMatches(), dateVal, groupVal, teamVal);

    container.innerHTML = '';

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches found for the selected filters.</div>';
      return;
    }

    filtered.forEach(match => {
      const dm = buildDisplayMatch(match);
      const status     = (match.status || 'scheduled').toLowerCase();
      const isLive     = status === 'live' || status === 'ht';
      const isFinished = status === 'finished';
      const pred    = userPredictions[match.id];
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
          ? `<div class="card-result-badge ${hasPred ? 'pred-saved' : 'pred-missed'}">${hasPred ? '&#x2713; Picked' : '&#x2715; No pick'}</div>`
          : `<button class="btn-save pred-btn save-pred-btn" data-match-id="${match.id}">Save</button>`
        }`;

      const groupLabel = match.group ? 'Group ' + match.group : (match.stage || '');
      const card = document.createElement('div');
      card.className = 'match-card' + (isLive ? ' match-card-live' : '');
      card.innerHTML = matchCardHTML(dm, scoreColHTML, groupLabel);

      if (!isFinished) {
        const saveBtn = card.querySelector('.save-pred-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            const homeInput = card.querySelector('.pred-input[data-side="home"]');
            const awayInput = card.querySelector('.pred-input[data-side="away"]');
            const homeScorePred = homeInput ? parseInt(homeInput.value, 10) : NaN;
            const awayScorePred = awayInput ? parseInt(awayInput.value, 10) : NaN;
            if (isNaN(homeScorePred) || isNaN(awayScorePred)) { console.warn('Invalid prediction input'); return; }
            saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
            try {
              await savePrediction(currentUser.uid, match.id, {
                homeTeam: match.home.name, awayTeam: match.away.name,
                homeScorePred, awayScorePred
              });
              userPredictions[match.id] = { matchId: match.id, homeScorePred, awayScorePred };
              saveBtn.textContent = 'Saved!';
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

  // ─── Render Knockout Bracket ──────────────────────────────────────────────────
  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = '<div class="auth-prompt"><p>Sign in to view and fill in your knockout predictions.</p><button class="btn btn-primary pred-standings-signin-btn">Sign In to Predict</button></div>';
      return;
    }

    const stages = [
      { key: 'R32', label: STAGE_LABELS.R32 },
      { key: 'R16', label: STAGE_LABELS.R16 },
      { key: 'QF',  label: STAGE_LABELS.QF  },
      { key: 'SF',  label: STAGE_LABELS.SF  },
      { key: '3P',  label: STAGE_LABELS['3P'] },
      { key: 'F',   label: STAGE_LABELS.F   },
    ];

    container.innerHTML = '';
    let anyStage = false;

    stages.forEach(({ key, label }) => {
      const stageMatches = WC_KNOCKOUT_FIXTURES.filter(m => m.stage === STAGE_LABELS[key]);
      if (!stageMatches.length) return;
      anyStage = true;

      const section = document.createElement('div');
      section.className = 'ko-stage-section';
      section.innerHTML = `<h3 class="ko-stage-title">${label}</h3>`;

      stageMatches.forEach(match => {
        const dm = buildDisplayMatch(match);
        const status     = (match.status || 'scheduled').toLowerCase();
        const isLive     = status === 'live' || status === 'ht';
        const isFinished = status === 'finished';
        const pred    = userPredictions[match.id];
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
            ? `<div class="card-result-badge ${hasPred ? 'pred-saved' : 'pred-missed'}">${hasPred ? '&#x2713; Picked' : '&#x2715; No pick'}</div>`
            : `<button class="btn-save pred-btn save-pred-btn" data-match-id="${match.id}">Save</button>`
          }`;

        const card = document.createElement('div');
        card.className = 'match-card' + (isLive ? ' match-card-live' : '');
        card.innerHTML = matchCardHTML(dm, scoreColHTML, match.stage || label);

        if (!isFinished) {
          const saveBtn = card.querySelector('.save-pred-btn');
          if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
              const homeInput = card.querySelector('.pred-input[data-side="home"]');
              const awayInput = card.querySelector('.pred-input[data-side="away"]');
              const homeScorePred = homeInput ? parseInt(homeInput.value, 10) : NaN;
              const awayScorePred = awayInput ? parseInt(awayInput.value, 10) : NaN;
              if (isNaN(homeScorePred) || isNaN(awayScorePred)) return;
              saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
              try {
                await savePrediction(currentUser.uid, match.id, {
                  homeTeam: match.home.name, awayTeam: match.away.name,
                  homeScorePred, awayScorePred
                });
                userPredictions[match.id] = { matchId: match.id, homeScorePred, awayScorePred };
                saveBtn.textContent = 'Saved!';
              } catch (err) {
                console.error('Save pred error:', err);
                saveBtn.textContent = 'Error';
              } finally {
                setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
              }
            });
          }
        }
        section.appendChild(card);
      });

      container.appendChild(section);
    });

    if (!anyStage) {
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
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''}">
                <td><span class="team-flag">${t.flag}</span> ${t.name}</td>
                <td>${t.w + t.d + t.l}</td>
                <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.ga}</td>
                <td>${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
                <td class="pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Render Prediction Standings ──────────────────────────────────────────────
  function renderPredStandings() {
    const container = document.getElementById('pred-standings-container');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      if (predStandingsAuthPrompt) predStandingsAuthPrompt.hidden = false;
      return;
    }
    if (predStandingsAuthPrompt) predStandingsAuthPrompt.hidden = true;

    container.innerHTML = '';
    const allMatches = getAllMatches();
    let correctExact = 0, correctResult = 0, total = 0;

    allMatches.forEach(match => {
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

})();
