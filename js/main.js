/**
 * Trocaê – Ponto de entrada principal
 * Orquestra UI, Auth, Ofertas, Chat e Perfil
 */

import {
  initAuth,
  getCurrentUser,
  getCurrentUserData,
  isLoggedIn,
  isEmailVerified,
  signUp,
  login,
  logout,
  updateUserProfile,
  deleteAccountCompletely,
  toggleBlockUser,
  isUserBlocked
} from "./auth.js";

import {
  createOffer,
  updateOffer,
  deleteOffer,
  subscribeOffers,
  filterOffersBySearch,
  getOfferById,
  getMyOffers,
  toggleFavorite,
  getFavorites,
  isFavorite
} from "./offers.js";

import {
  getOrCreateChat,
  sendMessage,
  subscribeMessages,
  getMyChats
} from "./chat.js";

import {
  initTheme,
  toggleTheme,
  openModal,
  closeModal,
  closeAllModals,
  showToast,
  initCarousel,
  formatDate,
  formatWhatsAppLink
} from "./ui.js";

// Estado local
let selectedImages = [];
let currentChatId = null;
let unsubscribeChat = null;
let currentEditingOfferId = null;

// ============================================================
// Inicialização
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initCarousel();
  bindGlobalEvents();
  initAuth(onAuthChange);
  subscribeOffers(renderOffers);
});

function onAuthChange(user, userData) {
  const btnAuth = document.getElementById("btnAuth");
  const btnProfile = document.getElementById("btnProfile");
  const btnNewOffer = document.getElementById("btnNewOffer");

  if (user) {
    btnAuth?.classList.add("hidden");
    btnProfile?.classList.remove("hidden");
    btnNewOffer?.classList.remove("hidden");

    if (!user.emailVerified) {
      showToast("Verifique seu e-mail para publicar e usar o chat.", "info");
    }
  } else {
    btnAuth?.classList.remove("hidden");
    btnProfile?.classList.add("hidden");
    btnNewOffer?.classList.add("hidden");
  }
}

// ============================================================
// Eventos globais
// ============================================================
function bindGlobalEvents() {
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);

  document.getElementById("logoLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeAllModals();
  });

  document.getElementById("btnAuth")?.addEventListener("click", () => openModal("authModal"));

  document.getElementById("btnProfile")?.addEventListener("click", () => {
    openProfileModal();
  });

  document.getElementById("btnNewOffer")?.addEventListener("click", () => {
    if (!isLoggedIn()) {
      showToast("Faça login para publicar.", "error");
      openModal("authModal");
      return;
    }
    if (!isEmailVerified()) {
      showToast("Verifique seu e-mail antes de publicar.", "error");
      return;
    }
    resetOfferForm();
    openModal("offerModal");
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      document.getElementById("loginForm")?.classList.toggle("hidden", !isLogin);
      document.getElementById("signupForm")?.classList.toggle("hidden", isLogin);
      document.getElementById("authTitle").textContent = isLogin
        ? "Entrar no Trocaê"
        : "Criar conta no Trocaê";
    });
  });

  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("signupForm")?.addEventListener("submit", handleSignup);

  document.getElementById("offerForm")?.addEventListener("submit", handleOfferSubmit);
  document.getElementById("btnSelectImages")?.addEventListener("click", () => {
    document.getElementById("offerImages")?.click();
  });
  document.getElementById("offerImages")?.addEventListener("change", handleImageSelect);

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");
  searchInput?.addEventListener("input", () => {
    const term = searchInput.value;
    clearBtn?.classList.toggle("hidden", !term);
    const filtered = filterOffersBySearch(term);
    renderOffers(filtered, true);
  });
  clearBtn?.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.add("hidden");
    renderOffers(filterOffersBySearch(""), true);
  });

  document.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchProfileTab(tab.dataset.tab));
  });

  document.getElementById("profileForm")?.addEventListener("submit", handleProfileSave);
  document.getElementById("btnDeleteAccount")?.addEventListener("click", handleDeleteAccount);
  document.getElementById("chatForm")?.addEventListener("submit", handleChatSubmit);
}

