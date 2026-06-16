import { teamName, teamFlag } from '../utils/teamData.js';
import { isFinished, stageKeyToLabel, formatDateHeader, parseTimeMins } from '../utils/filters.js';
import { predOutcome } from '../utils/stats.js';
import { savePrediction } from '../db.js';

export const TV_ICON     = `<svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13.5h6M8 13v.5"/></svg>`;
export const STREAM_ICON = `<svg class="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5C3 4.5 1 6 1 8s2 3.5 2 3.5M13 4.5s2 1.5 2 3.5-2 3.5-2 3.5M5.5 6.5S4.5 7 4.5 8s1 1.5 1 1.5M10.5 6.5S11.5 7 11.5 8s-1 1.5-1 1.5"/><circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none"/></svg>`;

export function buildBroadcastRow(m) {
  const parts = [];
  const tvEn  = Array.isArray(m.tvEnglish) ? m.tvEnglish  : (m.tvEnglish  ? [m.tvEnglish]  : []);
  const tvEs  = Array.isArray(m.tvSpanish) ? m.tvSpanish  : (m.tvSpanish  ? [m.tvSpanish]  : []);
  const strm  = Array.isArray(m.streaming) ? m.streaming  : (m.streaming  ? [m.streaming]  : []);
  if (tvEn.length || tvEs.length) {
    const combined = [...new Set([...tvEn, ...tvEs])];
    parts.push(`<span class="card-meta-item">${TV_ICON}${combined.map(c => `<span class="broadcaster-chip">${c}</span>`).join('')}</span>`);
  }
  if (strm.length) {
    parts.push(`<span class="card-meta-item">${STREAM_ICON}${strm.map(s => `<span class="broadcaster-chip broadcaster-chip--stream">${s}</span>`).join('')}</span>`);
  }
  return parts.length ? `<div class="card-meta card-meta-broadcast">${parts.join('')}</div>` : '';
}

