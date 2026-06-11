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
 * Load all predictions for a user.
 * Returns { matchId: { home, away } }
 */
export async function getUserPredictions(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'predictions'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

// ============================================================
// BRACKET PICKS
// ============================================================

/**
 * Save bracket picks object for a user.
 * picks = { 'fixtureId_home': 'TeamName', 'fixtureId_away': 'TeamName', ... }
 */
export async function saveBracketPicks(uid, picks) {
  const ref = doc(db, 'users', uid, 'bracket', 'picks');
  await setDoc(ref, { ...picks, savedAt: serverTimestamp() }, { merge: true });
}

/**
 * Load bracket picks for a user.
 */
export async function getBracketPicks(uid) {
  const ref  = doc(db, 'users', uid, 'bracket', 'picks');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  delete data.savedAt;
  return data;
}
