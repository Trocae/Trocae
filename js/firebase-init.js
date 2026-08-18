import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config.js";

let app = null;
let auth = null;
let db = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("[Trocaê] Falha ao inicializar o Firebase:", error);
}

export { app, auth, db };

export function isFirebaseReady() {
  return Boolean(app && auth && db);
}
