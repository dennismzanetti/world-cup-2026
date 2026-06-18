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

/**
 * Save a match result. For knockout ties, also accepts PK scores.
 * @param {string} matchId
 * @param {object} result
 * @param {number} result.homeScore
 * @param {number} result.awayScore
 * @param {number|null} [result.homePkScore]  - Goals scored in PK shootout (home). Only for knockout ties.
 * @param {number|null} [result.awayPkScore]  - Goals scored in PK shootout (away). Only for knockout ties.
 */
export async function updateMatchResult(matchId, { homeScore, awayScore, homePkScore, awayPkScore }) {
  const ref = doc(db, 'matches', String(matchId));
  const data = {
    homeScore,
    awayScore,
    status: 'final',
    updatedAt: serverTimestamp(),
  };

  // Only persist PK scores when it's a tied result and both values are provided
  const isTie = Number(homeScore) === Number(awayScore);
  if (isTie && homePkScore != null && awayPkScore != null) {
    data.homePkScore = Number(homePkScore);
    data.awayPkScore = Number(awayPkScore);
  } else {
    // Explicitly clear stale PK scores if the result is no longer a tie
    data.homePkScore = null;
    data.awayPkScore = null;
  }

  await setDoc(ref, data, { merge: true });
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

/**
 * Save a score prediction (and optional PK scores) for a knockout match.
 * @param {string} uid
 * @param {string} matchId
 * @param {number} home
 * @param {number} away
 * @param {string|undefined} pk          - 'home', 'away', or undefined (legacy PK winner toggle)
 * @param {number|undefined} homePkScore - Predicted PK goals (home). Only for knockout ties.
 * @param {number|undefined} awayPkScore - Predicted PK goals (away). Only for knockout ties.
 */
export async function savePrediction(uid, matchId, home, away, pk, homePkScore, awayPkScore) {
  const ref = doc(db, 'users', uid, 'predictions', String(matchId));
  const data = {
    home: Number(home),
    away: Number(away),
    savedAt: serverTimestamp(),
  };

  const isTie = Number(home) === Number(away);

  // PK winner side (legacy toggle — kept for backward compat)
  if (pk === 'home' || pk === 'away') data.pk = pk;

  // PK shootout scores — only saved on ties
  if (isTie && homePkScore != null && awayPkScore != null) {
    data.homePkScore = Number(homePkScore);
    data.awayPkScore = Number(awayPkScore);
    // Derive pk winner from scores if not explicitly set
    if (!data.pk) {
      if (Number(homePkScore) > Number(awayPkScore)) data.pk = 'home';
      else if (Number(awayPkScore) > Number(homePkScore)) data.pk = 'away';
    }
  } else {
    data.homePkScore = null;
    data.awayPkScore = null;
  }

  await setDoc(ref, data, { merge: true });
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
 * predictions: { matchId: { home, away, pk?, homePkScore?, awayPkScore? } }
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
    const isTie = Number(val.home) === Number(val.away);
    const data = { home: Number(val.home), away: Number(val.away), savedAt: serverTimestamp() };
    if (val.pk === 'home' || val.pk === 'away') data.pk = val.pk;
    if (isTie && val.homePkScore != null && val.awayPkScore != null) {
      data.homePkScore = Number(val.homePkScore);
      data.awayPkScore = Number(val.awayPkScore);
    }
    batch.set(ref, data, { merge: true });
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
