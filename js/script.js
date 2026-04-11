const container = document.getElementById("productsContainer");
const searchInput = document.getElementById("searchInput");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");
const messengerBtn = document.getElementById("messengerBtn");
const headerLogo = document.getElementById("headerLogo");
const paymentPlanWrap = document.getElementById("paymentPlanWrap");
const announcementBar = document.getElementById("announcementBar");

const params = new URLSearchParams(window.location.search);
const resellerKey = params.get("reseller");

let officialProducts = [];
let requestedProducts = [];
let allProducts = [];
let resellerConfig = null;
let selectedPaymentPlan = "cash";
let announcements = [];
let pageSettings = {
  maintenanceMode: {
    enabled: false,
    title: "",
    message: ""
  }
};

window.APP_STATE = {
  resellerKey: resellerKey || "",
  selectedPaymentPlan,
  showToast: (...args) => {
    if (typeof window.showToast === "function") {
      window.showToast(...args);
    }
  }
};

async function loadProducts() {
  try {
    const [productsRes, resellerRes, requestedRes, announcementsRes, settingsRes] = await Promise.all([
      fetch("./products.json"),
      fetch("./resellers.json"),
      fetch("./requested-products.json").catch(() => null),
      fetch("./announcements.json").catch(() => null),
      fetch("./settings.json").catch(() => null)
    ]);

    if (!productsRes.ok) {
      throw new Error("products.json not found");
    }

    const products = await productsRes.json();
    let resellerMap = {};
    let requested = [];
    let loadedAnnouncements = [];
    let loadedSettings = null;

    if (resellerRes && resellerRes.ok) {
      resellerMap = await resellerRes.json();
    }

    if (requestedRes && requestedRes.ok) {
      requested = await requestedRes.json();
    }

    if (announcementsRes && announcementsRes.ok) {
      loadedAnnouncements = await announcementsRes.json();
    }

    if (settingsRes && settingsRes.ok) {
      loadedSettings = await settingsRes.json();
    }

    resellerConfig = resellerKey ? resellerMap[resellerKey] : null;

    officialProducts = Array.isArray(products)
      ? products.map((p) => ({ ...p, isRequested: false }))
      : [];

    requestedProducts = Array.isArray(requested)
      ? requested.map((p) => ({ ...p, isRequested: true }))
      : [];

    announcements = Array.isArray(loadedAnnouncements) ? loadedAnnouncements : [];

    if (loadedSettings && typeof loadedSettings === "object") {
      pageSettings = {
        ...pageSettings,
        ...loadedSettings,
        maintenanceMode: {
          ...pageSettings.maintenanceMode,
          ...(loadedSettings.maintenanceMode || {})
        }
      };
    }

    applyPageCustomization();
    renderAnnouncementBar();
    setupPaymentPlanButtons();
    rebuildProductList();
    filterAndRenderProducts();
    applyMaintenanceMode();
    triggerAnnouncementToasts();
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load product data.</p>";
  }
}

function applyPageCustomization() {
  const defaultPageTitle = "GTServer Official Store";
  const defaultPageSubtitle = "Affordable Smartphones with Flexible Payment Options";
  const defaultBrowserTitle = "Shop";
  const defaultMessengerLink = "https://m.me/gentechserver";
  const defaultHeaderImage = "img/headergentechservernew1.png";

  if (resellerConfig) {
    document.title = resellerConfig.pageTitle || defaultBrowserTitle;

    if (pageTitleEl) pageTitleEl.textContent = resellerConfig.heroTitle || defaultPageTitle;
    if (pageSubtitleEl) pageSubtitleEl.textContent = resellerConfig.heroSubtitle || defaultPageSubtitle;
    if (messengerBtn) messengerBtn.href = resellerConfig.messengerLink || defaultMessengerLink;
    if (headerLogo) headerLogo.src = resellerConfig.headerImage || defaultHeaderImage;
  } else {
    document.title = defaultBrowserTitle;

    if (pageTitleEl) pageTitleEl.textContent = defaultPageTitle;
    if (pageSubtitleEl) pageSubtitleEl.textContent = defaultPageSubtitle;
    if (messengerBtn) messengerBtn.href = defaultMessengerLink;
    if (headerLogo) headerLogo.src = defaultHeaderImage;
  }
}

