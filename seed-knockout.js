// seed-knockout.js
// Knockout fixture stubs for the 2026 World Cup.
// These are written to the `matches` collection in Firestore with doc IDs
// matching the IDs used in app.js BRACKET_ROUNDS (r32-1 … final).
//
// homeSource / awaySource describe how the slot is filled:
//   { type: 'group',   group: 'A', pos: 1 }   — 1st or 2nd place in a group
//   { type: 'best3rd', rank: 1 }               — best 3rd-place finishers
//   { type: 'winner',  matchId: 'r32-1' }      — winner of a prior match
//   { type: 'loser',   matchId: 'sf-1' }       — loser of a prior match (3rd-place play-off)
//
// Dates and venues are approximate based on the FIFA 2026 schedule.
// Update them freely; the seeder will merge by default (scores are preserved).

export const KNOCKOUT_FIXTURES = [

  // ── Round of 32 (June 29 – July 4) ──────────────────────────────────────────
  {
    id: 'r32-1',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'A', pos: 1 },
    awaySource: { type: 'group', group: 'B', pos: 2 },
    date: '2026-06-29', venue: 'MetLife Stadium', city: 'New York/New Jersey',
  },
  {
    id: 'r32-2',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'C', pos: 1 },
    awaySource: { type: 'group', group: 'D', pos: 2 },
    date: '2026-06-29', venue: 'SoFi Stadium', city: 'Los Angeles',
  },
  {
    id: 'r32-3',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'E', pos: 1 },
    awaySource: { type: 'group', group: 'F', pos: 2 },
    date: '2026-06-30', venue: 'AT&T Stadium', city: 'Dallas',
  },
  {
    id: 'r32-4',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'G', pos: 1 },
    awaySource: { type: 'group', group: 'H', pos: 2 },
    date: '2026-06-30', venue: 'Estadio Azteca', city: 'Mexico City',
  },
  {
    id: 'r32-5',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'B', pos: 1 },
    awaySource: { type: 'group', group: 'A', pos: 2 },
    date: '2026-07-01', venue: 'Levi\'s Stadium', city: 'San Francisco Bay Area',
  },
  {
    id: 'r32-6',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'D', pos: 1 },
    awaySource: { type: 'group', group: 'C', pos: 2 },
    date: '2026-07-01', venue: 'Rose Bowl', city: 'Los Angeles',
  },
  {
    id: 'r32-7',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'F', pos: 1 },
    awaySource: { type: 'group', group: 'E', pos: 2 },
    date: '2026-07-02', venue: 'Arrowhead Stadium', city: 'Kansas City',
  },
  {
    id: 'r32-8',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'H', pos: 1 },
    awaySource: { type: 'group', group: 'G', pos: 2 },
    date: '2026-07-02', venue: 'Estadio AKRON', city: 'Guadalajara',
  },
  {
    id: 'r32-9',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'I', pos: 1 },
    awaySource: { type: 'best3rd', rank: 1 },
    date: '2026-07-03', venue: 'BC Place', city: 'Vancouver',
  },
  {
    id: 'r32-10',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'J', pos: 1 },
    awaySource: { type: 'best3rd', rank: 2 },
    date: '2026-07-03', venue: 'BMO Field', city: 'Toronto',
  },
  {
    id: 'r32-11',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'K', pos: 1 },
    awaySource: { type: 'best3rd', rank: 3 },
    date: '2026-07-04', venue: 'Gillette Stadium', city: 'Boston',
  },
  {
    id: 'r32-12',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'L', pos: 1 },
    awaySource: { type: 'best3rd', rank: 4 },
    date: '2026-07-04', venue: 'Lincoln Financial Field', city: 'Philadelphia',
  },
  {
    id: 'r32-13',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'I', pos: 2 },
    awaySource: { type: 'group', group: 'J', pos: 2 },
    date: '2026-07-05', venue: 'Mercedes-Benz Stadium', city: 'Atlanta',
  },
  {
    id: 'r32-14',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'K', pos: 2 },
    awaySource: { type: 'best3rd', rank: 5 },
    date: '2026-07-05', venue: 'NRG Stadium', city: 'Houston',
  },
  {
    id: 'r32-15',
    stage: 'Round of 32',
    homeSource: { type: 'group', group: 'L', pos: 2 },
    awaySource: { type: 'best3rd', rank: 6 },
    date: '2026-07-06', venue: 'Hard Rock Stadium', city: 'Miami',
  },
  {
    id: 'r32-16',
    stage: 'Round of 32',
    homeSource: { type: 'best3rd', rank: 7 },
    awaySource: { type: 'best3rd', rank: 8 },
    date: '2026-07-06', venue: 'Estadio Ciudad de Monterrey', city: 'Monterrey',
  },

  // ── Round of 16 (July 9 – July 12) ─────────────────────────────────────────
  {
    id: 'r16-1',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-1' },
    awaySource: { type: 'winner', matchId: 'r32-2' },
    date: '2026-07-09', venue: 'MetLife Stadium', city: 'New York/New Jersey',
  },
  {
    id: 'r16-2',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-3' },
    awaySource: { type: 'winner', matchId: 'r32-4' },
    date: '2026-07-09', venue: 'AT&T Stadium', city: 'Dallas',
  },
  {
    id: 'r16-3',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-5' },
    awaySource: { type: 'winner', matchId: 'r32-6' },
    date: '2026-07-10', venue: 'SoFi Stadium', city: 'Los Angeles',
  },
  {
    id: 'r16-4',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-7' },
    awaySource: { type: 'winner', matchId: 'r32-8' },
    date: '2026-07-10', venue: 'Arrowhead Stadium', city: 'Kansas City',
  },
  {
    id: 'r16-5',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-9' },
    awaySource: { type: 'winner', matchId: 'r32-10' },
    date: '2026-07-11', venue: 'BC Place', city: 'Vancouver',
  },
  {
    id: 'r16-6',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-11' },
    awaySource: { type: 'winner', matchId: 'r32-12' },
    date: '2026-07-11', venue: 'Gillette Stadium', city: 'Boston',
  },
  {
    id: 'r16-7',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-13' },
    awaySource: { type: 'winner', matchId: 'r32-14' },
    date: '2026-07-12', venue: 'Mercedes-Benz Stadium', city: 'Atlanta',
  },
  {
    id: 'r16-8',
    stage: 'Round of 16',
    homeSource: { type: 'winner', matchId: 'r32-15' },
    awaySource: { type: 'winner', matchId: 'r32-16' },
    date: '2026-07-12', venue: 'Hard Rock Stadium', city: 'Miami',
  },

  // ── Quarter-Finals (July 16 – July 17) ──────────────────────────────────────
  {
    id: 'qf-1',
    stage: 'Quarterfinals',
    homeSource: { type: 'winner', matchId: 'r16-1' },
    awaySource: { type: 'winner', matchId: 'r16-2' },
    date: '2026-07-16', venue: 'MetLife Stadium', city: 'New York/New Jersey',
  },
  {
    id: 'qf-2',
    stage: 'Quarterfinals',
    homeSource: { type: 'winner', matchId: 'r16-3' },
    awaySource: { type: 'winner', matchId: 'r16-4' },
    date: '2026-07-16', venue: 'SoFi Stadium', city: 'Los Angeles',
  },
  {
    id: 'qf-3',
    stage: 'Quarterfinals',
    homeSource: { type: 'winner', matchId: 'r16-5' },
    awaySource: { type: 'winner', matchId: 'r16-6' },
    date: '2026-07-17', venue: 'AT&T Stadium', city: 'Dallas',
  },
  {
    id: 'qf-4',
    stage: 'Quarterfinals',
    homeSource: { type: 'winner', matchId: 'r16-7' },
    awaySource: { type: 'winner', matchId: 'r16-8' },
    date: '2026-07-17', venue: 'Arrowhead Stadium', city: 'Kansas City',
  },

  // ── Semi-Finals (July 21 – July 22) ─────────────────────────────────────────
  {
    id: 'sf-1',
    stage: 'Semifinals',
    homeSource: { type: 'winner', matchId: 'qf-1' },
    awaySource: { type: 'winner', matchId: 'qf-2' },
    date: '2026-07-21', venue: 'MetLife Stadium', city: 'New York/New Jersey',
  },
  {
    id: 'sf-2',
    stage: 'Semifinals',
    homeSource: { type: 'winner', matchId: 'qf-3' },
    awaySource: { type: 'winner', matchId: 'qf-4' },
    date: '2026-07-22', venue: 'AT&T Stadium', city: 'Dallas',
  },

  // ── Final (July 19) ──────────────────────────────────────────────────────────
  {
    id: 'final',
    stage: 'Final',
    homeSource: { type: 'winner', matchId: 'sf-1' },
    awaySource: { type: 'winner', matchId: 'sf-2' },
    date: '2026-07-19', venue: 'MetLife Stadium', city: 'New York/New Jersey',
  },
];
