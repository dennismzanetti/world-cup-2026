// seed.js — Self-contained seeder for all 2026 World Cup matches.
// Deletes ALL existing documents in the `matches` collection, then
// writes 72 group-stage matches + 35 knockout fixtures.
// No dependency on data.js (which has been removed).

import { db } from './assets/firebase.js';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── GROUPS ────────────────────────────────────────────────────────────────────
const WC_GROUPS = [
  { id: 'A', teams: [
    { name: 'Mexico',        flag: '🇲🇽' },
    { name: 'South Africa',  flag: '🇿🇦' },
    { name: 'South Korea',   flag: '🇰🇷' },
    { name: 'Czechia',       flag: '🇨🇿' },
  ]},
  { id: 'B', teams: [
    { name: 'Canada',              flag: '🇨🇦' },
    { name: 'Bosnia-Herzegovina',  flag: '🇧🇦' },
    { name: 'Qatar',               flag: '🇶🇦' },
    { name: 'Switzerland',         flag: '🇨🇭' },
  ]},
  { id: 'C', teams: [
    { name: 'Brazil',    flag: '🇧🇷' },
    { name: 'Morocco',   flag: '🇲🇦' },
    { name: 'Haiti',     flag: '🇭🇹' },
    { name: 'Scotland',  flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  ]},
  { id: 'D', teams: [
    { name: 'USA',        flag: '🇺🇸' },
    { name: 'Paraguay',   flag: '🇵🇾' },
    { name: 'Australia',  flag: '🇦🇺' },
    { name: 'Türkiye',    flag: '🇹🇷' },
  ]},
  { id: 'E', teams: [
    { name: 'Germany',      flag: '🇩🇪' },
    { name: 'Curaçao',      flag: '🇨🇼' },
    { name: 'Ivory Coast',  flag: '🇨🇮' },
    { name: 'Ecuador',      flag: '🇪🇨' },
  ]},
  { id: 'F', teams: [
    { name: 'Netherlands',  flag: '🇳🇱' },
    { name: 'Japan',        flag: '🇯🇵' },
    { name: 'Sweden',       flag: '🇸🇪' },
    { name: 'Tunisia',      flag: '🇹🇳' },
  ]},
  { id: 'G', teams: [
    { name: 'Belgium',      flag: '🇧🇪' },
    { name: 'Egypt',        flag: '🇪🇬' },
    { name: 'Iran',         flag: '🇮🇷' },
    { name: 'New Zealand',  flag: '🇳🇿' },
  ]},
  { id: 'H', teams: [
    { name: 'Spain',         flag: '🇪🇸' },
    { name: 'Cape Verde',    flag: '🇨🇻' },
    { name: 'Saudi Arabia',  flag: '🇸🇦' },
    { name: 'Uruguay',       flag: '🇺🇾' },
  ]},
  { id: 'I', teams: [
    { name: 'France',    flag: '🇫🇷' },
    { name: 'Senegal',   flag: '🇸🇳' },
    { name: 'Iraq',      flag: '🇮🇶' },
    { name: 'Norway',    flag: '🇳🇴' },
  ]},
  { id: 'J', teams: [
    { name: 'Argentina',  flag: '🇦🇷' },
    { name: 'Algeria',    flag: '🇩🇿' },
    { name: 'Austria',    flag: '🇦🇹' },
    { name: 'Jordan',     flag: '🇯🇴' },
  ]},
  { id: 'K', teams: [
    { name: 'Portugal',   flag: '🇵🇹' },
    { name: 'Congo DR',   flag: '🇨🇩' },
    { name: 'Uzbekistan', flag: '🇺🇿' },
    { name: 'Colombia',   flag: '🇨🇴' },
  ]},
  { id: 'L', teams: [
    { name: 'England',   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Croatia',   flag: '🇭🇷' },
    { name: 'Ghana',     flag: '🇬🇭' },
    { name: 'Panama',    flag: '🇵🇦' },
  ]},
];

// ── FIXTURE METADATA ──────────────────────────────────────────────────────────
const BC = {
  fox: { tvEnglish: ['FOX'],  tvSpanish: ['Telemundo'], streaming: ['FOX One', 'Peacock'] },
  fs1: { tvEnglish: ['FS1'],  tvSpanish: ['Telemundo'], streaming: ['FOX One', 'Peacock'] },
};

const WC_FIXTURE_META = {
  // ── GROUP A ──
  'Mexico|South Africa':       { date: '2026-06-11', timeLocal: '15:00', tz: 'ET', venue: 'Estadio Azteca',           city: 'Mexico City, Mexico',         ...BC.fox },
  'South Korea|Czechia':       { date: '2026-06-11', timeLocal: '22:00', tz: 'ET', venue: 'Estadio Akron',            city: 'Guadalajara, Mexico',         ...BC.fs1 },
  'Czechia|South Africa':      { date: '2026-06-18', timeLocal: '12:00', tz: 'ET', venue: 'Mercedes-Benz Stadium',    city: 'Atlanta, GA',                 ...BC.fox },
  'Mexico|South Korea':        { date: '2026-06-18', timeLocal: '21:00', tz: 'ET', venue: 'Estadio Akron',            city: 'Guadalajara, Mexico',         ...BC.fox },
  'Czechia|Mexico':            { date: '2026-06-24', timeLocal: '21:00', tz: 'ET', venue: 'Estadio Azteca',           city: 'Mexico City, Mexico',         ...BC.fox },
  'South Africa|South Korea':  { date: '2026-06-24', timeLocal: '21:00', tz: 'ET', venue: 'Estadio BBVA',             city: 'Monterrey, Mexico',           ...BC.fs1 },
  // ── GROUP B ──
  'Canada|Bosnia-Herzegovina':      { date: '2026-06-12', timeLocal: '15:00', tz: 'ET', venue: 'BMO Field',           city: 'Toronto, Canada',             ...BC.fox },
  'Qatar|Switzerland':               { date: '2026-06-13', timeLocal: '15:00', tz: 'ET', venue: "Levi's Stadium",      city: 'Santa Clara, CA',             ...BC.fox },
  'Switzerland|Bosnia-Herzegovina':  { date: '2026-06-18', timeLocal: '15:00', tz: 'ET', venue: 'SoFi Stadium',       city: 'Inglewood, CA',               ...BC.fox },
  'Canada|Qatar':                    { date: '2026-06-18', timeLocal: '18:00', tz: 'ET', venue: 'BC Place',            city: 'Vancouver, Canada',           ...BC.fs1 },
  'Switzerland|Canada':              { date: '2026-06-24', timeLocal: '15:00', tz: 'ET', venue: 'BC Place',            city: 'Vancouver, Canada',           ...BC.fox },
  'Bosnia-Herzegovina|Qatar':        { date: '2026-06-24', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',         city: 'Seattle, WA',                 ...BC.fs1 },
  // ── GROUP C ──
  'Brazil|Morocco':   { date: '2026-06-13', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',          city: 'East Rutherford, NJ',         ...BC.fs1 },
  'Haiti|Scotland':   { date: '2026-06-13', timeLocal: '21:00', tz: 'ET', venue: 'Gillette Stadium',          city: 'Foxborough, MA',              ...BC.fs1 },
  'Scotland|Morocco': { date: '2026-06-19', timeLocal: '18:00', tz: 'ET', venue: 'Gillette Stadium',          city: 'Foxborough, MA',              ...BC.fox },
  'Brazil|Haiti':     { date: '2026-06-19', timeLocal: '21:00', tz: 'ET', venue: 'Lincoln Financial Field',   city: 'Philadelphia, PA',            ...BC.fox },
  'Scotland|Brazil':  { date: '2026-06-24', timeLocal: '18:00', tz: 'ET', venue: 'Hard Rock Stadium',         city: 'Miami Gardens, FL',           ...BC.fox },
  'Morocco|Haiti':    { date: '2026-06-24', timeLocal: '18:00', tz: 'ET', venue: 'Mercedes-Benz Stadium',     city: 'Atlanta, GA',                 ...BC.fs1 },
  // ── GROUP D ──
  'USA|Paraguay':       { date: '2026-06-12', timeLocal: '21:00', tz: 'ET', venue: 'SoFi Stadium',             city: 'Inglewood, CA',               ...BC.fox },
  'Australia|Türkiye':  { date: '2026-06-13', timeLocal: '00:00', tz: 'ET', venue: 'BC Place',                 city: 'Vancouver, Canada',           ...BC.fs1 },
  'USA|Australia':      { date: '2026-06-19', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',              city: 'Seattle, WA',                 ...BC.fox },
  'Türkiye|Paraguay':   { date: '2026-06-19', timeLocal: '23:00', tz: 'ET', venue: "Levi's Stadium",           city: 'Santa Clara, CA',             ...BC.fs1 },
  'Türkiye|USA':        { date: '2026-06-25', timeLocal: '22:00', tz: 'ET', venue: 'SoFi Stadium',             city: 'Inglewood, CA',               ...BC.fox },
  'Paraguay|Australia': { date: '2026-06-25', timeLocal: '22:00', tz: 'ET', venue: "Levi's Stadium",           city: 'Santa Clara, CA',             ...BC.fs1 },
  // ── GROUP E ──
  'Germany|Curaçao':      { date: '2026-06-14', timeLocal: '13:00', tz: 'ET', venue: 'NRG Stadium',            city: 'Houston, TX',                 ...BC.fox },
  'Ivory Coast|Ecuador':  { date: '2026-06-14', timeLocal: '19:00', tz: 'ET', venue: 'Lincoln Financial Field', city: 'Philadelphia, PA',            ...BC.fs1 },
  'Germany|Ivory Coast':  { date: '2026-06-20', timeLocal: '16:00', tz: 'ET', venue: 'BMO Field',              city: 'Toronto, Canada',             ...BC.fox },
  'Ecuador|Curaçao':      { date: '2026-06-20', timeLocal: '20:00', tz: 'ET', venue: 'Arrowhead Stadium',      city: 'Kansas City, MO',             ...BC.fs1 },
  'Curaçao|Ivory Coast':  { date: '2026-06-25', timeLocal: '16:00', tz: 'ET', venue: 'Lincoln Financial Field', city: 'Philadelphia, PA',            ...BC.fs1 },
  'Ecuador|Germany':      { date: '2026-06-25', timeLocal: '16:00', tz: 'ET', venue: 'MetLife Stadium',         city: 'East Rutherford, NJ',         ...BC.fox },
  // ── GROUP F ──
  'Netherlands|Japan':  { date: '2026-06-14', timeLocal: '16:00', tz: 'ET', venue: "AT&T Stadium",             city: 'Arlington, TX',               ...BC.fox },
  'Sweden|Tunisia':     { date: '2026-06-14', timeLocal: '22:00', tz: 'ET', venue: 'Estadio BBVA',             city: 'Monterrey, Mexico',           ...BC.fs1 },
  'Netherlands|Sweden': { date: '2026-06-20', timeLocal: '13:00', tz: 'ET', venue: 'NRG Stadium',              city: 'Houston, TX',                 ...BC.fox },
  'Tunisia|Japan':      { date: '2026-06-20', timeLocal: '00:00', tz: 'ET', venue: 'Estadio BBVA',             city: 'Monterrey, Mexico',           ...BC.fs1 },
  'Japan|Sweden':       { date: '2026-06-25', timeLocal: '19:00', tz: 'ET', venue: "AT&T Stadium",             city: 'Arlington, TX',               ...BC.fox },
  'Tunisia|Netherlands':{ date: '2026-06-25', timeLocal: '19:00', tz: 'ET', venue: 'Arrowhead Stadium',        city: 'Kansas City, MO',             ...BC.fs1 },
  // ── GROUP G ──
  'Belgium|Egypt':      { date: '2026-06-15', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',              city: 'Seattle, WA',                 ...BC.fox },
  'Iran|New Zealand':   { date: '2026-06-15', timeLocal: '21:00', tz: 'ET', venue: 'SoFi Stadium',             city: 'Inglewood, CA',               ...BC.fs1 },
  'Belgium|Iran':       { date: '2026-06-21', timeLocal: '15:00', tz: 'ET', venue: 'SoFi Stadium',             city: 'Inglewood, CA',               ...BC.fox },
  'New Zealand|Egypt':  { date: '2026-06-21', timeLocal: '21:00', tz: 'ET', venue: "AT&T Stadium",             city: 'Arlington, TX',               ...BC.fs1 },
  'Egypt|Iran':         { date: '2026-06-27', timeLocal: '15:00', tz: 'ET', venue: 'Hard Rock Stadium',        city: 'Miami Gardens, FL',           ...BC.fox },
  'Belgium|New Zealand':{ date: '2026-06-27', timeLocal: '15:00', tz: 'ET', venue: 'Rose Bowl',                city: 'Pasadena, CA',                ...BC.fs1 },
  // ── GROUP H ──
  'Spain|Uruguay':       { date: '2026-06-15', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',         city: 'East Rutherford, NJ',         ...BC.fox },
  'Cape Verde|Saudi Arabia': { date: '2026-06-16', timeLocal: '12:00', tz: 'ET', venue: 'Arrowhead Stadium',   city: 'Kansas City, MO',             ...BC.fs1 },
  'Spain|Cape Verde':    { date: '2026-06-21', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',         city: 'East Rutherford, NJ',         ...BC.fox },
  'Saudi Arabia|Uruguay':{ date: '2026-06-21', timeLocal: '22:00', tz: 'ET', venue: 'Arrowhead Stadium',       city: 'Kansas City, MO',             ...BC.fs1 },
  'Saudi Arabia|Spain':  { date: '2026-06-27', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',         city: 'East Rutherford, NJ',         ...BC.fox },
  'Uruguay|Cape Verde':  { date: '2026-06-27', timeLocal: '18:00', tz: 'ET', venue: 'Gillette Stadium',        city: 'Foxborough, MA',              ...BC.fs1 },
  // ── GROUP I ──
  'France|Iraq':    { date: '2026-06-16', timeLocal: '15:00', tz: 'ET', venue: 'Rose Bowl',                   city: 'Pasadena, CA',                ...BC.fox },
  'Senegal|Norway': { date: '2026-06-16', timeLocal: '21:00', tz: 'ET', venue: 'NRG Stadium',                 city: 'Houston, TX',                 ...BC.fs1 },
  'France|Senegal': { date: '2026-06-22', timeLocal: '15:00', tz: 'ET', venue: 'Rose Bowl',                   city: 'Pasadena, CA',                ...BC.fox },
  'Norway|Iraq':    { date: '2026-06-22', timeLocal: '21:00', tz: 'ET', venue: 'NRG Stadium',                 city: 'Houston, TX',                 ...BC.fs1 },
  'Iraq|Senegal':   { date: '2026-06-28', timeLocal: '15:00', tz: 'ET', venue: 'Rose Bowl',                   city: 'Pasadena, CA',                ...BC.fox },
  'Norway|France':  { date: '2026-06-28', timeLocal: '15:00', tz: 'ET', venue: 'Gillette Stadium',            city: 'Foxborough, MA',              ...BC.fs1 },
  // ── GROUP J ──
  'Argentina|Jordan': { date: '2026-06-16', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',           city: 'East Rutherford, NJ',         ...BC.fox },
  'Algeria|Austria':  { date: '2026-06-17', timeLocal: '12:00', tz: 'ET', venue: 'Hard Rock Stadium',         city: 'Miami Gardens, FL',           ...BC.fs1 },
  'Argentina|Algeria':{ date: '2026-06-22', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',           city: 'East Rutherford, NJ',         ...BC.fox },
  'Austria|Jordan':   { date: '2026-06-22', timeLocal: '22:00', tz: 'ET', venue: 'Lincoln Financial Field',   city: 'Philadelphia, PA',            ...BC.fs1 },
  'Austria|Argentina':{ date: '2026-06-28', timeLocal: '18:00', tz: 'ET', venue: 'MetLife Stadium',           city: 'East Rutherford, NJ',         ...BC.fox },
  'Jordan|Algeria':   { date: '2026-06-28', timeLocal: '22:00', tz: 'ET', venue: 'Hard Rock Stadium',         city: 'Miami Gardens, FL',           ...BC.fs1 },
  // ── GROUP K ──
  'Portugal|Uzbekistan': { date: '2026-06-17', timeLocal: '15:00', tz: 'ET', venue: 'Lincoln Financial Field', city: 'Philadelphia, PA',            ...BC.fox },
  'Congo DR|Colombia':   { date: '2026-06-17', timeLocal: '21:00', tz: 'ET', venue: 'Lumen Field',              city: 'Seattle, WA',                 ...BC.fs1 },
  'Portugal|Congo DR':   { date: '2026-06-23', timeLocal: '15:00', tz: 'ET', venue: 'Lincoln Financial Field', city: 'Philadelphia, PA',            ...BC.fox },
  'Colombia|Uzbekistan': { date: '2026-06-23', timeLocal: '21:00', tz: 'ET', venue: 'Arrowhead Stadium',       city: 'Kansas City, MO',             ...BC.fs1 },
  'Colombia|Portugal':   { date: '2026-06-29', timeLocal: '15:00', tz: 'ET', venue: 'Lincoln Financial Field', city: 'Philadelphia, PA',            ...BC.fox },
  'Uzbekistan|Congo DR': { date: '2026-06-29', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',              city: 'Seattle, WA',                 ...BC.fs1 },
  // ── GROUP L ──
  'England|Panama':  { date: '2026-06-17', timeLocal: '18:00', tz: 'ET', venue: "AT&T Stadium",               city: 'Arlington, TX',               ...BC.fox },
  'Croatia|Ghana':   { date: '2026-06-18', timeLocal: '12:00', tz: 'ET', venue: 'Hard Rock Stadium',           city: 'Miami Gardens, FL',           ...BC.fs1 },
  'England|Croatia': { date: '2026-06-23', timeLocal: '18:00', tz: 'ET', venue: "AT&T Stadium",               city: 'Arlington, TX',               ...BC.fox },
  'Ghana|Panama':    { date: '2026-06-23', timeLocal: '22:00', tz: 'ET', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta, GA',                 ...BC.fs1 },
  'Ghana|England':   { date: '2026-06-29', timeLocal: '18:00', tz: 'ET', venue: "AT&T Stadium",               city: 'Arlington, TX',               ...BC.fox },
  'Panama|Croatia':  { date: '2026-06-29', timeLocal: '18:00', tz: 'ET', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta, GA',                 ...BC.fs1 },
};

// ── ID GENERATOR ─────────────────────────────────────────────────────────────
function slug(s) {
  return (s || '').toLowerCase()
    .replace(/[çć]/g, 'c').replace(/[üú]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function makeMatchId(date, homeName, awayName) {
  return [date, slug(homeName), 'vs', slug(awayName)].filter(Boolean).join('-');
}

// ── GROUP STAGE MATCH BUILDER ─────────────────────────────────────────────────
function buildGroupMatches() {
  const matches = [];
  for (const group of WC_GROUPS) {
    const teams = group.teams;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const keyFwd = teams[i].name + '|' + teams[j].name;
        const keyRev = teams[j].name + '|' + teams[i].name;
        const metaFwd = WC_FIXTURE_META[keyFwd];
        const metaRev = WC_FIXTURE_META[keyRev];
        const meta = metaFwd || metaRev || {};
        const homeTeam = (metaRev && !metaFwd) ? teams[j] : teams[i];
        const awayTeam = (metaRev && !metaFwd) ? teams[i] : teams[j];
        matches.push({
          id:         makeMatchId(meta.date || null, homeTeam.name, awayTeam.name),
          stage:      'Group ' + group.id,
          group:      group.id,
          home:       homeTeam.name,
          homeflag:   homeTeam.flag,
          away:       awayTeam.name,
          awayflag:   awayTeam.flag,
          date:       meta.date       || null,
          timeLocal:  meta.timeLocal  || null,
          tz:         meta.tz         || 'ET',
          venue:      meta.venue      || null,
          city:       meta.city       || null,
          tvEnglish:  meta.tvEnglish  || ['FOX / FS1'],
          tvSpanish:  meta.tvSpanish  || ['Telemundo'],
          streaming:  meta.streaming  || ['FOX One', 'Peacock'],
          homeScore:  null,
          awayScore:  null,
        });
      }
    }
  }
  return matches;
}

// ── KNOCKOUT FIXTURES ─────────────────────────────────────────────────────────
const KNOCKOUT_FIXTURES = [
  // Round of 32
  { id: 'r32-1',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'A', pos: 1 }, awaySource: { type: 'group',   group: 'B', pos: 2 }, date: '2026-06-28', timeLocal: '15:00', tz: 'ET', venue: 'Estadio Azteca',           city: 'Mexico City, Mexico',   ...BC.fox },
  { id: 'r32-2',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'C', pos: 1 }, awaySource: { type: 'group',   group: 'D', pos: 2 }, date: '2026-06-28', timeLocal: '19:00', tz: 'ET', venue: 'MetLife Stadium',          city: 'East Rutherford, NJ',   ...BC.fox },
  { id: 'r32-3',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'E', pos: 1 }, awaySource: { type: 'group',   group: 'F', pos: 2 }, date: '2026-06-29', timeLocal: '15:00', tz: 'ET', venue: 'SoFi Stadium',             city: 'Inglewood, CA',         ...BC.fox },
  { id: 'r32-4',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'G', pos: 1 }, awaySource: { type: 'group',   group: 'H', pos: 2 }, date: '2026-06-29', timeLocal: '19:00', tz: 'ET', venue: "AT&T Stadium",             city: 'Arlington, TX',         ...BC.fs1 },
  { id: 'r32-5',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'I', pos: 1 }, awaySource: { type: 'group',   group: 'J', pos: 2 }, date: '2026-06-30', timeLocal: '15:00', tz: 'ET', venue: 'Arrowhead Stadium',        city: 'Kansas City, MO',       ...BC.fox },
  { id: 'r32-6',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'K', pos: 1 }, awaySource: { type: 'group',   group: 'L', pos: 2 }, date: '2026-06-30', timeLocal: '19:00', tz: 'ET', venue: 'NRG Stadium',              city: 'Houston, TX',           ...BC.fs1 },
  { id: 'r32-7',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'B', pos: 1 }, awaySource: { type: 'group',   group: 'A', pos: 2 }, date: '2026-07-01', timeLocal: '15:00', tz: 'ET', venue: 'BC Place',                 city: 'Vancouver, Canada',     ...BC.fox },
  { id: 'r32-8',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'D', pos: 1 }, awaySource: { type: 'group',   group: 'C', pos: 2 }, date: '2026-07-01', timeLocal: '19:00', tz: 'ET', venue: 'Lincoln Financial Field',  city: 'Philadelphia, PA',      ...BC.fs1 },
  { id: 'r32-9',  stage: 'Round of 32', homeSource: { type: 'group',   group: 'F', pos: 1 }, awaySource: { type: 'group',   group: 'E', pos: 2 }, date: '2026-07-02', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',              city: 'Seattle, WA',           ...BC.fox },
  { id: 'r32-10', stage: 'Round of 32', homeSource: { type: 'group',   group: 'H', pos: 1 }, awaySource: { type: 'group',   group: 'G', pos: 2 }, date: '2026-07-02', timeLocal: '19:00', tz: 'ET', venue: 'Gillette Stadium',         city: 'Foxborough, MA',        ...BC.fs1 },
  { id: 'r32-11', stage: 'Round of 32', homeSource: { type: 'group',   group: 'J', pos: 1 }, awaySource: { type: 'group',   group: 'I', pos: 2 }, date: '2026-07-03', timeLocal: '15:00', tz: 'ET', venue: 'Hard Rock Stadium',        city: 'Miami Gardens, FL',     ...BC.fox },
  { id: 'r32-12', stage: 'Round of 32', homeSource: { type: 'group',   group: 'L', pos: 1 }, awaySource: { type: 'group',   group: 'K', pos: 2 }, date: '2026-07-03', timeLocal: '19:00', tz: 'ET', venue: 'BMO Field',                city: 'Toronto, Canada',       ...BC.fs1 },
  { id: 'r32-13', stage: 'Round of 32', homeSource: { type: 'best3rd', rank: 1  }, awaySource: { type: 'best3rd', rank: 2  }, date: '2026-07-04', timeLocal: '15:00', tz: 'ET', venue: 'Mercedes-Benz Stadium',   city: 'Atlanta, GA',           ...BC.fox },
  { id: 'r32-14', stage: 'Round of 32', homeSource: { type: 'best3rd', rank: 3  }, awaySource: { type: 'best3rd', rank: 4  }, date: '2026-07-04', timeLocal: '19:00', tz: 'ET', venue: 'Estadio BBVA',            city: 'Monterrey, Mexico',     ...BC.fs1 },
  { id: 'r32-15', stage: 'Round of 32', homeSource: { type: 'best3rd', rank: 5  }, awaySource: { type: 'best3rd', rank: 6  }, date: '2026-07-05', timeLocal: '15:00', tz: 'ET', venue: 'Estadio Akron',           city: 'Guadalajara, Mexico',   ...BC.fox },
  { id: 'r32-16', stage: 'Round of 32', homeSource: { type: 'best3rd', rank: 7  }, awaySource: { type: 'best3rd', rank: 8  }, date: '2026-07-05', timeLocal: '19:00', tz: 'ET', venue: "Levi's Stadium",          city: 'Santa Clara, CA',       ...BC.fs1 },
  // Round of 16
  { id: 'r16-1', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-1'  }, awaySource: { type: 'winner', matchId: 'r32-2'  }, date: '2026-07-07', timeLocal: '15:00', tz: 'ET', venue: 'MetLife Stadium',   city: 'East Rutherford, NJ', ...BC.fox },
  { id: 'r16-2', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-3'  }, awaySource: { type: 'winner', matchId: 'r32-4'  }, date: '2026-07-07', timeLocal: '19:00', tz: 'ET', venue: "AT&T Stadium",      city: 'Arlington, TX',       ...BC.fs1 },
  { id: 'r16-3', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-5'  }, awaySource: { type: 'winner', matchId: 'r32-6'  }, date: '2026-07-08', timeLocal: '15:00', tz: 'ET', venue: 'SoFi Stadium',      city: 'Inglewood, CA',       ...BC.fox },
  { id: 'r16-4', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-7'  }, awaySource: { type: 'winner', matchId: 'r32-8'  }, date: '2026-07-08', timeLocal: '19:00', tz: 'ET', venue: 'Hard Rock Stadium', city: 'Miami Gardens, FL',   ...BC.fs1 },
  { id: 'r16-5', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-9'  }, awaySource: { type: 'winner', matchId: 'r32-10' }, date: '2026-07-09', timeLocal: '15:00', tz: 'ET', venue: 'NRG Stadium',       city: 'Houston, TX',         ...BC.fox },
  { id: 'r16-6', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-11' }, awaySource: { type: 'winner', matchId: 'r32-12' }, date: '2026-07-09', timeLocal: '19:00', tz: 'ET', venue: 'Arrowhead Stadium', city: 'Kansas City, MO',     ...BC.fs1 },
  { id: 'r16-7', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-13' }, awaySource: { type: 'winner', matchId: 'r32-14' }, date: '2026-07-10', timeLocal: '15:00', tz: 'ET', venue: 'Lumen Field',       city: 'Seattle, WA',         ...BC.fox },
  { id: 'r16-8', stage: 'Round of 16', homeSource: { type: 'winner', matchId: 'r32-15' }, awaySource: { type: 'winner', matchId: 'r32-16' }, date: '2026-07-10', timeLocal: '19:00', tz: 'ET', venue: 'BC Place',          city: 'Vancouver, Canada',   ...BC.fs1 },
  // Quarterfinals
  { id: 'qf-1', stage: 'Quarterfinals', homeSource: { type: 'winner', matchId: 'r16-1' }, awaySource: { type: 'winner', matchId: 'r16-2' }, date: '2026-07-14', timeLocal: '15:00', tz: 'ET', venue: 'Estadio Azteca',  city: 'Mexico City, Mexico',  ...BC.fox },
  { id: 'qf-2', stage: 'Quarterfinals', homeSource: { type: 'winner', matchId: 'r16-3' }, awaySource: { type: 'winner', matchId: 'r16-4' }, date: '2026-07-14', timeLocal: '19:00', tz: 'ET', venue: 'MetLife Stadium', city: 'East Rutherford, NJ',  ...BC.fs1 },
  { id: 'qf-3', stage: 'Quarterfinals', homeSource: { type: 'winner', matchId: 'r16-5' }, awaySource: { type: 'winner', matchId: 'r16-6' }, date: '2026-07-15', timeLocal: '15:00', tz: 'ET', venue: 'SoFi Stadium',    city: 'Inglewood, CA',        ...BC.fox },
  { id: 'qf-4', stage: 'Quarterfinals', homeSource: { type: 'winner', matchId: 'r16-7' }, awaySource: { type: 'winner', matchId: 'r16-8' }, date: '2026-07-15', timeLocal: '19:00', tz: 'ET', venue: "AT&T Stadium",    city: 'Arlington, TX',        ...BC.fs1 },
  // Semifinals
  { id: 'sf-1', stage: 'Semifinals', homeSource: { type: 'winner', matchId: 'qf-1' }, awaySource: { type: 'winner', matchId: 'qf-2' }, date: '2026-07-18', timeLocal: '19:00', tz: 'ET', venue: 'MetLife Stadium', city: 'East Rutherford, NJ', ...BC.fox },
  { id: 'sf-2', stage: 'Semifinals', homeSource: { type: 'winner', matchId: 'qf-3' }, awaySource: { type: 'winner', matchId: 'qf-4' }, date: '2026-07-21', timeLocal: '19:00', tz: 'ET', venue: "AT&T Stadium",    city: 'Arlington, TX',       ...BC.fox },
  // Third Place
  { id: 'tp-1', stage: 'Third Place', homeSource: { type: 'loser', matchId: 'sf-1' }, awaySource: { type: 'loser', matchId: 'sf-2' }, date: '2026-07-24', timeLocal: '14:00', tz: 'ET', venue: 'Hard Rock Stadium', city: 'Miami Gardens, FL',   ...BC.fox },
  // Final
  { id: 'final', stage: 'Final', homeSource: { type: 'winner', matchId: 'sf-1' }, awaySource: { type: 'winner', matchId: 'sf-2' }, date: '2026-07-26', timeLocal: '17:00', tz: 'ET', venue: 'MetLife Stadium', city: 'East Rutherford, NJ', ...BC.fox },
];

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function reseedAllMatches(onProgress) {
  const log = msg => { console.log(msg); onProgress && onProgress(msg); };

  // 1. Delete all existing matches
  log('🗑️  Fetching existing matches to delete…');
  const snap = await getDocs(collection(db, 'matches'));
  log(`   Found ${snap.size} existing documents. Deleting…`);
  let deleted = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'matches', d.id));
    deleted++;
    if (deleted % 10 === 0) log(`   Deleted ${deleted}/${snap.size}…`);
  }
  log(`✅ Deleted ${deleted} documents.`);

  // 2. Seed group stage matches
  const groupMatches = buildGroupMatches();
  log(`\n⚽ Seeding ${groupMatches.length} group stage matches…`);
  let gCount = 0;
  for (const match of groupMatches) {
    const { id, ...data } = match;
    await setDoc(doc(db, 'matches', id), { ...data, sourceUpdatedAt: serverTimestamp() });
    gCount++;
    log(`   ✓ [${gCount}/${groupMatches.length}] ${id}`);
  }

  // 3. Seed knockout fixtures
  log(`\n🏆 Seeding ${KNOCKOUT_FIXTURES.length} knockout fixtures…`);
  let kCount = 0;
  for (const fixture of KNOCKOUT_FIXTURES) {
    const { id, ...data } = fixture;
    await setDoc(doc(db, 'matches', id), {
      ...data,
      home:      null,
      homeflag:  null,
      away:      null,
      awayflag:  null,
      homeScore: null,
      awayScore: null,
      sourceUpdatedAt: serverTimestamp(),
    });
    kCount++;
    log(`   ✓ [${kCount}/${KNOCKOUT_FIXTURES.length}] ${id}`);
  }

  const total = gCount + kCount;
  log(`\n🎉 Re-seed complete! ${total} matches written to Firestore.`);
  return total;
}
