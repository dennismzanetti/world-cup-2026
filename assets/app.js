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
  const ADMIN_UIDS = ['EAi3lYhlSFYGaqm9F87BdJb1Vrg1'];

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
  // Merge Firestore docs into liveMatches.
  // Strategy:
  //   1. Match by exact `id` field.
  //   2. Fallback: match by home/away team name pair (handles admin-assigned IDs).
  //   3. If still unmatched, append as a new entry so no data is lost.
  watchMatches(allMatches => {
    allMatches.forEach(um => {
      // Try exact id match first
      let idx = liveMatches.findIndex(m => m.id === um.id);

      // Fallback: match by home+away team names (case-insensitive)
      if (idx === -1 && (um.home || um.away)) {
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
        // Merge Firestore fields over static data, preserving static group/team metadata
        liveMatches[idx] = { ...liveMatches[idx], ...um };
      }
      // Note: we intentionally do NOT append unknown docs — group stage standings
      // rely on WC_MATCHES having the full team objects with flags.
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

  // ─── Stage label ────────────────────────────────────────────────────────────────────
  const stageKeyToLabel = key => ({
    R32:'Round of 32', R16:'Round of 16', QF:'Quarter-Finals', SF:'Semi-Finals', '3P':'Third Place', F:'Final'
  }[key] || (/^[A-Z]$/.test(key) ? `Group ${key}` : key));

  // ─── Populate filters (Matches tab) ───────────────────────────────────────────────
  function populateMatchFilters() {
    const dateEl  = document.getElementById('match-date-filter');
    const stageEl = document.getElementById('match-group-filter');
    const venueEl = document.getElementById('match-venue-filter');
    if (dateEl) {
      const dates = [...new Set(allTabMatches().map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${formatDateHeader(d)}</option>`).join('');
    }
    if (stageEl) {
      const stages = [...new Set(allTabMatches().map(m => m.group || m.stage).filter(Boolean))];
      stageEl.innerHTML = '<option value="all">All Matches</option>' +
        stages.map(s => `<option value="${s}">${stageKeyToLabel(s)}</option>`).join('');
    }
    if (venueEl) {
      const venues = [...new Set(allTabMatches().map(m => m.venue).filter(Boolean))].sort();
      venueEl.innerHTML = '<option value="all">All Venues</option>' +
        venues.map(v => `<option value="${v}">${v}</option>`).join('');
    }
  }

  // ─── Populate filters (Predictions tab) ───────────────────────────────────────────────
  function populatePredFilters() {
    const dateEl  = document.getElementById('pred-date-filter');
    const stageEl = document.getElementById('pred-group-filter');
    if (dateEl) {
      const prevVal = dateEl.value;
      const dates = [...new Set(allPredMatches().map(m => m.date).filter(Boolean))].sort();
      dateEl.innerHTML = '<option value="all">All Dates</option>' +
        dates.map(d => `<option value="${d}">${formatDateHeader(d)}</option>`).join('');
      if (prevVal && dates.includes(prevVal)) dateEl.value = prevVal;
    }
    if (stageEl && stageEl.options.length <= 1) {
      WC_GROUPS.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = `Group ${g.id}`;
        stageEl.appendChild(opt);
      });
      const stageOrder = ['Round of 32','Round of 16','Quarterfinals','Semifinals','Third Place','Final'];
      const stageLabelMap = { 'Round of 32':'Round of 32','Round of 16':'Round of 16','Quarterfinals':'Quarter-Finals','Semifinals':'Semi-Finals','Third Place':'Third Place','Final':'Final' };
      const presentStages = new Set(WC_KNOCKOUT_FIXTURES.map(f => f.stage).filter(Boolean));
      stageOrder.filter(s => presentStages.has(s)).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = stageLabelMap[s] || s;
        stageEl.appendChild(opt);
      });
    }
  }

  // ─── Groups ──────────────────────────────────────────────────────────────────────────
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
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${standings.map((s,i) => `
            <tr class="${i < 2 ? 'qualify' : ''}">
              <td>${teamDisplay(s.team)}</td><td>${s.played}</td><td>${s.won}</td>
              <td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td>
              <td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td>
              <td><strong>${s.pts}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      // Group matches section
      const matchesWrap = document.createElement('div');
      matchesWrap.className = 'group-matches-list';
      groupMatches
        .slice()
        .sort((a, b) => {
          const da = (a.date || '') + (a.timeLocal || '');
          const db = (b.date || '') + (b.timeLocal || '');
          return da < db ? -1 : da > db ? 1 : 0;
        })
        .forEach(m => {
          const hs  = m.homeScore != null ? m.homeScore : '–';
          const as_ = m.awayScore != null ? m.awayScore : '–';
          const cls = m.status === 'live' ? 'score-final score-live' : m.homeScore != null ? 'score-final' : 'score-final score-pending';
          const row = document.createElement('div');
          row.className = 'group-match-row';
          row.innerHTML = `
            <span class="group-match-home">${teamFlag(m.home) ? `<span class="team-flag">${teamFlag(m.home)}</span>` : ''}<span>${teamName(m.home)}</span></span>
            <span class="${cls}">${hs} – ${as_}</span>
            <span class="group-match-away"><span>${teamName(m.away)}</span>${teamFlag(m.away) ? `<span class="team-flag">${teamFlag(m.away)}</span>` : ''}</span>`;
          matchesWrap.appendChild(row);
        });
      card.appendChild(matchesWrap);
      container.appendChild(card);
    });
  }

  // ─── Render by date ─────────────────────────────────────────────────────────────
  function renderByDate(container, matches, isPred) {
    const sorted = matches.slice().sort((a,b) => {
      const da = (a.date||'') + (a.timeLocal||'');
      const db = (b.date||'') + (b.timeLocal||'');
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

  // ─── Matches tab ──────────────────────────────────────────────────────────────────
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

  // ─── Broadcaster row builder ─────────────────────────────────────────────────────
  // TV icon SVG
  const TV_ICON = `<svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13.5h6M8 13v.5"/></svg>`;
  // Stream icon SVG
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

  // ─── Match card ────────────────────────────────────────────────────────────────────
  function buildMatchCard(m, isPred) {
    const card     = document.createElement('div');
    card.className = 'match-card' + (m.status === 'live' ? ' match-card-live' : '');
    const stageLabel = m.group ? `Group ${m.group}` : stageKeyToLabel(m.stage || '');
    const isAdmin    = currentUser && ADMIN_UIDS.includes(currentUser.uid);
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
    } else if (!isPred && isAdmin) {
      scoreColHtml = `
        <div class="card-score-col">
          <div class="score-inputs-wrap">
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="home" value="${m.homeScore != null ? m.homeScore : ''}" aria-label="${hn} score">
            <span class="score-sep">–</span>
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="away" value="${m.awayScore != null ? m.awayScore : ''}" aria-label="${an} score">
          </div>
          <button class="btn-save save-score-btn" data-match="${m.id}">Save</button>
          <span class="result-saved" style="display:none">Saved ✓</span>
        </div>`;
    } else {
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
        } catch (err) { console.warn('[app] updateMatchResult error', err); if (btn) btn.disabled = false; }
      });
    }
    return card;
  }

  // ─── Predictions (My Picks) ────────────────────────────────────────────────────────
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

  // ─── Predicted Group Standings ────────────────────────────────────────────────────────
  function calcPredPoints(teams, matches) {
    const stats = {};
    teams.forEach(t => { const n = teamName(t); stats[n] = { team:t, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, pts:0 }; });
    matches.forEach(m => {
      const pred = userPredictions[m.id];
      if (!pred || pred.home == null || pred.away == null) return;
      const hn = teamName(m.home), an = teamName(m.away);
      if (!stats[hn] || !stats[an]) return;
      const h = pred.home, a = pred.away;
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

  function renderPredGroupStandings() {
    const container  = document.getElementById('pred-group-standings-container');
    const authPrompt = document.getElementById('pred-group-standings-auth-prompt');
    if (!container) return;
    if (!currentUser) { authPrompt?.removeAttribute('hidden'); container.innerHTML = ''; return; }
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
          <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${standings.map((s,i) => `
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

  // ─── Prediction Accuracy ─────────────────────────────────────────────────────────────
  function renderPredStandings() {
    const container  = document.getElementById('pred-standings-container');
    const authPrompt = document.getElementById('pred-standings-auth-prompt');
    if (!container) return;
    if (!authResolved || !currentUser) { authPrompt?.removeAttribute('hidden'); container.innerHTML = ''; return; }
    authPrompt?.setAttribute('hidden', '');
    let correctExact = 0, correctResult = 0, total = 0;
    allPredMatches().forEach(match => {
      const pred = userPredictions[match.id];
      if (!pred || pred.home == null || pred.away == null) return;
      if (match.homeScore == null || match.awayScore == null) return;
      total++;
      const predResult   = pred.home > pred.away ? 'H' : pred.home < pred.away ? 'A' : 'D';
      const actualResult = match.homeScore > match.awayScore ? 'H' : match.homeScore < match.awayScore ? 'A' : 'D';
      if (pred.home === match.homeScore && pred.away === match.awayScore) { correctExact++; correctResult++; }
      else if (predResult === actualResult) { correctResult++; }
    });
    const pct = total > 0 ? Math.round((correctResult / total) * 100) : 0;
    container.innerHTML = `
      <div class="pred-stats-grid">
        <div class="pred-stat-card"><div class="pred-stat-value">${total}</div><div class="pred-stat-label">Matches Predicted</div></div>
        <div class="pred-stat-card"><div class="pred-stat-value">${correctResult}</div><div class="pred-stat-label">Correct Results</div></div>
        <div class="pred-stat-card"><div class="pred-stat-value">${correctExact}</div><div class="pred-stat-label">Exact Scores</div></div>
        <div class="pred-stat-card"><div class="pred-stat-value">${pct}%</div><div class="pred-stat-label">Accuracy</div></div>
      </div>`;
  }

  // ─── Knockout Bracket ─────────────────────────────────────────────────────────────────

  function getActualGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    if (gm.some(m => m.homeScore == null)) return null;
    return calcPoints(group.teams, gm)[rank-1]?.team || null;
  }

  function getPredictedGroupFinisher(groupId, rank) {
    const group = WC_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const gm = liveMatches.filter(m => m.group === groupId);
    if (!gm.some(m => userPredictions[m.id]?.home != null)) return null;
    return calcPredPoints(group.teams, gm)[rank-1]?.team || null;
  }

  function resolveKnockoutTeam(slot, depth = 0) {
    if (depth > 10 || !slot) return slot;
    const groupMatch = slot.match(/^(\d)([A-Z])$/);
    if (groupMatch) {
      const t = getActualGroupFinisher(groupMatch[2], parseInt(groupMatch[1]))
             || getPredictedGroupFinisher(groupMatch[2], parseInt(groupMatch[1]));
      return t ? teamName(t) : slot;
    }
    const winnerMatch = slot.match(/^W(.+)$/);
    if (winnerMatch) {
      const fixtureId = winnerMatch[1];
      const fixture   = WC_KNOCKOUT_FIXTURES.find(f => f.id === fixtureId);
      const pick      = bracketPicks[fixtureId];
      if (!fixture || !pick) return slot;
      return pick === 'home'
        ? resolveKnockoutTeam(fixture.home, depth + 1)
        : resolveKnockoutTeam(fixture.away, depth + 1);
    }
    return slot;
  }

  function slotLabel(source) {
    if (!source) return 'TBD';
    if (source.type === 'group') {
      const ord = ['','1st','2nd','3rd','4th'][source.pos] || `${source.pos}th`;
      return `${ord} Group ${source.group}`;
    }
    if (source.type === 'winner') return `W ${source.matchId.toUpperCase()}`;
    if (source.type === 'best3rd') return `Best 3rd #${source.rank}`;
    return 'TBD';
  }

  function resolveKnockoutTeamForPreds(source, depth = 0) {
    if (depth > 10 || source == null) return null;
    if (typeof source === 'string' || (typeof source === 'object' && source.name)) {
      const name = typeof source === 'string' ? source : source.name;
      const gm = name.match(/^(\d)([A-Z])$/);
      if (gm) source = { type: 'group', group: gm[2], pos: parseInt(gm[1]) };
      else {
        const wm = name.replace(/\s+/g, '').match(/^[Ww](.+)$/);
        if (wm) source = { type: 'winner', matchId: wm[1].toLowerCase() };
        else return name;
      }
    }
    if (source.type === 'group') {
      const t = getPredictedGroupFinisher(source.group, source.pos);
      return t ? teamName(t) : null;
    }
    if (source.type === 'winner') {
      const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === source.matchId);
      const pick    = bracketPicks[source.matchId];
      if (!fixture || !pick) return null;
      const nextSource = pick === 'home' ? fixture.homeSource : fixture.awaySource;
      return resolveKnockoutTeamForPreds(nextSource || (pick === 'home' ? fixture.home : fixture.away), depth + 1);
    }
    if (source.type === 'best3rd') return null;
    return null;
  }

  function clearDownstreamPicks(fixtureId) {
    const toVisit = [fixtureId], visited = new Set();
    while (toVisit.length) {
      const id = toVisit.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      delete bracketPicks[id];
      WC_KNOCKOUT_FIXTURES.forEach(f => {
        if ((f.homeSource?.type === 'winner' && f.homeSource.matchId === id) ||
            (f.awaySource?.type === 'winner' && f.awaySource.matchId === id)) toVisit.push(f.id);
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
    const totalPicks = BRACKET_ROUNDS.reduce((s, r) => s + r.ids.length, 0);
    const madePicks  = BRACKET_ROUNDS.reduce((s, r) => s + r.ids.filter(id => bracketPicks[id]).length, 0);
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
    BRACKET_ROUNDS.forEach(round => {
      const roundEl = document.createElement('div');
      roundEl.className = 'bracket-round';
      const labelEl = document.createElement('div');
      labelEl.className = 'bracket-round-label';
      labelEl.textContent = round.label;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-xs btn-ghost bracket-round-reset';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', () => {
        round.ids.forEach(id => clearDownstreamPicks(id));
        persistBracketPicks(); renderKnockoutBracket();
      });
      labelEl.appendChild(resetBtn);
      roundEl.appendChild(labelEl);
      round.ids.forEach(matchId => {
        const fixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === matchId);
        if (!fixture) return;
        const homeTeam = resolveKnockoutTeamForPreds(fixture.homeSource || fixture.home);
        const awayTeam = resolveKnockoutTeamForPreds(fixture.awaySource || fixture.away);
        const pick     = bracketPicks[matchId];
        const matchEl  = document.createElement('div');
        matchEl.className = 'bracket-match';
        const homeEl = document.createElement('div');
        homeEl.className = 'bracket-team' + (pick === 'home' ? ' picked' : '') + (homeTeam ? '' : ' tbd');
        homeEl.textContent = homeTeam || slotLabel(fixture.homeSource);
        homeEl.addEventListener('click', () => {
          if (bracketPicks[matchId] !== 'home') clearDownstreamPicks(matchId);
          bracketPicks[matchId] = 'home';
          persistBracketPicks(); renderKnockoutBracket();
        });
        const awayEl = document.createElement('div');
        awayEl.className = 'bracket-team' + (pick === 'away' ? ' picked' : '') + (awayTeam ? '' : ' tbd');
        awayEl.textContent = awayTeam || slotLabel(fixture.awaySource);
        awayEl.addEventListener('click', () => {
          if (bracketPicks[matchId] !== 'away') clearDownstreamPicks(matchId);
          bracketPicks[matchId] = 'away';
          persistBracketPicks(); renderKnockoutBracket();
        });
        matchEl.appendChild(homeEl);
        matchEl.appendChild(awayEl);
        roundEl.appendChild(matchEl);
      });
      scrollArea.appendChild(roundEl);
    });
    const finalId      = 'final';
    const finalFixture = WC_KNOCKOUT_FIXTURES.find(f => f.id === finalId);
    const finalPick    = bracketPicks[finalId];
    let champion = null;
    if (finalPick && finalFixture) {
      champion = finalPick === 'home'
        ? resolveKnockoutTeam(finalFixture.home)
        : resolveKnockoutTeam(finalFixture.away);
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
      bracketPicks = {}; persistBracketPicks(); renderKnockoutBracket();
    });
    container.querySelector('#bracket-seed-btn')?.addEventListener('click', () => {
      WC_KNOCKOUT_FIXTURES.forEach(f => { if (!bracketPicks[f.id]) bracketPicks[f.id] = 'home'; });
      persistBracketPicks(); renderKnockoutBracket();
    });
  }

  // ─── Init ───────────────────────────────────────────────────────────────────────────
  function init() {
    populateMatchFilters();
    populatePredFilters();
    renderGroups();
  }
  init();

  window._wc = { getAllMatches() { return [...liveMatches]; } };

})();
