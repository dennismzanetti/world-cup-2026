// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions, updateMatchResult, saveBracketPicks, getBracketPicks } from './db.js';

// ============================================================
// STATE
// ============================================================
let currentUser   = null;
let liveMatches   = WC_MATCHES.slice();
let userPreds     = {};   // { matchId: { home, away } }
let bracketPicks  = {};   // { fixtureId: teamName }
let bracketView   = 'overlay'; // 'predicted' | 'actual' | 'overlay'

// ============================================================
// HELPERS
// ============================================================
const $ = id => document.getElementById(id);

function stageKeyToLabel(key) {
  const map = {
    'group':         'Group Stage',
    'Round of 32':   'Round of 32',
    'Round of 16':   'Round of 16',
    'Quarter-Final': 'Quarter-Finals',
    'Semi-Final':    'Semi-Finals',
    'Final':         'Final',
    '3rd Place':     '3rd Place',
  };
  return map[key] || key;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

// ============================================================
// NAV
// ============================================================
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      const view = $('view-' + btn.dataset.view);
      if (view) view.classList.add('active');
      if (btn.dataset.view === 'predictions') renderPredictions();
      if (btn.dataset.view === 'standings')   renderStandings();
    });
  });
}

// Sub-tabs inside Predictions
function initSubTabs() {
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.sub-tab-panel').forEach(p => {
        p.classList.remove('active');
        p.hidden = true;
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = $(tab.dataset.subtab === 'my-picks'            ? 'subtab-my-picks'
                    : tab.dataset.subtab === 'pred-standings'       ? 'subtab-pred-standings'
                    : tab.dataset.subtab === 'pred-group-standings' ? 'subtab-pred-group-standings'
                    : 'subtab-pred-bracket');
      if (panel) { panel.classList.add('active'); panel.hidden = false; }
      if (tab.dataset.subtab === 'pred-standings')       renderPredStandings();
      if (tab.dataset.subtab === 'pred-group-standings') renderPredGroupStandings();
      if (tab.dataset.subtab === 'pred-bracket')         renderBracket();
    });
  });
}

