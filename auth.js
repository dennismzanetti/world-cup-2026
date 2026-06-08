// auth.js — email/password sign-up, sign-in, sign-out, and auth state observer
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./firebase.js";

/**
 * Create a new user account with email and password.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signUp(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

/**
 * Sign in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the currently signed-in user.
 * @returns {Promise<void>}
 */
export function logOut() {
  return signOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Callback receives the Firebase User object or null.
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Returns the currently signed-in user, or null.
 * @returns {import('firebase/auth').User|null}
 */
export function currentUser() {
  return auth.currentUser;
}
