/**
 * Trocaê – Módulo de Ofertas (CRUD + Feed + Imagens)
 * Versão SEM Firebase Storage (plano gratuito Spark)
 * Imagens são comprimidas e salvas como Base64 no Firestore
 */

import {
  db,
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
  serverTimestamp
} from "./firebase.js";

import { getCurrentUser, getCurrentUserData } from "./auth.js";

const MAX_IMAGES = 6;
const MAX_WIDTH = 800;      // largura máxima da imagem
const JPEG_QUALITY = 0.6;   // qualidade (0.1 a 1.0)

let offersCache = [];
let unsubscribeOffers = null;

/**
 * Comprime e converte um arquivo de imagem para Base64 (Data URL)
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Redimensiona mantendo proporção
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Converte para JPEG comprimido
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime várias imagens
 */
async function compressImages(files) {
  const results = [];
  for (let i = 0; i < files.length && i < MAX_IMAGES; i++) {
    const compressed = await compressImage(files[i]);
    results.push(compressed);
  }
  return results;
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

  // Comprime as imagens no navegador
  const images = await compressImages(imageFiles);

  const docRef = await addDoc(collection(db, "offers"), {
    title: title.trim(),
    description: description.trim(),
    images, // array de Base64
    userId: user.uid,
    userName: user.displayName || "Usuário",
    createdAt: serverTimestamp()
  });

  return docRef.id;
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

  // Se o usuário selecionou novas fotos, comprime e adiciona
  if (imageFiles && imageFiles.length > 0) {
    const newImages = await compressImages(imageFiles);
    images = [...images, ...newImages].slice(0, MAX_IMAGES);
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
 * Escuta ofertas em tempo real + filtros
 */
export function subscribeOffers(callback) {
  if (unsubscribeOffers) unsubscribeOffers();

  const q = query(collection(db, "offers"), orderBy("createdAt", "desc"));

  unsubscribeOffers = onSnapshot(
    q,
    async (snapshot) => {
      const raw = [];
      snapshot.forEach((d) => raw.push({ id: d.id, ...d.data() }));

      // Filtro de integridade: userId ainda existe
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

      // Filtro de usuários bloqueados
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
 * Filtro de busca local
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
 * Ofertas do usuário logado (ordenação no cliente)
 */
export async function getMyOffers() {
  const user = getCurrentUser();
  if (!user) return [];

  const q = query(
    collection(db, "offers"),
    where("userId", "==", user.uid)
  );

  const snap = await getDocs(q);
  const offers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  offers.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  return offers;
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
