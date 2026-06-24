const calculatorElements = {
  form: document.querySelector("#marginCalculator"),
  drinkPrice: document.querySelector("#drinkPrice"),
  teaSelect: document.querySelector("#teaSelect"),
  teaGrams: document.querySelector("#teaGrams"),
  dosageHint: document.querySelector("#dosageHint"),
  error: document.querySelector("#calculatorError"),
  result: document.querySelector("#calculatorResult"),
  grossProfit: document.querySelector("#grossProfit"),
  teaCost: document.querySelector("#teaCost"),
  chartPrice: document.querySelector("#chartPrice"),
  marginColumn: document.querySelector("#marginColumn"),
  profitSegment: document.querySelector("#profitSegment"),
  costSegment: document.querySelector("#costSegment"),
  profitShare: document.querySelector("#profitShare"),
  costShare: document.querySelector("#costShare"),
  costFormula: document.querySelector("#costFormula"),
  profitFormula: document.querySelector("#profitFormula")
};

let calculatorProducts = [];

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatCurrency(value) {
  return `${currencyFormatter.format(value)}\u00a0₽`;
}

function formatPercent(value) {
  return `${percentFormatter.format(value)}%`;
}

function getDosageNumbers(dosage) {
  if (!dosage) return [];

  const dosagePart = dosage.split("г")[0];
  return (dosagePart.match(/\d+(?:[.,]\d+)?/g) || [])
    .map((value) => Number(value.replace(",", ".")))
    .filter(Number.isFinite);
}

function getDefaultDosage(product) {
  const values = getDosageNumbers(product.brew_dosage);
  if (!values.length) return 4;
  if (values.length === 1) return values[0];
  return Math.round(((values[0] + values[1]) / 2) * 10) / 10;
}

function getSelectedProduct() {
  return calculatorProducts.find((product) => product.id === calculatorElements.teaSelect.value);
}

function updateProductDetails({ resetDosage = false } = {}) {
  const product = getSelectedProduct();
  if (!product) return;

  calculatorElements.dosageHint.textContent = product.brew_dosage
    ? product.brew_dosage.replace(/\s+на\s+.*/i, "")
    : "вручную";

  if (resetDosage) {
    calculatorElements.teaGrams.value = String(getDefaultDosage(product));
  }

  renderCalculation();
}

function renderCalculation() {
  const product = getSelectedProduct();
  const drinkPrice = Number(calculatorElements.drinkPrice.value);
  const grams = Number(calculatorElements.teaGrams.value);
  const isValid = product && Number.isFinite(drinkPrice) && drinkPrice > 0 && Number.isFinite(grams) && grams > 0;

  calculatorElements.drinkPrice.setAttribute("aria-invalid", String(!Number.isFinite(drinkPrice) || drinkPrice <= 0));
  calculatorElements.teaGrams.setAttribute("aria-invalid", String(!Number.isFinite(grams) || grams <= 0));

  if (!isValid) {
    calculatorElements.grossProfit.textContent = "—";
    calculatorElements.teaCost.textContent = "—";
    calculatorElements.chartPrice.textContent = "—";
    calculatorElements.profitShare.textContent = "—";
    calculatorElements.costShare.textContent = "—";
    calculatorElements.costFormula.textContent = "—";
    calculatorElements.profitFormula.textContent = "—";
    calculatorElements.profitSegment.style.flexBasis = "50%";
    calculatorElements.costSegment.style.flexBasis = "50%";
    return;
  }

  const gramPrice = product.price_kg / 1000;
  const teaCost = gramPrice * grams;
  const grossProfit = drinkPrice - teaCost;
  const marginPercent = (grossProfit / drinkPrice) * 100;
  const rawCostShare = (teaCost / drinkPrice) * 100;
  const chartCostShare = Math.min(100, Math.max(0, rawCostShare));
  // Preserve visible movement without making a small cost segment unreadable.
  const displayCostShare = Math.min(82, 18 + chartCostShare * 0.65);
  const displayProfitShare = 100 - displayCostShare;
  const isLoss = grossProfit < 0;

  calculatorElements.result.classList.toggle("is-loss", isLoss);
  calculatorElements.grossProfit.textContent = formatCurrency(grossProfit);
  calculatorElements.teaCost.textContent = formatCurrency(teaCost);
  calculatorElements.chartPrice.textContent = formatCurrency(drinkPrice);
  calculatorElements.profitShare.textContent = formatPercent(Math.max(0, marginPercent));
  calculatorElements.costShare.textContent = formatPercent(rawCostShare);
  calculatorElements.costFormula.textContent = `${product.name}: ${formatCurrency(product.price_kg)} за кг ÷ 1000 × ${currencyFormatter.format(grams)} г = ${formatCurrency(teaCost)}.`;
  calculatorElements.profitFormula.textContent = `${formatCurrency(drinkPrice)} − ${formatCurrency(teaCost)} = ${formatCurrency(grossProfit)} валовой прибыли.`;
  calculatorElements.profitSegment.style.flexBasis = `${displayProfitShare}%`;
  calculatorElements.costSegment.style.flexBasis = `${displayCostShare}%`;
  calculatorElements.marginColumn.setAttribute(
    "aria-label",
    `Цена напитка ${formatCurrency(drinkPrice)}. Себестоимость чая ${formatCurrency(teaCost)}. Валовая прибыль ${formatCurrency(grossProfit)}.`
  );
}

async function loadCalculatorProducts() {
  try {
    const response = await fetch("products.json?v=margin-calculator-1", { cache: "no-cache" });
    if (!response.ok) throw new Error("products.json not found");

    const products = await response.json();
    calculatorProducts = products.filter((product) => Number.isFinite(product.price_kg));
    calculatorElements.teaSelect.innerHTML = calculatorProducts
      .map((product) => `<option value="${product.id}">${product.name}</option>`)
      .join("");

    const defaultProduct = calculatorProducts.find((product) => product.id === "assam-mokalbari") || calculatorProducts[0];
    calculatorElements.teaSelect.value = defaultProduct.id;
    calculatorElements.teaSelect.disabled = false;
    updateProductDetails({ resetDosage: true });
  } catch (error) {
    calculatorElements.error.hidden = false;
    calculatorElements.teaSelect.innerHTML = "<option>Каталог недоступен</option>";
    calculatorElements.teaSelect.disabled = true;
  }
}

calculatorElements.form.addEventListener("submit", (event) => event.preventDefault());
calculatorElements.drinkPrice.addEventListener("input", renderCalculation);
calculatorElements.teaGrams.addEventListener("input", renderCalculation);
calculatorElements.teaSelect.addEventListener("change", () => updateProductDetails({ resetDosage: true }));

loadCalculatorProducts();
