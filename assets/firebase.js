// firebase.js — initializes Firebase app, exports auth and db
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
// Pass the named database ID so the SDK connects to 'wc2026' not '(default)'
export const db = getFirestore(app, "wc2026");
