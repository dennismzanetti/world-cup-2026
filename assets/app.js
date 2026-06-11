// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions, updateMatchResult } from './db.js';

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser    = null;
let isAdmin        = false;
let liveMatches    = [];   // mirror of Firestore
let userPredictions = {};  // { matchId: { homeScorePred, awayScorePred } }
let unsubMatches   = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = el => el && (el.hidden = false);
const hide = el => el && (el.hidden = true);

// Format a Firestore Timestamp or plain date string → readable
function fmtDate(val) {
  if (!val) return '';
  const d = val?.toDate ? val.toDate() : new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// Stage / group label
function stageLabel(m) {
  if (m.stage === 'group')    return `Group ${m.group}`;
  if (m.stage === 'r32')      return 'Round of 32';
  if (m.stage === 'r16')      return 'Round of 16';
  if (m.stage === 'qf')       return 'Quarter-final';
  if (m.stage === 'sf')       return 'Semi-final';
  if (m.stage === 'third')    return '3rd Place';
  if (m.stage === 'final')    return 'Final';
  return m.stage || '';
}

// ─── Auth UI ──────────────────────────────────────────────────────────────────
function renderAuthUI(user) {
  const loginBtn   = $('login-btn');
  const logoutBtn  = $('logout-btn');
  const userInfo   = $('user-info');
  const emailSpan  = $('user-email');
  const adminBadge = $('admin-badge');
  const authForm   = $('auth-form');

  if (user) {
    hide(loginBtn);
    hide(authForm);
    show(logoutBtn);
    show(userInfo);
    if (emailSpan) emailSpan.textContent = user.email;
    if (adminBadge) adminBadge.hidden = !isAdmin;
  } else {
    show(loginBtn);
    hide(logoutBtn);
    hide(userInfo);
    if (adminBadge) adminBadge.hidden = true;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initApp() {
  // ── Auth listeners ──
  watchAuth(async (user) => {
    currentUser = user;
    if (user) {
      // check admin claim
      const token = await user.getIdTokenResult();
      isAdmin = !!token.claims.admin;
    } else {
      isAdmin = false;
    }
    renderAuthUI(user);
    if (user) {
      userPredictions = await getUserPredictions(user.uid);
    } else {
      userPredictions = {};
    }
    renderAll();
  });

  // ── Login / signup buttons ──
  $('login-btn')?.addEventListener('click', () => {
    const form = $('auth-form');
    if (form) form.hidden = !form.hidden;
  });
  $('logout-btn')?.addEventListener('click', () => logOut());

  $('do-login-btn')?.addEventListener('click', async () => {
    const email = $('auth-email')?.value.trim();
    const pass  = $('auth-pass')?.value;
    const errEl = $('auth-error');
    try {
      await signIn(email, pass);
      if (errEl) errEl.hidden = true;
    } catch (e) {
      if (errEl) { errEl.textContent = e.message; errEl.hidden = false; }
    }
  });

  $('do-signup-btn')?.addEventListener('click', async () => {
    const email = $('auth-email')?.value.trim();
    const pass  = $('auth-pass')?.value;
    const errEl = $('auth-error');
    try {
      await signUp(email, pass);
      if (errEl) errEl.hidden = true;
    } catch (e) {
      if (errEl) { errEl.textContent = e.message; errEl.hidden = false; }
    }
  });

  // ── Tab navigation ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
      btn.classList.add('active');
      const panel = document.getElementById(btn.dataset.tab);
      if (panel) panel.hidden = false;
      if (btn.dataset.tab === 'standings-tab') renderStandings();
      if (btn.dataset.tab === 'predictions-tab') renderPredictions();
      if (btn.dataset.tab === 'leaderboard-tab') renderLeaderboard();
    });
  });

  // ── Theme toggle ──
  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    const root = document.documentElement;
    let dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeToggle.addEventListener('click', () => {
      dark = !dark;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
    });
  }

  // ── Filter change listeners ──
  document.getElementById('match-stage-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-group-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-date-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-status-filter')?.addEventListener('change', renderMatches);

  document.getElementById('pred-stage-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-date-filter')?.addEventListener('change', renderPredictions);

  // ── Watch Firestore ──
  if (unsubMatches) unsubMatches();
  unsubMatches = watchMatches((matches) => {
    liveMatches = matches;
    populateFilters();
    renderAll();
  });
}

