// db.js — Firestore interactions for World Cup 2026
import { db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================================
// MATCHES (live / admin-controlled)
// ============================================================

/**
 * Watch all matches in Firestore and call cb(matches) on any change.
 * Sorting is handled client-side in app.js.
 */
export function watchMatches(cb) {
  return onSnapshot(collection(db, 'matches'), snap => {
    if (snap.empty) { cb([]); return; }
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(matches);
  }, err => {
    console.error('watchMatches error:', err);
    cb([]);
  });
}

/**
 * Admin: update a match score.
 */
export async function updateMatchResult(matchId, { homeScore, awayScore }) {
  const ref = doc(db, 'matches', String(matchId));
  await setDoc(ref, {
    homeScore,
    awayScore,
    status: 'final',
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Seed (or overwrite) a set of knockout fixture stubs into the matches collection.
 * Each fixture is written as a separate doc using its id field as the document ID.
 * Uses setDoc with merge:false so that existing result data is preserved only
 * when the caller explicitly passes merge:true.
 *
 * @param {Array<Object>} fixtures  - Array of fixture objects; each must have an `id` field.
 * @param {boolean}       [merge=true] - If true, merges with existing doc (preserves scores).
 *                                       If false, overwrites entirely.
 */
export async function seedKnockoutMatches(fixtures, merge = true) {
  const results = { ok: 0, err: 0 };
  for (const fixture of fixtures) {
    const { id, ...data } = fixture;
    if (!id) { results.err++; continue; }
    try {
      await setDoc(doc(db, 'matches', id), {
        ...data,
        seededAt: serverTimestamp(),
      }, { merge });
      results.ok++;
      console.log(`✅ ${id} seeded`);
    } catch (err) {
      results.err++;
      console.error(`❌ ${id} failed:`, err.message);
    }
  }
  return results;
}

// ============================================================
// USER PREDICTIONS
// ============================================================

/**
 * Save a single match prediction for a user.
 */
export async function savePrediction(uid, matchId, home, away) {
  const ref = doc(db, 'users', uid, 'predictions', String(matchId));
  await setDoc(ref, {
    home: Number(home),
    away: Number(away),
    savedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Watch all predictions for a user in real-time.
 * Calls cb({ matchId: { home, away } }) on every change.
 * Returns an unsubscribe function.
 */
export function watchUserPredictions(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'predictions'), snap => {
    const result = {};
    snap.forEach(d => { result[d.id] = d.data(); });
    cb(result);
  }, err => {
    console.error('watchUserPredictions error:', err);
    cb({});
  });
}

// ============================================================
// BRACKET PICKS (Firestore — no localStorage)
// ============================================================

/**
 * Save bracket picks object for a user.
 * picks = { 'r32-1': 'home', 'r32-2': 'away', ... }
 */
export async function saveBracketPicks(uid, picks) {
  const ref = doc(db, 'users', uid, 'bracket', 'picks');
  await setDoc(ref, { ...picks, savedAt: serverTimestamp() }, { merge: true });
}

/**
 * Load bracket picks for a user (one-time fetch).
 * Returns { matchId: 'home'|'away', ... }
 */
export async function getBracketPicks(uid) {
  const ref  = doc(db, 'users', uid, 'bracket', 'picks');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  delete data.savedAt;
  return data;
}
