const container = document.getElementById("productsContainer");
const searchInput = document.getElementById("searchInput");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");
const messengerBtn = document.getElementById("messengerBtn");

const params = new URLSearchParams(window.location.search);
const resellerKey = params.get("reseller");

let allProducts = [];
let resellerConfig = null;

async function loadProducts() {
  try {
    const [productsRes, resellerRes] = await Promise.all([
      fetch("./products.json"),
      fetch("./resellers.json")
    ]);

    if (!productsRes.ok) throw new Error("products.json not found");

    let products = await productsRes.json();

    let resellerMap = {};
    if (resellerRes.ok) {
      resellerMap = await resellerRes.json();
    }

    resellerConfig = resellerKey ? resellerMap[resellerKey] : null;

    applyPageCustomization();

    products = products.sort((a, b) => {
      const cheapestA = computeResellerPrice(
        getCheapest(a.availableVariants).price,
        resellerConfig
      );
      const cheapestB = computeResellerPrice(
        getCheapest(b.availableVariants).price,
        resellerConfig
      );
      return cheapestA - cheapestB;
    });

    allProducts = products;
    renderProducts(allProducts);
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load product data.</p>";
  }
}

function applyPageCustomization() {
  const defaultPageTitle = "GTServer Official Store";
  const defaultPageSubtitle = "Affordable Smartphones with 0% Interest in 3 Months";
  const defaultBrowserTitle = "Shop";
  const defaultMessengerLink = "https://m.me/gentechserver";

  if (resellerConfig) {
    if (resellerConfig.pageTitle) {
      document.title = resellerConfig.pageTitle;
    } else {
      document.title = defaultBrowserTitle;
    }

    if (pageTitleEl) {
      pageTitleEl.textContent = resellerConfig.heroTitle || defaultPageTitle;
    }

    if (pageSubtitleEl) {
      pageSubtitleEl.textContent = resellerConfig.heroSubtitle || defaultPageSubtitle;
    }

    if (messengerBtn) {
      messengerBtn.href = resellerConfig.messengerLink || defaultMessengerLink;
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
  }
}

function computeResellerPrice(basePrice, commission) {
  if (!commission) return basePrice;

  if (commission.type === "percent") {
    return Math.round(basePrice + (basePrice * commission.value / 100));
  }

  if (commission.type === "fixed") {
    return Math.round(basePrice + commission.value);
  }

  return basePrice;
}

function getMonthlyPrice(totalPrice) {
  return Math.round(totalPrice / 3);
}

function formatPriceBlock(totalPrice) {
  const monthlyPrice = getMonthlyPrice(totalPrice);
  return `
    ₱${monthlyPrice.toLocaleString()} / month
    <div class="total-price">₱${totalPrice.toLocaleString()} total • 3 months</div>
  `;
}

function getCheapest(list) {
  return list.reduce((min, v) => (v.price < min.price ? v : min));
}

function renderProducts(products) {
  container.innerHTML = "";

  if (!products.length) {
    container.innerHTML = `<div class="no-results">No phone model found.</div>`;
    return;
  }

  products.forEach(product => renderProduct(product));
}

function renderProduct(product) {
  const cheapestVariant = getCheapest(product.availableVariants);
  const cheapestColorObj = product.colors.find(
    c => c.name === cheapestVariant.color
  );

  const displayPrice = computeResellerPrice(
    cheapestVariant.price,
    resellerConfig
  );

  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <div class="product-slider">
      ${product.images
        .map(
          (img, i) => `<img src="${img}" class="${i === 0 ? "active" : ""}">`
        )
        .join("")}
      <button class="prev">&#10094;</button>
      <button class="next">&#10095;</button>
    </div>

    <div class="product-header">
      <div class="product-name">${product.name}</div>
      <div class="color-options">
        ${product.colors
          .map(
            color =>
              `<span class="color-dot ${
                color.name === cheapestVariant.color ? "active" : ""
              }" style="background:${color.code}" data-name="${color.name}"></span>`
          )
          .join("")}
      </div>
    </div>

    <div class="product-price">
      <span class="price-text">${formatPriceBlock(displayPrice)}</span>
      <span class="selected-color" style="color:${cheapestColorObj.code}">
        ${cheapestVariant.color}
      </span>
    </div>

    <div class="product-note">${product.note}</div>

    <div class="variant-group">
      <label>Storage</label>
      <div class="variant-options storage-options">
        ${product.storageOptions
          .map(
            s =>
              `<span class="variant ${
                s === cheapestVariant.storage ? "active" : ""
              }" data-value="${s}">${s}</span>`
          )
          .join("")}
      </div>
    </div>

    <div class="variant-group">
      <label>RAM</label>
      <div class="variant-options ram-options">
        ${product.ramOptions
          .map(
            r =>
              `<span class="variant ${
                r === cheapestVariant.ram ? "active" : ""
              }" data-value="${r}">${r}</span>`
          )
          .join("")}
      </div>
    </div>

    <button class="buy-button view-specs" data-url="${product.specsPage}">
      View Specs
    </button>
  `;

  container.appendChild(card);

  setupSlider(card);
  setupVariants(card, product.availableVariants, cheapestVariant);
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

function setupVariants(card, available, initial) {
  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");

  let selectedColor = initial.color;
  let selectedStorage = initial.storage;
  let selectedRam = initial.ram;

  function disableAll() {
    storageBtns.forEach(btn => {
      btn.classList.add("disabled");
      btn.classList.remove("active");
    });

    ramBtns.forEach(btn => {
      btn.classList.add("disabled");
      btn.classList.remove("active");
    });
  }

  function refresh() {
    const variantsInColor = available.filter(v => v.color === selectedColor);

    if (variantsInColor.length === 0) {
      priceText.textContent = "Not available.";
      disableAll();
      return;
    }

    storageBtns.forEach(btn => {
      const valid = variantsInColor.some(v => v.storage === btn.dataset.value);
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", btn.dataset.value === selectedStorage);
    });

    ramBtns.forEach(btn => {
      const valid = available.some(
        v =>
          v.color === selectedColor &&
          v.storage === selectedStorage &&
          v.ram === btn.dataset.value
      );
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", btn.dataset.value === selectedRam);
    });

    const match = available.find(
      v =>
        v.color === selectedColor &&
        v.storage === selectedStorage &&
        v.ram === selectedRam
    );

    if (match) {
      const finalPrice = computeResellerPrice(match.price, resellerConfig);
      priceText.innerHTML = formatPriceBlock(finalPrice);
    } else {
      priceText.textContent = "Select Variant";
    }
  }

  colorDots.forEach(dot => {
    dot.onclick = () => {
      const newColor = dot.dataset.name;

      colorDots.forEach(d => d.classList.remove("active"));
      dot.classList.add("active");

      const variantsInColor = available.filter(v => v.color === newColor);

      if (variantsInColor.length === 0) {
        selectedColor = newColor;
        selectedStorage = null;
        selectedRam = null;
        disableAll();
        priceText.textContent = "Not available.";
        return;
      }

      const stillValid = variantsInColor.find(
        v => v.storage === selectedStorage && v.ram === selectedRam
      );

      if (stillValid) {
        selectedColor = newColor;
      } else {
        const cheapest = getCheapest(variantsInColor);
        selectedColor = newColor;
        selectedStorage = cheapest.storage;
        selectedRam = cheapest.ram;
      }

      colorLabel.textContent = selectedColor;
      colorLabel.style.color = dot.style.background;

      refresh();
    };
  });

  storageBtns.forEach(btn => {
    btn.onclick = () => {
      if (btn.classList.contains("disabled")) return;

      selectedStorage = btn.dataset.value;

      const exactMatch = available.find(
        v =>
          v.color === selectedColor &&
          v.storage === selectedStorage &&
          v.ram === selectedRam
      );

      if (!exactMatch) {
        const variants = available.filter(
          v => v.color === selectedColor && v.storage === selectedStorage
        );

        if (variants.length) {
          selectedRam = variants[0].ram;
        }
      }

      refresh();
    };
  });

  ramBtns.forEach(btn => {
    btn.onclick = () => {
      if (btn.classList.contains("disabled")) return;

      selectedRam = btn.dataset.value;

      const exactMatch = available.find(
        v =>
          v.color === selectedColor &&
          v.storage === selectedStorage &&
          v.ram === selectedRam
      );

      if (!exactMatch) {
        const variants = available.filter(
          v => v.color === selectedColor && v.ram === selectedRam
        );

        if (variants.length) {
          selectedStorage = variants[0].storage;
        }
      }

      refresh();
    };
  });

  refresh();
}

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("view-specs")) {
    const url = e.target.dataset.url;
    if (url) {
      window.location.href = url;
    }
  }
});

if (searchInput) {
  searchInput.addEventListener("input", function () {
    const keyword = this.value.trim().toLowerCase();

    const filtered = allProducts.filter(product =>
      product.name.toLowerCase().includes(keyword)
    );

    renderProducts(filtered);
  });
}

loadProducts();