// ============================================================
// AUTH UI
// ============================================================
function initAuth() {
  const backdrop  = $('auth-backdrop');
  const modal     = $('auth-modal');
  const openBtn   = $('auth-open-btn');
  const closeBtn  = $('auth-close-btn');
  const form      = $('auth-form');
  const submitBtn = $('auth-submit-btn');
  const toggleLink= $('auth-toggle-link');
  const errorEl   = $('auth-error');
  let   isSignUp  = false;

  function openModal() { backdrop.hidden = false; modal.hidden = false; }
  function closeModal() { backdrop.hidden = true;  modal.hidden = true; errorEl.hidden = true; }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  $('predict-signin-btn')?.addEventListener('click', openModal);
  document.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));

  toggleLink.addEventListener('click', e => {
    e.preventDefault();
    isSignUp = !isSignUp;
    $('sign-in-form').hidden = isSignUp;
    $('sign-up-form').hidden = !isSignUp;
    submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
    toggleLink.textContent = isSignUp ? 'Sign in' : 'Sign up';
    document.querySelector('.auth-toggle-text').firstChild.textContent =
      isSignUp ? 'Already have an account? ' : "Don\u2019t have an account? ";
    errorEl.hidden = true;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    try {
      if (isSignUp) {
        const name = $('signup-name').value.trim();
        const email = $('signup-email').value.trim();
        const pw    = $('signup-password').value;
        await signUp(email, pw, name);
      } else {
        const email = $('signin-email').value.trim();
        const pw    = $('signin-password').value;
        await signIn(email, pw);
      }
      closeModal();
    } catch(err) {
      errorEl.textContent = err.message || 'Authentication failed';
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  $('sign-out-btn').addEventListener('click', () => logOut());
}

function updateUserBar(user) {
  const bar      = $('user-bar');
  const greeting = $('user-greeting');
  const openBtn  = $('auth-open-btn');
  if (user) {
    greeting.textContent = 'Hi, ' + (user.displayName || user.email);
    bar.hidden    = false;
    openBtn.hidden = true;
  } else {
    bar.hidden    = true;
    openBtn.hidden = false;
  }
}

// ============================================================
// THEME TOGGLE
// ============================================================
function initTheme() {
  const btn  = document.querySelector('[data-theme-toggle]');
  const html = document.documentElement;
  let theme  = 'dark';
  try { theme = localStorage.getItem('theme') || 'dark'; } catch(e) {}
  html.setAttribute('data-theme', theme);
  updateThemeIcon(btn, theme);
  btn?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch(e) {}
    updateThemeIcon(btn, theme);
  });
}
function updateThemeIcon(btn, theme) {
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

// ============================================================
// GROUPS
// ============================================================
function renderGroups() {
  const container = $('groups-container');
  if (!container) return;
  container.innerHTML = WC_GROUPS.map(g => {
    const teams = g.teams.map(t => `
      <div class="group-team">
        <span class="team-flag">${t.flag}</span>
        <span class="team-name">${t.name}</span>
      </div>`).join('');
    return `<div class="group-card">
      <div class="group-card-header">Group ${g.group}</div>
      <div class="group-teams">${teams}</div>
    </div>`;
  }).join('');
}

// ============================================================
// MATCHES
// ============================================================
function populateMatchFilters() {
  const dateEl  = $('match-date-filter');
  const groupEl = $('match-group-filter');
  const venueEl = $('match-venue-filter');
  if (!dateEl || dateEl.dataset.populated) return;
  dateEl.dataset.populated = '1';

  const dates  = [...new Set(liveMatches.map(m => m.date))].sort();
  const stages = [...new Set(liveMatches.map(m => m.stage))];
  const venues = [...new Set(liveMatches.map(m => m.venue).filter(Boolean))].sort();

  dates.forEach(d  => dateEl.add(new Option(fmtDate(d), d)));
  stages.forEach(s => groupEl.add(new Option(stageKeyToLabel(s), s)));
  venues.forEach(v => venueEl.add(new Option(v, v)));
}

function renderMatches() {
  const container = $('matches-container');
  if (!container) return;
  const dateVal  = $('match-date-filter')?.value  || 'all';
  const groupVal = $('match-group-filter')?.value || 'all';
  const venueVal = $('match-venue-filter')?.value || 'all';
  const search   = ($('match-search')?.value || '').toLowerCase();

  let matches = liveMatches.filter(m => {
    if (dateVal  !== 'all' && m.date  !== dateVal)  return false;
    if (groupVal !== 'all' && m.stage !== groupVal) return false;
    if (venueVal !== 'all' && m.venue !== venueVal) return false;
    if (search && !m.home.toLowerCase().includes(search) && !m.away.toLowerCase().includes(search)) return false;
    return true;
  });

  if (!matches.length) { container.innerHTML = '<p class="empty-msg">No matches found.</p>'; return; }

  // Group by date
  const byDate = {};
  matches.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });

  container.innerHTML = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, ms]) => `
    <div class="date-group">
      <div class="date-group-header">${fmtDate(date)}</div>
      ${ms.map(m => buildMatchCard(m, false)).join('')}
    </div>`).join('');

  // Wire up admin score inputs
  container.querySelectorAll('.score-input').forEach(inp => {
    inp.addEventListener('change', handleScoreInput);
  });
}

