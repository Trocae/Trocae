/**
 * Trocaê – Configuração e inicialização do Firebase v10+
 * Substitua as chaves pelos valores reais do projeto trocae-f94e1
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  updateEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ============================================================
// CONFIGURAÇÃO – Substitua pelos valores reais do Firebase Console
// ============================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "trocae-f94e1.firebaseapp.com",
  projectId: "trocae-f94e1",
  storageBucket: "trocae-f94e1.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  app,
  auth,
  db,
  storage,
  // Auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  updateEmail,
  // Firestore
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  limit,
  // Storage
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};
