import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updateEmail,
  sendEmailVerification,
  deleteUser,
  reload,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { VERIFICATION_URL } from "./config.js";
import { toast } from "./ui.js";

const AUTH_ERROR_MESSAGES = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar.",
  "auth/invalid-email": "O e-mail informado é inválido.",
  "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
  "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
  "auth/wrong-password": "Senha incorreta. Tente novamente.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas de acesso. Aguarde alguns minutos.",
  "auth/requires-recent-login": "Por segurança, faça login novamente antes de continuar.",
  "auth/operation-not-allowed": "Operação não permitida no momento.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/email-change-needs-verification": "Confirme o novo e-mail na mensagem que enviamos a você.",
};

export function getAuthErrorMessage(error) {
  const code = error && error.code ? error.code : "";
  return AUTH_ERROR_MESSAGES[code] || "Algo deu errado. Tente novamente.";
}

export async function signUp(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await updateProfile(user, { displayName: name.trim() });

  await setDoc(doc(db, "users", user.uid), {
    name: name.trim(),
    email: user.email || email,
    createdAt: new Date().toISOString(),
  });

  try {
    await sendEmailVerification(user, { url: VERIFICATION_URL });
  } catch (error) {
    toast("Conta criada, mas não foi possível enviar o e-mail de verificação. Reenvie pelo seu perfil.", "error");
  }

  return user;
}

export async function signIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function refreshUser() {
  const user = auth.currentUser;
  if (user) await reload(user);
  return user;
}

export async function updateUserProfile(displayName) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-current-user");

  await updateProfile(user, { displayName: displayName.trim() });
  await setDoc(
    doc(db, "users", user.uid),
    { name: displayName.trim(), email: user.email || "" },
    { merge: true }
  );
  return user;
}

export async function updateUserEmail(newEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-current-user");

  await updateEmail(user, newEmail.trim());
  await setDoc(
    doc(db, "users", user.uid),
    { email: newEmail.trim() },
    { merge: true }
  );
  return user;
}

export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-current-user");
  await sendEmailVerification(user, { url: VERIFICATION_URL });
  return user;
}

export async function deleteAccountFull(user) {
  const offersQuery = query(collection(db, "offers"), where("userId", "==", user.uid));
  const offersSnapshot = await getDocs(offersQuery);

  const refs = offersSnapshot.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    if (refs.length > 0) {
      await batch.commit();
    }
  }

  await deleteDoc(doc(db, "users", user.uid));

  await deleteUser(user);
}
