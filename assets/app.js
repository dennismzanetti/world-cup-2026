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
    // Fall back to static WC_MATCHES if Firestore matches collection is empty
    if (!matches || matches.length === 0) matches = WC_MATCHES.slice();
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
    if (authMode === 'signin') {
      authHeading.textContent = 'Sign In';
      authSubmit.textContent  = 'Sign In';
      authToggle.textContent  = 'Sign up';
      authToggle.previousSibling.textContent = "Don\u2019t have an account? ";
    } else {
      authHeading.textContent = 'Create Account';
      authSubmit.textContent  = 'Create Account';
      authToggle.textContent  = 'Sign in';
      authToggle.previousSibling.textContent = 'Already have an account? ';
    }
  });

  document.getElementById('predict-signin-btn')?.addEventListener('click', openModal);
  document.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));

  document.getElementById('auth-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    authError?.setAttribute('hidden', '');
    authSubmit.disabled = true;
    authSubmit.textContent = 'Please wait\u2026';
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
      if (authError) {
        authError.textContent = err.message || 'Authentication failed.';
        authError.removeAttribute('hidden');
      }
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
    }
  });

  // ─── Theme toggle ─────────────────────────────────────────────────────────
  (function () {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root   = document.documentElement;
    let theme = root.getAttribute('data-theme') || 'dark';

    function applyTheme(t) {
      root.setAttribute('data-theme', t);
      theme = t;
      if (toggle) {
        toggle.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
        toggle.innerHTML = theme === 'dark'
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }

    applyTheme(theme);
    toggle?.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));
  })();

  // ─── Filter setup ─────────────────────────────────────────────────────────
  const matchFilters = { group: 'all', date: 'all', search: '' };
  const predFilters  = { group: 'all', status: 'all' };

  function populateMatchFilters() {
    const sel = document.getElementById('match-group-filter');
    if (sel) {
      WC_GROUPS.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = `Group ${g.id}`;
        sel.appendChild(opt);
      });
    }
    const dateSel = document.getElementById('match-date-filter');
    if (dateSel) {
      const dates = [...new Set(WC_MATCHES.map(m => m.date))].sort();
      dates.forEach(d => {
        const opt = document.createElement('option');
        const dt = new Date(d + 'T12:00:00');
        opt.value = d;
        opt.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateSel.appendChild(opt);
      });
    }
    const venueSel = document.getElementById('match-venue-filter');
    if (venueSel) {
      const venues = [...new Set(WC_MATCHES.map(m => m.venue).filter(Boolean))].sort();
      venues.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        venueSel.appendChild(opt);
      });
    }
  }

  function populatePredFilters() {
    const sel = document.getElementById('pred-group-filter');
    if (sel) {
      WC_GROUPS.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = `Group ${g.id}`;
        sel.appendChild(opt);
      });
    }
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
    const rows = teams.map(t => ({ team: t, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }));
    const rowOf = name => rows.find(r => teamName(r.team) === teamName(name));
    matches.forEach(m => {
      if (m.homeScore == null || m.awayScore == null) return;
      const h = rowOf(m.home), a = rowOf(m.away);
      if (!h || !a) return;
      h.played++; a.played++;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore)      { h.w++; h.pts += 3; a.l++; }
      else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
      else                                { h.d++; h.pts++; a.d++; a.pts++; }
    });
    rows.forEach(r => r.gd = r.gf - r.ga);
    return rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
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
    if (!matches.length) {
      container.innerHTML = '<div class="empty-filter-msg">No matches to show.</div>';
      return;
    }
    const byDate = {};
    matches.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    container.innerHTML = '';
    document.getElementById('pred-filters')?.removeAttribute('hidden');
    Object.keys(byDate).sort().forEach(date => {
      const section = document.createElement('div');
      section.className = 'pred-date-section';
      const d = new Date(date + 'T12:00:00');
      section.innerHTML = `<h3 class="pred-date-header">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h3>`;
      byDate[date].forEach(m => {
        const pred = userPredictions[m.id] || {};
        const played = m.homeScore != null;
        const card = document.createElement('div');
        card.className = 'pred-card' + (played ? ' pred-played' : '');
        card.innerHTML = `
          <div class="pred-match-header">
            <span class="pred-group-badge">Group ${m.group}</span>
            <span class="pred-time">${m.timeLocal} ${m.tz} &bull; ${m.venue}</span>
          </div>
          <div class="pred-teams">
            <div class="pred-team pred-team--home">
              <span class="pred-flag">${teamFlag(m.home)}</span>
              <span class="pred-name">${teamName(m.home)}</span>
            </div>
            <div class="pred-score-inputs">
              <input type="number" class="pred-score-input" min="0" max="30"
                placeholder="-" value="${pred.homeScorePred ?? ''}"
                data-match-id="${m.id}" data-field="home"
                ${played ? 'disabled' : ''} />
              <span class="pred-sep">&#8211;</span>
              <input type="number" class="pred-score-input" min="0" max="30"
                placeholder="-" value="${pred.awayScorePred ?? ''}"
                data-match-id="${m.id}" data-field="away"
                ${played ? 'disabled' : ''} />
            </div>
            <div class="pred-team pred-team--away">
              <span class="pred-name">${teamName(m.away)}</span>
              <span class="pred-flag">${teamFlag(m.away)}</span>
            </div>
          </div>
          ${played ? `<div class="pred-actual-result">Result: ${m.homeScore} \u2013 ${m.awayScore}</div>` : ''}`;
        if (!played) {
          card.querySelectorAll('.pred-score-input').forEach(input => {
            input.addEventListener('change', () => {
              const homeInput = card.querySelector('[data-field="home"]');
              const awayInput = card.querySelector('[data-field="away"]');
              const hv = homeInput?.value;
              const av = awayInput?.value;
              if (hv !== '' && av !== '') {
                savePrediction(currentUser.uid, m.id, {
                  homeScorePred: parseInt(hv),
                  awayScorePred: parseInt(av)
                }).then(() => {
                  if (!userPredictions[m.id]) userPredictions[m.id] = {};
                  userPredictions[m.id].homeScorePred = parseInt(hv);
                  userPredictions[m.id].awayScorePred = parseInt(av);
                }).catch(err => console.error('savePrediction failed', err));
              }
            });
          });
        }
        section.appendChild(card);
      });
      container.appendChild(section);
    });
  }

  // ─── Predictions: Group Standings ─────────────────────────────────────────
  function renderPredGroupStandings() {
    const container = document.getElementById('pred-group-standings-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to see your predicted standings.</p>
        <button class="btn btn-primary pred-signin-btn">Sign In</button></div>`;
      container.querySelector('.pred-signin-btn')?.addEventListener('click', openModal);
      return;
    }
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      // Build pseudo-matches using user's predicted scores
      const gm = liveMatches
        .filter(m => m.group === group.id)
        .map(m => {
          const pred = userPredictions[m.id] || {};
          return {
            ...m,
            homeScore: pred.homeScorePred ?? m.homeScore,
            awayScore: pred.awayScorePred ?? m.awayScore
          };
        });
      const standings = calcPoints(group.teams, gm);
      const card = document.createElement('div');
      card.className = 'pred-group-card';
      card.innerHTML = `
        <h3 class="pred-group-title">Group ${group.id}</h3>
        <table class="pred-group-table">
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${standings.map((row, i) => `
            <tr class="${i < 2 ? 'pred-qualify' : 'pred-eliminated'}">
              <td><span>${row.team.flag}</span> ${row.team.name}</td>
              <td>${row.played}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td>
              <td>${row.gd > 0 ? '+' : ''}${row.gd}</td>
              <td><strong>${row.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Predictions: Accuracy / Leaderboard ──────────────────────────────────
  function renderPredStandings() {
    const container = document.getElementById('pred-standings-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to see the leaderboard.</p>
        <button class="btn btn-primary pred-signin-btn">Sign In</button></div>`;
      container.querySelector('.pred-signin-btn')?.addEventListener('click', openModal);
      return;
    }
    const played = liveMatches.filter(m => m.homeScore != null && m.awayScore != null);
    if (!played.length) {
      container.innerHTML = `<div class="empty-state"><p>Accuracy stats will appear once matches are played.</p></div>`;
      return;
    }
    let exact = 0, correct = 0, total = played.length;
    played.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred) return;
      const predHome = pred.homeScorePred, predAway = pred.awayScorePred;
      if (predHome == null || predAway == null) return;
      if (predHome === m.homeScore && predAway === m.awayScore) { exact++; correct++; }
      else {
        const actualWinner = m.homeScore > m.awayScore ? 'home' : m.awayScore > m.homeScore ? 'away' : 'draw';
        const predWinner   = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
        if (actualWinner === predWinner) correct++;
      }
    });
    container.innerHTML = `
      <div class="accuracy-banner">
        <div class="accuracy-stat">
          <span class="accuracy-num">${correct}</span>
          <span class="accuracy-label">Correct Results</span>
        </div>
        <div class="accuracy-stat">
          <span class="accuracy-num">${exact}</span>
          <span class="accuracy-label">Exact Scores</span>
        </div>
        <div class="accuracy-stat">
          <span class="accuracy-num">${total > 0 ? Math.round(correct / total * 100) : 0}%</span>
          <span class="accuracy-label">Accuracy</span>
        </div>
        <div class="accuracy-stat">
          <span class="accuracy-num">${total}</span>
          <span class="accuracy-label">Matches Played</span>
        </div>
      </div>
      <div class="accuracy-breakdown">
        ${played.map(m => {
          const pred = userPredictions[m.id] || {};
          const hasPred = pred.homeScorePred != null && pred.awayScorePred != null;
          const actualWinner = m.homeScore > m.awayScore ? 'home' : m.awayScore > m.homeScore ? 'away' : 'draw';
          const predWinner   = (pred.homeScorePred || 0) > (pred.awayScorePred || 0) ? 'home' :
                               (pred.awayScorePred || 0) > (pred.homeScorePred || 0) ? 'away' : 'draw';
          const isExact   = hasPred && pred.homeScorePred === m.homeScore && pred.awayScorePred === m.awayScore;
          const isCorrect = hasPred && actualWinner === predWinner;
          return `<div class="accuracy-row ${isExact ? 'exact' : isCorrect ? 'correct' : hasPred ? 'wrong' : 'no-pred'}">
            <span class="acc-teams">${teamDisplay(m.home)} v ${teamDisplay(m.away)}</span>
            <span class="acc-result">Result: ${m.homeScore}\u2013${m.awayScore}</span>
            <span class="acc-pred">${hasPred ? `Pred: ${pred.homeScorePred}\u2013${pred.awayScorePred}` : 'No pick'}</span>
            <span class="acc-badge">${isExact ? '\u2605 Exact' : isCorrect ? '\u2713 Correct' : hasPred ? '\u2715 Wrong' : '\u2014'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  // ─── Knockout Bracket ─────────────────────────────────────────────────────
  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view your predicted bracket.</p>
        <button class="btn btn-primary pred-signin-btn">Sign In</button></div>`;
      container.querySelector('.pred-signin-btn')?.addEventListener('click', openModal);
      return;
    }

    const rounds = [
      { id: 'r32',    label: 'Round of 32',   matches: WC_KNOCKOUT_FIXTURES.filter(m => m.round === 'r32') },
      { id: 'r16',    label: 'Round of 16',   matches: WC_KNOCKOUT_FIXTURES.filter(m => m.round === 'r16') },
      { id: 'qf',     label: 'Quarter-Finals', matches: WC_KNOCKOUT_FIXTURES.filter(m => m.round === 'qf') },
      { id: 'sf',     label: 'Semi-Finals',    matches: WC_KNOCKOUT_FIXTURES.filter(m => m.round === 'sf') },
      { id: 'final',  label: 'Final',          matches: WC_KNOCKOUT_FIXTURES.filter(m => m.round === 'final') },
    ];

    const accuracy = (() => {
      let correct = 0, total = 0;
      rounds.forEach(r => {
        r.matches.forEach(m => {
          const actual = liveMatches.find(lm => lm.id === m.id);
          if (!actual || actual.homeScore == null) return;
          total++;
          const pick = bracketPicks[m.id];
          if (!pick) return;
          const winner = actual.homeScore > actual.awayScore ? 'home' : 'away';
          if (pick === winner) correct++;
        });
      });
      return { correct, total };
    })();

    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'bracket-accuracy-banner';
    banner.innerHTML = `
      <div class="bab-stat">
        <span class="bab-num">${accuracy.correct}</span>
        <span class="bab-label">Correct Picks</span>
      </div>
      <div class="bab-stat">
        <span class="bab-num">${accuracy.total}</span>
        <span class="bab-label">Decided Matches</span>
      </div>
      <div class="bab-stat">
        <span class="bab-num">${accuracy.total > 0 ? Math.round(accuracy.correct / accuracy.total * 100) : 0}%</span>
        <span class="bab-label">Accuracy</span>
      </div>`;
    container.appendChild(banner);

    const toolbar = document.createElement('div');
    toolbar.className = 'bracket-toolbar';
    toolbar.innerHTML = `
      <span class="bracket-toolbar-label">View:</span>
      ${['my','actual','overlay'].map(v => `
        <button class="btn btn-sm ${bracketView === v ? 'btn-primary' : 'btn-ghost'} bracket-view-btn" data-bview="${v}">
          ${v === 'my' ? 'My Picks' : v === 'actual' ? 'Actual' : 'Overlay'}
        </button>`).join('')}`;
    toolbar.querySelectorAll('.bracket-view-btn').forEach(btn => {
      btn.addEventListener('click', () => { bracketView = btn.dataset.bview; renderKnockoutBracket(); });
    });
    container.appendChild(toolbar);

    const bracket = document.createElement('div');
    bracket.className = 'bracket-scroll';
    const bracketInner = document.createElement('div');
    bracketInner.className = 'bracket-inner';

    rounds.forEach(round => {
      const col = document.createElement('div');
      col.className = 'bracket-round';
      const header = document.createElement('div');
      header.className = 'bracket-round-header';
      header.textContent = round.label;
      col.appendChild(header);

      round.matches.forEach(m => {
        const actual = liveMatches.find(lm => lm.id === m.id) || m;
        const pick   = bracketPicks[m.id];
        const played = actual.homeScore != null;
        const actualWinner = played
          ? (actual.homeScore > actual.awayScore ? 'home' : 'away')
          : null;
        const pickCorrect = pick && actualWinner && pick === actualWinner;
        const pickWrong   = pick && actualWinner && pick !== actualWinner;

        const matchBox = document.createElement('div');
        matchBox.className = 'bracket-match';

        if (bracketView === 'my') {
          // Show only the user's picks
          ['home','away'].forEach(side => {
            const row = document.createElement('div');
            row.className = `bracket-team ${pick === side ? 'bracket-team--picked' : ''}`;
            row.innerHTML = `
              <span class="bt-flag">${teamFlag(actual[side])}</span>
              <span class="bt-name">${teamName(actual[side]) || '?'}</span>
              ${pick === side ? '<span class="bt-pick-dot"></span>' : ''}`;
            matchBox.appendChild(row);
          });
        } else if (bracketView === 'actual') {
          // Show actual teams + result
          ['home','away'].forEach(side => {
            const row = document.createElement('div');
            row.className = `bracket-team ${played && actualWinner === side ? 'bracket-team--winner' : ''}`;
            row.innerHTML = `
              <span class="bt-flag">${teamFlag(actual[side])}</span>
              <span class="bt-name">${teamName(actual[side]) || '?'}</span>
              ${played ? `<span class="bt-score">${side === 'home' ? actual.homeScore : actual.awayScore}</span>` : ''}`;
            matchBox.appendChild(row);
          });
        } else {
          // Overlay: show both pick and actual with match indicators
          ['home','away'].forEach(side => {
            const row = document.createElement('div');
            const isWinner = played && actualWinner === side;
            const isPick   = pick === side;
            row.className = `bracket-team bracket-overlay-row
              ${isWinner ? 'bracket-team--winner' : ''}
              ${isPick && pickCorrect ? 'bracket-team--correct' : ''}
              ${isPick && pickWrong   ? 'bracket-team--wrong'   : ''}`;

            let badge = '';
            if (isPick && pickCorrect) badge = '<span class="bt-badge bt-badge--correct">✓</span>';
            else if (isPick && pickWrong) badge = '<span class="bt-badge bt-badge--wrong">✗</span>';
            else if (isPick) badge = '<span class="bt-badge bt-badge--pending">★</span>';

            row.innerHTML = `
              <span class="bt-flag">${teamFlag(actual[side])}</span>
              <span class="bt-name">${teamName(actual[side]) || '?'}</span>
              ${played ? `<span class="bt-score">${side === 'home' ? actual.homeScore : actual.awayScore}</span>` : ''}
              ${badge}`;

            if (!played && !pick) {
              row.addEventListener('click', () => {
                bracketPicks[m.id] = side;
                persistBracketPicks(); renderKnockoutBracket();
              });
              row.style.cursor = 'pointer';
              row.title = `Pick ${teamName(actual[side])}`;
            }
            matchBox.appendChild(row);
          });
        }

        if (!played && bracketView === 'overlay') {
          const clearBtn = document.createElement('button');
          clearBtn.className = 'bracket-clear-btn';
          clearBtn.textContent = '×';
          clearBtn.title = 'Clear pick';
          clearBtn.addEventListener('click', e => {
            e.stopPropagation();
            delete bracketPicks[m.id];
            persistBracketPicks(); renderKnockoutBracket();
          });
          matchBox.appendChild(clearBtn);
        }

        col.appendChild(matchBox);
      });

      bracketInner.appendChild(col);
    });

    // Champion display
    const champCol = document.createElement('div');
    champCol.className = 'bracket-round bracket-champ';
    champCol.innerHTML = '<div class="bracket-round-header">Champion</div>';
    const champCard = document.createElement('div');
    champCard.className = 'bracket-champ-card';
    const finalMatch = WC_KNOCKOUT_FIXTURES.find(m => m.round === 'final');
    const finalActual = finalMatch ? liveMatches.find(lm => lm.id === finalMatch.id) : null;
    const finalPick   = finalMatch ? bracketPicks[finalMatch.id] : null;

    if (finalActual && finalActual.homeScore != null) {
      const champSide = finalActual.homeScore > finalActual.awayScore ? 'home' : 'away';
      const actualChamp = finalActual[champSide];
      champCard.innerHTML = `
        <div class="champ-trophy">🏆</div>
        <div class="champ-flag">${teamFlag(actualChamp)}</div>
        <div class="champ-name">${teamName(actualChamp)}</div>
        <div class="champ-label">World Champion</div>`;
    } else if (finalPick && finalMatch) {
      const myChamp = finalMatch[finalPick];
      champCard.innerHTML = `
        <div class="champ-trophy">🏆</div>
        <div class="champ-flag">${teamFlag(myChamp)}</div>
        <div class="champ-name">${teamName(myChamp)}</div>
        <div class="champ-label">Your Pick</div>`;
    } else {
      champCard.innerHTML = `<div class="champ-tbd">TBD</div>`;
    }
    champCol.appendChild(champCard);
    bracketInner.appendChild(champCol);

    bracket.appendChild(bracketInner);
    container.appendChild(bracket);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost btn-sm bracket-reset-btn';
    resetBtn.textContent = 'Reset All Picks';
    resetBtn.addEventListener('click', () => {
      bracketPicks = {}; persistBracketPicks(); renderKnockoutBracket();
    });
    container.appendChild(resetBtn);

    if (bracketView === 'overlay' && !Object.keys(bracketPicks).length) {
      const hint = document.createElement('p');
      hint.className = 'bracket-hint';
      hint.textContent = 'Click a team in each match to make your bracket picks.';
      container.insertBefore(hint, bracket);
    }
  }

  function persistBracketPicks() {
    if (currentUser) saveBracketPicks(currentUser.uid, bracketPicks);
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
