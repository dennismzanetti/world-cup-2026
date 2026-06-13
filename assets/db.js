// db.js — Firestore interactions for World Cup 2026
import { db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================================
// MATCHES (live / admin-controlled)
// ============================================================

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

export async function updateMatchResult(matchId, { homeScore, awayScore }) {
  const ref = doc(db, 'matches', String(matchId));
  await setDoc(ref, {
    homeScore,
    awayScore,
    status: 'final',
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

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

export async function savePrediction(uid, matchId, home, away) {
  const ref = doc(db, 'users', uid, 'predictions', String(matchId));
  await setDoc(ref, {
    home: Number(home),
    away: Number(away),
    savedAt: serverTimestamp(),
  }, { merge: true });
}

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
// BRACKET PICKS
// ============================================================

export async function saveBracketPicks(uid, picks) {
  const ref = doc(db, 'users', uid, 'bracket', 'picks');
  await setDoc(ref, { ...picks, savedAt: serverTimestamp() }, { merge: true });
}

export async function getBracketPicks(uid) {
  const ref  = doc(db, 'users', uid, 'bracket', 'picks');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  delete data.savedAt;
  return data;
}

// ============================================================
// IMPORT: bulk-restore predictions + bracket picks
// ============================================================

/**
 * Restore a user's predictions and bracket picks from a backup object.
 * predictions: { matchId: { home, away } }
 * bracketPicks: { matchId: 'home'|'away' }
 * Uses batched writes (max 500 ops per batch).
 */
export async function importUserData(uid, { predictions = {}, bracketPicks = {} }) {
  const BATCH_LIMIT = 499;
  let batch = writeBatch(db);
  let ops = 0;

  const flush = async () => { await batch.commit(); batch = writeBatch(db); ops = 0; };

  // Write predictions
  for (const [matchId, val] of Object.entries(predictions)) {
    if (val.home === undefined || val.away === undefined) continue;
    const ref = doc(db, 'users', uid, 'predictions', String(matchId));
    batch.set(ref, { home: Number(val.home), away: Number(val.away), savedAt: serverTimestamp() }, { merge: true });
    if (++ops >= BATCH_LIMIT) await flush();
  }

  // Write bracket picks
  const cleanPicks = {};
  for (const [matchId, side] of Object.entries(bracketPicks)) {
    if (side === 'home' || side === 'away') cleanPicks[matchId] = side;
  }
  if (Object.keys(cleanPicks).length) {
    const ref = doc(db, 'users', uid, 'bracket', 'picks');
    batch.set(ref, { ...cleanPicks, savedAt: serverTimestamp() }, { merge: true });
    ops++;
  }

  if (ops > 0) await batch.commit();
}
