// World Cup 2026 App — Firebase-connected
import { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES } from './data.js';
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, watchUserPredictions, updateMatchResult, saveBracketPicks, getBracketPicks } from './db.js';

(function () {

  // ─── State ──────────────────────────────────────────────────────────────────────────
  let currentUser      = null;
  let authResolved     = false;
  let activeTab        = 'groups';
  let activePredSubtab = 'my-picks';
  let userPredictions  = {};  // matchId → {home, away}
  let liveMatches      = WC_MATCHES.slice();
  let unsubPredictions = null;
  let bracketPicks     = {};  // matchId (string) → 'home'|'away'
  let bracketSaveTimer = null;

  function allPredMatches() { return [...liveMatches, ...WC_KNOCKOUT_FIXTURES]; }
  function allTabMatches()  { return liveMatches.slice(); }

  // ─── Bracket rounds ───────────────────────────────────────────────────────
  const BRACKET_ROUNDS = [
    { label: 'Round of 32',    ids: ['r32-1','r32-2','r32-3','r32-4','r32-5','r32-6','r32-7','r32-8','r32-9','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'] },
    { label: 'Round of 16',    ids: ['r16-1','r16-2','r16-3','r16-4','r16-5','r16-6','r16-7','r16-8'] },
    { label: 'Quarter-Finals', ids: ['qf-1','qf-2','qf-3','qf-4'] },
    { label: 'Semi-Finals',    ids: ['sf-1','sf-2'] },
    { label: 'Final',          ids: ['final'] },
  ];

  // ─── Admin UIDs ──────────────────────────────────────────────────────────────
  const ADMIN_UIDS = ['rvR3HclRnhXAOd3rgk7sO0s3F7v1'];

  // ─── Team helpers ──────────────────────────────────────────────────────────
  function teamName(t)    { return (t && typeof t === 'object') ? t.name : (t || ''); }
  function teamFlag(t)    { return (t && typeof t === 'object') ? (t.flag || '') : ''; }
  function teamDisplay(t) { return teamFlag(t) ? `${teamFlag(t)} ${teamName(t)}` : teamName(t); }

  // ─── Date formatting ──────────────────────────────────────────────────────────
  function formatDateHeader(isoDate) {
    if (!isoDate) return 'Date TBD';
    const [year, month, day] = isoDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ─── Modal helpers ──────────────────────────────────────────────────────────
  function openModal()  { document.getElementById('auth-modal')?.removeAttribute('hidden'); document.getElementById('auth-backdrop')?.removeAttribute('hidden'); }
  function closeModal() { document.getElementById('auth-modal')?.setAttribute('hidden', ''); document.getElementById('auth-backdrop')?.setAttribute('hidden', ''); }

  // ─── Sub-tab switching ─────────────────────────────────────────────────────────
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

  // ─── Main tab switching ─────────────────────────────────────────────────────────
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
    if (id === 'predictions') switchPredSubtab(activePredSubtab);
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────────────
  watchAuth(async user => {
    if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
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
      bracketPicks = await getBracketPicks(user.uid);
      renderAll();
      unsubPredictions = watchUserPredictions(user.uid, preds => {
        userPredictions = preds || {};
        renderAll();
      });
    } else {
      if (userGreeting) userGreeting.textContent = '';
      userBar?.setAttribute('hidden', '');
      authBtn?.removeAttribute('hidden', '');
      signOutBtn?.setAttribute('hidden', '');
      userPredictions = {};
      bracketPicks    = {};
      renderAll();
    }
  });

  function renderAll() {
    if (activeTab === 'groups')      renderGroups();
    if (activeTab === 'matches')     renderMatches();
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
    if (activeTab === 'predictions' && activePredSubtab !== 'pred-bracket') {
      renderKnockoutBracket();
    }
  }

  // ─── Bracket picks persistence ───────────────────────────────────────────────────
  function persistBracketPicks() {
    if (!currentUser) return;
    clearTimeout(bracketSaveTimer);
    bracketSaveTimer = setTimeout(async () => {
      try { await saveBracketPicks(currentUser.uid, bracketPicks); }
      catch (err) { console.warn('[app] saveBracketPicks error', err); }
    }, 600);
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.view)));
  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab)));
  document.getElementById('auth-btn')?.addEventListener('click', openModal);
  document.getElementById('predict-signin-btn')?.addEventListener('click', openModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());
  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn => btn.addEventListener('click', openModal));
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
    } catch (err) { if (errEl) errEl.textContent = err.message; }
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

  document.getElementById('match-date-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-group-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-venue-filter')?.addEventListener('change', renderMatches);
  document.getElementById('match-team-filter')?.addEventListener('input', renderMatches);
  document.getElementById('pred-date-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', renderPredictions);
  document.getElementById('pred-team-filter')?.addEventListener('input', renderPredictions);

  // ─── Live match data ──────────────────────────────────────────────────────────
  watchMatches(allMatches => {
    allMatches.forEach(um => {
      let idx = liveMatches.findIndex(m => m.id === um.id);
      if (idx === -1) {
        const umHome = teamName(um.home).toLowerCase();
        const umAway = teamName(um.away).toLowerCase();
        if (umHome || umAway) {
          idx = liveMatches.findIndex(m =>
            teamName(m.home).toLowerCase() === umHome &&
            teamName(m.away).toLowerCase() === umAway
          );
        }
      }
      if (idx !== -1) {
        liveMatches[idx] = { ...liveMatches[idx], ...um };
      } else {
        liveMatches.push(um);
      }
    });
    if (authResolved) renderAll();
  });

  // ─── Points calculator ──────────────────────────────────────────────────────────
  function calcPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => { const n = teamName(t); stats[n] = { team: t, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, pts:0 }; });
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
    return Object.values(stats).sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || teamName(a.team).localeCompare(teamName(b.team)));
  }

  const stageKeyToLabel = key => {
    if (/^[A-Z]$/.test(key)) return `Group ${key}`;
    return { R32:'Round of 32', R16:'Round of 16', QF:'Quarter-Finals', SF:'Semi-Finals', '3P':'Third Place', F:'Final' }[key] || key;
  };

  function populateMatchFilters() {
    const dateEl  = document.getElementById('match-date-filter');
    const stageEl = document.getElementById('match-group-filter');
    const venueEl = document.getElementById('match-venue-filter');
    const allMatches = allPredMatches();
    if (dateEl) {
      const dates = [...new Set(allTabMatches().map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${formatDateHeader(d)}</option>`).join('');
    }
    if (stageEl) {
      const stages = [...new Set(allMatches.map(m => m.group || m.stage).filter(Boolean))];
      stageEl.innerHTML = '<option value="all">All Matches</option>' +
        stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
    if (venueEl) {
      const venues = [...new Set(allTabMatches().map(m => m.venue).filter(Boolean))].sort();
      venueEl.innerHTML = '<option value="all">All Venues</option>' +
        venues.map(v => `<option value="${v}">${v}</option>`).join('');
    }
  }

  function populatePredFilters() {
    const dateEl  = document.getElementById('pred-date-filter');
    const stageEl = document.getElementById('pred-group-filter');
    if (dateEl) {
      const dates = [...new Set(allPredMatches().map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${formatDateHeader(d)}</option>`).join('');
    }
    if (stageEl) {
      const stages = [...new Set(allPredMatches().map(m => m.group || m.stage).filter(Boolean))];
      stageEl.innerHTML = '<option value="all">All Matches</option>' +
        stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
  }

  function renderGroups() {
    const grid = document.getElementById('groups-grid');
    if (!grid) return;
    grid.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = liveMatches.filter(m => m.group === group.id);
      const standings = calcPoints(group.teams, groupMatches);
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <h2 class="group-title">Group ${group.id}</h2>
        <table class="standings-table" aria-label="Group ${group.id} standings">
          <thead>
            <tr>
              <th scope="col" class="col-team">Team</th>
              <th scope="col" class="col-num" title="Played">P</th>
              <th scope="col" class="col-num" title="Won">W</th>
              <th scope="col" class="col-num" title="Drawn">D</th>
              <th scope="col" class="col-num" title="Lost">L</th>
              <th scope="col" class="col-num" title="Goals For">GF</th>
              <th scope="col" class="col-num" title="Goals Against">GA</th>
              <th scope="col" class="col-num" title="Goal Difference">GD</th>
              <th scope="col" class="col-num" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr class="${i < 2 ? 'advancing' : ''}">
                <td class="col-team">${teamDisplay(s.team)}</td>
                <td class="col-num">${s.played}</td>
                <td class="col-num">${s.won}</td>
                <td class="col-num">${s.drawn}</td>
                <td class="col-num">${s.lost}</td>
                <td class="col-num">${s.gf}</td>
                <td class="col-num">${s.ga}</td>
                <td class="col-num">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
                <td class="col-num pts">${s.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      grid.appendChild(card);
    });
  }

  function renderByDate(container, matches, isPred) {
    const sorted = [...matches].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const groups = [], seen = {};
    sorted.forEach(m => {
      const key = m.date || '';
      if (!seen[key]) { seen[key] = true; groups.push({ date: key, matches: [] }); }
      groups[groups.length-1].matches.push(m);
    });
    groups.forEach(g => {
      const hdr = document.createElement('div');
      hdr.className = 'date-group-header';
      hdr.textContent = formatDateHeader(g.date);
      container.appendChild(hdr);
      const grp = document.createElement('div');
      grp.className = 'date-group';
      g.matches.forEach(m => grp.appendChild(buildMatchCard(m, isPred)));
      container.appendChild(grp);
    });
  }

  function renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    const dateVal  = document.getElementById('match-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('match-group-filter')?.value || 'all';
    const venueVal = document.getElementById('match-venue-filter')?.value || 'all';
    const teamVal  = (document.getElementById('match-team-filter')?.value || '').toLowerCase().trim();
    let matches = allTabMatches();
    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (venueVal !== 'all') matches = matches.filter(m => m.venue === venueVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) || teamName(m.away).toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
    renderByDate(container, matches, false);
  }

  const TV_ICON = `<svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13.5h6M8 13v.5"/></svg>`;
  const STREAM_ICON = `<svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5C3 4.5 1 6 1 8s2 3.5 2 3.5M13 4.5s2 1.5 2 3.5-2 3.5-2 3.5M5.5 6.5S4.5 7 4.5 8s1 1.5 1 1.5M10.5 6.5S11.5 7 11.5 8s-1 1.5-1 1.5"/><circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none"/></svg>`;

  function buildBroadcastRow(m) {
    const parts = [];
    const tvEn  = Array.isArray(m.tvEnglish)  ? m.tvEnglish  : (m.tvEnglish  ? [m.tvEnglish]  : []);
    const tvEs  = Array.isArray(m.tvSpanish)  ? m.tvSpanish  : (m.tvSpanish  ? [m.tvSpanish]  : []);
    const strm  = Array.isArray(m.streaming)  ? m.streaming  : (m.streaming  ? [m.streaming]  : []);
    if (tvEn.length || tvEs.length) {
      const combined = [...new Set([...tvEn, ...tvEs])];
      parts.push(`<span class="card-meta-item">${TV_ICON}${combined.map(c => `<span class="broadcaster-chip">${c}</span>`).join('')}</span>`);
    }
    if (strm.length) {
      parts.push(`<span class="card-meta-item">${STREAM_ICON}${strm.map(s => `<span class="broadcaster-chip broadcaster-chip--stream">${s}</span>`).join('')}</span>`);
    }
    return parts.length ? `<div class="card-meta card-meta-broadcast">${parts.join('')}</div>` : '';
  }

  function buildMatchCard(m, isPred) {
    const card     = document.createElement('div');
    card.className = 'match-card' + (m.status === 'live' ? ' match-card-live' : '');
    const stageLabel = m.group ? `Group ${m.group}` : stageKeyToLabel(m.stage || '');
    const isKnockout = !!m.homeSource;
    const hn = isKnockout && isPred
      ? (resolveKnockoutTeamForPreds(m.homeSource || m.home) || slotLabel(m.homeSource))
      : teamName(m.home);
    const an = isKnockout && isPred
      ? (resolveKnockoutTeamForPreds(m.awaySource || m.away) || slotLabel(m.awaySource))
      : teamName(m.away);
    const hFlag = isKnockout ? '' : teamFlag(m.home);
    const aFlag = isKnockout ? '' : teamFlag(m.away);
    const isLocked   = m.status === 'ft' || m.status === 'final';
    let statusBadge = '';
    if      (m.status === 'live')                       statusBadge = '<span class="status-badge status-live"><span class="live-dot"></span>Live</span>';
    else if (m.status === 'ht')                         statusBadge = '<span class="status-badge status-ht">HT</span>';
    else if (m.status === 'ft' || m.status === 'final') statusBadge = '<span class="status-badge status-ft">FT</span>';

    // Score column: always read-only on the Matches page (isPred=false).
    // Only show prediction inputs on the Predictions page (isPred=true).
    let scoreColHtml = '';
    if (isPred && currentUser) {
      const pred = userPredictions[m.id] || {};
      const hVal = pred.home !== undefined ? pred.home : '';
      const aVal = pred.away !== undefined ? pred.away : '';
      scoreColHtml = `
        <div class="card-score-col">
          <div class="score-inputs-wrap">
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="home" value="${hVal}" aria-label="${hn} predicted score"${isLocked ? ' disabled' : ''}>
            <span class="score-sep">–</span>
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="away" value="${aVal}" aria-label="${an} predicted score"${isLocked ? ' disabled' : ''}>
          </div>
          ${!isLocked ? `<button class="btn-save pred-btn save-pred-btn" data-match="${m.id}">Save</button>` : ''}
          <span class="pred-saving" hidden>Saving…</span>
          <span class="pred-saved"  hidden>Saved ✓</span>
          <span class="pred-error"  hidden></span>
        </div>`;
    } else {
      // Read-only score display — used for both the Matches page (all users incl. admin)
      // and the Predictions page when not signed in.
      const hs  = m.homeScore != null ? m.homeScore : '–';
      const as_ = m.awayScore != null ? m.awayScore : '–';
      const cls = m.status === 'live' ? 'score-final score-live' : m.homeScore != null ? 'score-final' : 'score-final score-pending';
      scoreColHtml = `<div class="card-score-col"><span class="${cls}">${hs} – ${as_}</span></div>`;
    }

    const dtStr = [m.timeLocal, m.tz].filter(Boolean).join(' ');
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
        ${m.venue ? `<span class="card-meta-item"><svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M13 6c0 4.5-5 8.5-5 8.5S3 10.5 3 6a5 5 0 0 1 10 0z"/></svg>${m.venue}${m.city ? ', '+m.city : ''}</span>` : ''}
        ${dtStr  ? `<span class="card-meta-item"><svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 1.5v3M11 1.5v3M2 7h12"/></svg>${dtStr}</span>` : ''}
      </div>` : ''}
      ${buildBroadcastRow(m)}`;

    if (isPred && currentUser) {
      card.querySelector('.save-pred-btn')?.addEventListener('click', async () => {
        const savingEl = card.querySelector('.pred-saving');
        const savedEl  = card.querySelector('.pred-saved');
        const errEl    = card.querySelector('.pred-error');
        const btn      = card.querySelector('.save-pred-btn');
        const homeVal  = parseInt(card.querySelector('[data-side="home"]')?.value);
        const awayVal  = parseInt(card.querySelector('[data-side="away"]')?.value);
        if (isNaN(homeVal) || isNaN(awayVal)) { if (errEl) { errEl.textContent = 'Enter both scores.'; errEl.hidden = false; } return; }
        if (errEl)    errEl.hidden    = true;
        if (savingEl) savingEl.hidden = false;
        if (btn)      btn.disabled    = true;
        userPredictions[m.id] = { home: homeVal, away: awayVal };
        try {
          await savePrediction(currentUser.uid, m.id, homeVal, awayVal);
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
    return card;
  }

  function renderPredictions() {
    const container  = document.getElementById('predictions-list');
    const authPrompt = document.getElementById('predictions-auth-prompt');
    const filtersBar = document.getElementById('pred-filters');
    if (!container) return;
    if (!authResolved) {
      authPrompt?.setAttribute('hidden', '');
      if (filtersBar) filtersBar.hidden = true;
      container.innerHTML = '<p class="empty-filter-msg">Loading…</p>';
      return;
    }
    if (!currentUser) {
      authPrompt?.removeAttribute('hidden');
      if (filtersBar) filtersBar.hidden = true;
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    if (filtersBar) filtersBar.hidden = false;
    populatePredFilters();
    const dateVal  = document.getElementById('pred-date-filter')?.value  || 'all';
    const stageVal = document.getElementById('pred-group-filter')?.value || 'all';
    const teamVal  = (document.getElementById('pred-team-filter')?.value || '').toLowerCase().trim();
    let matches = allPredMatches();
    if (dateVal  !== 'all') matches = matches.filter(m => m.date === dateVal);
    if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
    if (teamVal)            matches = matches.filter(m =>
      teamName(m.home).toLowerCase().includes(teamVal) || teamName(m.away).toLowerCase().includes(teamVal));
    container.innerHTML = '';
    if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
    renderByDate(container, matches, true);
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
      const predMatches  = groupMatches.map(m => {
        const pred = userPredictions[m.id];
        return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
      });
      const standings = calcPoints(group.teams, predMatches);
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <h2 class="group-title">Group ${group.id}</h2>
        <table class="standings-table" aria-label="Predicted Group ${group.id} standings">
          <thead>
            <tr>
              <th scope="col" class="col-team">Team</th>
              <th scope="col" class="col-num" title="Played">P</th>
              <th scope="col" class="col-num" title="Won">W</th>
              <th scope="col" class="col-num" title="Drawn">D</th>
              <th scope="col" class="col-num" title="Lost">L</th>
              <th scope="col" class="col-num" title="Goals For">GF</th>
              <th scope="col" class="col-num" title="Goals Against">GA</th>
              <th scope="col" class="col-num" title="Goal Difference">GD</th>
              <th scope="col" class="col-num" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr class="${i < 2 ? 'advancing' : ''}">
                <td class="col-team">${teamDisplay(s.team)}</td>
                <td class="col-num">${s.played}</td>
                <td class="col-num">${s.won}</td>
                <td class="col-num">${s.drawn}</td>
                <td class="col-num">${s.lost}</td>
                <td class="col-num">${s.gf}</td>
                <td class="col-num">${s.ga}</td>
                <td class="col-num">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
                <td class="col-num pts">${s.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      container.appendChild(card);
    });
  }

  function renderPredStandings() {
    const container  = document.getElementById('pred-standings-container');
    const authPrompt = document.getElementById('pred-standings-auth-prompt');
    if (!container) return;
    if (!currentUser) {
      authPrompt?.removeAttribute('hidden');
      container.innerHTML = '';
      return;
    }
    authPrompt?.setAttribute('hidden', '');
    const finishedMatches = liveMatches.filter(m => (m.status === 'ft' || m.status === 'final') && m.homeScore != null && m.awayScore != null);
    if (!finishedMatches.length) {
      container.innerHTML = '<p class="empty-filter-msg">No finished matches yet.</p>';
      return;
    }
    let exact = 0, correct = 0, total = finishedMatches.length;
    finishedMatches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.home === undefined) return;
      const ph = pred.home, pa = pred.away;
      const ah = m.homeScore, aa = m.awayScore;
      if (ph === ah && pa === aa) { exact++; correct++; }
      else if ((ph > pa && ah > aa) || (ph < pa && ah < aa) || (ph === pa && ah === aa)) correct++;
    });
    const pct = total ? Math.round((correct / total) * 100) : 0;
    container.innerHTML = `
      <div class="pred-stats">
        <div class="pred-stat-card"><span class="pred-stat-val">${exact}</span><span class="pred-stat-lbl">Exact scores</span></div>
        <div class="pred-stat-card"><span class="pred-stat-val">${correct}</span><span class="pred-stat-lbl">Correct results</span></div>
        <div class="pred-stat-card"><span class="pred-stat-val">${total}</span><span class="pred-stat-lbl">Matches played</span></div>
        <div class="pred-stat-card"><span class="pred-stat-val">${pct}%</span><span class="pred-stat-lbl">Accuracy</span></div>
      </div>`;
  }

  function slotLabel(source) {
    if (!source) return '?';
    if (source.type === 'group') return `${source.pos === 1 ? '1st' : '2nd'} Group ${source.group}`;
    if (source.type === 'best3rd') return `Best 3rd #${source.rank}`;
    if (source.type === 'winner') return `Winner R${source.match}`;
    return '?';
  }

  function resolveKnockoutTeamForPreds(source) {
    if (!source || typeof source === 'string') return null;
    if (source.type === 'group') {
      const gm = liveMatches.filter(m => m.group === source.group);
      const group = WC_GROUPS.find(g => g.id === source.group);
      if (!group) return null;
      const standings = calcPoints(group.teams, gm.map(m => {
        const pred = userPredictions[m.id];
        return pred ? { ...m, homeScore: pred.home, awayScore: pred.away } : m;
      }));
      const team = standings[source.pos - 1]?.team;
      return team ? teamDisplay(team) : null;
    }
    return null;
  }

  function renderKnockoutBracket() {
    const container = document.getElementById('pred-bracket-container');
    if (!container) return;
    container.innerHTML = '';
    BRACKET_ROUNDS.forEach(round => {
      const section = document.createElement('div');
      section.className = 'bracket-round';
      section.innerHTML = `<h3 class="bracket-round-label">${round.label}</h3>`;
      const grid = document.createElement('div');
      grid.className = 'bracket-matchups';
      round.ids.forEach(matchId => {
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;
        const hn = currentUser
          ? (resolveKnockoutTeamForPreds(fixture.homeSource) || slotLabel(fixture.homeSource))
          : slotLabel(fixture.homeSource);
        const an = currentUser
          ? (resolveKnockoutTeamForPreds(fixture.awaySource) || slotLabel(fixture.awaySource))
          : slotLabel(fixture.awaySource);
        const pick = bracketPicks[matchId];
        const matchup = document.createElement('div');
        matchup.className = 'bracket-matchup';
        matchup.innerHTML = `
          <button class="bracket-team ${pick === 'home' ? 'picked' : ''}" data-match="${matchId}" data-side="home">${hn}</button>
          <span class="bracket-vs">vs</span>
          <button class="bracket-team ${pick === 'away' ? 'picked' : ''}" data-match="${matchId}" data-side="away">${an}</button>`;
        matchup.querySelectorAll('.bracket-team').forEach(btn => {
          btn.addEventListener('click', () => {
            if (!currentUser) { openModal(); return; }
            const side = btn.dataset.side;
            bracketPicks[matchId] = side;
            persistBracketPicks();
            matchup.querySelectorAll('.bracket-team').forEach(b => b.classList.remove('picked'));
            btn.classList.add('picked');
          });
        });
        grid.appendChild(matchup);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  populateMatchFilters();
  renderGroups();

  window._wc = { getAllMatches() { return [...liveMatches]; } };

})();
