// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { auth } from './firebase.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions } from './db.js';

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────────
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

  // ─── stageKeyToLabel ────────────────────────────────────────────────────────
  function stageKeyToLabel(key) {
    if (!key) return '';
    if (/^[A-Za-z]{1,2}$/.test(key)) return 'Group ' + key.toUpperCase();
    return key;
  }

  // ─── State ──────────────────────────────────────────────────────────────────
  let currentUser = null;
  let authResolved = false;
  let firstAuthFire = true;
  let userPredictions = {};
  let authMode = 'signin';
  let unsubscribeMatches = null;
  let activepredSubtab = 'my-picks';

  // Bracket picks: { matchId: 'home' | 'away' }
  let bracketPicks = {};

  // ─── Theme ──────────────────────────────────────────────────────────────────
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

  // ─── Navigation ─────────────────────────────────────────────────────────────
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

  // ─── Predictions Sub-Tabs ───────────────────────────────────────────────────
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activepredSubtab = tab.dataset.subtab;
      document.querySelectorAll('.sub-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.sub-tab-panel').forEach(p => {
        const isActive = p.id === 'subtab-' + activepredSubtab;
        p.classList.toggle('active', isActive);
        p.hidden = !isActive;
      });
      if (activepredSubtab === 'my-picks')             renderPredictions();
      if (activepredSubtab === 'pred-bracket')         renderKnockoutBracket();
      if (activepredSubtab === 'pred-standings')       renderPredStandings();
      if (activepredSubtab === 'pred-group-standings') renderPredGroupStandings();
    });
  });

  // ─── Auth State ─────────────────────────────────────────────────────────────
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
  document.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));

  authForm.addEventListener('submit', async e => {
    e.preventDefault();
    authError.textContent = '';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    authSubmit.disabled = true;
    try {
      if (authMode === 'signup') {
        const name = authNameInput.value.trim();
        if (!name) { authError.textContent = 'Please enter your name.'; return; }
        await signUp(email, password, name);
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

  signOutBtn.addEventListener('click', async () => {
    await logOut();
  });

  // ─── Watch Auth ─────────────────────────────────────────────────────────────
  watchAuth(async (user) => {
    currentUser = user;
    authResolved = true;

    if (user) {
      authBtn.hidden = true;
      userBar.hidden = false;
      userGreeting.textContent = 'Hi, ' + (user.displayName || user.email);
      userPredictions = await getUserPredictions(user.uid);
    } else {
      authBtn.hidden = false;
      userBar.hidden = true;
      userPredictions = {};
    }

    if (firstAuthFire) {
      firstAuthFire = false;
      startMatchListener();
    } else {
      renderAll();
    }
  });

  // ─── Match Listener ──────────────────────────────────────────────────────────
  function startMatchListener() {
    if (unsubscribeMatches) unsubscribeMatches();
    unsubscribeMatches = watchMatches((matches) => {
      // Merge live match data into WC_MATCHES
      matches.forEach(m => {
        const match = WC_MATCHES.find(wm => wm.id === m.id);
        if (match) {
          match.homeScore = m.homeScore;
          match.awayScore = m.awayScore;
          match.status    = m.status;
        }
      });
      renderAll();
    });
  }

  // ─── Render All ─────────────────────────────────────────────────────────────
  function renderAll() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;
    const viewId = activeView.id;
    if (viewId === 'view-schedule')    renderSchedule();
    if (viewId === 'view-standings')   renderStandings();
    if (viewId === 'view-predictions') {
      renderPredictions();
      renderKnockoutBracket();
      renderPredStandings();
      renderPredGroupStandings();
    }
  }

  // ─── Schedule ───────────────────────────────────────────────────────────────
  function renderSchedule() {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);

    // Group matches by stage
    const byStage = {};
    WC_MATCHES.forEach(m => {
      const key = m.stage || 'Group';
      if (!byStage[key]) byStage[key] = [];
      byStage[key].push(m);
    });

    let html = '';
    Object.entries(byStage).forEach(([stage, matches]) => {
      html += `<div class="stage-section">
        <h2 class="stage-heading">${stageKeyToLabel(stage)}</h2>
        <div class="match-list">`;
      matches.forEach(m => {
        const hasResult = m.homeScore !== undefined && m.homeScore !== null;
        const scoreHtml = hasResult
          ? `<span class="score">${m.homeScore} – ${m.awayScore}</span>`
          : `<span class="score tbd">vs</span>`;
        const adminHtml = isAdmin ? `
          <div class="score-entry" data-match="${m.id}">
            <input type="number" class="score-input home-score" placeholder="H" min="0" max="20" value="${hasResult ? m.homeScore : ''}">
            <span>–</span>
            <input type="number" class="score-input away-score" placeholder="A" min="0" max="20" value="${hasResult ? m.awayScore : ''}">
            <button class="save-score-btn" data-match="${m.id}">Save</button>
          </div>` : '';
        html += `
          <div class="match-card ${hasResult ? 'has-result' : ''}">
            <div class="match-meta">${m.date || ''} · ${stageKeyToLabel(m.stage || m.group || '')}</div>
            <div class="match-teams">
              <span class="team home">${m.homeFlag || ''} ${m.home}</span>
              ${scoreHtml}
              <span class="team away">${m.away} ${m.awayFlag || ''}</span>
            </div>
            ${adminHtml}
          </div>`;
      });
      html += `</div></div>`;
    });

    container.innerHTML = html;

    // Admin save listeners
    if (isAdmin) {
      container.querySelectorAll('.save-score-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const matchId = btn.dataset.match;
          const entry = container.querySelector(`.score-entry[data-match="${matchId}"]`);
          const home = parseInt(entry.querySelector('.home-score').value);
          const away = parseInt(entry.querySelector('.away-score').value);
          if (isNaN(home) || isNaN(away)) return;
          btn.disabled = true;
          btn.textContent = 'Saving…';
          try {
            await savePrediction(currentUser.uid, matchId, { homeScore: home, awayScore: away, isResult: true });
            btn.textContent = 'Saved!';
          } catch (e) {
            btn.textContent = 'Error';
          } finally {
            setTimeout(() => { btn.disabled = false; btn.textContent = 'Save'; }, 1500);
          }
        });
      });
    }
  }

  // ─── Standings ──────────────────────────────────────────────────────────────
  function calcActualPoints(matches, teamName) {
    let pts = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      if (m.homeScore === undefined || m.homeScore === null) return;
      const isHome = m.home === teamName;
      const isAway = m.away === teamName;
      if (!isHome && !isAway) return;
      const tg = isHome ? m.homeScore : m.awayScore;
      const og = isHome ? m.awayScore : m.homeScore;
      gf += tg; ga += og;
      if (tg > og) { pts += 3; w++; }
      else if (tg === og) { pts += 1; d++; }
      else { l++; }
    });
    return { pts, w, d, l, gf, ga, gd: gf - ga };
  }

  function renderStandings() {
    const container = document.getElementById('standings-container');
    if (!container) return;

    let html = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcActualPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      html += `<div class="group-table">
        <h3>Group ${group.id}</h3>
        <table>
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>`;
      teams.forEach((t, i) => {
        const qual = i < 2 ? 'qualified' : '';
        html += `<tr class="${qual}">
          <td>${t.flag || ''} ${t.name}</td>
          <td>${t.w + t.d + t.l}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
          <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td><td>${t.pts}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    container.innerHTML = html;
  }

  // ─── Predictions ────────────────────────────────────────────────────────────
  function calcPredPoints(matches, teamName) {
    let pts = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred === undefined) return;
      const isHome = m.home === teamName;
      const isAway = m.away === teamName;
      if (!isHome && !isAway) return;
      const tg = isHome ? pred.homeScorePred : pred.awayScorePred;
      const og = isHome ? pred.awayScorePred : pred.homeScorePred;
      gf += tg; ga += og;
      if (tg > og) { pts += 3; w++; }
      else if (tg === og) { pts += 1; d++; }
      else { l++; }
    });
    return { pts, w, d, l, gf, ga, gd: gf - ga };
  }

  function renderPredictions() {
    const container = document.getElementById('predictions-container');
    if (!container) return;

    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt">
        <p>Sign in to save your match predictions.</p>
        <button class="btn btn-primary" id="predict-signin-btn">Sign In</button>
      </div>`;
      const btn = container.querySelector('#predict-signin-btn');
      if (btn) btn.addEventListener('click', openModal);
      return;
    }

    const byGroup = {};
    WC_MATCHES.forEach(m => {
      if (!m.group) return;
      if (!byGroup[m.group]) byGroup[m.group] = [];
      byGroup[m.group].push(m);
    });

    let html = '';
    Object.entries(byGroup).forEach(([group, matches]) => {
      html += `<div class="pred-group"><h3>Group ${group}</h3><div class="pred-match-list">`;
      matches.forEach(m => {
        const pred = userPredictions[m.id] || {};
        const hVal = pred.homeScorePred !== undefined ? pred.homeScorePred : '';
        const aVal = pred.awayScorePred !== undefined ? pred.awayScorePred : '';
        const saved = pred.homeScorePred !== undefined;
        html += `
          <div class="pred-match-card ${saved ? 'saved' : ''}" data-match="${m.id}">
            <div class="pred-match-meta">${m.date || ''}</div>
            <div class="pred-match-row">
              <span class="pred-team home">${m.homeFlag || ''} ${m.home}</span>
              <input type="number" class="pred-input home-pred" min="0" max="20" value="${hVal}" placeholder="0">
              <span class="pred-sep">–</span>
              <input type="number" class="pred-input away-pred" min="0" max="20" value="${aVal}" placeholder="0">
              <span class="pred-team away">${m.away} ${m.awayFlag || ''}</span>
            </div>
            <button class="pred-save-btn" data-match="${m.id}">${saved ? 'Update' : 'Save'}</button>
          </div>`;
      });
      html += `</div></div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.pred-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId = btn.dataset.match;
        const card = container.querySelector(`.pred-match-card[data-match="${matchId}"]`);
        const home = parseInt(card.querySelector('.home-pred').value);
        const away = parseInt(card.querySelector('.away-pred').value);
        if (isNaN(home) || isNaN(away)) return;
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await savePrediction(currentUser.uid, matchId, { homeScorePred: home, awayScorePred: away });
          userPredictions[matchId] = { ...userPredictions[matchId], homeScorePred: home, awayScorePred: away };
          btn.textContent = 'Saved!';
          card.classList.add('saved');
          setTimeout(() => { btn.textContent = 'Update'; btn.disabled = false; }, 1000);
          renderKnockoutBracket();
        } catch (e) {
          btn.textContent = 'Error';
          btn.disabled = false;
        }
      });
    });
  }

  // ─── Predicted Group Standings ───────────────────────────────────────────────
  function renderPredGroupStandings() {
    const container = document.getElementById('pred-group-standings-container');
    if (!container) return;

    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt">
        <p>Sign in to view your predicted group standings.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button>
      </div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }

    let html = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teams = group.teams.map(t => ({
        ...t,
        ...calcPredPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      html += `<div class="group-table">
        <h3>Group ${group.id}</h3>
        <table>
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>`;
      teams.forEach((t, i) => {
        const qual = i < 2 ? 'qualified' : '';
        html += `<tr class="${qual}">
          <td>${t.flag || ''} ${t.name}</td>
          <td>${t.w + t.d + t.l}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
          <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td><td>${t.pts}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    container.innerHTML = html;
  }

  // ─── Knockout Bracket ────────────────────────────────────────────────────────

  // Get actual group finisher from recorded match results
  function getActualGroupFinisher(groupId, pos) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    const allDone = groupMatches.length > 0 &&
      groupMatches.every(m => m.homeScore !== undefined && m.homeScore !== null);
    if (!allDone) return null;
    const teams = group.teams.map(t => ({
      ...t,
      ...calcActualPoints(groupMatches, t.name)
    })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (teams[pos]) return { name: teams[pos].name, flag: teams[pos].flag };
    return null;
  }

  // Get the predicted group winner (pos=0) or runner-up (pos=1) from user's
  // score predictions. Returns null if the user hasn't predicted at least one
  // match in this group yet — otherwise all teams tie at 0 pts and the sort
  // order is arbitrary, showing a misleading team in the bracket.
  function getPredictedGroupFinisher(groupId, pos) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const groupMatches = WC_MATCHES.filter(m => m.group === groupId);
    const hasPredictions = groupMatches.some(m => {
      const pred = userPredictions[m.id];
      return pred && pred.homeScorePred !== undefined && pred.awayScorePred !== undefined;
    });
    if (!hasPredictions) return null;
    const teams = group.teams.map(t => ({
      ...t,
      ...calcPredPoints(groupMatches, t.name)
    })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (teams[pos]) return { name: teams[pos].name, flag: teams[pos].flag };
    return null;
  }

  function resolveKnockoutTeam(source) {
    if (!source) return null;
    if (source.type === 'group') {
      return getActualGroupFinisher(source.groupId, source.pos)
          || getPredictedGroupFinisher(source.groupId, source.pos)
          || null;
    }
    if (source.type === 'winner') {
      const match = WC_KNOCKOUT_FIXTURES.find(f => f.id === source.matchId);
      if (!match) return null;
      const pick = bracketPicks[source.matchId];
      if (!pick) return null;
      const homeTeam = resolveKnockoutTeam(match.home);
      const awayTeam = resolveKnockoutTeam(match.away);
      return pick === 'home' ? homeTeam : awayTeam;
    }
    return null;
  }

  function teamLabel(source, resolved) {
    if (resolved) return `${resolved.flag || ''} ${resolved.name}`;
    if (!source) return '?';
    if (source.type === 'group') return `${source.pos === 0 ? '1' : '2'}${source.groupId}`;
    if (source.type === 'winner') return `W${source.matchId}`;
    return '?';
  }

  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;

    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt">
        <p>Sign in to view your predicted bracket.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button>
      </div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }

    const stages = [...new Set(WC_KNOCKOUT_FIXTURES.map(f => f.stage))];
    let html = '<div class="bracket-scroll"><div class="bracket-stages">';

    stages.forEach(stage => {
      const fixtures = WC_KNOCKOUT_FIXTURES.filter(f => f.stage === stage);
      html += `<div class="bracket-stage">
        <div class="bracket-stage-label">${STAGE_LABELS[stage] || stage}</div>
        <div class="bracket-matches">`;

      fixtures.forEach(fixture => {
        const homeResolved = resolveKnockoutTeam(fixture.home);
        const awayResolved = resolveKnockoutTeam(fixture.away);
        const homeLabel = teamLabel(fixture.home, homeResolved);
        const awayLabel = teamLabel(fixture.away, awayResolved);
        const pick = bracketPicks[fixture.id];
        const homePicked = pick === 'home';
        const awayPicked = pick === 'away';
        const canPick = !!(homeResolved && awayResolved);

        html += `
          <div class="bracket-match" data-fixture="${fixture.id}">
            <div class="bracket-team ${homePicked ? 'picked' : ''} ${canPick ? 'pickable' : 'unknown'}"
                 data-fixture="${fixture.id}" data-side="home">
              ${homeLabel}
            </div>
            <div class="bracket-team ${awayPicked ? 'picked' : ''} ${canPick ? 'pickable' : 'unknown'}"
                 data-fixture="${fixture.id}" data-side="away">
              ${awayLabel}
            </div>
          </div>`;
      });

      html += `</div></div>`;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Pick listeners
    container.querySelectorAll('.bracket-team.pickable').forEach(el => {
      el.addEventListener('click', () => {
        const fixtureId = el.dataset.fixture;
        const side = el.dataset.side;
        bracketPicks[fixtureId] = side;
        renderKnockoutBracket();
      });
    });
  }

  // ─── Pred Standings ─────────────────────────────────────────────────────────
  function renderPredStandings() {
    const container = document.getElementById('pred-standings-container');
    if (!container) return;

    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt">
        <p>Sign in to view your predicted standings.</p>
        <button class="btn btn-primary pred-standings-signin-btn">Sign In</button>
      </div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }

    container.innerHTML = '<p class="muted">Predicted overall standings coming soon.</p>';
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  function init() {
    renderSchedule();
    renderStandings();
  }

  init();

  // expose for testing
  window._wc = {
    getMatches() { return [...WC_MATCHES]; }
  }

})();
