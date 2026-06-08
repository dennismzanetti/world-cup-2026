// db.js — Firestore helpers for matches, predictions, and users
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";

// ─── MATCHES ─────────────────────────────────────────────────────────────────

/**
 * Fetch all matches from Firestore, ordered by date.
 * @returns {Promise<Array>}
 */
export async function getMatches() {
  const q = query(collection(db, "matches"), orderBy("date"), orderBy("timeLocal"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a single match by its Firestore document ID.
 * @param {string} matchId
 * @returns {Promise<Object|null>}
 */
export async function getMatch(matchId) {
  const snap = await getDoc(doc(db, "matches", matchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Update a match result (admin only — enforced by Firestore rules).
 * @param {string} matchId
 * @param {{ homeScore: number, awayScore: number, status: string }} result
 */
export async function updateMatchResult(matchId, { homeScore, awayScore, status }) {
  return updateDoc(doc(db, "matches", matchId), {
    homeScore,
    awayScore,
    status,
    updatedAt: serverTimestamp()
  });
}

/**
 * Real-time listener on all matches.
 * @param {function} callback - receives array of match objects
 * @returns {function} unsubscribe
 */
export function watchMatches(callback) {
  const q = query(collection(db, "matches"), orderBy("date"), orderBy("timeLocal"));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── PREDICTIONS ─────────────────────────────────────────────────────────────

/**
 * Save or update a prediction. Uses setDoc with matchId as doc ID so each
 * user has at most one prediction per match.
 * @param {string} userId
 * @param {string} matchId
 * @param {{ homeScorePred: number, awayScorePred: number }} prediction
 */
export async function savePrediction(userId, matchId, { homeScorePred, awayScorePred }) {
  const ref = doc(db, "predictions", `${userId}_${matchId}`);
  return setDoc(ref, {
    userId,
    matchId,
    homeScorePred,
    awayScorePred,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Fetch all predictions for a given user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserPredictions(userId) {
  const q = query(collection(db, "predictions"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a single prediction for a user+match combo.
 * @param {string} userId
 * @param {string} matchId
 * @returns {Promise<Object|null>}
 */
export async function getPrediction(userId, matchId) {
  const snap = await getDoc(doc(db, "predictions", `${userId}_${matchId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Delete a prediction.
 * @param {string} userId
 * @param {string} matchId
 */
export async function deletePrediction(userId, matchId) {
  return deleteDoc(doc(db, "predictions", `${userId}_${matchId}`));
}

// ─── USERS ────────────────────────────────────────────────────────────────────

/**
 * Create or update a user profile document.
 * @param {string} uid
 * @param {{ email: string, displayName: string }} profile
 */
export async function saveUserProfile(uid, { email, displayName }) {
  return setDoc(doc(db, "users", uid), {
    email,
    displayName,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Fetch a user profile.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