// ─── Populate filter dropdowns ────────────────────────────────────────────────
function populateFilters() {
  const stageEl = document.getElementById('match-stage-filter');
  const groupEl = document.getElementById('match-group-filter');
  const dateEl  = document.getElementById('match-date-filter');

  const predStageEl = document.getElementById('pred-stage-filter');
  const predGroupEl = document.getElementById('pred-group-filter');
  const predDateEl  = document.getElementById('pred-date-filter');

  if (stageEl) {
    const stages = [...new Set(liveMatches.map(m => m.stage).filter(Boolean))]
      .sort((a,b) => {
        const order = ['group','r32','r16','qf','sf','third','final'];
        return order.indexOf(a) - order.indexOf(b);
      });
    stageEl.innerHTML = '<option value="all">All Stages</option>' +
      stages.map(s => `<option value="${s}">${stageLabel({stage:s})}</option>`).join('');
  }
  if (groupEl) {
    const groups = [...new Set(liveMatches.map(m => m.group).filter(Boolean))].sort();
    groupEl.innerHTML = '<option value="all">All Groups</option>' +
      groups.map(g => `<option value="${g}">Group ${g}</option>`).join('');
  }
  if (dateEl) {
    const dates = [...new Set(liveMatches.map(m => m.date).filter(Boolean))].sort();
    dateEl.innerHTML = '<option value="all">All Dates</option>' +
      dates.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  if (predStageEl) {
    const stages = [...new Set(liveMatches.map(m => m.stage).filter(Boolean))]
      .sort((a,b) => {
        const order = ['group','r32','r16','qf','sf','third','final'];
        return order.indexOf(a) - order.indexOf(b);
      });
    predStageEl.innerHTML = '<option value="all">All Stages</option>' +
      stages.map(s => `<option value="${s}">${stageLabel({stage:s})}</option>`).join('');
  }
  if (predGroupEl) {
    const groups = [...new Set(liveMatches.map(m => m.group).filter(Boolean))].sort();
    predGroupEl.innerHTML = '<option value="all">All Groups</option>' +
      groups.map(g => `<option value="${g}">Group ${g}</option>`).join('');
  }
  if (predDateEl) {
    const dates = [...new Set(liveMatches.map(m => m.date).filter(Boolean))].sort();
    predDateEl.innerHTML = '<option value="all">All Dates</option>' +
      dates.map(d => `<option value="${d}">${d}</option>`).join('');
  }
}

// ─── Render all sections ──────────────────────────────────────────────────────
function renderAll() {
  renderMatches();
  renderPredictions();
}

// ─── Matches tab ──────────────────────────────────────────────────────────────
function renderMatches() {
  const container = document.getElementById('matches-grid');
  if (!container) return;

  const stageVal = document.getElementById('match-stage-filter')?.value || 'all';
  const groupVal = document.getElementById('match-group-filter')?.value || 'all';
  const dateVal  = document.getElementById('match-date-filter')?.value  || 'all';
  const statusVal = document.getElementById('match-status-filter')?.value || 'all';

  let matches = [...liveMatches];
  if (stageVal !== 'all') matches = matches.filter(m => m.stage === stageVal);
  if (groupVal !== 'all') matches = matches.filter(m => m.group === groupVal);
  if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
  if (statusVal !== 'all') matches = matches.filter(m => m.status === statusVal);

  container.innerHTML = '';
  if (!matches.length) {
    container.innerHTML = '<p class="no-matches">No matches found.</p>';
    return;
  }
  matches.forEach(m => {
    const card = buildMatchCard(m, false);
    container.appendChild(card);
  });
}

// ─── Match card builder ───────────────────────────────────────────────────────
function buildMatchCard(m, isPred) {
  const card = document.createElement('div');
  card.className = 'match-card' + (m.status === 'live' ? ' match-card-live' : '');
  card.dataset.matchId = m.id;

  // ── Team names / flags ──
  const hn = m.homeTeam || '?';
  const an = m.awayTeam || '?';
  const hFlag = m.homeFlagEmoji || '';
  const aFlag = m.awayFlagEmoji || '';

  // ── Stage label ──
  const stageLbl = stageLabel(m);

  // ── Status badge ──
  let statusBadge = '';
  if (m.status === 'live') {
    statusBadge = `<span class="status-badge status-live"><span class="live-dot" aria-hidden="true"></span>LIVE</span>`;
  } else if (m.status === 'ht') {
    statusBadge = `<span class="status-badge status-ht">HT</span>`;
  } else if (m.status === 'ft') {
    statusBadge = `<span class="status-badge status-ft">FT</span>`;
  }

  // ── Score / prediction columns ──
  let scoreColHtml = '';
  if (isPred && currentUser) {
    const pred = userPredictions[m.id];
    const homeVal = pred?.homeScorePred ?? '';
    const awayVal = pred?.awayScorePred ?? '';
    const predWas = (pred && m.status === 'ft')
      ? `<span class="pred-was">Predicted: ${pred.homeScorePred}–${pred.awayScorePred}</span>`
      : '';
    const predResult = (pred && m.status === 'ft' && m.homeScore != null)
      ? (() => {
          const correct = pred.homeScorePred === m.homeScore && pred.awayScorePred === m.awayScore;
          return `<span class="card-result-badge">${correct ? '✓ Exact' : '✗ Miss'}</span>`;
        })()
      : '';
    scoreColHtml = `
      <div class="card-score-col">
        ${m.status === 'ft' || m.status === 'live'
          ? `<span class="score-final ${m.status === 'live' ? 'score-live' : ''}">${m.homeScore ?? '–'} – ${m.awayScore ?? '–'}</span>`
          : `<div class="score-inputs-wrap">
              <input type="number" class="pred-input" data-side="home" min="0" max="99" value="${homeVal}" placeholder="0">
              <span class="score-sep">–</span>
              <input type="number" class="pred-input" data-side="away" min="0" max="99" value="${awayVal}" placeholder="0">
            </div>
            <button class="btn-save pred-btn save-pred-btn">Save</button>
            <span class="pred-saving" hidden>Saving…</span>
            <span class="pred-saved"  hidden>Saved!</span>
            <span class="pred-error"  hidden></span>`
        }
        ${predWas}
        ${predResult}
      </div>`;
  } else {
    const hs  = m.homeScore != null ? m.homeScore : '–';
    const as_ = m.awayScore != null ? m.awayScore : '–';
    const cls = m.status === 'live'  ? 'score-final score-live'
              : m.homeScore != null  ? 'score-final'
                                     : 'score-final score-pending';
    scoreColHtml = `<div class="card-score-col"><span class="${cls}">${hs} – ${as_}</span></div>`;
  }

  // ── Date/time string ────────────────────────────────────────────────────
  const dtStr = [m.date, m.timeLocal, m.tz].filter(Boolean).join(' ');

  // ── Card HTML ────────────────────────────────────────────────────────────
  card.innerHTML = `
      <div class="card-header">
        <span class="card-header-group">${stageLbl}</span>
        ${statusBadge}
      </div>
      <div class="card-teams">
        <div class="card-team home-team">
          ${hFlag ? `<span class="team-flag" aria-hidden="true">${hFlag}</span>` : ''}
          <span class="card-team-name">${hn}</span>
        </div>
        ${scoreColHtml}
        <div class="card-team away-team">
          <span class="card-team-name">${an}</span>
          ${aFlag ? `<span class="team-flag" aria-hidden="true">${aFlag}</span>` : ''}
        </div>
      </div>
      ${(m.venue || dtStr) ? `
      <div class="card-meta">
        ${m.venue ? `<span class="card-meta-item">
          <svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M13 6c0 4.5-5 8.5-5 8.5S3 10.5 3 6a5 5 0 0 1 10 0z"/></svg>
          ${m.venue}${m.city ? ', ' + m.city : ''}
        </span>` : ''}
        ${dtStr ? `<span class="card-meta-item">
          <svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 1a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 1.5v3.25l2 1.25-.5.8L7 8.5V5h1z"/></svg>
          ${dtStr}
        </span>` : ''}
      </div>` : ''}`;

  // ── Event listeners ──────────────────────────────────────────────────────
  if (isPred && currentUser) {
    card.querySelector('.save-pred-btn')?.addEventListener('click', async () => {
      const savingEl = card.querySelector('.pred-saving');
      const savedEl  = card.querySelector('.pred-saved');
      const errEl    = card.querySelector('.pred-error');
      const btn      = card.querySelector('.save-pred-btn');
      const homeVal  = parseInt(card.querySelector('[data-side="home"]')?.value);
      const awayVal  = parseInt(card.querySelector('[data-side="away"]')?.value);
      if (isNaN(homeVal) || isNaN(awayVal)) {
        if (errEl) { errEl.textContent = 'Enter both scores.'; errEl.hidden = false; }
        return;
      }
      if (errEl)    errEl.hidden    = true;
      if (savingEl) savingEl.hidden = false;
      if (btn)      btn.disabled    = true;
      userPredictions[m.id] = { homeScorePred: homeVal, awayScorePred: awayVal };
      try {
        await savePrediction(currentUser.uid, m.id, { homeScorePred: homeVal, awayScorePred: awayVal });
        if (savingEl) savingEl.hidden = true;
        if (savedEl)  { savedEl.hidden = false; setTimeout(() => { savedEl.hidden = true; }, 2000); }
      } catch (err) {
        if (savingEl) savingEl.hidden = true;
        if (errEl)    { errEl.textContent = 'Save failed.'; errEl.hidden = false; }
        console.warn('[app] savePrediction error', err);
      }
      if (btn) btn.disabled = false;
    });
  }

  if (!isPred && isAdmin) {
    card.querySelector('.save-score-btn')?.addEventListener('click', async () => {
      const btn     = card.querySelector('.save-score-btn');
      const savedEl = card.querySelector('.result-saved');
      const homeVal = parseInt(card.querySelector('[data-side="home"]')?.value);
      const awayVal = parseInt(card.querySelector('[data-side="away"]')?.value);
      if (isNaN(homeVal) || isNaN(awayVal)) return;
      if (btn) btn.disabled = true;
      try {
        await updateMatchResult(m.id, { homeScore: homeVal, awayScore: awayVal, status: 'ft' });
        if (savedEl) { savedEl.style.display = 'inline'; setTimeout(() => { savedEl.style.display = 'none'; if (btn) btn.disabled = false; }, 2000); }
      } catch (err) {
        console.warn('[app] updateMatchResult error', err);
        if (btn) btn.disabled = false;
      }
    });
  }

  return card;
}

// ─── Standings ────────────────────────────────────────────────────────────────
function renderStandings() {
  const container = document.getElementById('standings-grid');
  if (!container) return;
  container.innerHTML = '';
  WC_GROUPS.forEach(group => {
    const groupMatches = liveMatches.filter(m => m.group === group.id);
    const standings    = calcPoints(group.teams, groupMatches);
    const card = document.createElement('div');
    card.className = 'standings-card';
    card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>
            ${standings.map((t,i) => `
            <tr class="${i < 2 ? 'qualify-row' : ''}">
              <td class="team-cell">
                ${t.flag ? `<span class="team-flag-sm">${t.flag}</span>` : ''}
                <span>${t.name}</span>
              </td>
              <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
              <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd > 0 ? '+' : ''}${t.gd}</td>
              <td class="pts-cell">${t.pts}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    container.appendChild(card);
  });
}

// ─── Points calculation ───────────────────────────────────────────────────────
function calcPoints(teams, matches) {
  const table = {};
  teams.forEach(t => {
    table[t.name] = { name: t.name, flag: t.flagEmoji || '', p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };
  });
  matches.forEach(m => {
    if (m.homeScore == null || m.awayScore == null) return;
    const h = table[m.homeTeam];
    const a = table[m.awayTeam];
    if (!h || !a) return;
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
    if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; a.l++; }
    else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  return Object.values(table).sort((a,b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );
}

// ─── Predictions tab ──────────────────────────────────────────────────────────
function renderPredictions() {
  const container = document.getElementById('predictions-grid');
  if (!container) return;

  const stageVal = document.getElementById('pred-stage-filter')?.value || 'all';
  const groupVal = document.getElementById('pred-group-filter')?.value || 'all';
  const dateVal  = document.getElementById('pred-date-filter')?.value  || 'all';

  let matches = liveMatches.filter(m => m.status !== 'ft');
  if (stageVal !== 'all') matches = matches.filter(m => m.stage === stageVal);
  if (groupVal !== 'all') matches = matches.filter(m => m.group === groupVal);
  if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);

  container.innerHTML = '';
  if (!matches.length) {
    container.innerHTML = '<p class="no-matches">No upcoming matches.</p>';
    return;
  }
  if (!currentUser) {
    container.innerHTML = '<p class="no-matches">Sign in to make predictions.</p>';
    return;
  }
  matches.forEach(m => {
    const card = buildMatchCard(m, true);
    container.appendChild(card);
  });
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;
  container.innerHTML = '<p class="no-matches">Leaderboard coming soon.</p>';
}
