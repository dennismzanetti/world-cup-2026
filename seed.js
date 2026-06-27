// seed.js — browser-runnable seeder for seed.html
// Reads fixtures from data/matches.json, deletes all existing match docs,
// then writes all fixtures fresh (scores cleared).

import { db } from './assets/firebase.js';
import {
  collection, doc, setDoc, getDocs, deleteDoc,
  writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Delete all docs in the matches collection, then re-seed from data/matches.json.
 * @param {function} log  - callback(msg: string) for progress updates
 */
export async function reseedAllMatches(log = console.log) {
  // 1. Load fixture data
  log('📦 Loading fixture data…');
  const res = await fetch('./data/matches.json');
  if (!res.ok) throw new Error(`Failed to load matches.json: ${res.status}`);
  const fixtures = await res.json();
  log(`📋 Loaded ${fixtures.length} fixtures`);

  // 2. Delete all existing match documents
  log('🗑️  Deleting existing match documents…');
  const matchesCol = collection(db, 'matches');
  const existing = await getDocs(matchesCol);
  let deleted = 0;
  // Delete in batches of 499
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

    // Strip any score fields — seed clean
    delete data.homeScore;
    delete data.awayScore;
    delete data.homePkScore;
    delete data.awayPkScore;
    delete data.status;

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
