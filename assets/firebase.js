// firebase.js — initializes Firebase app, exports auth and db
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCmbjBxgkBLylC_JeNdmhwuFdNXQcGvNlA",
  authDomain: "worldcup2026-cfbc2.firebaseapp.com",
  projectId: "worldcup2026-cfbc2",
  storageBucket: "worldcup2026-cfbc2.firebasestorage.app",
  messagingSenderId: "732352574920",
  appId: "1:732352574920:web:938ce6947b6f25be743cfd",
  measurementId: "G-63HQFYJLKE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Explicitly target the 'wc2026' named database (not the default)
export const db = getFirestore(app, 'wc2026');

// Use sessionStorage-backed persistence instead of IndexedDB (the default).
// IndexedDB is blocked in sandboxed iframes (GitHub Pages preview proxy),
// which causes Firebase to always fire onAuthStateChanged with null on page
// load, making every signed-in user appear signed out.
// sessionStorage works in sandboxed iframes and persists for the tab lifetime.
setPersistence(auth, browserSessionPersistence).catch(err =>
  console.warn('[Firebase] Could not set session persistence:', err)
);