function setupPaymentPlanButtons() {
  if (!paymentPlanWrap) return;

  paymentPlanWrap.querySelectorAll(".payment-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPaymentPlan = btn.dataset.plan || "cash";
      window.APP_STATE.selectedPaymentPlan = selectedPaymentPlan;

      paymentPlanWrap.querySelectorAll(".payment-plan-btn").forEach((item) => {
        item.classList.remove("active");
      });

      btn.classList.add("active");

      rebuildProductList();
      filterAndRenderProducts();
    });
  });
}

function getCashPriceRuleText(priceAfterMarkup) {
  if (priceAfterMarkup <= 5000) {
    return "Cash price • 10% discount";
  }

  if (priceAfterMarkup >= 6000 && priceAfterMarkup <= 9000) {
    return "Cash price • 5% discount";
  }

  if (priceAfterMarkup >= 10000) {
    return "Cash price • ₱1,000 off";
  }

  return "Cash price";
}

function getCashRuleBreakdown(priceAfterMarkup) {
  const rounded = Math.round(Number(priceAfterMarkup) || 0);

  if (rounded <= 5000) {
    const finalPrice = Math.round(rounded * 0.9);
    return {
      label: "Cash promo",
      text: `Original ${formatCurrency(rounded)} • 10% off • Final ${formatCurrency(finalPrice)}`
    };
  }

  if (rounded >= 6000 && rounded <= 9000) {
    const finalPrice = Math.round(rounded * 0.95);
    return {
      label: "Cash promo",
      text: `Original ${formatCurrency(rounded)} • 5% off • Final ${formatCurrency(finalPrice)}`
    };
  }

  if (rounded >= 10000) {
    const finalPrice = Math.max(0, Math.round(rounded - 1000));
    return {
      label: "Cash promo",
      text: `Original ${formatCurrency(rounded)} • Less ₱1,000 • Final ${formatCurrency(finalPrice)}`
    };
  }

  return {
    label: "Cash promo",
    text: `Original ${formatCurrency(rounded)} • No cash discount`
  };
}

function getPlanMeta(plan, priceAfterMarkup = 0) {
  if (plan === "cash") {
    return {
      key: "cash",
      label: "Cash Price",
      months: 0,
      note: getCashPriceRuleText(priceAfterMarkup)
    };
  }

  if (plan === "6") {
    return {
      key: "6",
      label: "6 Months",
      months: 6,
      note: "Pay in 6 Months"
    };
  }

  if (plan === "12") {
    return {
      key: "12",
      label: "12 Months",
      months: 12,
      note: "Pay in 12 Months"
    };
  }

  return {
    key: "3",
    label: "3 Months",
    months: 3,
    note: "Pay in 3 Months with 0% Interest"
  };
}

function applyResellerMarkup(basePrice) {
  const value = Number(basePrice) || 0;

  if (!resellerConfig) return Math.round(value);

  if (resellerConfig.type === "percent") {
    return Math.round(value + (value * Number(resellerConfig.value || 0) / 100));
  }

  if (resellerConfig.type === "fixed") {
    return Math.round(value + Number(resellerConfig.value || 0));
  }

  return Math.round(value);
}

function applyCashRule(priceAfterMarkup) {
  const value = Math.round(Number(priceAfterMarkup) || 0);

  if (value <= 5000) {
    return Math.round(value * 0.9);
  }

  if (value >= 6000 && value <= 9000) {
    return Math.round(value * 0.95);
  }

  if (value >= 10000) {
    return Math.max(0, Math.round(value - 1000));
  }

  return value;
}

function applyPaymentPlan(priceAfterMarkup, plan) {
  const value = Math.round(Number(priceAfterMarkup) || 0);

  if (plan === "cash") {
    return applyCashRule(value);
  }

  if (plan === "6") {
    return Math.round(priceAfterMarkup * 1.15);
  }

  if (plan === "12") {
    return Math.round(priceAfterMarkup * 1.30);
  }

  return value;
}

