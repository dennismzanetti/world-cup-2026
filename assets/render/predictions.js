import { teamName } from '../utils/teamData.js';
import { isFinished } from '../utils/filters.js';
import { predOutcome } from '../utils/stats.js';
import { renderByDate } from './matches.js';

export function renderPredictions({
  currentUser,
  authResolved,
  allPredMatches,
  getTodayStr,
  buildMatchCardCtx,
}) {
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
  const dateVal  = document.getElementById('pred-date-filter')?.value  || 'all';
  const stageVal = document.getElementById('pred-group-filter')?.value || 'all';
  const teamVal  = (document.getElementById('pred-team-filter')?.value || '').toLowerCase().trim();
  let matches = allPredMatches();
  const resolvedDate = dateVal === 'today' ? getTodayStr() : dateVal;
  if (resolvedDate !== 'all') matches = matches.filter(m => m.date === resolvedDate);
  if (stageVal !== 'all') matches = matches.filter(m => (m.group || m.stage) === stageVal);
  if (teamVal)            matches = matches.filter(m =>
    teamName(m.home).toLowerCase().includes(teamVal) || teamName(m.away).toLowerCase().includes(teamVal));
  container.innerHTML = '';
  if (!matches.length) { container.innerHTML = '<p class="empty-filter-msg">No matches found.</p>'; return; }
  renderByDate(container, matches, true, buildMatchCardCtx);
}

export function renderPredStandings(liveMatches, userPredictions, currentUser) {
  const container  = document.getElementById('pred-standings-container');
  const authPrompt = document.getElementById('pred-standings-auth-prompt');
  if (!container) return;
  if (!currentUser) {
    authPrompt?.removeAttribute('hidden');
    container.innerHTML = '';
    return;
  }
  authPrompt?.setAttribute('hidden', '');
  const finishedMatches = liveMatches.filter(m => isFinished(m) && m.homeScore != null && m.awayScore != null);
  if (!finishedMatches.length) {
    container.innerHTML = `
      <div class="pred-stats-empty">
        <div class="pred-stats-empty-icon">⏳</div>
        <h3>No Results Yet</h3>
        <p>Your accuracy will appear here once matches have finished.</p>
      </div>`;
    return;
  }
  let exact = 0, correct = 0, predicted = 0;
  const total = finishedMatches.length;
  finishedMatches.forEach(m => {
    const pred = userPredictions[m.id];
    const outcome = predOutcome(pred, m);
    if (outcome === 'exact')   exact++;
    if (outcome === 'correct') correct++;
    if (outcome !== 'none')    predicted++;
  });
  const pct = predicted > 0 ? Math.round(((exact + correct) / predicted) * 100) : 0;
  container.innerHTML = `
    <div class="pred-stats-header">
      <div class="pred-stats-summary">
        <span class="pred-stats-pct">${pct}%</span>
        <span class="pred-stats-label">Prediction Accuracy</span>
      </div>
      <div class="pred-stat-cards">
        <div class="pred-stat-card"><span class="pred-stat-icon">🎯</span><span class="pred-stat-val">${exact}</span><span class="pred-stat-lbl">Exact Scores</span></div>
        <div class="pred-stat-card"><span class="pred-stat-icon">✅</span><span class="pred-stat-val">${correct}</span><span class="pred-stat-lbl">Correct Results</span></div>
        <div class="pred-stat-card"><span class="pred-stat-icon">📋</span><span class="pred-stat-val">${predicted}</span><span class="pred-stat-lbl">Matches Predicted</span></div>
        <div class="pred-stat-card"><span class="pred-stat-icon">⚽</span><span class="pred-stat-val">${total}</span><span class="pred-stat-lbl">Matches Played</span></div>
      </div>
    </div>`;
}
