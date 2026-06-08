// seed.js — Run this ONCE in the browser console (or a local Node script with
// firebase-admin) to seed the matches collection in Firestore from matches.json.
//
// Usage in browser (after loading firebase.js and db.js as modules):
//   import { seedMatches } from './seed.js';
//   seedMatches();

import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function seedMatches() {
  const response = await fetch("./data/matches.json");
  const matches = await response.json();

  let count = 0;
  for (const match of matches) {
    const { id, ...data } = match;
    await setDoc(doc(db, "matches", id), {
      ...data,
      sourceUpdatedAt: serverTimestamp()
    });
    count++;
    console.log(`Seeded match ${count}/${matches.length}: ${id}`);
  }

  console.log(`✅ Seeded ${count} matches into Firestore.`);
}
