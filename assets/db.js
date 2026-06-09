// db.js — Firestore helpers for matches, predictions, and users
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { auth } from "./firebase.js";

const PROJECT  = "worldcup2026-cfbc2";
const FS_BASE  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
// :runQuery must be appended to /documents, NOT to the database root
const RQ_URL   = `${FS_BASE}:runQuery`;

// ─── REST helpers ──────────────────────────────────────────────────────────────

// forceRefresh=true avoids stale tokens right after onAuthStateChanged fires
async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

function toFsValue(v) {
  if (typeof v === 'string')  return { stringValue: v };
  if (typeof v === 'number')  return { integerValue: String(v) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null)             return { nullValue: null };
  return { stringValue: String(v) };
}

function fromFsValue(fv) {
  if ('stringValue'  in fv) return fv.stringValue;
  if ('integerValue' in fv) return parseInt(fv.integerValue);
  if ('doubleValue'  in fv) return fv.doubleValue;
  if ('booleanValue' in fv) return fv.booleanValue;
  if ('nullValue'    in fv) return null;
  return null;
}

function docToObj(fsDoc) {
  const fields = fsDoc.fields || {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromFsValue(v);
  obj.id = fsDoc.name.split('/').pop();
  return obj;
}

// Build a prediction doc URL encoding each segment independently so the
// resulting path always matches the raw doc name returned by Firestore.
function predDocUrl(userId, matchId) {
  return `${FS_BASE}/predictions/${encodeURIComponent(userId)}_${encodeURIComponent(matchId)}`;
}

// ─── MATCHES (SDK — read-only) ───────────────────────────────────────────────────

export async function getMatches() {
  const q = query(collection(db, "matches"), orderBy("date"), orderBy("timeLocal"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMatch(matchId) {
  const snap = await getDoc(doc(db, "matches", matchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateMatchResult(matchId, { homeScore, awayScore, status }) {
  return updateDoc(doc(db, "matches", matchId), {
    homeScore, awayScore, status,
    updatedAt: new Date().toISOString()
  });
}

// ─── MATCHES (REST polling — replaces onSnapshot to avoid ad-blocker blocks) ──

export function watchMatches(callback, intervalMs = 30000) {
  const MATCHES_URL = `${FS_BASE}?pageSize=200&orderBy=date,timeLocal`;

  async function fetchMatches() {
    try {
      const res = await fetch(MATCHES_URL);
      if (!res.ok) { console.warn('[watchMatches] fetch failed', res.status); return; }
      const data = await res.json();
      const docs = (data.documents || []).map(docToObj);
      callback(docs);
    } catch (err) {
      console.warn('[watchMatches] error', err);
    }
  }

  // Fire immediately, then poll
  fetchMatches();
  const timerId = setInterval(fetchMatches, intervalMs);

  // Return an unsubscribe function matching the onSnapshot API
  return () => clearInterval(timerId);
}

// ─── PREDICTIONS (REST — bypasses WebChannel) ────────────────────────────────

export async function savePrediction(userId, matchId, { homeScorePred, awayScorePred }) {
  const token = await getIdToken();
  const url   = predDocUrl(userId, matchId);
  const res   = await fetch(url, {
    method:  'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        userId:        toFsValue(userId),
        matchId:       toFsValue(matchId),
        homeScorePred: toFsValue(homeScorePred),
        awayScorePred: toFsValue(awayScorePred),
        updatedAt:     toFsValue(new Date().toISOString())
      }
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firestore REST error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

export async function getUserPredictions(userId) {
  // forceRefresh=true ensures the token is valid right after onAuthStateChanged
  const token = await getIdToken(true);
  const res   = await fetch(RQ_URL, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from:  [{ collectionId: 'predictions' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op:    'EQUAL',
            value: { stringValue: userId }
          }
        }
      }
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firestore REST query error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const results = await res.json();
  return results
    .filter(r => r.document)
    .map(r => docToObj(r.document));
}

export async function getPrediction(userId, matchId) {
  const token = await getIdToken();
  const url   = predDocUrl(userId, matchId);
  const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return docToObj(await res.json());
}

export async function deletePrediction(userId, matchId) {
  const token = await getIdToken();
  const url   = predDocUrl(userId, matchId);
  await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
}

// ─── USERS ───────────────────────────────────────────────────────────────────

export async function saveUserProfile(uid, { email, displayName }) {
  const token = await getIdToken();
  const url   = `${FS_BASE}/users/${encodeURIComponent(uid)}`;
  const res   = await fetch(url, {
    method:  'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        email:       toFsValue(email),
        displayName: toFsValue(displayName),
        updatedAt:   toFsValue(new Date().toISOString())
      }
    })
  });
  if (!res.ok) console.warn('saveUserProfile failed', res.status);
}

export async function getUserProfile(uid) {
  const token = await getIdToken();
  const url   = `${FS_BASE}/users/${encodeURIComponent(uid)}`;
  const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) return null;
  return docToObj(await res.json());
}
