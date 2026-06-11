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
