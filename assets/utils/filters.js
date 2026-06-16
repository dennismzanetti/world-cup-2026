import { teamName } from './teamData.js';

// Knockout stage order (for sorting)
export const KNOCKOUT_STAGE_ORDER = [
  'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'
];

// Today's date as YYYY-MM-DD (local)
export function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Date formatting
export function formatDateHeader(isoDate) {
  if (!isoDate) return 'Date TBD';
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Parse time string to sortable minutes since midnight
export function parseTimeMins(timeStr) {
  if (!timeStr) return Infinity;
  const ampm = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(timeStr);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = parseInt(ampm[2], 10);
    const meridiem = ampm[3].toLowerCase();
    if (meridiem === 'pm' && h !== 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }
  const hm = /(\d{1,2}):(\d{2})/.exec(timeStr);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  return Infinity;
}

// Sort group keys then knockout stages
export function sortStages(stages) {
  return stages.sort((a, b) => {
    const aIsGroup = /^[A-Z]$/.test(a);
    const bIsGroup = /^[A-Z]$/.test(b);
    if (aIsGroup && bIsGroup) return a.localeCompare(b);
    if (aIsGroup) return -1;
    if (bIsGroup) return 1;
    const ai = KNOCKOUT_STAGE_ORDER.indexOf(a);
    const bi = KNOCKOUT_STAGE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Match status helper
export function isFinished(m) {
  return m.status === 'finished' || m.status === 'ft' || m.status === 'final';
}

// Stage key to human label
export const stageKeyToLabel = key => {
  if (/^[A-Z]$/.test(key)) return `Group ${key}`;
  return { R32:'Round of 32', R16:'Round of 16', QF:'Quarter-Finals', SF:'Semi-Finals', '3P':'Third Place', F:'Final' }[key] || key;
};

// Shared helper: populate a date <select> and a stage <select> from a match list.
// dateId  - element id of the date dropdown
// stageId - element id of the stage/group dropdown
// matches - already-resolved array of match objects
function populateDateStageFilters(dateId, stageId, matches) {
  const dateEl  = document.getElementById(dateId);
  const stageEl = document.getElementById(stageId);
  if (dateEl) {
    const savedDate = dateEl.value;
    const today = getTodayStr();
    const todayExists = matches.some(m => m.date === today);
    const dates = [...new Set(matches.map(m => m.date).filter(Boolean))].sort();
    dateEl.innerHTML =
      '<option value="all">All Dates</option>' +
      `<option value="today">Today${todayExists ? '' : ' (no matches)'}</option>` +
      dates.map(d => `<option value="${d}">${formatDateHeader(d)}</option>`).join('');
    // Restore saved selection, or default to "today" on first load
    if (savedDate && savedDate !== 'all') {
      dateEl.value = savedDate;
    } else if (!savedDate) {
      dateEl.value = 'today';
    }
  }
  if (stageEl) {
    const savedStage = stageEl.value;
    const stages = [...new Set(matches.map(m => m.group || m.stage).filter(Boolean))];
    sortStages(stages);
    stageEl.innerHTML =
      '<option value="all">All Matches</option>' +
      stages.map(s => `<option value="${s}">${/^[A-Z]$/.test(s) ? `Group ${s}` : s}</option>`).join('');
    if (savedStage && savedStage !== 'all') stageEl.value = savedStage;
  }
}

// Populate the Matches tab filter dropdowns
export function populateMatchFilters(allTabMatches, getTodayStr, formatDateHeader, sortStages) {
  const tabMatches = allTabMatches();
  populateDateStageFilters('match-date-filter', 'match-group-filter', tabMatches);
  const venueEl = document.getElementById('match-venue-filter');
  if (venueEl) {
    const savedVenue = venueEl.value;
    const venues = [...new Set(tabMatches.map(m => m.venue).filter(Boolean))].sort();
    venueEl.innerHTML =
      '<option value="all">All Venues</option>' +
      venues.map(v => `<option value="${v}">${v}</option>`).join('');
    if (savedVenue && savedVenue !== 'all') venueEl.value = savedVenue;
  }
}

// Populate the Predictions tab filter dropdowns
export function populatePredFilters(allPredMatches, getTodayStr, formatDateHeader, sortStages) {
  populateDateStageFilters('pred-date-filter', 'pred-group-filter', allPredMatches());
}
