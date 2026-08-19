/**
 * Trocaê – Configuração e inicialização do Firebase v10+
 * Versão SEM Storage (plano gratuito Spark)
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
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
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

// ============================================================
// CONFIGURAÇÃO – Substitua pelos valores reais do Firebase Console
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA-p54xblpgEqdv7eJ-HjN1FvCv12Vz-ZU",
  authDomain: "trocae-f94e1.firebaseapp.com",
  projectId: "trocae-f94e1",
  storageBucket: "trocae-f94e1.appspot.com",
  messagingSenderId: "727780957751",
  appId: "1:727780957751:web:0cc36e90d867031b8069b2"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  // Auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
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
  limit
};
