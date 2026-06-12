// seed.js — Seeder using slug IDs from assets/data.js
// Loaded as an ES module by seed.html on the live GitHub Pages site.

import { db } from './assets/firebase.js';
import { WC_MATCHES } from './assets/data.js';
import {
  doc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function seedMatches() {
  let count = 0;
  for (const match of WC_MATCHES) {
    const { id, ...rest } = match;
    // Flatten team objects to plain name strings for storage
    const data = {
      ...rest,
      home: match.home?.name ?? match.home,
      away: match.away?.name ?? match.away,
      sourceUpdatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'matches', String(id)), data);
    count++;
    console.log(`✓ ${count}/${WC_MATCHES.length}: ${id}`);
  }
  console.log(`✅ Seeded ${count} matches into Firestore with slug IDs.`);
}