function formatCurrency(value) {
  return `₱${Math.round(Number(value) || 0).toLocaleString()}`;
}

function resolveVariantStatus(product, variant) {
  return (variant?.status || product?.status || "active").toLowerCase();
}

function getVariantCurrentBasePrice(variant) {
  const activePrice = variant?.salePrice ?? variant?.price ?? 0;
  return Number(activePrice) || 0;
}

function getVariantOriginalBasePrice(variant) {
  if (variant?.originalPrice != null) {
    return Number(variant.originalPrice) || 0;
  }

  if (variant?.salePrice != null) {
    return Number(variant.price) || 0;
  }

  return Number(variant?.price) || 0;
}

function isVariantOnSale(variant) {
  if (variant?.salePrice == null) return false;
  return Number(variant.salePrice) < getVariantOriginalBasePrice(variant);
}

function computeDisplayedPriceData(variant) {
  const currentBase = getVariantCurrentBasePrice(variant);
  const originalBase = getVariantOriginalBasePrice(variant);

  const resellerCurrent = applyResellerMarkup(currentBase);
  const resellerOriginal = applyResellerMarkup(originalBase);

  const finalCurrent = applyPaymentPlan(resellerCurrent, selectedPaymentPlan);
  const finalOriginal = applyPaymentPlan(resellerOriginal, selectedPaymentPlan);

  const planMeta = getPlanMeta(selectedPaymentPlan, resellerCurrent);

  return {
    planMeta,
    total: finalCurrent,
    originalTotal: finalOriginal,
    monthly: planMeta.months ? Math.round(finalCurrent / planMeta.months) : finalCurrent,
    hasSale: isVariantOnSale(variant),
    resellerCurrent,
    resellerOriginal
  };
}

function getActiveVariants(product) {
  return (product.availableVariants || []).filter(
    (variant) => resolveVariantStatus(product, variant) === "active"
  );
}

function getCheapestVariant(variants) {
  if (!variants.length) return null;

  return variants.reduce((min, variant) => {
    return getVariantCurrentBasePrice(variant) < getVariantCurrentBasePrice(min)
      ? variant
      : min;
  }, variants[0]);
}

function getInitialVariant(product) {
  const activeVariants = getActiveVariants(product);

  if (activeVariants.length) {
    return getCheapestVariant(activeVariants);
  }

  if (product.availableVariants && product.availableVariants.length) {
    return product.availableVariants[0];
  }

  return {
    color: product.colors?.[0]?.name || "",
    storage: product.storageOptions?.[0] || "",
    ram: product.ramOptions?.[0] || "",
    price: 0,
    status: "sold_out"
  };
}

function getColorCode(product, colorName) {
  const found = (product.colors || []).find((color) => color.name === colorName);
  return found ? found.code : "#666";
}

function getProductRibbon(product) {
  const badge = (product.badge || "").toLowerCase();
  const activeVariants = getActiveVariants(product);

  if ((product.status || "").toLowerCase() === "sold_out" || activeVariants.length === 0) {
    return { label: "SOLD OUT", className: "sold-out" };
  }

  if (badge === "sale") {
    return { label: "SALE", className: "sale" };
  }

  if (badge === "new") {
    return { label: "NEW", className: "new" };
  }

  return null;
}

function getSortPrice(product) {
  const activeVariants = getActiveVariants(product);

  if (activeVariants.length) {
    const cheapest = getCheapestVariant(activeVariants);
    return computeDisplayedPriceData(cheapest).total;
  }

  if (product.availableVariants && product.availableVariants.length) {
    const first = product.availableVariants[0];
    return computeDisplayedPriceData(first).total;
  }

  return Number.MAX_SAFE_INTEGER;
}

