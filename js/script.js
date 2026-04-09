const container = document.getElementById("productsContainer");
const searchInput = document.getElementById("searchInput");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");
const messengerBtn = document.getElementById("messengerBtn");
const headerLogo = document.getElementById("headerLogo");
const paymentPlanWrap = document.getElementById("paymentPlanWrap");

const params = new URLSearchParams(window.location.search);
const resellerKey = params.get("reseller");

let officialProducts = [];
let requestedProducts = [];
let allProducts = [];
let resellerConfig = null;
let selectedPaymentPlan = "cash";

window.APP_STATE = {
  resellerKey: resellerKey || "",
  selectedPaymentPlan: selectedPaymentPlan
};

async function loadProducts() {
  try {
    const [productsRes, resellerRes, requestedRes] = await Promise.all([
      fetch("./products.json"),
      fetch("./resellers.json"),
      fetch("./requested-products.json").catch(() => null)
    ]);

    if (!productsRes.ok) throw new Error("products.json not found");

    const products = await productsRes.json();
    let resellerMap = {};
    let requested = [];

    if (resellerRes.ok) {
      resellerMap = await resellerRes.json();
    }

    if (requestedRes && requestedRes.ok) {
      requested = await requestedRes.json();
    }

    resellerConfig = resellerKey ? resellerMap[resellerKey] : null;

    officialProducts = Array.isArray(products) ? products.map(p => ({ ...p, isRequested: false })) : [];
    requestedProducts = Array.isArray(requested) ? requested.map(p => ({ ...p, isRequested: true })) : [];

    applyPageCustomization();
    setupPaymentPlanButtons();
    rebuildProductList();
    filterAndRenderProducts();
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

    if (pageTitleEl) {
      pageTitleEl.textContent = resellerConfig.heroTitle || defaultPageTitle;
    }

    if (pageSubtitleEl) {
      pageSubtitleEl.textContent = resellerConfig.heroSubtitle || defaultPageSubtitle;
    }

    if (messengerBtn) {
      messengerBtn.href = resellerConfig.messengerLink || defaultMessengerLink;
    }

    if (headerLogo) {
      headerLogo.src = resellerConfig.headerImage || defaultHeaderImage;
    }
  } else {
    document.title = defaultBrowserTitle;

    if (pageTitleEl) {
      pageTitleEl.textContent = defaultPageTitle;
    }

    if (pageSubtitleEl) {
      pageSubtitleEl.textContent = defaultPageSubtitle;
    }

    if (messengerBtn) {
      messengerBtn.href = defaultMessengerLink;
    }

    if (headerLogo) {
      headerLogo.src = defaultHeaderImage;
    }
  }
}

function setupPaymentPlanButtons() {
  if (!paymentPlanWrap) return;

  paymentPlanWrap.querySelectorAll(".payment-plan-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedPaymentPlan = btn.dataset.plan;
      window.APP_STATE.selectedPaymentPlan = selectedPaymentPlan;

      paymentPlanWrap.querySelectorAll(".payment-plan-btn").forEach(item => {
        item.classList.remove("active");
      });

      btn.classList.add("active");
      rebuildProductList();
      filterAndRenderProducts();
    });
  });
}

function getPlanMeta(plan) {
  if (plan === "cash") {
    return {
      key: "cash",
      label: "Cash Price",
      months: 0,
      multiplier: 0.9,
      note: "Cash price with 10% discount"
    };
  }

  if (plan === "6") {
    return {
      key: "6",
      label: "6 Months",
      months: 6,
      multiplier: 1.1,
      note: "Pay in 6 Months with 10% markup"
    };
  }

  if (plan === "12") {
    return {
      key: "12",
      label: "12 Months",
      months: 12,
      multiplier: 1.2,
      note: "Pay in 12 Months with 20% markup"
    };
  }

  return {
    key: "3",
    label: "3 Months",
    months: 3,
    multiplier: 1,
    note: "Pay in 3 Months with 0% Interest"
  };
}

function applyResellerMarkup(basePrice) {
  if (!resellerConfig) return Math.round(basePrice);

  if (resellerConfig.type === "percent") {
    return Math.round(basePrice + (basePrice * resellerConfig.value / 100));
  }

  if (resellerConfig.type === "fixed") {
    return Math.round(basePrice + resellerConfig.value);
  }

  return Math.round(basePrice);
}

function applyPaymentPlan(priceAfterMarkup, plan) {
  const meta = getPlanMeta(plan);
  return Math.round(priceAfterMarkup * meta.multiplier);
}

function formatCurrency(value) {
  return `₱${Math.round(value).toLocaleString()}`;
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

  const planMeta = getPlanMeta(selectedPaymentPlan);

  return {
    planMeta,
    total: finalCurrent,
    originalTotal: finalOriginal,
    monthly: planMeta.months ? Math.round(finalCurrent / planMeta.months) : finalCurrent,
    hasSale: isVariantOnSale(variant)
  };
}

function getActiveVariants(product) {
  return (product.availableVariants || []).filter(variant => resolveVariantStatus(product, variant) === "active");
}

