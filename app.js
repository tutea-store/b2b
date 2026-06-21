const catalogGrid = document.getElementById("catalogGrid");
const orderTable = document.getElementById("orderTable");
const orderTotal = document.getElementById("orderTotal");
const readyMenuList = document.getElementById("readyMenuList");
const readyMenuSummary = document.getElementById("readyMenuSummary");
const guideTemperatureList = document.getElementById("guideTemperatures");

const guideBrewingNotes = {
  "matcha-1": "Для шота матча объёмом 20–40\u00a0мл в напитках",
  "white-puer-yue-guang-bai": "Светлый, мягкий, цветочный",
  "gaba-alishan": "Светлый улун, кислотность, плотность",
  "gaba-dark": "Темнее, кислотнее, фруктовее",
  "moli-hua-cha": "Жасминовый зелёный чай",
  "bai-mao-hou": "Мягкий зелёный чай",
  "tie-guan-yin-summer": "Светлый улун",
  "zheng-shan-xiao-zhong": "Копчёный красный чай",
  "yi-xing-hong-cha": "Базовый красный чай",
  "jin-hao-dian-hong": "Мягкий красный чай с ворсом",
  "assam-mokalbari": "Крепкий индийский чай",
  "shu-puer-guntin": "Плотный тёмный пуэр",
  "rooibos": "Травяной напиток без кофеина",
  "utro-v-derevne": "Травяной купаж",
  "lemongrass": "Травяной лимонный купаж",
  "chrysanthemum": "Цветочный тизан"
};

const readyMenuItems = [
  {
    name: "Моли Хуа Ча",
    image: "assets/tea_photos/moli-hua-cha.webp",
    weight: "500\u00a0г",
    price: 2375,
    taste: "жасмин, виноград, лемонграсс"
  },
  {
    name: "Те Гуань Инь Летний",
    image: "assets/tea_photos/tie-guan-yin-summer.webp",
    weight: "500\u00a0г",
    price: 2970,
    taste: "сирень, трава, яблоко"
  },
  {
    name: "Цзинь Хао Дянь Хун",
    image: "assets/tea_photos/jin-hao-dian-hong.webp",
    weight: "500\u00a0г",
    price: 4145,
    taste: "мёд, облепиха, курага"
  },
  {
    name: "Ассам Мокалбари",
    image: "assets/tea_photos/assam-mokalbari.webp",
    weight: "500\u00a0г",
    price: 3850,
    taste: "древесина, мёд, арахис"
  },
  {
    name: "Утро в деревне",
    image: "assets/tea_photos/utro-v-derevne.webp",
    weight: "500\u00a0г",
    price: 3255,
    taste: "мелисса, чабрец, смородина, ромашка"
  }
];

const readyMenuDiscount = 0.3;

let products = [];
let cart = {};

if (catalogGrid || guideTemperatureList) {
  loadProducts();
}

if (readyMenuList && readyMenuSummary) {
  renderReadyMenu();
}

initGuideNavigation();
initGuideSectionNavigation();

function formatPrice(value) {
  return `${value.toLocaleString("ru-RU")}\u00a0₽`;
}

function formatUnit(value) {
  return String(value).replace(/\s+(?=\S+$)/, "\u00a0");
}

