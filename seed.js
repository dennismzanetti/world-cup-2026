// seed.js — browser-runnable seeder for seed.html
// Reads fixtures from data/matches.json, deletes all existing match docs,
// then writes all fixtures fresh (scores cleared).

import { db } from './assets/firebase.js';
import {
  collection, doc, setDoc, getDocs, deleteDoc,
  writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Map a raw fixture from matches.json to the field schema the app expects.
 * Group matches use:    homeTeam / awayTeam
 * Knockout matches use: home / away  (already the display-ready slot label or TBD)
 * Both styles also carry homeSource / awaySource for bracket wiring.
 */
function toAppSchema(raw) {
  const appDoc = {
    id:          raw.id,
    matchNumber: raw.matchNumber,
    stage:       raw.stage,
    group:       raw.group ?? null,
    date:        raw.date,
    timeUTC:     raw.timeUTC,
    venue:       raw.venue,
    city:        raw.city,
    country:     raw.country,
    // Support both naming conventions:
    // - group matches use homeTeam / awayTeam
    // - knockout matches use home / away
    home:        raw.homeTeam ?? raw.home ?? 'TBD',
    away:        raw.awayTeam ?? raw.away ?? 'TBD',
    matchup:     raw.matchup ?? null,
    tvEnglish:   raw.tvEnglish ?? [],
    tvSpanish:   raw.tvSpanish ?? [],
    streaming:   raw.streaming ?? [],
    status:      'scheduled',
    homeScore:   null,
    awayScore:   null,
    homePkScore: null,
    awayPkScore: null,
  };
  // Preserve homeSource / awaySource if present (knockout bracket wiring)
  if (raw.homeSource !== undefined) appDoc.homeSource = raw.homeSource;
  if (raw.awaySource !== undefined) appDoc.awaySource = raw.awaySource;
  return appDoc;
}

/**
 * Delete all docs in the matches collection, then re-seed from data/matches.json.
 * @param {function} log  - callback(msg: string) for progress updates
 */
export async function reseedAllMatches(log = console.log) {
  // 1. Load fixture data
  log('📦 Loading fixture data…');
  const res = await fetch('./data/matches.json');
  if (!res.ok) throw new Error(`Failed to load matches.json: ${res.status}`);
  const rawFixtures = await res.json();
  const fixtures = rawFixtures.map(toAppSchema);
  log(`📋 Loaded ${fixtures.length} fixtures`);

  // 2. Delete all existing match documents
  log('🗑️  Deleting existing match documents…');
  const matchesCol = collection(db, 'matches');
  const existing = await getDocs(matchesCol);
  let deleted = 0;
  let batch = writeBatch(db);
  let batchCount = 0;
  for (const snap of existing.docs) {
    batch.delete(snap.ref);
    batchCount++;
    deleted++;
    if (batchCount >= 499) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  log(`🗑️  Deleted ${deleted} existing documents`);

  // 3. Write all fixtures fresh
  log('✍️  Writing fresh fixtures…');
  let written = 0;
  let errCount = 0;
  batch = writeBatch(db);
  batchCount = 0;

  for (const fixture of fixtures) {
    const { id, ...data } = fixture;
    if (!id) { errCount++; continue; }
    const ref = doc(db, 'matches', String(id));
    batch.set(ref, { ...data, seededAt: serverTimestamp() });
    batchCount++;
    written++;
    if (batchCount >= 499) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
      log(`  …${written} written so far`);
    }
  }

  if (batchCount > 0) await batch.commit();

  if (errCount > 0) log(`⚠️  ${errCount} fixtures skipped (missing id)`);
  log(`🎉 Done! ${written} matches seeded successfully.`);
}
