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
    }

    if (!firstAuthFire) {
      const local = WC_MATCHES.find(
        m => m.homeScore !== undefined && m.homeScore !== null
      );
      if (local) {
        renderAll();
      } else {
        renderAll();
      }
    }
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
      opt.textContent = s.startsWith('Group') ? s : (STAGE_LABELS[s] || s);
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
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-header">Group ${group.id}</div>
        <table class="group-table">
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

        card.innerHTML = matchCardHTML(m, scoreCol, m.group || STAGE_LABELS[m.stage] || m.stage || '') + broadcast;

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
      'R32', 'R16', 'QF', 'SF', '3P', 'F'
    ];

    let anyStage = false;
    stageOrder.forEach(stageKey => {
      if (!byStage[stageKey]) return;
      anyStage = true;

      const section = document.createElement('div');
      section.className = 'pred-section';

      const heading = document.createElement('div');
      heading.className = 'date-divider';
      heading.textContent = stageKey.startsWith('Group') ? stageKey : (STAGE_LABELS[stageKey] || stageKey);
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

        card.innerHTML = matchCardHTML(dm, scoreCol, stageKey.startsWith('Group') ? stageKey : (STAGE_LABELS[stageKey] || stageKey));

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
          No knockout matches scheduled yet.<br>
          <span style="font-size:var(--text-xs);opacity:0.7">Bracket populates after the group stage.</span>
        </div>`;
    }
  }

  // ─── Render Knockout Bracket (Placeholder) ───────────────────────────────────
  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    if (!authResolved || !currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view and fill in your knockout predictions.</p><button class="btn btn-primary pred-standings-signin-btn">Sign In to Predict</button></div>`;
      container.querySelector('.pred-standings-signin-btn')?.addEventListener('click', openModal);
      return;
    }
    container.innerHTML = `<p class="bracket-intro">Knockout bracket predictions coming soon — will auto-populate from your Group Standings predictions.</p>`;
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
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ─── getAllMatches ────────────────────────────────────────────────────────────
  function getAllMatches() {
    return WC_MATCHES.concat(WC_KNOCKOUT_FIXTURES);
  }

})();