function renderReadyMenu() {
  const fullTotal = readyMenuItems.reduce((sum, item) => sum + item.price, 0);
  const saving = Math.round(fullTotal * readyMenuDiscount);
  const discountedTotal = Math.round(fullTotal * (1 - readyMenuDiscount));

  readyMenuList.innerHTML = readyMenuItems.map((item) => {
    return `
      <div class="ready-order-item">
        <img class="ready-order-image" src="${item.image}" alt="Сухой чай ${item.name}" width="72" height="72" loading="lazy" decoding="async">
        <div class="ready-order-copy">
          <h4>${item.name}</h4>
          <p>${item.taste}</p>
        </div>
        <div class="ready-order-meta">
          <span class="ready-order-weight">${item.weight}</span>
          <span class="ready-order-price">${formatPrice(item.price)}</span>
        </div>
      </div>
    `;
  }).join("");

  readyMenuSummary.innerHTML = `
    <div class="summary-row">
      <span>Итого без скидки</span>
      <strong><s>${formatPrice(fullTotal)}</s></strong>
    </div>
    <div class="summary-row is-discount">
      <span>Скидка</span>
      <strong>30%</strong>
    </div>
    <div class="summary-row">
      <span>Экономия</span>
      <strong>${formatPrice(saving)}</strong>
    </div>
    <div class="summary-row is-delivery">
      <span>Доставка</span>
      <strong>бесплатно</strong>
    </div>
    <div class="summary-row is-total">
      <span>Итого со скидкой</span>
      <strong>${formatPrice(discountedTotal)}</strong>
    </div>
  `;
}

async function loadProducts() {
  try {
    const response = await fetch("products.json?v=tea-brewing-5", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error("products.json not found or not loaded");
    }

    products = await response.json();

    if (catalogGrid) {
      renderCatalog();
    }

    if (guideTemperatureList) {
      renderGuideTemperatures();
    }

    if (orderTable && orderTotal) {
      renderOrderTable();
    }
  } catch (error) {
    console.error("Catalog loading error:", error);

    if (catalogGrid) {
      catalogGrid.innerHTML = `
        <p class="load-error">
          Не удалось загрузить каталог. Проверьте products.json и Console.
        </p>
      `;
    }

    if (guideTemperatureList) {
      guideTemperatureList.innerHTML = `
        <p class="load-error">Не удалось загрузить параметры чая.</p>
      `;
    }
  }
}

function renderGuideTemperatures() {
  if (!guideTemperatureList) return;

  guideTemperatureList.innerHTML = products.map((product) => {
    const note = guideBrewingNotes[product.id] || product.category || "Чай";
    const dosage = product.brew_dosage
      ? product.brew_dosage.split(/\s+на\s+/)[0].replace(/\s+(?=г\b)/g, "\u00a0")
      : "Уточняется";
    const duration = product.brew_time
      ? product.brew_time.replace(/\s+минут(?:а|ы)?/, "\u00a0мин")
      : "—";
    const temperature = Number.isFinite(product.brew_temp)
      ? `${product.brew_temp}\u00a0°C`
      : "Уточняется";

    return `
      <article class="guide-temperature-item">
        <div class="guide-temperature-name">
          <span>${product.article || product.category || "чай"}</span>
          <h3>${product.name}</h3>
        </div>
        <dl>
          <div>
            <dt>Температура<sup aria-hidden="true">*</sup></dt>
            <dd>${temperature}</dd>
          </div>
          <div>
            <dt>Граммовка<sup aria-hidden="true">*</sup></dt>
            <dd>${dosage}</dd>
          </div>
          <div>
            <dt>Время</dt>
            <dd>${duration}</dd>
          </div>
        </dl>
        <p>${note}</p>
      </article>
    `;
  }).join("");
}