// ============================================================
// Auth handlers
// ============================================================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";

  try {
    await login(email, password);
    closeModal("authModal");
    showToast("Bem-vindo de volta!", "success");
    e.target.reset();
  } catch (err) {
    errEl.textContent = translateAuthError(err);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const whatsapp = document.getElementById("signupWhatsapp").value.trim();
  const password = document.getElementById("signupPassword").value;
  const errEl = document.getElementById("signupError");
  errEl.textContent = "";

  try {
    await signUp(name, email, password, whatsapp);
    closeModal("authModal");
    showToast("Conta criada! Verifique seu e-mail para ativar.", "success");
    e.target.reset();
  } catch (err) {
    errEl.textContent = translateAuthError(err);
  }
}

function translateAuthError(err) {
  const code = err.code || "";
  const map = {
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "Senha muito fraca (mín. 6 caracteres).",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Tente mais tarde."
  };
  return map[code] || err.message || "Erro inesperado.";
}

// ============================================================
// Ofertas – Renderização
// ============================================================
function renderOffers(offers, isSearch = false) {
  const grid = document.getElementById("offersGrid");
  const empty = document.getElementById("emptyState");
  const loading = document.getElementById("loadingState");
  const countEl = document.getElementById("offerCount");

  if (loading) loading.classList.add("hidden");

  if (!offers || offers.length === 0) {
    grid.innerHTML = "";
    empty?.classList.remove("hidden");
    if (countEl) countEl.textContent = "";
    return;
  }

  empty?.classList.add("hidden");
  if (countEl) countEl.textContent = `${offers.length} oferta${offers.length !== 1 ? "s" : ""}`;

  grid.innerHTML = offers
    .map((o) => {
      const cover = (o.images && o.images[0]) || "https://via.placeholder.com/400x300?text=Sem+foto";
      const dots =
        o.images && o.images.length > 1
          ? `<div class="card-image-nav">${o.images
              .map((_, i) => `<span class="card-dot${i === 0 ? " active" : ""}"></span>`)
              .join("")}</div>`
          : "";

      return `
      <article class="offer-card" data-id="${o.id}">
        <div class="card-image-wrap">
          <img src="${cover}" alt="${escapeHtml(o.title)}" loading="lazy">
          ${dots}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(o.title)}</h3>
          <p class="card-desc">${escapeHtml(o.description)}</p>
          <div class="card-actions">
            <button class="btn btn-whatsapp btn-sm" data-action="whatsapp" data-id="${o.id}" title="WhatsApp">📱 WhatsApp</button>
            <button class="btn btn-chat btn-sm" data-action="chat" data-id="${o.id}" title="Chat interno">💬 Chat</button>
            <button class="btn btn-fav btn-sm" data-action="fav" data-id="${o.id}" title="Favoritar">⭐</button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  grid.querySelectorAll(".offer-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      openDetailModal(card.dataset.id);
    });
  });

  grid.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "whatsapp") handleWhatsApp(id);
      else if (action === "chat") handleOpenChat(id);
      else if (action === "fav") handleToggleFav(id, btn);
    });
  });

  if (isLoggedIn()) {
    offers.forEach(async (o) => {
      const fav = await isFavorite(o.id);
      const btn = grid.querySelector(`[data-action="fav"][data-id="${o.id}"]`);
      if (btn && fav) btn.classList.add("active");
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// Detalhe da oferta
// ============================================================
async function openDetailModal(offerId) {
  const offer = await getOfferById(offerId);
  if (!offer) {
    showToast("Oferta não encontrada.", "error");
    return;
  }

  const content = document.getElementById("detailContent");
  const images =
    offer.images && offer.images.length
      ? offer.images.map((url) => `<img src="${url}" alt="">`).join("")
      : `<img src="https://via.placeholder.com/600x400?text=Sem+foto" alt="">`;

  content.innerHTML = `
    <div class="detail-gallery">${images}</div>
    <h2 class="detail-title">${escapeHtml(offer.title)}</h2>
    <p class="detail-desc">${escapeHtml(offer.description)}</p>
    <p class="detail-meta">Publicado por ${escapeHtml(offer.userName || "Usuário")} • ${formatDate(offer.createdAt)}</p>
    <div class="detail-actions">
      <button class="btn btn-whatsapp" data-action="whatsapp" data-id="${offer.id}">📱 WhatsApp</button>
      <button class="btn btn-chat" data-action="chat" data-id="${offer.id}">💬 Chat interno</button>
      <button class="btn btn-fav" data-action="fav" data-id="${offer.id}">⭐ Favoritar</button>
      ${
        isLoggedIn() && getCurrentUser()?.uid !== offer.userId
          ? `<button class="btn btn-outline btn-sm" data-action="block" data-userid="${offer.userId}">🚫 Bloquear usuário</button>`
          : ""
      }
    </div>
  `;

  content.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "whatsapp") handleWhatsApp(offer.id);
      else if (action === "chat") handleOpenChat(offer.id);
      else if (action === "fav") handleToggleFav(offer.id, btn);
      else if (action === "block") {
        try {
          const blocked = await toggleBlockUser(btn.dataset.userid);
          showToast(blocked ? "Usuário bloqueado." : "Usuário desbloqueado.", "success");
          closeModal("detailModal");
        } catch (err) {
          showToast(err.message, "error");
        }
      }
    });
  });

  openModal("detailModal");
}

// ============================================================
// Ações rápidas
// ============================================================
async function handleWhatsApp(offerId) {
  const offer = await getOfferById(offerId);
  if (!offer) return;

  try {
    const { getDoc, doc, db } = await import("./firebase.js");
    const userSnap = await getDoc(doc(db, "users", offer.userId));
    if (!userSnap.exists() || !userSnap.data().whatsapp) {
      showToast("WhatsApp do anunciante não disponível.", "error");
      return;
    }
    const link = formatWhatsAppLink(userSnap.data().whatsapp, offer.title);
    window.open(link, "_blank");
  } catch (err) {
    showToast("Erro ao abrir WhatsApp.", "error");
  }
}

async function handleOpenChat(offerId) {
  if (!isLoggedIn()) {
    showToast("Faça login para usar o chat.", "error");
    openModal("authModal");
    return;
  }
  if (!isEmailVerified()) {
    showToast("Verifique seu e-mail para usar o chat.", "error");
    return;
  }

  const offer = await getOfferById(offerId);
  if (!offer) return;
  if (offer.userId === getCurrentUser().uid) {
    showToast("Esta é a sua oferta.", "info");
    return;
  }

  try {
    currentChatId = await getOrCreateChat(offer.userId, offer.id, offer.title);
    document.getElementById("chatTitle").textContent = `Chat com ${offer.userName || "usuário"}`;
    document.getElementById("chatOfferRef").textContent = `Sobre: ${offer.title}`;
    document.getElementById("chatMessages").innerHTML = "";

    if (unsubscribeChat) unsubscribeChat();
    unsubscribeChat = subscribeMessages(currentChatId, renderChatMessages);

    openModal("chatModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderChatMessages(messages) {
  const container = document.getElementById("chatMessages");
  const uid = getCurrentUser()?.uid;
  container.innerHTML = messages
    .map((m) => {
      const mine = m.senderId === uid;
      const time = m.timestamp ? formatDate(m.timestamp) : "";
      return `
      <div class="chat-bubble ${mine ? "mine" : "theirs"}">
        ${escapeHtml(m.text)}
        <span class="chat-time">${time}</span>
      </div>
    `;
    })
    .join("");
  container.scrollTop = container.scrollHeight;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentChatId) return;

  try {
    await sendMessage(currentChatId, text);
    input.value = "";
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleToggleFav(offerId, btn) {
  if (!isLoggedIn()) {
    showToast("Faça login para favoritar.", "error");
    openModal("authModal");
    return;
  }
  try {
    const added = await toggleFavorite(offerId);
    btn.classList.toggle("active", added);
    showToast(added ? "Adicionado aos favoritos!" : "Removido dos favoritos.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ============================================================
// Formulário de Oferta + Imagens
// ============================================================
function resetOfferForm() {
  currentEditingOfferId = null;
  selectedImages = [];
  document.getElementById("offerId").value = "";
  document.getElementById("offerTitle").value = "";
  document.getElementById("offerDescription").value = "";
  document.getElementById("imagePreview").innerHTML = "";
  document.getElementById("offerModalTitle").textContent = "Publicar oferta";
  document.getElementById("btnSubmitOffer").textContent = "Publicar";
  document.getElementById("offerError").textContent = "";
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files || []);
  const remaining = 6 - selectedImages.length;
  const toAdd = files.slice(0, remaining);

  selectedImages = [...selectedImages, ...toAdd].slice(0, 6);
  renderImagePreviews();
  e.target.value = "";
}

function renderImagePreviews() {
  const container = document.getElementById("imagePreview");
  container.innerHTML = selectedImages
    .map((file, i) => {
      const url = URL.createObjectURL(file);
      return `
      <div class="preview-item">
        <img src="${url}" alt="Preview ${i + 1}">
        <button type="button" class="preview-remove" data-index="${i}" aria-label="Remover">×</button>
      </div>
    `;
    })
    .join("");

  container.querySelectorAll(".preview-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedImages.splice(Number(btn.dataset.index), 1);
      renderImagePreviews();
    });
  });
}

async function handleOfferSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("offerTitle").value.trim();
  const description = document.getElementById("offerDescription").value.trim();
  const errEl = document.getElementById("offerError");
  errEl.textContent = "";

  const btn = document.getElementById("btnSubmitOffer");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    if (currentEditingOfferId) {
      const existing = await getOfferById(currentEditingOfferId);
      await updateOffer(currentEditingOfferId, {
        title,
        description,
        imageFiles: selectedImages,
        existingImages: existing?.images || []
      });
      showToast("Oferta atualizada!", "success");
    } else {
      if (selectedImages.length === 0) {
        throw new Error("Adicione pelo menos uma imagem.");
      }
      await createOffer({ title, description, imageFiles: selectedImages });
      showToast("Oferta publicada com sucesso!", "success");
    }
    closeModal("offerModal");
    resetOfferForm();
  } catch (err) {
    errEl.textContent = err.message || "Erro ao publicar.";
  } finally {
    btn.disabled = false;
    btn.textContent = currentEditingOfferId ? "Salvar" : "Publicar";
  }
}

// ============================================================
// Perfil
// ============================================================
async function openProfileModal() {
  if (!isLoggedIn()) return;
  const data = getCurrentUserData();
  const user = getCurrentUser();

  document.getElementById("profileName").value = data?.name || user?.displayName || "";
  document.getElementById("profileEmail").value = user?.email || "";
  document.getElementById("profileWhatsapp").value = data?.whatsapp || "";

  switchProfileTab("account");
  openModal("profileModal");
}

function switchProfileTab(tabName) {
  document.querySelectorAll(".profile-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  document.querySelectorAll(".profile-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${tabName}`);
  });

  if (tabName === "myOffers") loadMyOffers();
  else if (tabName === "chats") loadMyChats();
  else if (tabName === "favorites") loadFavorites();
  else if (tabName === "blocked") loadBlocked();
}

