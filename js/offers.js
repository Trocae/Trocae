//Início 
import { auth, db } from "./firebase-init.js";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { LOCAL_BLOCKED_USERS } from "./config.js";
import { toast, initials, formatDate, timeAgo } from "./ui.js";

const offersCache = new Map();
const usersMap = new Map();
const firestoreBlocked = new Set();
const userBlockedList = new Set(LOCAL_BLOCKED_USERS);

const FEED_LIMIT = 100;
let unsubscribeOfferListener = null;
let unsubscribeUserListener = null;
let unsubscribeBlockedListener = null;
let feedInitStarted = false;

export function initFeed() {
  if (feedInitStarted) return;
  feedInitStarted = true;

  const offersQuery = query(
    collection(db, "offers"),
    orderBy("createdAt", "desc"),
    limit(FEED_LIMIT)
  );

  unsubscribeOfferListener = onSnapshot(
    offersQuery,
    (snapshot) => {
      offersCache.clear();
      snapshot.docs.forEach((offerDoc) => {
        offersCache.set(offerDoc.id, { id: offerDoc.id, ...offerDoc.data() });
      });
      renderOffers();
    },
    (error) => {
      console.error("[Trocaê] Erro ao carregar ofertas:", error);
      showFeedLoading(false);
      toast("Não foi possível carregar as ofertas.", "error");
    }
  );

  const usersQuery = query(collection(db, "users"));
  unsubscribeUserListener = onSnapshot(
    usersQuery,
    (snapshot) => {
      usersMap.clear();
      snapshot.docs.forEach((userDoc) => {
        usersMap.set(userDoc.id, userDoc.data());
      });
      renderOffers();
    },
    (error) => {
      console.error("[Trocaê] Erro ao carregar usuários:", error);
    }
  );

  const blockedQuery = query(collection(db, "blockedUsers"));
  unsubscribeBlockedListener = onSnapshot(
    blockedQuery,
    (snapshot) => {
      firestoreBlocked.clear();
      snapshot.docs.forEach((blockedDoc) => {
        firestoreBlocked.add(blockedDoc.id);
      });
      syncBlockedList();
      renderOffers();
    },
    (error) => {
      console.error("[Trocaê] Erro ao carregar lista de bloqueio:", error);
    }
  );
}

function syncBlockedList() {
  userBlockedList.clear();
  LOCAL_BLOCKED_USERS.forEach((id) => userBlockedList.add(id));
  firestoreBlocked.forEach((id) => userBlockedList.add(id));
}

export function stopFeed() {
  if (unsubscribeOfferListener) unsubscribeOfferListener();
  if (unsubscribeUserListener) unsubscribeUserListener();
  if (unsubscribeBlockedListener) unsubscribeBlockedListener();
  unsubscribeOfferListener = null;
  unsubscribeUserListener = null;
  unsubscribeBlockedListener = null;
  feedInitStarted = false;
}

export function renderOffers() {
  const grid = document.getElementById("offersGrid");
  const empty = document.getElementById("feedEmpty");
  if (!grid) return;

  showFeedLoading(false);

  grid.innerHTML = "";
  const currentUser = auth?.currentUser;
  let visibleCount = 0;

  offersCache.forEach((offer) => {
    const owner = usersMap.get(offer.userId);
    if (!owner || userBlockedList.has(offer.userId)) {
      return;
    }
    grid.appendChild(createOfferCard(offer, owner, currentUser));
    visibleCount += 1;
  });

  if (empty) empty.hidden = visibleCount > 0;
}

function showFeedLoading(isLoading) {
  const loading = document.getElementById("feedLoading");
  if (loading) loading.hidden = !isLoading;
}

function createOfferCard(offer, owner, currentUser) {
  const card = document.createElement("article");
  card.className = "offer-card";

  const header = document.createElement("div");
  header.className = "offer-card-header";

  const title = document.createElement("h3");
  title.className = "offer-card-title";
  title.textContent = offer.title || "Sem título";

  header.appendChild(title);

  if (currentUser && offer.userId === currentUser.uid) {
    const badge = document.createElement("span");
    badge.className = "card-badge";
    badge.textContent = "Minha oferta";
    header.appendChild(badge);
  }
  card.appendChild(header);

  const description = document.createElement("p");
  description.className = "offer-card-description";
  description.textContent = offer.description || "";
  card.appendChild(description);

  const footer = document.createElement("div");
  footer.className = "offer-card-footer";

  const author = document.createElement("span");
  author.className = "offer-author";
  author.title = owner.name || "Usuário";

  const avatar = document.createElement("span");
  avatar.className = "avatar avatar-sm";
  avatar.textContent = initials(owner.name);
  author.appendChild(avatar);

  const authorName = document.createElement("span");
  authorName.className = "offer-author-name";
  authorName.textContent = owner.name || "Usuário";
  author.appendChild(authorName);

  const date = document.createElement("time");
  date.className = "offer-date";
  date.dateTime = offer.createdAt?.toDate?.().toISOString?.() || "";
  date.textContent = offer.createdAt ? timeAgo(offer.createdAt) : formatDate(new Date());
  author.appendChild(date);

  footer.appendChild(author);

  if (currentUser && offer.userId === currentUser.uid) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete";
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Excluir';
    deleteBtn.addEventListener("click", () => {
      deleteBtn.disabled = true;
      handleDeleteOffer(offer.id, currentUser.uid);
    });
    footer.appendChild(deleteBtn);
  }

  card.appendChild(footer);
  return card;
}

async function handleDeleteOffer(offerId, userId) {
  try {
    await deleteOffer(offerId, userId);
    toast("Oferta excluída.", "success");
  } catch (error) {
    console.error("[Trocaê] Erro ao excluir oferta:", error);
    toast(error.message || "Não foi possível excluir a oferta.", "error");
  }
}

export async function createOffer({ title, description }) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-current-user");

  await addDoc(collection(db, "offers"), {
    title: title.trim(),
    description: description.trim(),
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
}

export async function deleteOffer(offerId, userId) {
  const offerRef = doc(db, "offers", offerId);
  const offerSnapshot = await getDoc(offerRef);

  if (!offerSnapshot.exists()) {
    throw new Error("Esta oferta não existe mais.");
  }

  if (offerSnapshot.data().userId !== userId) {
    throw new Error("Você só pode excluir as suas próprias ofertas.");
  }

  await deleteDoc(offerRef);
}