function buildMatchCard(m, isPred) {
  const hasResult = m.homeScore !== null && m.homeScore !== undefined
                 && m.awayScore !== null && m.awayScore !== undefined;
  const statusLabel = hasResult ? 'FT' : (m.status === 'live' ? 'LIVE' : 'Preview');
  const statusClass = hasResult ? 'status-ft' : (m.status === 'live' ? 'status-live' : 'status-preview');
  const pred  = userPreds[m.id] || {};
  const hasPred = pred.home !== undefined && pred.away !== undefined;

  // Score display
  let scoreHtml;
  if (hasResult) {
    scoreHtml = `<div class="score-display">${m.homeScore} <span class="score-sep">–</span> ${m.awayScore}</div>`;
  } else if (isPred && hasPred) {
    scoreHtml = `<div class="score-display pred-score">${pred.home} <span class="score-sep">–</span> ${pred.away}</div>`;
  } else if (isPred) {
    scoreHtml = `
      <div class="score-inputs">
        <input type="number" min="0" max="20" class="score-input pred-input" data-match="${m.id}" data-side="home" value="${pred.home ?? ''}" placeholder="0">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input pred-input" data-match="${m.id}" data-side="away" value="${pred.away ?? ''}" placeholder="0">
      </div>`;
  } else if (currentUser?.isAdmin) {
    scoreHtml = `
      <div class="score-inputs">
        <input type="number" min="0" max="20" class="score-input admin-input" data-match="${m.id}" data-side="home" value="" placeholder="0">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input admin-input" data-match="${m.id}" data-side="away" value="" placeholder="0">
      </div>`;
  } else {
    scoreHtml = `<div class="score-vs">vs</div>`;
  }

  // TV/streaming
  const channels = (m.tv || []).map(ch => {
    const cls = /ESPN|ABC/i.test(ch) ? 'badge-tv' : /Fubo|Sling|Hulu|Peacock|Paramount/i.test(ch) ? 'badge-stream' : 'badge-esp';
    return `<span class="channel-badge ${cls}">${ch}</span>`;
  }).join('');

  return `
  <div class="match-card" data-id="${m.id}">
    <div class="card-header">
      <span class="stage-label">${stageKeyToLabel(m.stage)}</span>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
    </div>
    <div class="card-body">
      <div class="team home-team">
        <span class="team-flag">${m.homeFlag || ''}</span>
        <span class="team-name">${m.home}</span>
      </div>
      ${scoreHtml}
      <div class="team away-team">
        <span class="team-name">${m.away}</span>
        <span class="team-flag">${m.awayFlag || ''}</span>
      </div>
    </div>
    <div class="card-footer">
      ${channels ? `<div class="channels">${channels}</div>` : ''}
      <div class="match-meta">
        <span>${m.venue || ''}</span>
        <span>${fmtDate(m.date)} &bull; ${fmtTime(m.date)}</span>
      </div>
    </div>
  </div>`;
}

function handleScoreInput(e) {
  const inp   = e.target;
  const matchId = inp.dataset.match;
  const side  = inp.dataset.side;
  const card  = inp.closest('.match-card');
  const homeInp = card.querySelector('[data-side="home"]');
  const awayInp = card.querySelector('[data-side="away"]');
  if (homeInp.value === '' || awayInp.value === '') return;

  if (inp.classList.contains('admin-input') && currentUser?.isAdmin) {
    updateMatchResult(matchId, { homeScore: +homeInp.value, awayScore: +awayInp.value });
  } else if (inp.classList.contains('pred-input') && currentUser) {
    savePredAndRefresh(matchId, +homeInp.value, +awayInp.value);
  }
}

async function savePredAndRefresh(matchId, home, away) {
  userPreds[matchId] = { home, away };
  await savePrediction(currentUser.uid, matchId, home, away);
  renderPredictions();
}

// ============================================================
// PREDICTIONS
// ============================================================
function populatePredFilters() {
  const dateEl  = $('pred-date-filter');
  const groupEl = $('pred-group-filter');
  if (!dateEl || dateEl.dataset.populated) return;
  dateEl.dataset.populated = '1';

  const allMatches = [...liveMatches, ...WC_KNOCKOUT_FIXTURES];
  const dates  = [...new Set(allMatches.map(m => m.date))].sort();
  const stages = [...new Set(allMatches.map(m => m.stage))];

  dates.forEach(d  => dateEl.add(new Option(fmtDate(d), d)));
  stages.forEach(s => groupEl.add(new Option(stageKeyToLabel(s), s)));
}

function resolveFixtureTeams(mode) {
  // mode: 'pick' = use bracketPicks, 'actual' = use liveMatches results
  const resolved = {};
  WC_KNOCKOUT_FIXTURES.forEach(fix => {
    let home = '', away = '';
    if (mode === 'pick') {
      home = bracketPicks[fix.id + '_home'] || fix.homePlaceholder || '';
      away = bracketPicks[fix.id + '_away'] || fix.awayPlaceholder || '';
    } else {
      // Try to get from liveMatches results
      const lm = liveMatches.find(m => m.id === fix.id);
      home = lm?.home || fix.homePlaceholder || '';
      away = lm?.away || fix.awayPlaceholder || '';
    }
    resolved[fix.id] = { home, away };
  });
  return resolved;
}