function getCheapestVariant(variants) {
  return variants.reduce((min, variant) => {
    return getVariantCurrentBasePrice(variant) < getVariantCurrentBasePrice(min) ? variant : min;
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
  const found = (product.colors || []).find(color => color.name === colorName);
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
  const sortedOfficial = [...officialProducts].sort((a, b) => getSortPrice(a) - getSortPrice(b));
  const sortedRequested = [...requestedProducts].sort((a, b) => getSortPrice(a) - getSortPrice(b));
  allProducts = [...sortedOfficial, ...sortedRequested];
}

function filterAndRenderProducts() {
  const keyword = (searchInput?.value || "").trim().toLowerCase();

  const filtered = allProducts.filter(product => {
    const haystack = [
      product.name || "",
      ...(product.colors || []).map(item => item.name || "")
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

  products.forEach(product => {
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
  return card;
}

function renderProduct(product) {
  const initialVariant = getInitialVariant(product);
  const ribbon = getProductRibbon(product);
  const productImages = Array.isArray(product.images) && product.images.length ? product.images : ["img/logo.png"];

  const card = document.createElement("div");
  card.className = `product-card${product.isRequested ? " requested-product-card" : ""}`;

  card.innerHTML = `
    ${ribbon ? `<div class="product-ribbon ${ribbon.className}">${ribbon.label}</div>` : ""}
    ${product.isRequested ? `<div class="requested-unit-tag">Requested Unit</div>` : ""}

    <div class="product-slider">
      ${productImages.map((img, index) => `<img src="${img}" class="${index === 0 ? "active" : ""}" alt="${escapeHtml(product.name)}">`).join("")}
      <button class="prev" type="button">&#10094;</button>
      <button class="next" type="button">&#10095;</button>
    </div>

    <div class="product-header">
      <div class="product-name">${escapeHtml(product.name || "Unnamed Product")}</div>
      <div class="color-options">
        ${(product.colors || []).map(color => {
          const activeColorVariants = getActiveVariants(product).filter(variant => variant.color === color.name);
          const unavailableClass = activeColorVariants.length ? "" : "unavailable";
          const activeClass = color.name === initialVariant.color ? "active" : "";
          return `<span class="color-dot ${activeClass} ${unavailableClass}" style="background:${color.code}" data-name="${escapeHtml(color.name)}" title="${escapeHtml(color.name)}"></span>`;
        }).join("")}
      </div>
    </div>

    <div class="product-price">
      <div class="price-text"></div>
      <span class="selected-color"></span>
    </div>

    <div class="product-note"></div>

    <div class="variant-group">
      <label>Storage</label>
      <div class="variant-options storage-options">
        ${(product.storageOptions || []).map(storage => `<span class="variant" data-value="${escapeHtml(storage)}">${escapeHtml(storage)}</span>`).join("")}
      </div>
    </div>

    <div class="variant-group">
      <label>RAM</label>
      <div class="variant-options ram-options">
        ${(product.ramOptions || []).map(ram => `<span class="variant" data-value="${escapeHtml(ram)}">${escapeHtml(ram)}</span>`).join("")}
      </div>
    </div>

    <button class="buy-button view-specs${product.specsPage ? "" : " disabled-button"}" data-url="${product.specsPage || ""}" ${product.specsPage ? "" : "disabled"}>
      ${product.specsPage ? "View Specs" : "Pending Specs"}
    </button>
  `;

  setupSlider(card);
  setupVariants(card, product, initialVariant);

  return card;
}

function setupSlider(card) {
  const slider = card.querySelector(".product-slider");
  const slides = slider.querySelectorAll("img");
  const prev = slider.querySelector(".prev");
  const next = slider.querySelector(".next");

  if (slides.length <= 1) {
    prev.style.display = "none";
    next.style.display = "none";
    return;
  }

  let index = 0;

  next.onclick = () => {
    slides[index].classList.remove("active");
    index = (index + 1) % slides.length;
    slides[index].classList.add("active");
  };

  prev.onclick = () => {
    slides[index].classList.remove("active");
    index = (index - 1 + slides.length) % slides.length;
    slides[index].classList.add("active");
  };
}

function setupVariants(card, product, initialVariant) {
  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const noteEl = card.querySelector(".product-note");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");

  let selectedColor = initialVariant.color || product.colors?.[0]?.name || "";
  let selectedStorage = initialVariant.storage || product.storageOptions?.[0] || "";
  let selectedRam = initialVariant.ram || product.ramOptions?.[0] || "";

  function getVariantsInColor(color) {
    return (product.availableVariants || []).filter(variant => variant.color === color);
  }

  function getActiveVariantsInColor(color) {
    return getActiveVariants(product).filter(variant => variant.color === color);
  }

  function setUnavailableState() {
    const colorCode = getColorCode(product, selectedColor);
    priceText.innerHTML = `<div class="price-main unavailable-price">Not available.</div>`;
    colorLabel.textContent = selectedColor;
    colorLabel.style.color = colorCode;
    noteEl.textContent = "This selected color or variant is currently unavailable.";

    storageBtns.forEach(btn => {
      btn.classList.remove("active");
      btn.classList.add("disabled");
    });

    ramBtns.forEach(btn => {
      btn.classList.remove("active");
      btn.classList.add("disabled");
    });
  }

  function renderPriceForVariant(variant) {
    const pricing = computeDisplayedPriceData(variant);

    if (pricing.planMeta.key === "cash") {
      priceText.innerHTML = `
        ${pricing.hasSale ? `<div class="old-price">${formatCurrency(pricing.originalTotal)}</div>` : ""}
        <div class="price-main">${formatCurrency(pricing.total)}</div>
        <div class="total-price">${pricing.planMeta.label}</div>
      `;
    } else {
      priceText.innerHTML = `
        ${pricing.hasSale ? `<div class="old-price">${formatCurrency(pricing.originalTotal)}</div>` : ""}
        <div class="price-main">${formatCurrency(pricing.monthly)} / month</div>
        <div class="total-price">${formatCurrency(pricing.total)} total • ${pricing.planMeta.months} months</div>
      `;
    }

    const colorCode = getColorCode(product, selectedColor);
    colorLabel.textContent = selectedColor;
    colorLabel.style.color = colorCode;
    noteEl.textContent = getPlanMeta(selectedPaymentPlan).note;
  }

  function refreshColorDots() {
    colorDots.forEach(dot => {
      const colorName = dot.dataset.name;
      const hasActive = getActiveVariantsInColor(colorName).length > 0;
      dot.classList.toggle("unavailable", !hasActive);
      dot.classList.toggle("active", colorName === selectedColor);
    });
  }

  function refreshStorageButtons(activeVariantsInColor) {
    storageBtns.forEach(btn => {
      const valid = activeVariantsInColor.some(variant => variant.storage === btn.dataset.value);
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", valid && btn.dataset.value === selectedStorage);
    });
  }

  function refreshRamButtons(activeVariantsInColor) {
    ramBtns.forEach(btn => {
      const valid = activeVariantsInColor.some(variant => {
        return variant.storage === selectedStorage && variant.ram === btn.dataset.value;
      });
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", valid && btn.dataset.value === selectedRam);
    });
  }

  function refresh() {
    refreshColorDots();

    const activeVariantsInColor = getActiveVariantsInColor(selectedColor);

    if (!activeVariantsInColor.length) {
      selectedStorage = "";
      selectedRam = "";
      setUnavailableState();
      return;
    }

    const selectedStorageStillValid = activeVariantsInColor.some(variant => variant.storage === selectedStorage);

    if (!selectedStorageStillValid) {
      const cheapestInColor = getCheapestVariant(activeVariantsInColor);
      selectedStorage = cheapestInColor.storage;
      selectedRam = cheapestInColor.ram;
    }

    const exactMatch = activeVariantsInColor.find(variant => {
      return variant.storage === selectedStorage && variant.ram === selectedRam;
    });

    if (!exactMatch) {
      const sameStorageVariants = activeVariantsInColor.filter(variant => variant.storage === selectedStorage);
      const fallbackVariant = sameStorageVariants.length ? getCheapestVariant(sameStorageVariants) : getCheapestVariant(activeVariantsInColor);
      selectedStorage = fallbackVariant.storage;
      selectedRam = fallbackVariant.ram;
    }

    refreshStorageButtons(activeVariantsInColor);
    refreshRamButtons(activeVariantsInColor);

    const finalMatch = activeVariantsInColor.find(variant => {
      return variant.storage === selectedStorage && variant.ram === selectedRam;
    });

    if (finalMatch) {
      renderPriceForVariant(finalMatch);
    } else {
      setUnavailableState();
    }
  }

  colorDots.forEach(dot => {
    dot.addEventListener("click", () => {
      selectedColor = dot.dataset.name;
      refresh();
    });
  });

  storageBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;

      selectedStorage = btn.dataset.value;

      const activeVariantsInColor = getActiveVariantsInColor(selectedColor);
      const exactMatch = activeVariantsInColor.find(variant => {
        return variant.storage === selectedStorage && variant.ram === selectedRam;
      });

      if (!exactMatch) {
        const candidates = activeVariantsInColor.filter(variant => variant.storage === selectedStorage);
        if (candidates.length) {
          selectedRam = getCheapestVariant(candidates).ram;
        }
      }

      refresh();
    });
  });

  ramBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;

      selectedRam = btn.dataset.value;

      const activeVariantsInColor = getActiveVariantsInColor(selectedColor);
      const exactMatch = activeVariantsInColor.find(variant => {
        return variant.storage === selectedStorage && variant.ram === selectedRam;
      });

      if (!exactMatch) {
        const candidates = activeVariantsInColor.filter(variant => variant.ram === selectedRam);
        if (candidates.length) {
          selectedStorage = getCheapestVariant(candidates).storage;
        }
      }

      refresh();
    });
  });

  refresh();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("click", function (e) {
  const specsBtn = e.target.closest(".view-specs");
  if (specsBtn && !specsBtn.disabled) {
    const url = specsBtn.dataset.url;
    if (url) {
      window.location.href = url;
    }
  }
});

if (searchInput) {
  searchInput.addEventListener("input", function () {
    filterAndRenderProducts();
  });
}

loadProducts();