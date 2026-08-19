/**
 * Trocaê – Módulo de Autenticação e Gestão de Usuários
 */

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "./firebase.js";

let currentUser = null;
let currentUserData = null;
let authListeners = [];

/**
 * Observa mudanças de autenticação e notifica listeners
 */
export function initAuth(onChange) {
  if (typeof onChange === "function") {
    authListeners.push(onChange);
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        currentUserData = snap.exists() ? { id: user.uid, ...snap.data() } : null;
      } catch (e) {
        console.error("Erro ao carregar dados do usuário:", e);
        currentUserData = null;
      }
    } else {
      currentUserData = null;
    }
    authListeners.forEach((fn) => fn(user, currentUserData));
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserData() {
  return currentUserData;
}

export function isLoggedIn() {
  return !!currentUser;
}

export function isEmailVerified() {
  return currentUser?.emailVerified === true;
}

/**
 * Cadastro com e-mail, senha, nome, WhatsApp e endereço
 */
export async function signUp(name, email, password, whatsapp, address) {
  const cleanWhatsapp = whatsapp.replace(/\D/g, "");
  if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
    throw new Error("Número de WhatsApp inválido. Use DDD + número (10 ou 11 dígitos).");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await sendEmailVerification(cred.user, {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: false
  });

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    whatsapp: cleanWhatsapp,
    address: (address || "").trim(),
    createdAt: serverTimestamp(),
    userBlockedList: []
  });

  return cred.user;
}

/**
 * Login
 */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Logout
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Atualiza dados do perfil (nome, WhatsApp e endereço)
 */
export async function updateUserProfile(name, whatsapp, address) {
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const cleanWhatsapp = whatsapp.replace(/\D/g, "");
  if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
    throw new Error("WhatsApp inválido.");
  }

  await updateProfile(currentUser, { displayName: name });
  await setDoc(
    doc(db, "users", currentUser.uid),
    {
      name,
      whatsapp: cleanWhatsapp,
      address: (address || "").trim()
    },
    { merge: true }
  );

  currentUserData = {
    ...currentUserData,
    name,
    whatsapp: cleanWhatsapp,
    address: (address || "").trim()
  };
  return currentUserData;
}

/**
 * Exclusão definitiva da conta
 * Pede a senha novamente (reautenticação) antes de apagar
 */
export async function deleteAccountCompletely(password) {
  if (!currentUser) throw new Error("Usuário não autenticado.");
  if (!password) throw new Error("Informe sua senha para confirmar.");

  const uid = currentUser.uid;

  // 1. Reautentica (obrigatório para deleteUser)
  const credential = EmailAuthProvider.credential(currentUser.email, password);
  await reauthenticateWithCredential(currentUser, credential);

  // 2. Apaga ofertas do usuário
  const batch = writeBatch(db);
  const offersSnap = await getDocs(query(collection(db, "offers"), where("userId", "==", uid)));
  offersSnap.forEach((d) => batch.delete(d.ref));

  // 3. Apaga favoritos do usuário
  const favsSnap = await getDocs(query(collection(db, "favorites"), where("userId", "==", uid)));
  favsSnap.forEach((d) => batch.delete(d.ref));

  // 4. Apaga documento do usuário
  batch.delete(doc(db, "users", uid));

  await batch.commit();

  // 5. Apaga a conta no Authentication
  await deleteUser(currentUser);

  currentUser = null;
  currentUserData = null;
}

/**
 * Bloqueia ou desbloqueia um usuário
 */
export async function toggleBlockUser(targetUserId) {
  if (!currentUser || !currentUserData) throw new Error("Não autenticado.");

  const list = currentUserData.userBlockedList || [];
  const isBlocked = list.includes(targetUserId);
  const newList = isBlocked
    ? list.filter((id) => id !== targetUserId)
    : [...list, targetUserId];

  await setDoc(
    doc(db, "users", currentUser.uid),
    { userBlockedList: newList },
    { merge: true }
  );

  currentUserData.userBlockedList = newList;
  return !isBlocked;
}

export function isUserBlocked(targetUserId) {
  if (!currentUserData) return false;
  return (currentUserData.userBlockedList || []).includes(targetUserId);
}