function renderPredictions() {
  const authPrompt = $('predictions-auth-prompt');
  const filtersDiv = $('pred-filters');
  const container  = $('pred-picks-container');
  if (!container) return;

  if (!currentUser) {
    authPrompt.hidden = false;
    filtersDiv.hidden = true;
    container.innerHTML = '';
    return;
  }
  authPrompt.hidden = true;
  filtersDiv.hidden = false;
  populatePredFilters();

  const dateVal  = $('pred-date-filter')?.value  || 'all';
  const groupVal = $('pred-group-filter')?.value || 'all';
  const search   = ($('pred-team-filter')?.value || '').toLowerCase();

  // Resolve knockout fixture teams from bracket picks
  const fixTeams = resolveFixtureTeams('pick');

  const allMatches = [
    ...liveMatches,
    ...WC_KNOCKOUT_FIXTURES.map(fix => ({
      ...fix,
      home: fixTeams[fix.id]?.home || fix.homePlaceholder || 'TBD',
      away: fixTeams[fix.id]?.away || fix.awayPlaceholder || 'TBD',
    }))
  ];

  let matches = allMatches.filter(m => {
    if (dateVal  !== 'all' && m.date  !== dateVal)  return false;
    if (groupVal !== 'all' && m.stage !== groupVal) return false;
    if (search && !m.home.toLowerCase().includes(search) && !m.away.toLowerCase().includes(search)) return false;
    return true;
  });

  if (!matches.length) { container.innerHTML = '<p class="empty-msg">No matches found.</p>'; return; }

  // Group by date
  const byDate = {};
  matches.forEach(m => { (byDate[m.date] = byDate[m.date] || []).push(m); });

  container.innerHTML = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, ms]) => `
    <div class="date-group">
      <div class="date-group-header">${fmtDate(date)}</div>
      ${ms.map(m => buildMatchCard(m, true)).join('')}
    </div>`).join('');

  // Wire up prediction inputs
  container.querySelectorAll('.pred-input').forEach(inp => {
    inp.addEventListener('change', handleScoreInput);
  });
}