function initGuideNavigation() {
  const sections = Array.from(document.querySelectorAll("[data-guide-section]"));
  const links = Array.from(document.querySelectorAll("[data-guide-nav] a"));
  const mobileToc = document.querySelector(".guide-mobile-toc details");

  if (!sections.length || !links.length) return;

  const setCurrentSection = (id) => {
    links.forEach((link) => {
      if (link.getAttribute("href") === `#${id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.getAttribute("href").slice(1);
      setCurrentSection(id);

      if (mobileToc && window.matchMedia("(max-width: 760px)").matches) {
        mobileToc.open = true;
      }
    });
  });

  setCurrentSection(window.location.hash.slice(1) || sections[0].id);

  if (!("IntersectionObserver" in window)) return;

  const visibleSections = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target);
      } else {
        visibleSections.delete(entry.target);
      }
    });

    const activeLine = window.innerHeight * 0.22;
    const current = Array.from(visibleSections).sort((a, b) => {
      const aDistance = Math.abs(a.getBoundingClientRect().top - activeLine);
      const bDistance = Math.abs(b.getBoundingClientRect().top - activeLine);
      return aDistance - bDistance;
    })[0];

    if (current) {
      setCurrentSection(current.id);
    }
  }, {
    rootMargin: "-10% 0px -55% 0px",
    threshold: [0, 0.15, 0.4]
  });

  sections.forEach((section) => observer.observe(section));
}

function initGuideSectionNavigation() {
  const sections = Array.from(document.querySelectorAll("[data-guide-section]"));

  if (!sections.length) return;

  sections.forEach((section, index) => {
    const previous = sections[index - 1];
    const next = sections[index + 1];
    const indexLabel = section.querySelector(":scope > .guide-section-index");
    const heading = section.querySelector(":scope > h2");
    const header = document.createElement("header");
    const navigation = document.createElement("nav");
    header.className = "guide-section-header";
    navigation.className = "guide-section-nav";
    navigation.setAttribute("aria-label", "Переход между разделами гайда");

    if (previous) {
      const previousLink = document.createElement("a");
      previousLink.href = `#${previous.id}`;
      previousLink.setAttribute("aria-label", `Предыдущий раздел: ${previous.querySelector("h2").textContent}`);
      previousLink.title = "Предыдущий раздел";
      previousLink.innerHTML = `<span aria-hidden="true">←</span>`;
      navigation.append(previousLink);
    } else {
      const previousPlaceholder = document.createElement("span");
      previousPlaceholder.className = "is-disabled";
      previousPlaceholder.setAttribute("aria-hidden", "true");
      previousPlaceholder.textContent = "←";
      navigation.append(previousPlaceholder);
    }

    if (next) {
      const nextLink = document.createElement("a");
      nextLink.href = `#${next.id}`;
      nextLink.className = "is-next";
      nextLink.setAttribute("aria-label", `Следующий раздел: ${next.querySelector("h2").textContent}`);
      nextLink.title = "Следующий раздел";
      nextLink.innerHTML = `<span aria-hidden="true">→</span>`;
      navigation.append(nextLink);
    } else {
      const nextPlaceholder = document.createElement("span");
      nextPlaceholder.className = "is-disabled";
      nextPlaceholder.setAttribute("aria-hidden", "true");
      nextPlaceholder.textContent = "→";
      navigation.append(nextPlaceholder);
    }

    if (indexLabel && heading) {
      section.insertBefore(header, indexLabel);
      header.append(indexLabel, heading, navigation);
    }
  });
}

function renderCatalog() {
  catalogGrid.innerHTML = products.map((product) => {
    const image = product.image
      ? `<img class="catalog-card-image" src="${product.image}" alt="Сухой чай ${product.name}" width="80" height="80" loading="lazy" decoding="async">`
      : "";
    const imageClass = product.image ? " has-image" : "";

    return `
      <article class="catalog-card${imageClass}">
        ${image}
        <div class="catalog-card-header">
          <div class="product-kicker">
            <span>${product.article || product.category || "чай"}</span>
          </div>
          <h3>${product.name}</h3>
        </div>
        <div class="catalog-tags">${product.tags || ""}</div>
        <p class="product-description">${product.description}</p>
        <div class="product-price">
          ${formatPrice(product.price_500g)} <span>/ ${formatUnit(product.unit)}</span>
        </div>
        <p class="product-descriptors">
          <strong>Во вкусе:</strong> ${product.descriptors || "уточняется"}
        </p>
      </article>
    `;
  }).join("");
}

function renderOrderTable() {
  if (!orderTable) return;

  const rows = products.map((product) => {
    const quantity = cart[product.id] || 0;
    const lineTotal = quantity * product.price_500g;
    const selectedClass = quantity > 0 ? " is-selected" : "";
    const decreaseDisabled = quantity === 0 ? " disabled" : "";

    return `
      <div class="order-row${selectedClass}">
        <div class="order-product-cell">
          <strong>${product.name}</strong>
          <span>${product.tags || ""}</span>
        </div>

        <div class="order-cell" data-label="Цена">
          ${product.price_500g.toLocaleString("ru-RU")} ₽
        </div>

        <div class="order-cell" data-label="Грамм">
          ${product.unit}
        </div>

        <div class="order-cell" data-label="Количество">
          <div class="order-controls">
            <button type="button" data-action="decrease" data-id="${product.id}" aria-label="Уменьшить количество ${product.name}"${decreaseDisabled}>-</button>
            <strong>${quantity}</strong>
            <button type="button" data-action="increase" data-id="${product.id}" aria-label="Увеличить количество ${product.name}">+</button>
          </div>
        </div>

        <div class="order-cell order-line-total" data-label="Сумма">
          ${lineTotal.toLocaleString("ru-RU")} ₽
        </div>
      </div>
    `;
  }).join("");

  orderTable.innerHTML = `
    <div class="order-table-head">
      <span>Товар</span>
      <span>Цена</span>
      <span>Грамм</span>
      <span>Количество</span>
      <span>Сумма</span>
    </div>
    ${rows}
  `;

  updateOrderTotal();
}

function updateOrderTotal() {
  if (!orderTotal) return;

  const totals = calculateTotals();
  orderTotal.textContent = `${totals.total.toLocaleString("ru-RU")} ₽`;
}

function calculateTotals() {
  let total = 0;
  let count = 0;

  products.forEach((product) => {
    const quantity = cart[product.id] || 0;
    total += quantity * product.price_500g;
    count += quantity;
  });

  return { total, count };
}

function getSelectedProducts() {
  return products
    .map((product) => {
      return {
        product,
        quantity: cart[product.id] || 0
      };
    })
    .filter((item) => item.quantity > 0);
}

function buildOrderText(contact) {
  const selectedProducts = getSelectedProducts();
  const totals = calculateTotals();

  const orderLines = selectedProducts.map((item) => {
    const lineTotal = item.product.price_500g * item.quantity;

    return `${item.product.name} - ${item.quantity} шт. - ${lineTotal.toLocaleString("ru-RU")} ₽`;
  });

  return `
Новая заявка на заказ

${orderLines.join("\n")}

Итого: ${totals.total.toLocaleString("ru-RU")} ₽

Контакт: ${contact}
  `.trim();
}

if (orderTable) {
  orderTable.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!action || !id) return;

    const currentQuantity = cart[id] || 0;

    if (action === "increase") {
      cart[id] = currentQuantity + 1;
    }

    if (action === "decrease") {
      cart[id] = Math.max(0, currentQuantity - 1);
    }

    renderOrderTable();
  });
}

const sendOrderButton = document.getElementById("sendOrderButton");

if (sendOrderButton) {
  sendOrderButton.addEventListener("click", async () => {
    const selectedProducts = getSelectedProducts();
    const contactInput = document.getElementById("contactInput");
    const orderNote = document.getElementById("orderNote");
    const contact = contactInput.value.trim();

    if (selectedProducts.length === 0) {
      orderNote.textContent = "Сначала добавьте хотя бы одну позицию в заказ.";
      orderNote.className = "order-note error";
      return;
    }

    if (!contact) {
      orderNote.textContent = "Укажите, как с вами связаться.";
      orderNote.className = "order-note error";
      return;
    }

    const orderText = buildOrderText(contact);

    console.log("ORDER:", orderText);

    try {
      await navigator.clipboard.writeText(orderText);
      orderNote.textContent = "Заказ собран и скопирован. Свяжитесь с нами удобным способом и отправьте текст заявки.";
      orderNote.className = "order-note success";
    } catch (error) {
      orderNote.textContent = "Заказ собран. Текст заявки выведен в Console.";
      orderNote.className = "order-note success";
    }
  });
}