async function handleProfileSave(e) {
  e.preventDefault();
  const name = document.getElementById("profileName").value.trim();
  const whatsapp = document.getElementById("profileWhatsapp").value.trim();

  try {
    await updateUserProfile(name, whatsapp);
    showToast("Perfil atualizado!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleDeleteAccount() {
  if (!confirm("Tem certeza? Esta ação é irreversível. Todos os seus anúncios serão apagados.")) {
    return;
  }

  const password = prompt("Por segurança, digite sua senha para confirmar a exclusão da conta:");
  if (!password) {
    showToast("Exclusão cancelada.", "info");
    return;
  }

  try {
    await deleteAccountCompletely(password);
    closeModal("profileModal");
    showToast("Conta excluída com sucesso.", "success");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      showToast("Senha incorreta.", "error");
    } else if (err.code === "auth/requires-recent-login") {
      showToast("Faça login novamente e tente excluir a conta.", "error");
    } else {
      showToast(err.message || "Erro ao excluir conta.", "error");
    }
  }
}

async function loadMyOffers() {
  const list = document.getElementById("myOffersList");
  const empty = document.getElementById("myOffersEmpty");
  list.innerHTML = "<p>Carregando...</p>";

  try {
    const offers = await getMyOffers();
    if (!offers.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = offers
      .map(
        (o) => `
      <div class="profile-item">
        <img src="${(o.images && o.images[0]) || "https://via.placeholder.com/56"}" alt="">
        <div class="profile-item-info">
          <h4>${escapeHtml(o.title)}</h4>
          <p>${formatDate(o.createdAt)}</p>
        </div>
        <div class="profile-item-actions">
          <button class="btn btn-outline btn-sm" data-edit="${o.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-delete="${o.id}">Excluir</button>
        </div>
      </div>
    `
      )
      .join("");

    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => editOffer(btn.dataset.edit));
    });
    list.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir esta oferta?")) return;
        try {
          await deleteOffer(btn.dataset.delete);
          showToast("Oferta excluída.", "success");
          loadMyOffers();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function editOffer(offerId) {
  const offer = await getOfferById(offerId);
  if (!offer) return;

  currentEditingOfferId = offerId;
  selectedImages = [];
  document.getElementById("offerId").value = offerId;
  document.getElementById("offerTitle").value = offer.title || "";
  document.getElementById("offerDescription").value = offer.description || "";
  document.getElementById("imagePreview").innerHTML =
    (offer.images || [])
      .map(
        (url, i) => `
    <div class="preview-item">
      <img src="${url}" alt="Foto ${i + 1}">
    </div>
  `
      )
      .join("") +
    `<p class="hint">Para adicionar novas fotos, use o botão abaixo (as existentes serão mantidas + novas).</p>`;
  document.getElementById("offerModalTitle").textContent = "Editar oferta";
  document.getElementById("btnSubmitOffer").textContent = "Salvar";
  closeModal("profileModal");
  openModal("offerModal");
}

async function loadMyChats() {
  const list = document.getElementById("chatsList");
  const empty = document.getElementById("chatsEmpty");
  list.innerHTML = "<p>Carregando...</p>";

  try {
    const chats = await getMyChats();
    if (!chats.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    list.innerHTML = chats
      .map((c) => {
        return `
        <div class="profile-item" data-chatid="${c.id}" data-offerid="${c.offerId}" style="cursor:pointer">
          <div class="profile-item-info">
            <h4>${escapeHtml(c.offerTitle || "Oferta")}</h4>
            <p>${escapeHtml(c.lastMessage || "Sem mensagens")} • ${formatDate(c.lastMessageAt)}</p>
          </div>
        </div>
      `;
      })
      .join("");

    list.querySelectorAll("[data-chatid]").forEach((el) => {
      el.addEventListener("click", async () => {
        currentChatId = el.dataset.chatid;
        document.getElementById("chatTitle").textContent = "Conversa";
        document.getElementById("chatOfferRef").textContent = "";
        if (unsubscribeChat) unsubscribeChat();
        unsubscribeChat = subscribeMessages(currentChatId, renderChatMessages);
        closeModal("profileModal");
        openModal("chatModal");
      });
    });
  } catch (err) {
    list.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function loadFavorites() {
  const list = document.getElementById("favoritesList");
  const empty = document.getElementById("favoritesEmpty");
  list.innerHTML = "<p>Carregando...</p>";

  try {
    const favs = await getFavorites();
    if (!favs.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = favs
      .map(
        (o) => `
      <div class="profile-item" data-offer="${o.id}" style="cursor:pointer">
        <img src="${(o.images && o.images[0]) || "https://via.placeholder.com/56"}" alt="">
        <div class="profile-item-info">
          <h4>${escapeHtml(o.title)}</h4>
          <p>${escapeHtml(o.userName || "")}</p>
        </div>
        <button class="btn btn-outline btn-sm" data-unfav="${o.id}">Remover</button>
      </div>
    `
      )
      .join("");

    list.querySelectorAll("[data-offer]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-unfav]")) return;
        openDetailModal(el.dataset.offer);
      });
    });
    list.querySelectorAll("[data-unfav]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await toggleFavorite(btn.dataset.unfav);
        loadFavorites();
      });
    });
  } catch (err) {
    list.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function loadBlocked() {
  const list = document.getElementById("blockedList");
  const empty = document.getElementById("blockedEmpty");
  const blocked = getCurrentUserData()?.userBlockedList || [];

  if (!blocked.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const { getDoc, doc, db } = await import("./firebase.js");
  const items = await Promise.all(
    blocked.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        return { uid, name: snap.exists() ? snap.data().name : "Usuário removido" };
      } catch {
        return { uid, name: "Usuário" };
      }
    })
  );

  list.innerHTML = items
    .map(
      (u) => `
    <div class="profile-item">
      <div class="profile-item-info">
        <h4>${escapeHtml(u.name)}</h4>
      </div>
      <button class="btn btn-outline btn-sm" data-unblock="${u.uid}">Desbloquear</button>
    </div>
  `
    )
    .join("");

  list.querySelectorAll("[data-unblock]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await toggleBlockUser(btn.dataset.unblock);
      showToast("Usuário desbloqueado.", "success");
      loadBlocked();
    });
  });
}