function rebuildProductList() {
  allProducts = [...officialProducts, ...requestedProducts].sort((a, b) => {
    const priceDiff = getSortPrice(a) - getSortPrice(b);
    if (priceDiff !== 0) return priceDiff;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function filterAndRenderProducts() {
  const keyword = (searchInput?.value || "").trim().toLowerCase();

  const filtered = allProducts.filter((product) => {
    const haystack = [
      product.name || "",
      ...(product.colors || []).map((item) => item.name || ""),
      ...(product.availableVariants || []).map((v) => `${v.storage || ""} ${v.ram || ""}`)
    ].join(" ").toLowerCase();

    return haystack.includes(keyword);
  });

  renderProducts(filtered, keyword);
}

function renderProducts(products, keyword = "") {
  container.innerHTML = "";

  if (!products.length) {
    container.appendChild(createNoResultsCard(keyword));
    container.appendChild(createRequestCard(keyword));
    return;
  }

  products.forEach((product) => {
    container.appendChild(renderProduct(product));
  });

  container.appendChild(createRequestCard(keyword));
}

function createNoResultsCard(keyword) {
  const card = document.createElement("div");
  card.className = "no-results";
  card.innerHTML = `
    <strong>No phone model found.</strong>
    <div class="no-results-sub">
      ${keyword ? `No result for "${escapeHtml(keyword)}".` : "Try searching another model."}
    </div>
  `;
  return card;
}

function createRequestCard(keyword = "") {
  const card = document.createElement("div");
  card.className = "product-card request-card";
  card.innerHTML = `
    <div class="request-card-badge">REQUEST UNIT</div>
    <div class="request-card-content">
      <div class="request-card-title">Can't find the phone you need?</div>
      <div class="request-card-text">Send your preferred unit to admin and it can be reviewed for addition to the page.</div>
      <button class="buy-button open-request-modal" data-prefill="${escapeHtml(keyword)}">Request a Unit</button>
    </div>
  `;

  const btn = card.querySelector(".open-request-modal");
  if (btn) {
    btn.addEventListener("click", () => {
      if (typeof window.openRequestModal === "function") {
        window.openRequestModal(btn.dataset.prefill || "");
      }
    });
  }

  return card;
}

function renderProduct(product) {
  const initialVariant = getInitialVariant(product);
  const ribbon = getProductRibbon(product);
  const productImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : ["img/logo.png"];

  const card = document.createElement("div");
  card.className = `product-card${product.isRequested ? " requested-product-card" : ""}`;

  card.innerHTML = `
    ${ribbon ? `<div class="product-ribbon ${ribbon.className}">${ribbon.label}</div>` : ""}
    ${product.isRequested ? `<div class="requested-unit-tag">Requested Unit</div>` : ""}

    <div class="product-slider"></div>

    <div class="product-header">
      <div class="product-name">${escapeHtml(product.name || "Unnamed Product")}</div>
      <div class="color-options">
        ${(product.colors || []).map((color) => {
          const activeColorVariants = getActiveVariants(product).filter(
            (variant) => variant.color === color.name
          );
          const unavailableClass = activeColorVariants.length ? "" : "unavailable";
          const activeClass = color.name === initialVariant.color ? "active" : "";
          return `
            <span
              class="color-dot ${activeClass} ${unavailableClass}"
              style="background:${color.code}"
              data-name="${escapeHtml(color.name)}"
              title="${escapeHtml(color.name)}"></span>
          `;
        }).join("")}
      </div>
    </div>

    <div class="product-price">
      <div class="price-text"></div>
      <span class="selected-color"></span>
    </div>

    <div class="product-note"></div>
    <div class="variant-stock"></div>
    <div class="cash-rule-box" style="display:none;"></div>

    <div class="variant-group">
      <label>Storage</label>
      <div class="variant-options storage-options">
        ${(product.storageOptions || []).map((storage) => `
          <span class="variant" data-value="${escapeHtml(storage)}">${escapeHtml(storage)}</span>
        `).join("")}
      </div>
    </div>

    <div class="variant-group">
      <label>RAM</label>
      <div class="variant-options ram-options">
        ${(product.ramOptions || []).map((ram) => `
          <span class="variant" data-value="${escapeHtml(ram)}">${escapeHtml(ram)}</span>
        `).join("")}
      </div>
    </div>

    <button
      class="buy-button view-specs${product.specsPage ? "" : " disabled-button"}"
      data-url="${product.specsPage || ""}"
      ${product.specsPage ? "" : "disabled"}>
      ${product.specsPage ? "View Specs" : "Pending Specs"}
    </button>
  `;

  setupSlider(card, productImages);
  setupVariants(card, product, initialVariant);

  return card;
}

function setupSlider(card, initialImages = []) {
  const slider = card.querySelector(".product-slider");
  if (!slider) return;

  let slides = Array.isArray(initialImages) && initialImages.length ? [...initialImages] : ["img/logo.png"];
  let index = 0;

  function render() {
    slider.innerHTML = `
      ${slides.map((img, i) => `
        <img src="${escapeHtml(img)}" class="${i === index ? "active" : ""}" alt="Product image">
      `).join("")}
      <button class="prev" type="button">&#10094;</button>
      <button class="next" type="button">&#10095;</button>
    `;

    const prev = slider.querySelector(".prev");
    const next = slider.querySelector(".next");

    if (slides.length <= 1) {
      if (prev) prev.style.display = "none";
      if (next) next.style.display = "none";
      return;
    }

    if (prev) {
      prev.onclick = () => {
        index = (index - 1 + slides.length) % slides.length;
        render();
      };
    }

    if (next) {
      next.onclick = () => {
        index = (index + 1) % slides.length;
        render();
      };
    }
  }

  card._sliderApi = {
    setImages(newImages = []) {
      const safeImages = Array.isArray(newImages) && newImages.length ? [...newImages] : ["img/logo.png"];
      const same =
        safeImages.length === slides.length &&
        safeImages.every((img, i) => img === slides[i]);

      if (same) return;

      slides = safeImages;
      index = 0;
      render();
    }
  };

  render();
}

function setupVariants(card, product, initialVariant) {
  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const noteEl = card.querySelector(".product-note");
  const stockEl = card.querySelector(".variant-stock");
  const cashRuleBox = card.querySelector(".cash-rule-box");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");
  const specsBtn = card.querySelector(".view-specs");

  let selectedColor = initialVariant.color || product.colors?.[0]?.name || "";
  let selectedStorage = initialVariant.storage || product.storageOptions?.[0] || "";
  let selectedRam = initialVariant.ram || product.ramOptions?.[0] || "";

  function getActiveVariantsInColor(color) {
    return getActiveVariants(product).filter((variant) => variant.color === color);
  }

  function getImagesForColor(color) {
    const colorMap = product.colorImageMap || {};
    const mapped = colorMap[color];

    if (Array.isArray(mapped) && mapped.length) {
      return mapped;
    }

    return Array.isArray(product.images) && product.images.length
      ? product.images
      : ["img/logo.png"];
  }

  function refreshColorDots() {
    colorDots.forEach((dot) => {
      dot.classList.toggle("active", dot.dataset.name === selectedColor);

      const activeVariantsInColor = getActiveVariantsInColor(dot.dataset.name);
      dot.classList.toggle("unavailable", activeVariantsInColor.length === 0);
    });
  }

  function findExactVariant() {
    return getActiveVariants(product).find((variant) => {
      return (
        variant.color === selectedColor &&
        variant.storage === selectedStorage &&
        variant.ram === selectedRam
      );
    });
  }

  function selectFallbackVariant(activeVariantsInColor) {
    const exactStorageRam = activeVariantsInColor.find((variant) => {
      return variant.storage === selectedStorage && variant.ram === selectedRam;
    });

    if (exactStorageRam) return exactStorageRam;

    const sameStorage = activeVariantsInColor.find((variant) => variant.storage === selectedStorage);
    if (sameStorage) return sameStorage;

    const sameRam = activeVariantsInColor.find((variant) => variant.ram === selectedRam);
    if (sameRam) return sameRam;

    return getCheapestVariant(activeVariantsInColor) || activeVariantsInColor[0];
  }

  function syncSelectionFromVariant(variant) {
    if (!variant) return;
    selectedColor = variant.color;
    selectedStorage = variant.storage;
    selectedRam = variant.ram;
  }

  function refreshStorageButtons(activeVariantsInColor) {
    storageBtns.forEach((btn) => {
      const value = btn.dataset.value;
      const hasOption = activeVariantsInColor.some((variant) => variant.storage === value);
      btn.classList.toggle("disabled", !hasOption);
      btn.classList.toggle("active", value === selectedStorage);
    });
  }

  function refreshRamButtons() {
    ramBtns.forEach((btn) => {
      const value = btn.dataset.value;
      const hasOption = getActiveVariants(product).some((variant) => {
        return (
          variant.color === selectedColor &&
          variant.storage === selectedStorage &&
          variant.ram === value
        );
      });

      btn.classList.toggle("disabled", !hasOption);
      btn.classList.toggle("active", value === selectedRam);
    });
  }

  function updateSoldOutRibbon(variant) {
    let ribbonEl = card.querySelector(".product-ribbon");
    const baseRibbon = getProductRibbon(product);

    const hasExplicitStock = variant?.stock != null && variant?.stock !== "";
    const isSoldOutByStock = hasExplicitStock && Number(variant.stock) <= 0;

    if (isSoldOutByStock) {
      if (!ribbonEl) {
        ribbonEl = document.createElement("div");
        card.prepend(ribbonEl);
      }

      ribbonEl.className = "product-ribbon sold-out";
      ribbonEl.textContent = "SOLD OUT";
      return;
    }

    if (baseRibbon) {
      if (!ribbonEl) {
        ribbonEl = document.createElement("div");
        card.prepend(ribbonEl);
      }

      ribbonEl.className = `product-ribbon ${baseRibbon.className}`;
      ribbonEl.textContent = baseRibbon.label;
      return;
    }

    if (ribbonEl) {
      ribbonEl.remove();
    }
  }

  function renderStock(variant) {
    if (!stockEl) return;

    if (variant?.stock == null || variant?.stock === "") {
      stockEl.innerHTML = "";
      return;
    }

    const stock = Number(variant.stock);

    if (stock <= 0) {
      stockEl.innerHTML = "";
      return;
    }

    if (stock <= 3) {
      stockEl.innerHTML = `<span class="stock-badge low">Only ${stock} left</span>`;
      return;
    }

    stockEl.innerHTML = `<span class="stock-badge ok">${stock} available</span>`;
  }

  function setUnavailableState() {
    const colorCode = getColorCode(product, selectedColor);

    priceText.innerHTML = `<div class="price-main unavailable-price">Not available.</div>`;
    colorLabel.textContent = selectedColor;
    colorLabel.style.color = colorCode;
    noteEl.textContent = "This selected color or variant is currently unavailable.";

    if (stockEl) {
      stockEl.innerHTML = "";
    }

    updateSoldOutRibbon({ stock: 0 });

    if (cashRuleBox) {
      cashRuleBox.style.display = "none";
      cashRuleBox.innerHTML = "";
    }

    storageBtns.forEach((btn) => {
      btn.classList.remove("active");
      btn.classList.add("disabled");
    });

    ramBtns.forEach((btn) => {
      btn.classList.remove("active");
      btn.classList.add("disabled");
    });

    if (card._sliderApi) {
      card._sliderApi.setImages(getImagesForColor(selectedColor));
    }
  }

  function renderPriceForVariant(variant) {
    const pricing = computeDisplayedPriceData(variant);

    if (pricing.planMeta.key === "cash") {
      priceText.innerHTML = `
        ${pricing.hasSale ? `<div class="old-price">${formatCurrency(pricing.originalTotal)}</div>` : ""}
        <div class="price-main">${formatCurrency(pricing.total)}</div>
      `;

      if (cashRuleBox) {
        const breakdown = getCashRuleBreakdown(pricing.resellerCurrent);
        cashRuleBox.style.display = "block";
        cashRuleBox.innerHTML = `
          <div class="cash-rule-title">${escapeHtml(breakdown.label)}</div>
          <div class="cash-rule-text">${escapeHtml(breakdown.text)}</div>
        `;
      }
    } else {
      priceText.innerHTML = `
        ${pricing.hasSale ? `<div class="old-price">${formatCurrency(pricing.originalTotal)}</div>` : ""}
        <div class="price-main">${formatCurrency(pricing.monthly)} / month</div>
        <div class="total-price">Total: ${formatCurrency(pricing.total)}</div>
      `;

      if (cashRuleBox) {
        cashRuleBox.style.display = "none";
        cashRuleBox.innerHTML = "";
      }
    }

    colorLabel.textContent = variant.color || "";
    colorLabel.style.color = getColorCode(product, variant.color || "");
    noteEl.textContent = pricing.planMeta.note || product.note || "";
    renderStock(variant);
    updateSoldOutRibbon(variant);

    if (card._sliderApi) {
      card._sliderApi.setImages(getImagesForColor(variant.color || selectedColor));
    }
  }

  function updateUI() {
    const activeVariantsInColor = getActiveVariantsInColor(selectedColor);
    refreshColorDots();

    if (!activeVariantsInColor.length) {
      setUnavailableState();
      return;
    }

    let activeVariant = findExactVariant();

    if (!activeVariant) {
      activeVariant = selectFallbackVariant(activeVariantsInColor);
      syncSelectionFromVariant(activeVariant);
    }

    refreshStorageButtons(activeVariantsInColor);
    refreshRamButtons();
    renderPriceForVariant(activeVariant);

    if (specsBtn && product.specsPage) {
      specsBtn.onclick = () => {
        window.open(product.specsPage, "_blank", "noopener,noreferrer");
      };
    }
  }

  colorDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const colorName = dot.dataset.name;
      const activeVariantsInColor = getActiveVariantsInColor(colorName);

      selectedColor = colorName;

      if (activeVariantsInColor.length) {
        const fallback = selectFallbackVariant(activeVariantsInColor);
        syncSelectionFromVariant(fallback);
      }

      if (card._sliderApi) {
        card._sliderApi.setImages(getImagesForColor(colorName));
      }

      updateUI();
    });
  });

  storageBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      selectedStorage = btn.dataset.value;
      updateUI();
    });
  });

  ramBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      selectedRam = btn.dataset.value;
      updateUI();
    });
  });

  updateUI();
}

