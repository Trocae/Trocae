/**
 * Trocaê – Módulo de Ofertas (CRUD + Feed + Imagens)
 */

import {
  db,
  storage,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "./firebase.js";

import { getCurrentUser, getCurrentUserData, isUserBlocked } from "./auth.js";
import { showToast } from "./ui.js";

const MAX_IMAGES = 6;
let offersCache = [];
let unsubscribeOffers = null;

/**
 * Upload de imagens para Firebase Storage
 * Retorna array de URLs
 */
async function uploadImages(files, offerId) {
  const urls = [];
  for (let i = 0; i < files.length && i < MAX_IMAGES; i++) {
    const file = files[i];
    const path = `offers/${offerId}/${Date.now()}_${i}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
}

/**
 * Cria nova oferta
 */
export async function createOffer({ title, description, imageFiles }) {
  const user = getCurrentUser();
  if (!user) throw new Error("Faça login para publicar.");
  if (!user.emailVerified) throw new Error("Verifique seu e-mail antes de publicar.");

  if (!imageFiles || imageFiles.length === 0) {
    throw new Error("Adicione pelo menos uma imagem.");
  }
  if (imageFiles.length > MAX_IMAGES) {
    throw new Error(`Máximo de ${MAX_IMAGES} imagens.`);
  }

  const docRef = await addDoc(collection(db, "offers"), {
    title: title.trim(),
    description: description.trim(),
    images: [],
    userId: user.uid,
    userName: user.displayName || "Usuário",
    createdAt: serverTimestamp()
  });

  try {
    const urls = await uploadImages(imageFiles, docRef.id);
    await updateDoc(docRef, { images: urls });
    return docRef.id;
  } catch (err) {
    await deleteDoc(docRef);
    throw err;
  }
}

/**
 * Atualiza oferta existente
 */
export async function updateOffer(offerId, { title, description, imageFiles, existingImages }) {
  const user = getCurrentUser();
  if (!user) throw new Error("Não autenticado.");

  const offerRef = doc(db, "offers", offerId);
  const snap = await getDoc(offerRef);
  if (!snap.exists()) throw new Error("Oferta não encontrada.");
  if (snap.data().userId !== user.uid) throw new Error("Você não pode editar esta oferta.");

  let images = existingImages || snap.data().images || [];

  if (imageFiles && imageFiles.length > 0) {
    const newUrls = await uploadImages(imageFiles, offerId);
    images = [...images, ...newUrls].slice(0, MAX_IMAGES);
  }

  await updateDoc(offerRef, {
    title: title.trim(),
    description: description.trim(),
    images
  });
}

/**
 * Exclui oferta
 */
export async function deleteOffer(offerId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Não autenticado.");

  const offerRef = doc(db, "offers", offerId);
  const snap = await getDoc(offerRef);
  if (!snap.exists()) return;
  if (snap.data().userId !== user.uid) throw new Error("Permissão negada.");

  await deleteDoc(offerRef);
}

/**
 * Escuta ofertas em tempo real e aplica filtros de integridade + bloqueio
 */
export function subscribeOffers(callback) {
  if (unsubscribeOffers) unsubscribeOffers();

  const q = query(collection(db, "offers"), orderBy("createdAt", "desc"));

  unsubscribeOffers = onSnapshot(
    q,
    async (snapshot) => {
      const raw = [];
      snapshot.forEach((d) => raw.push({ id: d.id, ...d.data() }));

      const validUserIds = new Set();
      await Promise.all(
        [...new Set(raw.map((o) => o.userId))].map(async (uid) => {
          try {
            const u = await getDoc(doc(db, "users", uid));
            if (u.exists()) validUserIds.add(uid);
          } catch (_) {}
        })
      );

      let filtered = raw.filter((o) => validUserIds.has(o.userId));

      const blocked = getCurrentUserData()?.userBlockedList || [];
      if (blocked.length) {
        filtered = filtered.filter((o) => !blocked.includes(o.userId));
      }

      offersCache = filtered;
      callback(filtered);
    },
    (err) => {
      console.error("Erro no snapshot de ofertas:", err);
      callback([]);
    }
  );

  return unsubscribeOffers;
}

export function getOffersCache() {
  return offersCache;
}

/**
 * Filtra localmente por termo de busca (título ou descrição)
 */
export function filterOffersBySearch(term) {
  if (!term || !term.trim()) return offersCache;
  const t = term.trim().toLowerCase();
  return offersCache.filter(
    (o) =>
      (o.title || "").toLowerCase().includes(t) ||
      (o.description || "").toLowerCase().includes(t)
  );
}

/**
 * Obtém uma oferta por ID
 */
export async function getOfferById(id) {
  const snap = await getDoc(doc(db, "offers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Ofertas do usuário logado
 */
export async function getMyOffers() {
  const user = getCurrentUser();
  if (!user) return [];
  const q = query(
    collection(db, "offers"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Favoritos
 */
export async function toggleFavorite(offerId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Faça login para favoritar.");

  const favId = `${user.uid}_${offerId}`;
  const favRef = doc(db, "favorites", favId);
  const snap = await getDoc(favRef);

  if (snap.exists()) {
    await deleteDoc(favRef);
    return false;
  } else {
    await setDoc(favRef, {
      userId: user.uid,
      offerId,
      createdAt: serverTimestamp()
    });
    return true;
  }
}

export async function getFavorites() {
  const user = getCurrentUser();
  if (!user) return [];

  const q = query(collection(db, "favorites"), where("userId", "==", user.uid));
  const snap = await getDocs(q);
  const offerIds = snap.docs.map((d) => d.data().offerId);

  if (!offerIds.length) return [];

  const offers = [];
  for (const oid of offerIds) {
    const o = await getOfferById(oid);
    if (o) offers.push(o);
  }
  return offers;
}

export async function isFavorite(offerId) {
  const user = getCurrentUser();
  if (!user) return false;
  const favId = `${user.uid}_${offerId}`;
  const snap = await getDoc(doc(db, "favorites", favId));
  return snap.exists();
}
