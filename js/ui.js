/**
 * Trocaê – Utilitários de Interface (modais, toasts, tema, carousel)
 */

/* ========== Tema ========== */
export function initTheme() {
  const saved = localStorage.getItem("trocae-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("trocae-theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  // Ícones já controlados via CSS
}

/* ========== Modais ========== */
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("open");
    if (!document.querySelector(".modal.open")) {
      document.body.style.overflow = "";
    }
  }
}

export function closeAllModals() {
  document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
  document.body.style.overflow = "";
}

/* ========== Toast ========== */
export function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ========== Carousel de Banners ========== */
const BANNER_SLIDES = [
  {
    title: "Dê uma nova vida ao que você não usa mais",
    subtitle: "Troque, reutilize e fortaleça a economia circular na sua região.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80"
  },
  {
    title: "Troque o que você não quer, pelo que precisa",
    subtitle: "Produtos por produtos, serviços por serviços ou mistos. Sem dinheiro.",
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80"
  },
  {
    title: "Comunidade local, impacto real",
    subtitle: "Conecte-se com vizinhos e construa relações baseadas em reciprocidade.",
    image: "https://images.unsplash.com/photo-1582213782179-e0d53f98b2e3?w=1200&q=80"
  },
  {
    title: "Sustentabilidade começa com uma troca",
    subtitle: "Menos desperdício, mais valor. Junte-se ao movimento Trocaê.",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200&q=80"
  }
];

let currentSlide = 0;
let carouselInterval = null;

export function initCarousel() {
  const track = document.getElementById("carouselTrack");
  const dotsContainer = document.getElementById("carouselDots");
  if (!track || !dotsContainer) return;

  track.innerHTML = "";
  dotsContainer.innerHTML = "";

  BANNER_SLIDES.forEach((slide, i) => {
    const div = document.createElement("div");
    div.className = "carousel-slide";
    div.style.backgroundImage = `url(${slide.image})`;
    div.innerHTML = `
      <div class="slide-content">
        <h2>${slide.title}</h2>
        <p>${slide.subtitle}</p>
      </div>
    `;
    track.appendChild(div);

    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });

  document.getElementById("carouselPrev")?.addEventListener("click", () => {
    goToSlide(currentSlide - 1);
    resetCarouselTimer();
  });
  document.getElementById("carouselNext")?.addEventListener("click", () => {
    goToSlide(currentSlide + 1);
    resetCarouselTimer();
  });

  startCarouselTimer();
}

function goToSlide(index) {
  const track = document.getElementById("carouselTrack");
  const dots = document.querySelectorAll(".carousel-dots .dot");
  if (!track) return;

  currentSlide = (index + BANNER_SLIDES.length) % BANNER_SLIDES.length;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;

  dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
}

function startCarouselTimer() {
  carouselInterval = setInterval(() => {
    goToSlide(currentSlide + 1);
  }, 8000);
}

function resetCarouselTimer() {
  clearInterval(carouselInterval);
  startCarouselTimer();
}

/* ========== Formatação ========== */
export function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatWhatsAppLink(number, offerTitle) {
  const clean = String(number).replace(/\D/g, "");
  const text = encodeURIComponent(
    `Olá! Vi seu anúncio "${offerTitle}" no Trocaê e gostaria de conversar sobre a troca.`
  );
  return `https://wa.me/55${clean}?text=${text}`;
}