export function buildMatchCard(m, isPred, {
  KNOCKOUT_IDS,
  currentUser,
  userPredictions,
  resolveKnockoutTeamForPreds,
  slotLabel,
  openModal,
  renderPredictions,
  renderKnockoutBracket,
  activePredSubtab,
}) {
  const card     = document.createElement('div');
  const finished = isFinished(m);
  card.className = 'match-card' + (m.status === 'live' ? ' match-card-live' : '');
  const stageLabel = m.group ? `Group ${m.group}` : stageKeyToLabel(m.stage || '');
  const isKnockout = KNOCKOUT_IDS.has(m.id);
  const hn = isKnockout && isPred
    ? (resolveKnockoutTeamForPreds(m.homeSource || m.home) || slotLabel(m.homeSource))
    : teamName(m.home);
  const an = isKnockout && isPred
    ? (resolveKnockoutTeamForPreds(m.awaySource || m.away) || slotLabel(m.awaySource))
    : teamName(m.away);
  const hFlag = isKnockout ? '' : teamFlag(m.home);
  const aFlag = isKnockout ? '' : teamFlag(m.away);
  let statusBadge = '';
  if      (m.status === 'live')  statusBadge = '<span class="status-badge status-live"><span class="live-dot"></span>Live</span>';
  else if (m.status === 'ht')    statusBadge = '<span class="status-badge status-ht">HT</span>';
  else if (finished)             statusBadge = '<span class="status-badge status-ft">FT</span>';

  let scoreColHtml = '';
  if (isPred && currentUser) {
    const pred = userPredictions[m.id] || {};
    const hVal = pred.home !== undefined ? pred.home : '';
    const aVal = pred.away !== undefined ? pred.away : '';

    if (finished && m.homeScore != null) {
      const outcome = predOutcome(pred, m);
      const hasPred = outcome !== 'none';
      const outcomeClass = hasPred ? `pred-outcome--${outcome}` : 'pred-outcome--none';
      const outcomeLabel = { exact: '🎯 Exact!', correct: '✅ Correct result', wrong: '❌ Wrong', none: 'No prediction' }[outcome];
      scoreColHtml = `
        <div class="card-score-col pred-score-col--finished">
          <span class="score-final">${m.homeScore} – ${m.awayScore}</span>
          <div class="pred-result-row ${outcomeClass}">
            <span class="pred-result-label">Your pick:</span>
            <span class="pred-result-score">${hasPred ? `${hVal} – ${aVal}` : '—'}</span>
          </div>
          <span class="pred-outcome-badge ${outcomeClass}">${outcomeLabel}</span>
        </div>`;
    } else {
      const isTied    = hVal !== '' && aVal !== '' && Number(hVal) === Number(aVal);
      const pkVal     = pred.pk || '';
      const pkHomeCls = pkVal === 'home' ? ' pk-selected' : '';
      const pkAwayCls = pkVal === 'away' ? ' pk-selected' : '';
      const pkRowHtml = isKnockout && isTied ? `
        <div class="pk-row" data-match="${m.id}">
          <span class="pk-label">PK winner:</span>
          <button class="pk-btn pk-btn-home${pkHomeCls}" data-match="${m.id}" data-pk="home">${hFlag} ${hn}</button>
          <button class="pk-btn pk-btn-away${pkAwayCls}" data-match="${m.id}" data-pk="away">${an} ${aFlag}</button>
        </div>` : '';
      scoreColHtml = `
        <div class="card-score-col">
          <div class="score-inputs-wrap">
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="home" value="${hVal}" aria-label="${hn} predicted score">
            <span class="score-sep">–</span>
            <input type="number" class="score-input" min="0" max="99" data-match="${m.id}" data-side="away" value="${aVal}" aria-label="${an} predicted score">
          </div>
          ${isKnockout ? pkRowHtml : ''}
          <button class="btn-save pred-btn save-pred-btn" data-match="${m.id}">Save</button>
          <span class="pred-saving" hidden>Saving…</span>
          <span class="pred-saved"  hidden>Saved ✓</span>
          <span class="pred-error"  hidden></span>
        </div>`;
    }
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

  if (isPred && currentUser && !finished) {
    card.querySelectorAll('.pk-btn').forEach(pkBtn => {
      pkBtn.addEventListener('click', () => {
        const pk = pkBtn.dataset.pk;
        const current = userPredictions[m.id]?.pk;
        const newPk = current === pk ? undefined : pk;
        userPredictions[m.id] = { ...(userPredictions[m.id] || {}), pk: newPk };
        card.querySelectorAll('.pk-btn').forEach(b => b.classList.remove('pk-selected'));
        if (newPk) pkBtn.classList.add('pk-selected');
        const hv = parseInt(card.querySelector('[data-side="home"]')?.value);
        const av = parseInt(card.querySelector('[data-side="away"]')?.value);
        if (!isNaN(hv) && !isNaN(av)) {
          savePrediction(currentUser.uid, m.id, hv, av, newPk).catch(console.warn);
          if (activePredSubtab() === 'pred-bracket') renderKnockoutBracket();
        }
      });
    });

    if (isKnockout) {
      const homeInput = card.querySelector('[data-side="home"]');
      const awayInput = card.querySelector('[data-side="away"]');
      const updatePkRow = () => {
        const hv = parseInt(homeInput?.value);
        const av = parseInt(awayInput?.value);
        const pkRow = card.querySelector('.pk-row');
        if (!pkRow) {
          if (!isNaN(hv) && !isNaN(av) && hv === av) {
            userPredictions[m.id] = { ...(userPredictions[m.id] || {}), home: hv, away: av };
            renderPredictions();
          }
          return;
        }
        const isTied = !isNaN(hv) && !isNaN(av) && hv === av;
        pkRow.style.display = isTied ? '' : 'none';
      };
      homeInput?.addEventListener('input', updatePkRow);
      awayInput?.addEventListener('input', updatePkRow);
    }

    card.querySelector('.save-pred-btn')?.addEventListener('click', async () => {
      const savingEl = card.querySelector('.pred-saving');
      const savedEl  = card.querySelector('.pred-saved');
      const errEl    = card.querySelector('.pred-error');
      const btn      = card.querySelector('.save-pred-btn');
      const homeVal  = parseInt(card.querySelector('[data-side="home"]')?.value);
      const awayVal  = parseInt(card.querySelector('[data-side="away"]')?.value);
      if (isNaN(homeVal) || isNaN(awayVal)) { if (errEl) { errEl.textContent = 'Enter both scores.'; errEl.hidden = false; } return; }
      const pkPick = isKnockout ? (userPredictions[m.id]?.pk || card.querySelector('.pk-btn.pk-selected')?.dataset.pk) : undefined;
      if (errEl)    errEl.hidden    = true;
      if (savingEl) savingEl.hidden = false;
      if (btn)      btn.disabled    = true;
      userPredictions[m.id] = { home: homeVal, away: awayVal, ...(pkPick ? { pk: pkPick } : {}) };
      try {
        await savePrediction(currentUser.uid, m.id, homeVal, awayVal, pkPick);
        if (savingEl) savingEl.hidden = true;
        if (savedEl)  { savedEl.hidden = false; setTimeout(() => { savedEl.hidden = true; }, 2000); }
        if (activePredSubtab() === 'pred-bracket') renderKnockoutBracket();
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

export function renderByDate(container, matches, isPred, buildMatchCardCtx) {
  const sorted = [...matches].sort((a, b) => {
    const dc = (a.date || '').localeCompare(b.date || '');
    if (dc !== 0) return dc;
    return parseTimeMins(a.timeLocal) - parseTimeMins(b.timeLocal);
  });
  const seen = {};
  const groups = [];
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
    g.matches.forEach(m => grp.appendChild(buildMatchCard(m, isPred, buildMatchCardCtx)));
    container.appendChild(grp);
  });
}

export function renderMatches({
  allTabMatches,
  getTodayStr,
  buildMatchCardCtx,
}) {
  const container = document.getElementById('matches-list');
  if (!container) return;
  const dateVal  = document.getElementById('match-date-filter')?.value  || 'all';
  const stageVal = document.getElementById('match-group-filter')?.value || 'all';
  const venueVal = document.getElementById('match-venue-filter')?.value || 'all';
  const teamVal  = (document.getElementById('match-team-filter')?.value || '').toLowerCase().trim();
  let matches = allTabMatches();
  const resolvedDate = dateVal === 'today' ? getTodayStr() : dateVal;
  if (resolvedDate !== 'all') matches = matches.filter(m => m.date === resolvedDate);
  if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
  if (venueVal !== 'all') matches = matches.filter(m => m.venue === venueVal);
  if (teamVal)            matches = matches.filter(m =>
    teamName(m.home).toLowerCase().includes(teamVal) || teamName(m.away).toLowerCase().includes(teamVal));
  container.innerHTML = '';
  if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
  renderByDate(container, matches, false, buildMatchCardCtx);
}
