/**
 * Trocaê – Sistema de Chat Interno em Tempo Real
 * Estrutura: coleção "chats" com documentos de conversa
 * e subcoleção "messages" para as mensagens.
 *
 * ID da conversa: sortedIds join (uid1_uid2) + offerId
 */

import {
  db,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "./firebase.js";

import { getCurrentUser } from "./auth.js";

/**
 * Gera ID estável para a conversa entre dois usuários sobre uma oferta
 */
function getChatId(userA, userB, offerId) {
  const sorted = [userA, userB].sort().join("_");
  return `${sorted}_${offerId}`;
}

/**
 * Inicia ou retorna conversa existente
 */
export async function getOrCreateChat(otherUserId, offerId, offerTitle = "") {
  const user = getCurrentUser();
  if (!user) throw new Error("Faça login para conversar.");
  if (user.uid === otherUserId) throw new Error("Não é possível conversar consigo mesmo.");

  const chatId = getChatId(user.uid, otherUserId, offerId);
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    await setDoc(chatRef, {
      participants: [user.uid, otherUserId],
      offerId,
      offerTitle,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: ""
    });
  }

  return chatId;
}

/**
 * Envia mensagem
 */
export async function sendMessage(chatId, text) {
  const user = getCurrentUser();
  if (!user) throw new Error("Não autenticado.");

  const trimmed = text.trim();
  if (!trimmed) return;

  const messagesRef = collection(db, "chats", chatId, "messages");
  await addDoc(messagesRef, {
    senderId: user.uid,
    text: trimmed,
    timestamp: serverTimestamp()
  });

  await setDoc(
    doc(db, "chats", chatId),
    {
      lastMessage: trimmed.slice(0, 80),
      lastMessageAt: serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Escuta mensagens em tempo real
 */
export function subscribeMessages(chatId, callback) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("timestamp", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
    callback(msgs);
  });
}

/**
 * Lista conversas do usuário atual
 */
export async function getMyChats() {
  const user = getCurrentUser();
  if (!user) return [];

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", user.uid)
  );

  const snap = await getDocs(q);
  const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  chats.sort((a, b) => {
    const ta = a.lastMessageAt?.toMillis?.() || 0;
    const tb = b.lastMessageAt?.toMillis?.() || 0;
    return tb - ta;
  });

  return chats;
}
