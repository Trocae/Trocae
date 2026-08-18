import { auth, isFirebaseReady } from "./firebase-init.js";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseConfig } from "./config.js";
import {
  signUp,
  signIn,
  signOutUser,
  updateUserProfile,
  updateUserEmail,
  resendVerificationEmail,
  deleteAccountFull,
  refreshUser,
  getAuthErrorMessage,
} from "./auth.js";
import {
  initFeed,
  renderOffers,
  createOffer,
} from "./offers.js";
import {
  toast,
  openModal,
  closeModal,
  closeAllModals,
  showError,
  clearForm,
  setFormBusy,
  initials,
} from "./ui.js";

const $ = (id) => document.getElementById(id);

const FIREBASE_IS_CONFIGURED =
  !firebaseConfig.apiKey.includes("AIzaSyA-p54xblpgEqdv7eJ-HjN1FvCv12Vz-ZU") &&
  !firebaseConfig.appId.includes("1:727780957751:web:0cc36e90d867031b8069b2");

let currentUser = null;
let confirmCallback = null;

function initTheme() {
  const stored = localStorage.getItem("trocae-theme");
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (preferredDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  $("btnThemeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("trocae-theme", next);
  });
}

function initModals() {
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      el.closest(".modal").hidden = true;
      document.body.style.overflow = "";
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAllModals();
    closeDropdown();
  });
}

function initAuthTabs() {
  const tabLogin = $("tabLogin");
  const tabSignup = $("tabSignup");

  const activate = (loginActive) => {
    tabLogin.classList.toggle("is-active", loginActive);
    tabSignup.classList.toggle("is-active", !loginActive);
    tabLogin.setAttribute("aria-selected", String(loginActive));
    tabSignup.setAttribute("aria-selected", String(!loginActive));
    $("loginForm").hidden = !loginActive;
    $("signupForm").hidden = loginActive;
    showError("loginError", "");
    showError("signupError", "");
  };

  tabLogin.addEventListener("click", () => activate(true));
  tabSignup.addEventListener("click", () => activate(false));
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  showError("loginError", "");
  setFormBusy(form, true);

  try {
    await signIn(email, password);
    closeModal("authModal");
    clearForm(form);
    toast("Login realizado com sucesso!", "success");
  } catch (error) {
    showError("loginError", getAuthErrorMessage(error));
  } finally {
    setFormBusy(form, false);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;
  showError("signupError", "");

  if (!name) {
    showError("signupError", "Informe seu nome de exibição.");
    return;
  }

  if (password !== confirm) {
    showError("signupError", "As senhas não coincidem.");
    return;
  }

  setFormBusy(form, true);

  try {
    await signUp(name, email, password);
    closeModal("authModal");
    clearForm(form);
    toast("Conta criada! Enviamos um e-mail de verificação para " + email, "success");
    openModal("profileModal");
    await populateProfileModal();
  } catch (error) {
    showError("signupError", getAuthErrorMessage(error));
  } finally {
    setFormBusy(form, false);
  }
}

function openAuthModal() {
  showError("loginError", "");
  showError("signupError", "");
  openModal("authModal");
}

function openOfferModal() {
  const user = auth.currentUser;
  if (!user) {
    openAuthModal();
    toast("Entre ou crie uma conta para publicar ofertas.");
    return;
  }

  if (!user.emailVerified) {
    toast("Verifique seu e-mail antes de publicar ofertas.", "error");
    openModal("profileModal");
    return;
  }

  const form = $("offerForm");
  clearForm(form);
  showError("offerError", "");
  openModal("offerModal");
}

async function handleCreateOffer(event) {
  event.preventDefault();
  const form = event.target;
  const user = auth.currentUser;
  if (!user) return;

  if (!user.emailVerified) {
    showError("offerError", "Você ainda não verificou seu e-mail. Confira sua caixa de entrada para ativar sua conta.");
    return;
  }

  showError("offerError", "");
  setFormBusy(form, true);

  try {
    await createOffer({
      title: $("offerTitle").value,
      description: $("offerDescription").value,
    });
    closeModal("offerModal");
    clearForm(form);
    toast("Oferta publicada!", "success");
  } catch (error) {
    showError("offerError", error.message || "Não foi possível publicar a oferta.");
  } finally {
    setFormBusy(form, false);
  }
}

async function populateProfileModal() {
  const user = await refreshUser();
  if (!user) return;

  $("profileName").value = user.displayName || "";
  $("profileEmail").value = user.email || "";
  showError("profileError", "");

  const banner = $("verificationBanner");
  const text = $("verificationText");
  const resendBtn = $("btnResendVerification");

  if (user.emailVerified) {
    banner.hidden = false;
    banner.classList.add("is-verified");
    text.textContent = "Seu e-mail está verificado.";
    resendBtn.hidden = true;
  } else {
    banner.hidden = false;
    banner.classList.remove("is-verified");
    text.textContent = "Seu e-mail ainda não foi verificado. Enviamos uma mensagem de confirmação para " + (user.email || "") + ".";
    resendBtn.hidden = false;
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  const form = event.target;
  const name = $("profileName").value.trim();
  const email = $("profileEmail").value.trim();
  showError("profileError", "");
  setFormBusy(form, true);

  try {
    const changes = [];

    if (name && name !== (currentUser?.displayName || "")) {
      changes.push(updateUserProfile(name));
    }
    if (email && email !== (currentUser?.email || "")) {
      changes.push(updateUserEmail(email));
    }

    await Promise.all(changes);
    await refreshUser();
    updateUserHeader();
    toast("Perfil atualizado!", "success");
    await populateProfileModal();
  } catch (error) {
    showError("profileError", getAuthErrorMessage(error));
  } finally {
    setFormBusy(form, false);
  }
}

async function handleResendVerification() {
  const btn = $("btnResendVerification");
  btn.disabled = true;
  try {
    await resendVerificationEmail();
    toast("E-mail de verificação reenviado. Confira sua caixa de entrada.", "success");
  } catch (error) {
    toast(getAuthErrorMessage(error), "error");
  } finally {
    btn.disabled = false;
  }
}

function openConfirm({ title, message, confirmLabel = "Confirmar", onConfirm }) {
  confirmCallback = onConfirm;
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  const okBtn = $("btnConfirmOk");
  okBtn.textContent = confirmLabel;
  openModal("confirmModal");
}

function closeConfirm() {
  confirmCallback = null;
  closeModal("confirmModal");
}

function handleConfirmOk() {
  if (typeof confirmCallback === "function") {
    const callback = confirmCallback;
    closeConfirm();
    callback();
  }
}

async function handleDeleteAccount() {
  const user = auth.currentUser;
  if (!user) return;

  openConfirm({
    title: "Excluir minha conta?",
    message: "Sua conta, perfil e todos os seus anúncios serão apagados permanentemente. Essa ação não pode ser desfeita.",
    confirmLabel: "Excluir minha conta",
    onConfirm: async () => {
      try {
        toast("Excluindo conta...");
        await deleteAccountFull(user);
        toast("Conta excluída com sucesso. Até logo!", "success");
      } catch (error) {
        console.error("[Trocaê] Erro ao excluir conta:", error);
        toast(getAuthErrorMessage(error), "error");
      }
    },
  });
}

function closeDropdown() {
  const dropdown = $("userDropdown");
  const menuBtn = $("btnUserMenu");
  dropdown.hidden = true;
  menuBtn.classList.remove("is-open");
  menuBtn.setAttribute("aria-expanded", "false");
}

function toggleDropdown() {
  const dropdown = $("userDropdown");
  const menuBtn = $("btnUserMenu");
  const willOpen = dropdown.hidden;
  dropdown.hidden = !willOpen;
  menuBtn.classList.toggle("is-open", willOpen);
  menuBtn.setAttribute("aria-expanded", String(willOpen));
}

function initDropdown() {
  $("btnUserMenu").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDropdown();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-menu")) {
      closeDropdown();
    }
  });
}

