// firebase.js — initializes Firebase app, exports auth and db
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

// Use localStorage-backed persistence so auth state survives tab closes
// and page reloads on GitHub Pages. The previous sessionStorage workaround
// was only needed for sandboxed iframe previews; on the live site it caused
// users to be signed out on every page load, making Sign In appear broken.
setPersistence(auth, browserLocalPersistence).catch(err =>
  console.warn('[Firebase] Could not set local persistence:', err)
);
