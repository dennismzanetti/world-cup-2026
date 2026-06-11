// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, getUserPredictions, updateMatchResult } from './db.js';

(function () {

  // ─── State ────────────────────────────────────────────────────────────────
  let currentUser      = null;
  let authResolved     = false;
  let activeTab        = 'groups';
  let activePredSubtab = 'my-picks';
  let userPredictions  = {};  // matchId → {homeScorePred, awayScorePred}
  let liveMatches      = WC_MATCHES.slice();
  let bracketPicks     = {};

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

  // ─── Stage label ──────────────────────────────────────────────────────────
  function stageKeyToLabel(key) {
    if (!key) return '';
    if (/^[A-L]$/.test(key)) return `Group ${key}`;
    return key;
  }

  // ─── Stage key extractor ─────────────────────────────────────────────────
  function matchStageKey(m) { return m.group || m.stage || null; }

  // ─── Knockout stage ordering ───────────────────────────────────────────────
  const KNOCKOUT_STAGE_ORDER = [
    'Round of 32', 'Round of 16', 'Quarterfinals',
    'Semifinals', 'Third Place', 'Final'
  ];

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
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.view').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${id}`);
    });
    if (id === 'groups')      renderGroups();
    if (id === 'matches')     renderMatches();
    if (id === 'standings')   renderStandings();
    if (id === 'predictions') switchPredSubtab(activePredSubtab);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  watchAuth(async (user) => {
    currentUser  = user;
    authResolved = true;
    const userGreeting = document.getElementById('user-greeting');
    const userBar      = document.getElementById('user-bar');
    const authBtn      = document.getElementById('auth-btn');
    const signOutBtn   = document.getElementById('sign-out-btn');
    if (user) {
      if (userGreeting) userGreeting.textContent = user.email;
      userBar?.removeAttribute('hidden');
      authBtn?.setAttribute('hidden', '');
      signOutBtn?.removeAttribute('hidden');
      try {
        const preds = await getUserPredictions(user.uid);
        userPredictions = {};
        (preds || []).forEach(p => { userPredictions[p.matchId] = p; });
      } catch (e) {
        console.warn('[app] getUserPredictions error', e);
      }
      loadBracketPicks();
      renderAll();
    } else {
      if (userGreeting) userGreeting.textContent = '';
      userBar?.setAttribute('hidden', '');
      authBtn?.removeAttribute('hidden');
      signOutBtn?.setAttribute('hidden', '');
      userPredictions = {};
      bracketPicks = {};
      renderAll();
    }
  });

  function renderAll() {
    if (activeTab === 'groups')      renderGroups();
    if (activeTab === 'matches')     renderMatches();
    if (activeTab === 'standings')   renderStandings();
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.view)));
  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab)));

  document.getElementById('auth-btn')?.addEventListener('click', openModal);
  document.getElementById('predict-signin-btn')?.addEventListener('click', openModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());
  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn =>
    btn.addEventListener('click', openModal));
  document.getElementById('auth-close')?.addEventListener('click', closeModal);
  document.getElementById('auth-backdrop')?.addEventListener('click', closeModal);

  const authForm = document.getElementById('auth-form');
  let authFormMode = 'signin';
  authForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    if (errEl) errEl.textContent = '';
    try {
      if (authFormMode === 'signup') await signUp(email, password);
      else                           await signIn(email, password);
      closeModal();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  });

  document.getElementById('auth-switch')?.addEventListener('click', () => {
    const submitBtn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-switch');
    const titleEl   = document.getElementById('auth-title');
    const subEl     = document.getElementById('auth-sub');
    if (authFormMode === 'signin') {
      authFormMode = 'signup';
      if (titleEl)   titleEl.textContent   = 'Create Account';
      if (subEl)     subEl.textContent     = 'Create an account to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign in';
    } else {
      authFormMode = 'signin';
      if (titleEl)   titleEl.textContent   = 'Sign In';
      if (subEl)     subEl.textContent     = 'Sign in to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign up";
    }
  });

  // ─── Match filters ────────────────────────────────────────────────────────
  document.getElementById('match-date-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-group-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-venue-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-team-filter')?.addEventListener('input', renderMatches);
  document.getElementById('pred-date-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-team-filter')?.addEventListener('input', renderPredictions);

  // ─── Live match data ──────────────────────────────────────────────────────
  watchMatches(allMatches => {
    allMatches.forEach(um => {
      const idx = liveMatches.findIndex(m => m.id === um.id);
      if (idx !== -1) liveMatches[idx] = { ...liveMatches[idx], ...um };
    });
    renderAll();
  });

  // ─── Points calculator ────────────────────────────────────────────────────
  function calcPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      const n = teamName(t);
      stats[n] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    matches.forEach(m => {
      if (m.homeScore == null || m.awayScore == null) return;
      const hn = teamName(m.home), an = teamName(m.away);
      if (!stats[hn] || !stats[an]) return;
      const h = m.homeScore, a = m.awayScore;
      stats[hn].played++; stats[an].played++;
      stats[hn].gf += h;  stats[an].gf += a;
      stats[hn].ga += a;  stats[an].ga += h;
      if (h > a)      { stats[hn].won++;   stats[hn].pts += 3; stats[an].lost++; }
      else if (h < a) { stats[an].won++;   stats[an].pts += 3; stats[hn].lost++; }
      else            { stats[hn].drawn++; stats[hn].pts++;    stats[an].drawn++; stats[an].pts++; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      teamName(a.team).localeCompare(teamName(b.team)));
  }

  // ─── Populate filters (called once on init only) ─────────────────────────
  function populateMatchFilters() {
    const dateEl  = document.getElementById('match-date-filter');
    const stageEl = document.getElementById('match-group-filter');
    const venueEl = document.getElementById('match-venue-filter');
    if (dateEl) {
      const dates = [...new Set(liveMatches.map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${d}</option>`).join('');
    }
    if (stageEl) {
      const groupStages    = [...new Set(liveMatches.filter(m => m.group).map(m => m.group))].sort();
      const knockoutStages = KNOCKOUT_STAGE_ORDER.filter(s =>
        WC_KNOCKOUT_FIXTURES.some(f => f.stage === s));
      stageEl.innerHTML = '<option value="all">All Stages</option>' +
        [...groupStages, ...knockoutStages]
          .map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
    if (venueEl) {
      const venues = [...new Set(liveMatches.map(m => m.venue).filter(Boolean))].sort();
      venueEl.innerHTML = '<option value="all">All Venues</option>' +
        venues.map(v => `<option value="${v}">${v}</option>`).join('');
    }
  }

  function populatePredFilters() {
    const dateEl  = document.getElementById('pred-date-filter');
    const stageEl = document.getElementById('pred-group-filter');
    if (dateEl) {
      const groupDates    = liveMatches.filter(m => m.group).map(m => m.date);
      const knockoutDates = WC_KNOCKOUT_FIXTURES.map(f => f.date);
      const dates = [...new Set([...groupDates, ...knockoutDates].filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${d}</option>`).join('');
    }
    if (stageEl) {
      const groupStages    = [...new Set(liveMatches.filter(m => m.group).map(m => m.group))].sort();
      const knockoutStages = KNOCKOUT_STAGE_ORDER.filter(s =>
        WC_KNOCKOUT_FIXTURES.some(f => f.stage === s));
      stageEl.innerHTML = '<option value="all">All Stages</option>' +
        [...groupStages, ...knockoutStages]
          .map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
  }

  // ─── Group matches by date ────────────────────────────────────────────────
  function groupByDate(matches) {
    const sorted = matches.slice().sort((a, b) => {
      const da = (a.date || ''), db = (b.date || '');
      if (da !== db) return da < db ? -1 : 1;
      const ta = (a.timeLocal || ''), tb = (b.timeLocal || '');
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    const groups = new Map();
    sorted.forEach(m => {
      const key = m.date || 'TBD';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });
    return groups;
  }

  // ─── Format date header label ─────────────────────────────────────────────
  function formatDateLabel(dateStr) {
    if (!dateStr || dateStr === 'TBD') return 'Date TBD';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // ─── Render a grouped list of match cards into a container ────────────────
  function renderGroupedCards(container, matches, isPred) {
    container.innerHTML = '';
    if (!matches.length) {
      container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>';
      return;
    }
    const grouped = groupByDate(matches);
    grouped.forEach((dayMatches, dateKey) => {
      const header = document.createElement('div');
      header.className = 'date-group-header';
      header.textContent = formatDateLabel(dateKey);
      container.appendChild(header);
      dayMatches.forEach(m => container.appendChild(buildMatchCard(m, isPred)));
    });
  }

  // ─── Groups ──────────────────────────────────────────────────────────────
  function renderGroups() {
    const container = document.getElementById('groups-grid');
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
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Matches ──────────────────────────────────────────────────────────────
  function renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    const dateVal  = document.getElementById('match-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('match-group-filter')?.value || 'all';
    const venueVal = document.getElementById('match-venue-filter')?.value || 'all';
    const teamVal  = (document.getElementById('match-team-filter')?.value || '').toLowerCase().trim();
    let matches = liveMatches.slice();
    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => matchStageKey(m) === stageVal);
    if (venueVal !== 'all') matches = matches.filter(m => m.venue === venueVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) ||
      teamName(m.away).toLowerCase().includes(teamVal));
    renderGroupedCards(container, matches, false);
  }

  // ─── Bracket picks persistence ────────────────────────────────────────────
  function saveBracketPicks() {
    if (!currentUser) return;
    try { localStorage.setItem(`bracketPicks_${currentUser.uid}`, JSON.stringify(bracketPicks)); } catch(e) {}
  }
  function loadBracketPicks() {
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(`bracketPicks_${currentUser.uid}`);
      bracketPicks = raw ? JSON.parse(raw) : {};
    } catch(e) { bracketPicks = {}; }
  }

  // ─── Group finisher helpers ───────────────────────────────────────────────
  function getActualGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    if (gm.some(m => m.homeScore == null)) return null;
    return calcPoints(group.teams, gm)[rank - 1]?.team || null;
  }

  function getPredictedGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    if (!gm.some(m => userPredictions[m.id]?.homeScorePred != null)) return null;
    return calcPredPoints(group.teams, gm)[rank - 1]?.team || null;
  }

  // ─── Resolve a knockout slot to a team ───────────────────────────────────
  function resolveSlot(slot, source = 'bracket', depth = 0) {
    if (depth > 10 || !slot) return null;
    if (typeof slot === 'object') return slot;
    if (!slot.match(/^[0-9W]/)) return slot;

    const groupMatch = slot.match(/^(\d)([A-Z])$/);
    if (groupMatch) {
      const rank = parseInt(groupMatch[1]);
      const gid  = groupMatch[2];
      if (source === 'actual') return getActualGroupFinisher(gid, rank);
      return getActualGroupFinisher(gid, rank) || getPredictedGroupFinisher(gid, rank);
    }

    const winnerMatch = slot.match(/^W(.+)$/);
    if (winnerMatch) {
      const matchId = winnerMatch[1];
      const fixture = WC_KNOCKOUT_FIXTURES.find(f => String(f.id) === matchId);
      if (!fixture) return null;
      const actual = liveMatches.find(m => m.id === fixture.id);
      if (actual && actual.homeScore != null && actual.awayScore != null && actual.status === 'ft') {
        const winSide = actual.homeScore > actual.awayScore ? fixture.home : fixture.away;
        return resolveSlot(winSide, source, depth + 1);
      }
      const pick = bracketPicks[fixture.id];
      if (!pick) return null;
      return resolveSlot(pick === 'home' ? fixture.home : fixture.away, source, depth + 1);
    }

    return slot;
  }

  function resolveSlotDisplay(slot, source = 'bracket') {
    const t = resolveSlot(slot, source);
    if (!t) return typeof slot === 'string' ? slot : '?';
    return typeof t === 'object' ? teamName(t) : t;
  }

  function resolveSlotTeam(slot, source = 'predicted') {
    return resolveSlot(slot, source) || null;
  }

  // ─── Build a knockout match card for predictions ──────────────────────────
  function buildKnockoutPredMatch(fixture) {
    const homeResolved = resolveSlotTeam(fixture.home, 'predicted');
    const awayResolved = resolveSlotTeam(fixture.away, 'predicted');
    const homeName = homeResolved
      ? (typeof homeResolved === 'object' ? homeResolved : { name: homeResolved })
      : (typeof fixture.home === 'object' ? fixture.home : { name: fixture.home?.name || fixture.home });
    const awayName = awayResolved
      ? (typeof awayResolved === 'object' ? awayResolved : { name: awayResolved })
      : (typeof fixture.away === 'object' ? fixture.away : { name: fixture.away?.name || fixture.away });
    const live = liveMatches.find(m => m.id === fixture.id);
    return {
      id:        fixture.id,
      stage:     fixture.stage,
      home:      homeName,
      away:      awayName,
      homeScore: live?.homeScore,
      awayScore: live?.awayScore,
      status:    live?.status,
      date:      fixture.date,
      timeLocal: fixture.timeLocal,
      tz:        fixture.tz,
      venue:     fixture.venue,
      city:      fixture.city,
    };
  }

  // ─── Match card ───────────────────────────────────────────────────────────
  function buildMatchCard(m, isPred) {
    const card     = document.createElement('div');
    card.className = 'match-card' + (m.status === 'live' ? ' match-card-live' : '');

    const stageLabel = m.group ? `Group ${m.group}` : (m.stage || '');
    const isAdmin    = currentUser && ADMIN_UIDS.includes(currentUser.uid);
    const hn         = teamName(m.home);
    const an         = teamName(m.away);
    const hFlag      = teamFlag(m.home);
    const aFlag      = teamFlag(m.away);
    const isLocked   = m.status === 'ft' || m.status === 'final';

    let statusBadge = '';
    if      (m.status === 'live') statusBadge = '<span class="status-badge status-live"><span class="live-dot"></span>Live</span>';
    else if (m.status === 'ht')   statusBadge = '<span class="status-badge status-ht">HT</span>';
    else if (m.status === 'ft' || m.status === 'final') statusBadge = '<span class="status-badge status-ft">FT</span>';

    let scoreColHtml = '';
    if (isPred && currentUser) {
      const pred = userPredictions[m.id] || {};
      const hVal = pred.homeScorePred !== undefined ? pred.homeScorePred : '';
      const aVal = pred.awayScorePred !== undefined ? pred.awayScorePred : '';
      scoreColHtml = `
        <div class="card-score-col">
          <div class="score-inputs-wrap">
            <input type="number" class="score-input" min="0" max="99"
              data-match="${m.id}" data-side="home" value="${hVal}"
              aria-label="${hn} predicted score"${isLocked ? ' disabled' : ''}>
            <span class="score-sep">–</span>
            <input type="number" class="score-input" min="0" max="99"
              data-match="${m.id}" data-side="away" value="${aVal}"
              aria-label="${an} predicted score"${isLocked ? ' disabled' : ''}>
          </div>
          ${!isLocked ? `<button class="btn-save pred-btn save-pred-btn" data-match="${m.id}">Save</button>` : ''}
          <span class="pred-saving" hidden>Saving…</span>
          <span class="pred-saved" hidden>Saved ✓</span>
          <span class="pred-error" hidden></span>
        </div>`;
    } else if (!isPred && isAdmin) {
      scoreColHtml = `
        <div class="card-score-col">
          <div class="score-inputs-wrap">
            <input type="number" class="score-input" min="0" max="99"
              data-match="${m.id}" data-side="home"
              value="${m.homeScore != null ? m.homeScore : ''}" aria-label="${hn} score">
            <span class="score-sep">–</span>
            <input type="number" class="score-input" min="0" max="99"
              data-match="${m.id}" data-side="away"
              value="${m.awayScore != null ? m.awayScore : ''}" aria-label="${an} score">
          </div>
          <button class="btn-save save-score-btn" data-match="${m.id}">Save</button>
          <span class="result-saved" style="display:none">Saved ✓</span>
        </div>`;
    } else {
      const hs  = m.homeScore != null ? m.homeScore : '–';
      const as_ = m.awayScore != null ? m.awayScore : '–';
      const cls = m.status === 'live'  ? 'score-final score-live'
                : m.homeScore != null  ? 'score-final'
                                       : 'score-final score-pending';
      scoreColHtml = `<div class="card-score-col"><span class="${cls}">${hs} – ${as_}</span></div>`;
    }

    const dtStr = [m.date, m.timeLocal, m.tz].filter(Boolean).join(' ');

    card.innerHTML = `
      <div class="card-header">
        <span class="card-header-group">${stageLabel}</span>
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
          <svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></svg>
          ${dtStr}
        </span>` : ''}
      </div>` : ''}`;

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

  // ─── Standings ────────────────────────────────────────────────────────────
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
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Predictions (My Picks) ───────────────────────────────────────────────
  function renderPredictions() {
    const container  = document.getElementById('predictions-list');
    const authPrompt = document.getElementById('predictions-auth-prompt');
    if (!container) return;
    if (!currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    // NOTE: populatePredFilters() is NOT called here — it runs once in init()
    // so filter selections are preserved across renders.

    const dateVal  = document.getElementById('pred-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('pred-group-filter')?.value || 'all';
    const teamVal  = (document.getElementById('pred-team-filter')?.value || '').toLowerCase().trim();

    // Group matches + knockout matches (no double-inclusion — knockout fixtures
    // are already in liveMatches but we use buildKnockoutPredMatch for resolved team names)
    const groupMatches    = liveMatches.filter(m => m.group);
    const knockoutMatches = WC_KNOCKOUT_FIXTURES.map(f => buildKnockoutPredMatch(f));
    let matches = [...groupMatches, ...knockoutMatches];

    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => matchStageKey(m) === stageVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) ||
      teamName(m.away).toLowerCase().includes(teamVal));

    renderGroupedCards(container, matches, true);
  }

  // ─── Predicted Group Standings ────────────────────────────────────────────
  function calcPredPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => {
      const n = teamName(t);
      stats[n] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.homeScorePred == null || pred.awayScorePred == null) return;
      const hn = teamName(m.home), an = teamName(m.away);
      if (!stats[hn] || !stats[an]) return;
      const h = pred.homeScorePred, a = pred.awayScorePred;
      stats[hn].played++; stats[an].played++;
      stats[hn].gf += h;  stats[an].gf += a;
      stats[hn].ga += a;  stats[an].ga += h;
      if (h > a)      { stats[hn].won++;   stats[hn].pts += 3; stats[an].lost++; }
      else if (h < a) { stats[an].won++;   stats[an].pts += 3; stats[hn].lost++; }
      else            { stats[hn].drawn++; stats[hn].pts++;    stats[an].drawn++; stats[an].pts++; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    return Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      teamName(a.team).localeCompare(teamName(b.team)));
  }

  function renderPredGroupStandings() {
    const container  = document.getElementById('pred-group-standings-container');
    const authPrompt = document.getElementById('pred-group-standings-auth-prompt');
    if (!container) return;
    if (!currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = liveMatches.filter(m => m.group === group.id);
      const standings    = calcPredPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead><tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr></thead>
          <tbody>${standings.map((s, i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  // ─── Prediction Accuracy ──────────────────────────────────────────────────
  function renderPredStandings() {
    const container  = document.getElementById('pred-standings-container');
    const authPrompt = document.getElementById('pred-standings-auth-prompt');
    if (!container) return;
    if (!authResolved || !currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    let correctExact = 0, correctResult = 0, total = 0;
    liveMatches.forEach(match => {
      const pred = userPredictions[match.id];
      if (!pred || pred.homeScorePred == null || pred.awayScorePred == null) return;
      if (match.homeScore == null || match.awayScore == null) return;
      total++;
      const predResult   = pred.homeScorePred > pred.awayScorePred ? 'H'
                         : pred.homeScorePred < pred.awayScorePred ? 'A' : 'D';
      const actualResult = match.homeScore > match.awayScore ? 'H'
                         : match.homeScore < match.awayScore ? 'A' : 'D';
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

  // ─── Knockout Bracket ─────────────────────────────────────────────────────
  function clearDownstreamPicks(matchId) {
    const toVisit = [matchId], visited = new Set();
    while (toVisit.length) {
      const id = toVisit.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      delete bracketPicks[id];
      WC_KNOCKOUT_FIXTURES.forEach(f => {
        if (f.home === `W${id}` || f.away === `W${id}`) toVisit.push(f.id);
      });
    }
  }

  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    if (!currentUser) {
      container.innerHTML = `<div class="auth-prompt"><p>Sign in to view your predicted bracket.</p><button class="btn btn-primary pred-standings-signin-btn">Sign In</button></div>`;
      container.querySelectorAll('.pred-standings-signin-btn').forEach(b => b.addEventListener('click', openModal));
      return;
    }
    loadBracketPicks();
    const rounds = [
      { label: 'Round of 32',    stage: 'Round of 32' },
      { label: 'Round of 16',    stage: 'Round of 16' },
      { label: 'Quarter-Finals', stage: 'Quarterfinals' },
      { label: 'Semi-Finals',    stage: 'Semifinals' },
      { label: 'Final',          stage: 'Final' },
    ];
    const allFixtureIds = WC_KNOCKOUT_FIXTURES
      .filter(f => f.stage !== 'Third Place')
      .map(f => f.id);
    const totalPicks = allFixtureIds.length;
    const madePicks  = allFixtureIds.filter(id => bracketPicks[id]).length;
    const pct        = Math.round((madePicks / totalPicks) * 100);
    container.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'bracket-header';
    header.innerHTML = `
      <div class="bracket-progress">
        <span>${madePicks}/${totalPicks} picks made</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bracket-actions">
        <button class="btn btn-sm btn-ghost" id="bracket-seed-btn">Seed from Results</button>
        <button class="btn btn-sm btn-ghost" id="bracket-reset-all-btn">Reset All</button>
      </div>`;
    container.appendChild(header);
    const scrollArea = document.createElement('div');
    scrollArea.className = 'bracket-scroll';
    container.appendChild(scrollArea);
    rounds.forEach(round => {
      const fixtures = WC_KNOCKOUT_FIXTURES.filter(f => f.stage === round.stage);
      if (!fixtures.length) return;
      const roundEl  = document.createElement('div');
      roundEl.className = 'bracket-round';
      const labelEl = document.createElement('div');
      labelEl.className = 'bracket-round-label';
      labelEl.textContent = round.label;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-xs btn-ghost bracket-round-reset';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', () => {
        fixtures.forEach(f => clearDownstreamPicks(f.id));
        saveBracketPicks(); renderKnockoutBracket();
      });
      labelEl.appendChild(resetBtn);
      roundEl.appendChild(labelEl);
      fixtures.forEach(fixture => {
        const homeTeam = resolveSlotDisplay(fixture.home, 'bracket');
        const awayTeam = resolveSlotDisplay(fixture.away, 'bracket');
        const pick     = bracketPicks[fixture.id];
        const matchEl  = document.createElement('div');
        matchEl.className = 'bracket-match';
        const homeEl = document.createElement('div');
        homeEl.className = 'bracket-team' + (pick === 'home' ? ' picked' : '');
        homeEl.textContent = homeTeam;
        homeEl.addEventListener('click', () => {
          if (bracketPicks[fixture.id] !== 'home') clearDownstreamPicks(fixture.id);
          bracketPicks[fixture.id] = 'home';
          saveBracketPicks(); renderKnockoutBracket();
        });
        const awayEl = document.createElement('div');
        awayEl.className = 'bracket-team' + (pick === 'away' ? ' picked' : '');
        awayEl.textContent = awayTeam;
        awayEl.addEventListener('click', () => {
          if (bracketPicks[fixture.id] !== 'away') clearDownstreamPicks(fixture.id);
          bracketPicks[fixture.id] = 'away';
          saveBracketPicks(); renderKnockoutBracket();
        });
        matchEl.appendChild(homeEl);
        matchEl.appendChild(awayEl);
        roundEl.appendChild(matchEl);
      });
      scrollArea.appendChild(roundEl);
    });
    const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.stage === 'Final');
    let champion = null;
    if (finalFixture) {
      const pick = bracketPicks[finalFixture.id];
      if (pick) {
        champion = pick === 'home'
          ? resolveSlotDisplay(finalFixture.home, 'bracket')
          : resolveSlotDisplay(finalFixture.away, 'bracket');
      }
    }
    const champEl = document.createElement('div');
    champEl.className = 'bracket-round bracket-champion';
    champEl.innerHTML = `
      <div class="bracket-round-label">Champion</div>
      <div class="champion-card">${champion
        ? `<span class="trophy">🏆</span><span>${champion}</span>`
        : '<span class="muted">TBD</span>'}</div>`;
    scrollArea.appendChild(champEl);
    container.querySelector('#bracket-reset-all-btn')?.addEventListener('click', () => {
      bracketPicks = {}; saveBracketPicks(); renderKnockoutBracket();
    });
    container.querySelector('#bracket-seed-btn')?.addEventListener('click', () => {
      WC_KNOCKOUT_FIXTURES.forEach(f => { if (!bracketPicks[f.id]) bracketPicks[f.id] = 'home'; });
      saveBracketPicks(); renderKnockoutBracket();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    populateMatchFilters();
    populatePredFilters(); // populate once — never reset by renderPredictions()
    renderGroups();
  }
  init();

  window._wc = { getAllMatches() { return [...liveMatches]; } };

})();
