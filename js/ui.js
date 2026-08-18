let toastTimer = null;

export function toast(message, type = "info", duration = 3500) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = message;
  el.className = "toast";
  if (type === "success") el.classList.add("is-success");
  if (type === "error") el.classList.add("is-error");
  el.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, duration);
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  const firstInput = modal.querySelector("input, textarea, button");
  if (firstInput) firstInput.focus({ preventScroll: true });
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = true;
  if (!document.querySelector(".modal:not([hidden])")) {
    document.body.style.overflow = "";
  }
}

export function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => {
    m.hidden = true;
  });
  document.body.style.overflow = "";
}

export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = message || "";
}

export function clearForm(form) {
  form.reset();
  form.querySelectorAll(".form-error").forEach((el) => {
    el.textContent = "";
  });
}

export function setFormBusy(form, busy) {
  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = busy;
    submit.dataset.label = submit.dataset.label || submit.textContent;
    submit.textContent = busy ? "Aguarde..." : submit.dataset.label;
  }
}

export function formatDate(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function initials(name) {
  const clean = String(name || "?").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

export function timeAgo(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} dia${days > 1 ? "s" : ""}`;
  return formatDate(date);
}