function updateUserHeader() {
  const user = currentUser;
  if (!user) return;

  $("userName").textContent = user.displayName || user.email || "Usuário";
  $("userAvatar").textContent = initials(user.displayName || user.email);
}

function handleAuthStateChange(user) {
  currentUser = user;
  renderOffers();

  if (user) {
    $("guestArea").hidden = true;
    $("userArea").hidden = false;
    $("btnNewOfferFeed").hidden = false;
    updateUserHeader();
  } else {
    $("guestArea").hidden = false;
    $("userArea").hidden = true;
    $("btnNewOfferFeed").hidden = true;
    closeAllModals();
    closeDropdown();
  }
}

function showConfigBanner() {
  const banner = document.createElement("div");
  banner.style.cssText =
    "max-width:1120px;margin:20px auto 0;padding:14px 18px;border:1px solid " +
    "color-mix(in srgb, var(--color-warning) 40%, transparent);border-radius:12px;" +
    "background:var(--color-warning-soft);color:var(--color-text);font-size:0.92rem;";
  

function bindEvents() {
  $("btnLogin").addEventListener("click", openAuthModal);
  $("btnHeroCta").addEventListener("click", () => {
    if (auth.currentUser) {
      openOfferModal();
    } else {
      openAuthModal();
    }
  });
  $("btnNewOffer").addEventListener("click", openOfferModal);
  $("btnNewOfferFeed").addEventListener("click", openOfferModal);

  $("loginForm").addEventListener("submit", handleLogin);
  $("signupForm").addEventListener("submit", handleSignup);
  $("offerForm").addEventListener("submit", handleCreateOffer);
  $("profileForm").addEventListener("submit", handleProfileSave);
  $("btnResendVerification").addEventListener("click", handleResendVerification);
  $("btnDeleteAccount").addEventListener("click", handleDeleteAccount);
  $("btnConfirmOk").addEventListener("click", handleConfirmOk);
  $("btnConfirmCancel").addEventListener("click", closeConfirm);

  $("btnProfile").addEventListener("click", async () => {
    closeDropdown();
    await populateProfileModal();
    openModal("profileModal");
  });

  $("btnLogout").addEventListener("click", async () => {
    closeDropdown();
    try {
      await signOutUser();
      toast("Você saiu da sua conta.");
    } catch (error) {
      toast("Não foi possível sair. Tente novamente.", "error");
    }
  });
}

function init() {
  initTheme();
  initModals();
  initAuthTabs();
  initDropdown();
  bindEvents();

  if (!FIREBASE_IS_CONFIGURED) {
    showConfigBanner();
  }

  if (!isFirebaseReady()) {
    const loading = $("feedLoading");
    if (loading) loading.hidden = true;
    toast("Erro de inicialização do Firebase. Verifique a configuração.", "error");
    return;
  }

  onAuthStateChanged(auth, handleAuthStateChange);
  initFeed();
}

init();