// ============================================================
// PREDICTION ACCURACY (STANDINGS)
// ============================================================
function renderPredStandings() {
  const authPrompt = $('pred-standings-auth-prompt');
  const container  = $('pred-standings-container');
  if (!container) return;

  if (!currentUser) { authPrompt.hidden = false; return; }
  authPrompt.hidden = true;

  const played = liveMatches.filter(m =>
    m.homeScore !== null && m.homeScore !== undefined &&
    m.awayScore !== null && m.awayScore !== undefined
  );

  if (!played.length) {
    container.innerHTML = '<p class="empty-msg">No results yet to evaluate predictions.</p>';
    return;
  }

  let exactScore = 0, correctResult = 0, total = played.length;
  played.forEach(m => {
    const p = userPreds[m.id];
    if (!p) return;
    if (p.home === m.homeScore && p.away === m.awayScore) { exactScore++; correctResult++; return; }
    const actualWinner = m.homeScore > m.awayScore ? 'home' : m.homeScore < m.awayScore ? 'away' : 'draw';
    const predWinner   = p.home > p.away ? 'home' : p.home < p.away ? 'away' : 'draw';
    if (actualWinner === predWinner) correctResult++;
  });

  const predCount = played.filter(m => userPreds[m.id]).length;

  container.innerHTML = `
    <div class="pred-stats">
      <div class="pred-stat-card">
        <div class="pred-stat-value">${predCount}/${total}</div>
        <div class="pred-stat-label">Matches Predicted</div>
      </div>
      <div class="pred-stat-card">
        <div class="pred-stat-value">${correctResult}</div>
        <div class="pred-stat-label">Correct Results</div>
      </div>
      <div class="pred-stat-card">
        <div class="pred-stat-value">${exactScore}</div>
        <div class="pred-stat-label">Exact Scores</div>
      </div>
      <div class="pred-stat-card">
        <div class="pred-stat-value">${predCount ? Math.round(correctResult/predCount*100) : 0}%</div>
        <div class="pred-stat-label">Accuracy</div>
      </div>
    </div>
    <table class="pred-table">
      <thead><tr><th>Match</th><th>Result</th><th>Your Pick</th><th>Points</th></tr></thead>
      <tbody>${played.map(m => {
        const p = userPreds[m.id];
        const aW = m.homeScore > m.awayScore ? 'home' : m.homeScore < m.awayScore ? 'away' : 'draw';
        const pW = p ? (p.home > p.away ? 'home' : p.home < p.away ? 'away' : 'draw') : null;
        const exact   = p && p.home === m.homeScore && p.away === m.awayScore;
        const correct = p && aW === pW;
        const pts = exact ? 3 : correct ? 1 : 0;
        const cls = exact ? 'exact' : correct ? 'correct' : p ? 'wrong' : '';
        return `<tr class="${cls}">
          <td>${m.home} vs ${m.away}</td>
          <td>${m.homeScore}–${m.awayScore}</td>
          <td>${p ? `${p.home}–${p.away}` : '—'}</td>
          <td>${pts > 0 ? '+'+pts : (p ? '0' : '—')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ============================================================
// PREDICTED GROUP STANDINGS
// ============================================================
function renderPredGroupStandings() {
  const authPrompt = $('pred-group-standings-auth-prompt');
  const container  = $('pred-group-standings-container');
  if (!container) return;

  if (!currentUser) { authPrompt.hidden = false; container.innerHTML = ''; return; }
  authPrompt.hidden = true;

  // Build predicted standings for each group using userPreds
  const groupMatches = liveMatches.filter(m => m.stage === 'group');

  // Initialize table: { teamName: { mp,w,d,l,gf,ga } }
  const tables = {};
  WC_GROUPS.forEach(g => {
    tables[g.group] = {};
    g.teams.forEach(t => {
      tables[g.group][t.name] = { flag: t.flag, mp:0, w:0, d:0, l:0, gf:0, ga:0 };
    });
  });

  groupMatches.forEach(m => {
    const p = userPreds[m.id];
    if (!p || p.home === undefined || p.away === undefined) return;
    const grp = m.group;
    if (!grp || !tables[grp]) return;
    const ht = tables[grp][m.home];
    const at = tables[grp][m.away];
    if (!ht || !at) return;
    ht.mp++; at.mp++;
    ht.gf += +p.home; ht.ga += +p.away;
    at.gf += +p.away; at.ga += +p.home;
    if (+p.home > +p.away)      { ht.w++; at.l++; }
    else if (+p.home < +p.away) { at.w++; ht.l++; }
    else                        { ht.d++; at.d++; }
  });

  const pts = r => r.w*3 + r.d;
  const gd  = r => r.gf - r.ga;

  container.innerHTML = Object.entries(tables).map(([grp, teams]) => {
    const rows = Object.entries(teams)
      .sort(([,a],[,b]) => pts(b)-pts(a) || gd(b)-gd(a) || b.gf-a.gf)
      .map(([name, r], i) => `
        <tr class="${i < 2 ? 'qualify' : ''}">
          <td>${i+1}</td>
          <td><span class="team-flag">${r.flag}</span> ${name}</td>
          <td>${r.mp}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
          <td>${r.gf}</td><td>${r.ga}</td><td>${gd(r) >= 0 ? '+':''}${gd(r)}</td>
          <td><strong>${pts(r)}</strong></td>
        </tr>`).join('');
    return `
      <div class="standings-card">
        <div class="standings-header">Group ${grp}</div>
        <table class="standings-table">
          <thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

// ============================================================
// STANDINGS (ACTUAL)
// ============================================================
function renderStandings() {
  const container = $('standings-container');
  if (!container) return;

  const groupMatches = liveMatches.filter(m => m.stage === 'group');

  const tables = {};
  WC_GROUPS.forEach(g => {
    tables[g.group] = {};
    g.teams.forEach(t => {
      tables[g.group][t.name] = { flag: t.flag, mp:0, w:0, d:0, l:0, gf:0, ga:0 };
    });
  });

  groupMatches.forEach(m => {
    if (m.homeScore === null || m.homeScore === undefined) return;
    const grp = m.group;
    if (!grp || !tables[grp]) return;
    const ht = tables[grp][m.home];
    const at = tables[grp][m.away];
    if (!ht || !at) return;
    ht.mp++; at.mp++;
    ht.gf += m.homeScore; ht.ga += m.awayScore;
    at.gf += m.awayScore; at.ga += m.homeScore;
    if (m.homeScore > m.awayScore)      { ht.w++; at.l++; }
    else if (m.homeScore < m.awayScore) { at.w++; ht.l++; }
    else                                { ht.d++; at.d++; }
  });

  const pts = r => r.w*3 + r.d;
  const gd  = r => r.gf - r.ga;

  container.innerHTML = Object.entries(tables).map(([grp, teams]) => {
    const rows = Object.entries(teams)
      .sort(([,a],[,b]) => pts(b)-pts(a) || gd(b)-gd(a) || b.gf-a.gf)
      .map(([name, r], i) => `
        <tr class="${i < 2 ? 'qualify' : ''}">
          <td>${i+1}</td>
          <td><span class="team-flag">${r.flag}</span> ${name}</td>
          <td>${r.mp}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
          <td>${r.gf}</td><td>${r.ga}</td><td>${gd(r) >= 0 ? '+':''}${gd(r)}</td>
          <td><strong>${pts(r)}</strong></td>
        </tr>`).join('');
    return `
      <div class="standings-card">
        <div class="standings-header">Group ${grp}</div>
        <table class="standings-table">
          <thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

// ============================================================
// BRACKET
// ============================================================
function renderBracket() {
  const container = $('pred-bracket-container');
  if (!container) return;

  const rounds = [
    { label: 'Round of 32',   stage: 'Round of 32'   },
    { label: 'Round of 16',   stage: 'Round of 16'   },
    { label: 'Quarter-Finals',stage: 'Quarter-Final' },
    { label: 'Semi-Finals',   stage: 'Semi-Final'    },
    { label: 'Final',         stage: 'Final'         },
  ];

  // Group fixtures by stage
  const byStage = {};
  WC_KNOCKOUT_FIXTURES.forEach(f => {
    (byStage[f.stage] = byStage[f.stage] || []).push(f);
  });

  const roundsHtml = rounds.map(r => {
    const fixtures = byStage[r.stage] || [];
    const matchesHtml = fixtures.map(fix => {
      const pickHome = bracketPicks[fix.id + '_home'] || '';
      const pickAway = bracketPicks[fix.id + '_away'] || '';
      const lm       = liveMatches.find(m => m.id === fix.id);
      const actualHome = lm?.home || fix.homePlaceholder || 'TBD';
      const actualAway = lm?.away || fix.awayPlaceholder || 'TBD';

      const homeMatch = pickHome && pickHome === actualHome;
      const awayMatch = pickAway && pickAway === actualAway;

      return `
        <div class="bracket-match">
          <div class="bracket-team ${homeMatch ? 'correct' : pickHome ? 'picked' : ''}">
            <span class="bracket-team-name">${actualHome}</span>
            ${pickHome && pickHome !== actualHome ? `<span class="bracket-pick-label">${pickHome}</span>` : ''}
          </div>
          <div class="bracket-team ${awayMatch ? 'correct' : pickAway ? 'picked' : ''}">
            <span class="bracket-team-name">${actualAway}</span>
            ${pickAway && pickAway !== actualAway ? `<span class="bracket-pick-label">${pickAway}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    return `<div class="bracket-round">
      <div class="bracket-round-label">${r.label}</div>
      <div class="bracket-matches">${matchesHtml}</div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="bracket-scroll">${roundsHtml}</div>`;
}

// ============================================================
// FIRESTORE WATCHER
// ============================================================
function watchMatchesAndRender() {
  watchMatches(matches => {
    if (matches && matches.length > 0) {
      liveMatches = matches;
    }
    populateMatchFilters();
    renderGroups();
    renderMatches();
    renderStandings();
    if (currentUser) renderPredictions();
  });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  initNav();
  initSubTabs();
  initAuth();
  initTheme();

  // Render immediately from static data
  populateMatchFilters();
  renderGroups();
  renderMatches();
  renderStandings();

  // Watch auth state
  watchAuth(async user => {
    currentUser = user;
    updateUserBar(user);
    if (user) {
      userPreds = await getUserPredictions(user.uid);
      const saved = await getBracketPicks(user.uid);
      if (saved) bracketPicks = saved;
    } else {
      userPreds    = {};
      bracketPicks = {};
    }
    renderPredictions();
    renderPredStandings();
    renderPredGroupStandings();
  });

  // Start Firestore live watcher
  watchMatchesAndRender();

  // Filter listeners — Matches tab
  ['match-date-filter','match-group-filter','match-venue-filter'].forEach(id => {
    $(id)?.addEventListener('change', renderMatches);
  });
  $('match-search')?.addEventListener('input', renderMatches);

  // Filter listeners — Predictions tab
  ['pred-date-filter','pred-group-filter'].forEach(id => {
    $(id)?.addEventListener('change', renderPredictions);
  });
  $('pred-team-filter')?.addEventListener('input', renderPredictions);
}

init();