function renderAnnouncementBar() {
  if (!announcementBar) return;

  const visibleAnnouncements = announcements
    .filter((item) => item && item.enabled !== false)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  if (!visibleAnnouncements.length) {
    announcementBar.innerHTML = "";
    announcementBar.style.display = "none";
    return;
  }

  const topAnnouncement = visibleAnnouncements[0];

  announcementBar.style.display = "block";
  announcementBar.innerHTML = `
    <div class="announcement-pill announcement-${escapeHtml(topAnnouncement.type || "info")}">
      <strong>${escapeHtml(topAnnouncement.title || "Update")}:</strong>
      <span>${escapeHtml(topAnnouncement.message || "")}</span>
    </div>
  `;
}

function triggerAnnouncementToasts() {
  if (typeof window.showToast !== "function") return;

  const visibleAnnouncements = announcements
    .filter(item => item && item.enabled !== false && item.toast === true)
    .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));

  visibleAnnouncements.forEach((item, index) => {
    setTimeout(() => {
      window.showToast(
        `${item.title ? item.title + ": " : ""}${item.message || ""}`,
        item.type || "info",
        Number(item.duration || 10000)
      );
    }, 400 + (index * 350));
  });
}

function applyMaintenanceMode() {
  const mode = pageSettings?.maintenanceMode;

  const existing = document.getElementById("maintenanceOverlay");
  if (existing) {
    existing.remove();
  }

  document.body.classList.remove("maintenance-active");

  if (!mode || mode.enabled !== true) {
    return;
  }

  document.body.classList.add("maintenance-active");

  const overlay = document.createElement("div");
  overlay.id = "maintenanceOverlay";
  overlay.className = "maintenance-overlay";
  overlay.innerHTML = `
    <div class="maintenance-box">
      <h2>${escapeHtml(mode.title || "Under Maintenance")}</h2>
      <p>${escapeHtml(mode.message || "This page is temporarily unavailable. Please check again later.")}</p>
    </div>
  `;

  document.body.appendChild(overlay);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

if (searchInput) {
  searchInput.addEventListener("input", filterAndRenderProducts);
}

loadProducts();