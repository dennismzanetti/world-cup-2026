// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
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

  // ─── stageKeyToLabel ─────────────────────────────────────────────────────────
  function stageKeyToLabel(key) {
    if (!key) return '';
    if (/^[A-Za-z]{1,2}$/.test(key)) return 'Group ' + key.toUpperCase();
    return key;
  }

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentUser = null;
  let authResolved = false;
  let firstAuthFire = true;
  let userPredictions = {};
  let authMode = 'signin';
  let unsubscribeMatches = null;
  let activePredSubtab = 'my-picks';

  // Bracket picks: { matchId: 'home' | 'away' }
  let bracketPicks = {};

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
      if (activePredSubtab === 'my-picks')            renderPredictions();
      if (activePredSubtab === 'pred-bracket')        renderKnockoutBracket();
      if (activePredSubtab === 'pred-standings')      renderPredStandings();
      if (activePredSubtab === 'pred-group-standings') renderPredGroupStandings();
    });
  });

  // ─── Auth State ──────────────────────────────────────────────────────────────
  const authBtn        = document.getElementById('auth-btn');
  const authModal      = document.getElementById('auth-modal');
  const authBackdrop   = document.getElementById('auth-backdrop');
  const authClose      = document.getElementById('auth-close');
  const authForm       = document.getElementById('auth-form');
  const authSubmit     = document.getElementById('auth-submit');
  const authSwitch     = document.getElementById('auth-switch');
  const authError      = document.getElementById('auth-error');
  const authTitle      = document.getElementById('auth-title');
  const authSub        = document.getElementById('auth-sub');
  const authNameGroup  = document.getElementById('auth-name');
  const authNameInput  = document.getElementById('auth-name-input');
  const userBar        = document.getElementById('user-bar');
  const userGreeting   = document.getElementById('user-greeting');
  const signOutBtn     = document.getElementById('sign-out-btn');
  const predictSigninBtn = document.getElementById('predict-signin-btn');
  const predStandingsAuthPrompt = document.getElementById('pred-standings-auth-prompt');

  function openModal() {
    authModal.hidden = false;
    authBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      authModal.classList.add('open');
      authBackdrop.classList.add('open');
    }, 10);
  }
  function closeModal() {
    authModal.classList.remove('open');
    authBackdrop.classList.remove('open');
    setTimeout(() => {
      authModal.hidden = true;
      authBackdrop.hidden = true;
      document.body.style.overflow = '';
    }, 250);
  }

  function setAuthMode(mode) {
    authMode = mode;
    if (mode === 'signup') {
      authTitle.textContent = 'Create Account';
      authSub.textContent = 'Sign up to save your predictions.';
      authSubmit.textContent = 'Create Account';
      authSwitch.textContent = 'Already have an account? Sign in';
      authNameGroup.style.display = 'block';
    } else {
      authTitle.textContent = 'Sign In';
      authSub.textContent = 'Sign in to save your predictions.';
      authSubmit.textContent = 'Sign In';
      authSwitch.textContent = "Don't have an account? Sign up";
      authNameGroup.style.display = 'none';
    }
    authError.textContent = '';
  }

  authBtn.addEventListener('click', openModal);
  authClose.addEventListener('click', closeModal);
  authBackdrop.addEventListener('click', closeModal);
  authSwitch.addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  if (predictSigninBtn) predictSigninBtn.addEventListener('click', openModal);

  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  authForm.addEventListener('submit', async e => {
    e.preventDefault();
    authError.textContent = '';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    authSubmit.disabled = true;
    try {
      if (authMode === 'signup') {
        const displayName = authNameInput.value.trim() || email.split('@')[0];
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      closeModal();
    } catch (err) {
      authError.textContent = err.message || 'Authentication failed.';
    } finally {
      authSubmit.disabled = false;
    }
  });

  if (signOutBtn) signOutBtn.addEventListener('click', async () => { await logOut(); });

  watchAuth(async (user) => {
    currentUser = user;
    authResolved = true;

    if (user) {
      authBtn.textContent = 'Account';
      authBtn.setAttribute('aria-label', 'Account');
      if (userBar) userBar.hidden = false;
      if (userGreeting) userGreeting.textContent = 'Hello, ' + (user.displayName || user.email);

      // Load bracket picks from localStorage
      const savedPicks = localStorage.getItem('bracketPicks_' + user.uid);
      bracketPicks = savedPicks ? JSON.parse(savedPicks) : {};

      try {
        const preds = await getUserPredictions(user.uid);
        userPredictions = {};
        preds.forEach(p => { userPredictions[p.matchId] = p; });
      } catch (err) {
        console.error('Error loading predictions:', err);
        userPredictions = {};
      }
    } else {
      authBtn.textContent = 'Sign In';
      authBtn.setAttribute('aria-label', 'Sign in');
      if (userBar) userBar.hidden = true;
      userPredictions = {};
      bracketPicks = {};
    }

    renderAll();
    firstAuthFire = false;
  });

  // ─── Firestore Live Match Updates ─────────────────────────────────────────────
  unsubscribeMatches = watchMatches((updatedMatches) => {
    updatedMatches.forEach(um => {
      const idx = WC_MATCHES.findIndex(m => m.id === um.id);
      if (idx !== -1) {
        WC_MATCHES[idx] = { ...WC_MATCHES[idx], ...um };
      } else {
        const kidx = WC_KNOCKOUT_FIXTURES.findIndex(m => m.id === um.id);
        if (kidx !== -1) WC_KNOCKOUT_FIXTURES[kidx] = { ...WC_KNOCKOUT_FIXTURES[kidx], ...um };
      }
    });
    renderAll();
  });

  // ─── Date/Group/Venue Filter Helpers ─────────────────────────────────────────
  function populateDateSelect(sel, matches) {
    if (!sel) return;
    const dates = [...new Set(matches.map(m => m.date).filter(Boolean))].sort();
    sel.innerHTML = '<option value="all">All Dates</option>';
    dates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = formatDate(d);
      sel.appendChild(opt);
    });
  }

  function populateStageSelect(sel, matches, allLabel) {
    if (!sel) return;
    const stages = [...new Set(matches.map(m => m.group || m.stage).filter(Boolean))];
    sel.innerHTML = `<option value="all">${allLabel}</option>`;
    stages.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = stageKeyToLabel(s);
      sel.appendChild(opt);
    });
  }

  function populateVenueSelect(sel, matches) {
    if (!sel) return;
    const venues = [...new Set(matches.map(m => m.venue).filter(Boolean))].sort();
    sel.innerHTML = '<option value="all">All Venues</option>';
    venues.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function applyMatchFilters(matches, dateVal, groupVal, teamVal) {
    return matches.filter(m => {
      if (dateVal && dateVal !== 'all' && m.date !== dateVal) return false;
      if (groupVal && groupVal !== 'all' && (m.group || m.stage) !== groupVal) return false;
      if (teamVal && teamVal.trim()) {
        const t = teamVal.trim().toLowerCase();
        if (!m.home.name.toLowerCase().includes(t) && !m.away.name.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }

  // ─── Filters Init ────────────────────────────────────────────────────────────
  const matchDateFilter  = document.getElementById('match-date-filter');
  const matchGroupFilter = document.getElementById('match-group-filter');
  const matchVenueFilter = document.getElementById('match-venue-filter');
  const matchTeamFilter  = document.getElementById('match-team-filter');
  const predDateFilter   = document.getElementById('pred-date-filter');
  const predGroupFilter  = document.getElementById('pred-group-filter');
  const predTeamFilter   = document.getElementById('pred-team-filter');

  populateDateSelect(matchDateFilter, WC_MATCHES);
  populateStageSelect(matchGroupFilter, WC_MATCHES, 'All Groups');
  populateVenueSelect(matchVenueFilter, getAllMatches());

  if (matchDateFilter)  matchDateFilter.addEventListener('change',  renderMatches);
  if (matchGroupFilter) matchGroupFilter.addEventListener('change', renderMatches);
  if (matchVenueFilter) matchVenueFilter.addEventListener('change', renderMatches);
  if (matchTeamFilter)  matchTeamFilter.addEventListener('input',   renderMatches);

  populateDateSelect(predDateFilter, getAllMatches());
  populateStageSelect(predGroupFilter, getAllMatches(), 'All Matches');

  if (predDateFilter)  predDateFilter.addEventListener('change',  renderPredictions);
  if (predGroupFilter) predGroupFilter.addEventListener('change', renderPredictions);
  if (predTeamFilter)  predTeamFilter.addEventListener('input',   renderPredictions);

  // ─── Initial render ──────────────────────────────────────────────────────────
  renderGroups();
  renderMatches();
  renderStandings();

  // ─── Utility ─────────────────────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ─── Resolve TBD teams from group standings ───────────────────────────────────
  function resolveTeam(teamRef) {
    if (!teamRef || !teamRef.tbd) return teamRef;
    const { grpId, pos } = teamRef.tbd;
    const group = WC_GROUPS.find(g => g.id === grpId);
    if (group) {
      const groupMatches = WC_MATCHES.filter(m => m.group === grpId);
      const ranked = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      if (ranked[pos]) return { name: ranked[pos].name, flag: ranked[pos].flag };
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

  // ─── Shared helper: build a standings card ────────────────────────────────────
  function buildStandingsCard(groupId, teams) {
    const card = document.createElement('div');
    card.className = 'standings-card';
    card.innerHTML = `
      <div class="standings-header">Group ${groupId}</div>
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
    return card;
  }

  // ─── Match Card HTML ──────────────────────────────────────────────────────────
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
        ${scoreColContent}
        <div class="card-team away-team">
          <span class="team-flag">${dm.away.flag}</span>
          <span class="team-name">${dm.away.name}</span>
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
    if (activePredSubtab === 'my-picks')             renderPredictions();
    if (activePredSubtab === 'pred-bracket')         renderKnockoutBracket();
    if (activePredSubtab === 'pred-standings')       renderPredStandings();
    if (activePredSubtab === 'pred-group-standings') renderPredGroupStandings();
    renderStandings();
  }

  // ─── Render Groups ────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-grid');
    if (!container) return;
    container.innerHTML = '';
    container.className = 'standings-grid';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      container.appendChild(buildStandingsCard(group.id, teams));
    });
  }

  // ─── Render Matches ──────────────────────────────────────────────────────────
  function renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;

    const dateVal  = matchDateFilter  ? matchDateFilter.value  : 'all';
    const groupVal = matchGroupFilter ? matchGroupFilter.value : 'all';
    const venueVal = matchVenueFilter ? matchVenueFilter.value : 'all';
    const teamVal  = matchTeamFilter  ? matchTeamFilter.value  : '';

    let filtered = applyMatchFilters(WC_MATCHES, dateVal, groupVal, teamVal);
    if (venueVal && venueVal !== 'all') filtered = filtered.filter(m => m.venue === venueVal);

    container.innerHTML = '';

    const byDate = {};
    filtered.forEach(m => {
      const key = m.date || 'TBD';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m);
    });

    const sortedDates = Object.keys(byDate).sort();
    if (sortedDates.length === 0) {
      container.innerHTML = '<p class="empty-filter-msg">No matches found for the selected filters.</p>';
      return;
    }

    sortedDates.forEach(date => {
      const divider = document.createElement('div');
      divider.className = 'date-divider';
      divider.textContent = date === 'TBD' ? 'Date TBD' : formatDate(date);
      container.appendChild(divider);

      byDate[date].forEach(m => {
        const card = document.createElement('div');
        card.className = 'match-card';
        const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);
        const hasScore = m.homeScore !== undefined && m.homeScore !== null &&
                         m.awayScore !== undefined && m.awayScore !== null;

        let scoreCol;
        if (hasScore) {
          scoreCol = `<div class="card-score">${m.homeScore} – ${m.awayScore}</div>`;
        } else if (isAdmin) {
          scoreCol = `
            <div class="card-score-input">
              <input type="number" min="0" max="99" placeholder="0" class="score-input" id="home-${m.id}" value="" aria-label="Home score">
              <span class="score-sep">–</span>
              <input type="number" min="0" max="99" placeholder="0" class="score-input" id="away-${m.id}" value="" aria-label="Away score">
              <button class="btn btn-xs btn-primary save-score-btn" data-match-id="${m.id}">Save</button>
            </div>`;
        } else {
          scoreCol = `<div class="card-vs">vs</div>`;
        }

        const broadcast = m.broadcast && m.broadcast.length
          ? `<div class="broadcast-row">${m.broadcast.map(b => `<span class="broadcast-badge">${b}</span>`).join('')}</div>`
          : '';

        card.innerHTML = matchCardHTML(m, scoreCol, stageKeyToLabel(m.group || m.stage)) + broadcast;

        if (isAdmin && !hasScore) {
          const btn = card.querySelector('.save-score-btn');
          if (btn) {
            btn.addEventListener('click', async () => {
              const homeInput = card.querySelector(`#home-${m.id}`);
              const awayInput = card.querySelector(`#away-${m.id}`);
              const hs = parseInt(homeInput.value, 10);
              const as_ = parseInt(awayInput.value, 10);
              if (isNaN(hs) || isNaN(as_)) return;
              btn.disabled = true; btn.textContent = 'Saving...';
              try {
                const { saveScore } = await import('./db.js');
                await saveScore(m.id, hs, as_);
                btn.textContent = 'Saved!';
              } catch (err) {
                console.error('Save score error:', err);
                btn.textContent = 'Error';
              } finally {
                setTimeout(() => { btn.disabled = false; btn.textContent = 'Save'; }, 2000);
              }
            });
          }
        }

        container.appendChild(card);
      });
    });
  }

  // ─── Render Predictions ──────────────────────────────────────────────────────
  function renderPredictions() {
    const container  = document.getElementById('predictions-list');
    const authPrompt = document.getElementById('predictions-auth-prompt');
    const filters    = document.getElementById('pred-filters');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      if (authPrompt) authPrompt.hidden = false;
      if (filters)    filters.hidden    = true;
      return;
    }
    if (authPrompt) authPrompt.hidden = true;
    if (filters)    filters.hidden    = false;

    const dateVal  = predDateFilter  ? predDateFilter.value  : 'all';
    const groupVal = predGroupFilter ? predGroupFilter.value : 'all';
    const teamVal  = predTeamFilter  ? predTeamFilter.value  : '';

    const allMatches = getAllMatches();
    const filtered   = applyMatchFilters(allMatches, dateVal, groupVal, teamVal);

    container.innerHTML = '';

    const byStage = {};
    filtered.forEach(m => {
      const key = m.group || m.stage || 'Other';
      if (!byStage[key]) byStage[key] = [];
      byStage[key].push(m);
    });

    const stageOrder = [
      ...WC_GROUPS.map(g => g.id),
      'Round of 32', 'Round of 16', 'Quarterfinals',
      'Semifinals', 'Third Place', 'Final'
    ];

    let anyStage = false;
    stageOrder.forEach(stageKey => {
      if (!byStage[stageKey]) return;
      anyStage = true;

      const section = document.createElement('div');
      section.className = 'pred-section';

      const heading = document.createElement('div');
      heading.className = 'date-divider';
      heading.textContent = stageKeyToLabel(stageKey);
      section.appendChild(heading);

      byStage[stageKey].forEach(match => {
        const dm     = { ...match, home: resolveTeam(match.home), away: resolveTeam(match.away) };
        const pred   = userPredictions[match.id];
        const hasPred = pred && pred.homeScorePred !== undefined;
        const hasScore = match.homeScore !== undefined && match.homeScore !== null &&
                         match.awayScore !== undefined && match.awayScore !== null;

        let resultClass = '';
        if (hasPred && hasScore) {
          const predResult   = pred.homeScorePred > pred.awayScorePred ? 'H' : pred.homeScorePred < pred.awayScorePred ? 'A' : 'D';
          const actualResult = match.homeScore > match.awayScore ? 'H' : match.homeScore < match.awayScore ? 'A' : 'D';
          if (pred.homeScorePred === match.homeScore && pred.awayScorePred === match.awayScore) resultClass = 'pred-exact';
          else if (predResult === actualResult) resultClass = 'pred-correct';
          else resultClass = 'pred-wrong';
        }

        const card = document.createElement('div');
        card.className = 'match-card pred-card' + (resultClass ? ' ' + resultClass : '');

        const scoreCol = `
          <div class="card-pred-score">
            ${hasScore ? `<div class="actual-score">${match.homeScore}–${match.awayScore}</div>` : ''}
            <div class="pred-inputs">
              <input type="number" min="0" max="99" class="score-input pred-input" data-match="${match.id}" data-side="home"
                value="${hasPred ? pred.homeScorePred : ''}" placeholder="0" aria-label="Predicted home score">
              <span class="score-sep">–</span>
              <input type="number" min="0" max="99" class="score-input pred-input" data-match="${match.id}" data-side="away"
                value="${hasPred ? pred.awayScorePred : ''}" placeholder="0" aria-label="Predicted away score">
            </div>
            <button class="btn btn-xs btn-primary save-pred-btn" data-match-id="${match.id}">Save</button>
          </div>`;

        card.innerHTML = matchCardHTML(dm, scoreCol, stageKeyToLabel(stageKey));

        const saveBtn = card.querySelector('.save-pred-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            const homeInput = card.querySelector(`.pred-input[data-match="${match.id}"][data-side="home"]`);
            const awayInput = card.querySelector(`.pred-input[data-match="${match.id}"][data-side="away"]`);
            const homeScorePred = parseInt(homeInput.value, 10);
            const awayScorePred = parseInt(awayInput.value, 10);
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
        section.appendChild(card);
      });

      container.appendChild(section);
    });

    if (!anyStage) {
      container.innerHTML = `
        <div class="empty-filter-msg">
          No matches found.<br>
          <span style="font-size:var(--text-xs);opacity:0.7">Try adjusting your filters.</span>
        </div>`;
    }
  }

  // ─── Bracket Helpers ─────────────────────────────────────────────────────────

  // Get the actual group finisher (pos=0=winner, pos=1=runner-up) from real
  // entered match results. Returns null if the group has incomplete results.
  function getActualGroupFinisher(groupId, pos) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    // Only use actual results — require all 3 group matches per team to be complete
    const hasAllResults = groupMatches.every(m =>
      m.homeScore !== undefined && m.homeScore !== null &&
      m.awayScore !== undefined && m.awayScore !== null
    );
    if (!hasAllResults) return null;
    const teams = group.teams.map(t => ({
      ...t,
      ...calcActualPoints(groupMatches, t.name)
    })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (teams[pos]) return { name: teams[pos].name, flag: teams[pos].flag };
    return null;
  }

  // Get the predicted group winner (pos=0) or runner-up (pos=1) from user's
  // score predictions. Falls back to the data.js placeholder label.
  function getPredictedGroupFinisher(groupId, pos) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    const teams = group.teams.map(t => ({
      ...t,
      ...calcPredPoints(groupMatches, t.name)
    })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (teams[pos]) return { name: teams[pos].name, flag: teams[pos].flag };
    return null;
  }

  // Resolve a knockout fixture's home/away team using:
  //  1. Actual results (type='group' → real standings if complete)
  //  2. User's score predictions (type='group' → predicted standings)
  //  3. bracketPicks cascade (type='winner' → picked winner of prior match)
  //  4. Fallback to the placeholder name in data.js
  function resolveKnockoutTeam(source, fixture) {
    if (!source) return { name: '?', flag: '🏳️' };

    if (source.type === 'group') {
      // Prefer actual results when the group is fully played
      const actual = getActualGroupFinisher(source.group, source.pos);
      if (actual) return actual;
      // Fall back to user's predicted standings
      const predicted = getPredictedGroupFinisher(source.group, source.pos);
      if (predicted) return predicted;
      // Last resort: placeholder label e.g. "1A"
      const posLabel = source.pos === 0 ? '1' : '2';
      return { name: posLabel + source.group, flag: '🏳️' };
    }

    if (source.type === 'best3rd') {
      return { name: 'Best 3rd #' + source.rank, flag: '🏳️' };
    }

    if (source.type === 'winner') {
      const priorMatchId = source.matchId;
      const pick = bracketPicks[priorMatchId]; // 'home' or 'away'
      if (pick) {
        const priorFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === priorMatchId);
        if (priorFixture) {
          const priorHome = resolveKnockoutTeam(priorFixture.homeSource, priorFixture);
          const priorAway = resolveKnockoutTeam(priorFixture.awaySource, priorFixture);
          return pick === 'home' ? priorHome : priorAway;
        }
      }
      // No pick yet — show placeholder
      return { name: fixture ? (fixture.home.name.startsWith('W ') ? fixture.home.name : '?') : '?', flag: '🏳️' };
    }

    if (source.type === 'loser') {
      return { name: 'Loser of ' + source.matchId.toUpperCase(), flag: '🏳️' };
    }

    return { name: '?', flag: '🏳️' };
  }

  // Given a matchId pick ('home'/'away'), clear all downstream bracket picks
  // that depended on this match's result.
  function clearDownstreamPicks(matchId) {
    // Find all fixtures that source their team from this match
    const dependents = WC_KNOCKOUT_FIXTURES.filter(f =>
      (f.homeSource && f.homeSource.type === 'winner' && f.homeSource.matchId === matchId) ||
      (f.awaySource && f.awaySource.type === 'winner' && f.awaySource.matchId === matchId)
    );
    dependents.forEach(f => {
      if (bracketPicks[f.id]) {
        delete bracketPicks[f.id];
        clearDownstreamPicks(f.id);
      }
    });
  }

  function saveBracketPicks() {
    if (currentUser) {
      localStorage.setItem('bracketPicks_' + currentUser.uid, JSON.stringify(bracketPicks));
    }
  }

  // ─── Render Knockout Bracket ─────────────────────────────────────────────────
  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;

    if (!authResolved || !currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view and fill in your knockout predictions.</p><button class="btn btn-primary pred-standings-signin-btn">Sign In to Predict</button></div>`;
      container.querySelector('.pred-standings-signin-btn')?.addEventListener('click', openModal);
      return;
    }

    const rounds = [
      { label: 'Round of 32',   ids: ['r32-1','r32-2','r32-3','r32-4','r32-5','r32-6','r32-7','r32-8','r32-9','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'] },
      { label: 'Round of 16',   ids: ['r16-1','r16-2','r16-3','r16-4','r16-5','r16-6','r16-7','r16-8'] },
      { label: 'Quarterfinals', ids: ['qf-1','qf-2','qf-3','qf-4'] },
      { label: 'Semifinals',    ids: ['sf-1','sf-2'] },
      { label: 'Final',         ids: ['final'] },
    ];

    container.innerHTML = '';

    // Header row with progress info
    const totalPicks = Object.keys(bracketPicks).length;
    const totalMatches = 31; // R32(16) + R16(8) + QF(4) + SF(2) + F(1)
    const pct = Math.round((totalPicks / totalMatches) * 100);

    const header = document.createElement('div');
    header.className = 'bracket-header';
    header.innerHTML = `
      <div class="bracket-progress">
        <span class="bracket-progress-label">Bracket completion: <strong>${totalPicks}/${totalMatches} picks (${pct}%)</strong></span>
        <div class="bracket-progress-bar"><div class="bracket-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bracket-actions">
        <button class="btn btn-ghost btn-sm" id="bracket-seed-results" title="Auto-fill R32 teams from actual match results where available">Seed from Results</button>
        <button class="btn btn-ghost btn-sm" id="bracket-reset-all">Reset All</button>
      </div>`;
    container.appendChild(header);

    header.querySelector('#bracket-reset-all').addEventListener('click', () => {
      bracketPicks = {};
      saveBracketPicks();
      renderKnockoutBracket();
    });

    // "Seed from Results" — populate R32 team labels from actual standings
    // when all group matches for a given group are complete. This doesn't make
    // any bracket picks; it just ensures real team names show in the R32 slots
    // by triggering a re-render (resolveKnockoutTeam already prefers actual
    // results). Shows a brief confirmation with how many groups were seeded.
    header.querySelector('#bracket-seed-results').addEventListener('click', () => {
      let seededGroups = 0;
      WC_GROUPS.forEach(group => {
        const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
        const complete = groupMatches.every(m =>
          m.homeScore !== undefined && m.homeScore !== null &&
          m.awayScore !== undefined && m.awayScore !== null
        );
        if (complete) seededGroups++;
      });
      renderKnockoutBracket();
      // Brief toast-style feedback
      const btn = document.getElementById('bracket-seed-results');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = seededGroups > 0
          ? `✓ ${seededGroups} group${seededGroups > 1 ? 's' : ''} seeded`
          : '✗ No complete groups yet';
        btn.disabled = true;
        setTimeout(() => { if (btn) { btn.textContent = orig; btn.disabled = false; } }, 2500);
      }
    });

    // Bracket scroll wrapper
    const scroll = document.createElement('div');
    scroll.className = 'bracket-scroll';
    container.appendChild(scroll);

    const bracketEl = document.createElement('div');
    bracketEl.className = 'bracket';
    scroll.appendChild(bracketEl);

    rounds.forEach((round, roundIdx) => {
      const col = document.createElement('div');
      col.className = 'bracket-round';

      const roundHeader = document.createElement('div');
      roundHeader.className = 'bracket-round-label';
      roundHeader.innerHTML = `
        <span>${round.label}</span>
        ${roundIdx > 0 ? `<button class="bracket-reset-round btn-xs" data-round="${roundIdx}" title="Reset this round and beyond">↺</button>` : ''}
      `;
      col.appendChild(roundHeader);

      if (roundIdx > 0) {
        const resetBtn = roundHeader.querySelector('.bracket-reset-round');
        resetBtn && resetBtn.addEventListener('click', () => {
          // Clear picks from this round onward
          const roundsToReset = rounds.slice(roundIdx);
          roundsToReset.forEach(r => r.ids.forEach(id => delete bracketPicks[id]));
          saveBracketPicks();
          renderKnockoutBracket();
        });
      }

      const matchesEl = document.createElement('div');
      matchesEl.className = 'bracket-matches';
      col.appendChild(matchesEl);

      round.ids.forEach(matchId => {
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;

        const homeTeam = resolveKnockoutTeam(fixture.homeSource, fixture);
        const awayTeam = resolveKnockoutTeam(fixture.awaySource, fixture);
        const pick = bracketPicks[matchId]; // 'home' | 'away' | undefined

        const matchEl = document.createElement('div');
        matchEl.className = 'bracket-match';
        matchEl.dataset.matchId = matchId;

        // Determine if teams are TBD (not yet resolvable)
        const homeTBD = homeTeam.name === '?' || homeTeam.name.startsWith('Best 3rd') || homeTeam.name.startsWith('W ');
        const awayTBD = awayTeam.name === '?' || awayTeam.name.startsWith('Best 3rd') || awayTeam.name.startsWith('W ');

        const homePickedClass = pick === 'home' ? ' bracket-team--picked' : (pick === 'away' ? ' bracket-team--eliminated' : '');
        const awayPickedClass = pick === 'away' ? ' bracket-team--picked' : (pick === 'home' ? ' bracket-team--eliminated' : '');

        matchEl.innerHTML = `
          <button class="bracket-team bracket-team--home${homePickedClass}${homeTBD ? ' bracket-team--tbd' : ''}" data-side="home" ${homeTBD ? 'disabled' : ''} aria-label="Pick ${homeTeam.name}">
            <span class="bracket-flag">${homeTeam.flag}</span>
            <span class="bracket-name">${homeTeam.name}</span>
            ${pick === 'home' ? '<span class="bracket-check">✓</span>' : ''}
          </button>
          <div class="bracket-vs">vs</div>
          <button class="bracket-team bracket-team--away${awayPickedClass}${awayTBD ? ' bracket-team--tbd' : ''}" data-side="away" ${awayTBD ? 'disabled' : ''} aria-label="Pick ${awayTeam.name}">
            <span class="bracket-flag">${awayTeam.flag}</span>
            <span class="bracket-name">${awayTeam.name}</span>
            ${pick === 'away' ? '<span class="bracket-check">✓</span>' : ''}
          </button>
          ${fixture.date ? `<div class="bracket-date">${formatDate(fixture.date)}</div>` : ''}
        `;

        // Click handlers for team buttons
        matchEl.querySelectorAll('.bracket-team').forEach(btn => {
          btn.addEventListener('click', () => {
            const side = btn.dataset.side;
            if (bracketPicks[matchId] === side) {
              // Toggle off — also clear downstream
              delete bracketPicks[matchId];
            } else {
              bracketPicks[matchId] = side;
            }
            clearDownstreamPicks(matchId);
            saveBracketPicks();
            renderKnockoutBracket();
          });
        });

        matchesEl.appendChild(matchEl);
      });

      bracketEl.appendChild(col);
    });

    // ── Champion display ──────────────────────────────────────────────────────
    const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === 'final');
    const finalPick = bracketPicks['final'];
    let champion = null;
    if (finalFixture && finalPick) {
      const homeTeam = resolveKnockoutTeam(finalFixture.homeSource, finalFixture);
      const awayTeam = resolveKnockoutTeam(finalFixture.awaySource, finalFixture);
      champion = finalPick === 'home' ? homeTeam : awayTeam;
    }

    const champCol = document.createElement('div');
    champCol.className = 'bracket-round bracket-round--champion';
    champCol.innerHTML = `
      <div class="bracket-round-label"><span>Champion</span></div>
      <div class="bracket-champion">
        ${champion
          ? `<div class="bracket-champion-flag">${champion.flag}</div>
             <div class="bracket-champion-name">${champion.name}</div>
             <div class="bracket-champion-trophy">🏆</div>`
          : `<div class="bracket-champion-empty">Pick your champion</div>`
        }
      </div>`;
    bracketEl.appendChild(champCol);
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
      container.appendChild(buildStandingsCard(group.id, teams));
    });
  }

  // ─── Render Prediction Accuracy ───────────────────────────────────────────────
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

  // ─── Calc Predicted Points ────────────────────────────────────────────────────
  function calcPredPoints(matches, teamName) {
    let pts = 0, gf = 0, ga = 0, w = 0, d = 0, l = 0;
    matches.forEach(m => {
      const isHome = m.home.name === teamName;
      const isAway = m.away.name === teamName;
      if (!isHome && !isAway) return;
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred === undefined || pred.awayScorePred === undefined) return;
      const ts = isHome ? pred.homeScorePred : pred.awayScorePred;
      const os = isHome ? pred.awayScorePred : pred.homeScorePred;
      gf += ts; ga += os;
      if (ts > os)       { pts += 3; w++; }
      else if (ts === os){ pts += 1; d++; }
      else               { l++; }
    });
    return { pts, gf, ga, gd: gf - ga, w, d, l };
  }

  // ─── Render Predicted Group Standings ─────────────────────────────────────────
  function renderPredGroupStandings() {
    const container = document.getElementById('pred-group-standings-container');
    if (!container) return;

    const authPrompt = document.getElementById('pred-group-standings-auth-prompt');
    if (!authResolved || !currentUser) {
      container.innerHTML = '';
      if (authPrompt) authPrompt.hidden = false;
      return;
    }
    if (authPrompt) authPrompt.hidden = true;

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'standings-grid';

    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcPredPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      grid.appendChild(buildStandingsCard(group.id, teams));
    });

    container.appendChild(grid);
  }

  // ─── getAllMatches ────────────────────────────────────────────────────────────
  function getAllMatches() {
    return [...WC_MATCHES];
  }

})();
