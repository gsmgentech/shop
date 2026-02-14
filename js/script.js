const container = document.getElementById("productsContainer");

async function loadProducts() {
  try {
    const res = await fetch("./products.json");
    if (!res.ok) throw new Error("JSON not found");
    const products = await res.json();
    products.forEach(product => renderProduct(product));
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load products.json</p>";
  }
}

loadProducts();

function renderProduct(product) {
  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <div class="product-slider">
      ${product.images.map((img,i)=>
        `<img src="${img}" class="${i===0?'active':''}">`
      ).join("")}
      <button class="prev">&#10094;</button>
      <button class="next">&#10095;</button>
    </div>

    <div class="product-header">
      <div class="product-name">${product.name}</div>
      <div class="color-options">
        ${product.colors.map((color,i)=>
          `<span class="color-dot ${i===0?'active':''}" 
            style="background:${color.code}" 
            data-name="${color.name}"
            data-index="${i}"></span>`
        ).join("")}
      </div>
    </div>

    <div class="product-price">
      <span class="price-text">Select Variant</span>
      <span class="selected-color" style="color:${product.colors[0].code}">
        ${product.colors[0].name}
      </span>
    </div>

    <div class="product-note">${product.note}</div>

    <div class="variant-group">
      <label>Storage</label>
      <div class="variant-options storage-options">
        ${product.storageOptions.map(s=>
          `<span class="variant" data-value="${s}">${s}</span>`
        ).join("")}
      </div>
    </div>

    <div class="variant-group">
      <label>RAM</label>
      <div class="variant-options ram-options">
        ${product.ramOptions.map(r=>
          `<span class="variant" data-value="${r}">${r}</span>`
        ).join("")}
      </div>
    </div>

    <button class="buy-button view-specs" data-specs='${product.specs}'>
      View Specs
    </button>
  `;

  container.appendChild(card);

  setupSlider(card);
  setupColorSwitch(card);
  setupVariants(card, product.availableVariants);
}

function setupSlider(card){
  const slider = card.querySelector(".product-slider");
  const slides = slider.querySelectorAll("img");
  const prev = slider.querySelector(".prev");
  const next = slider.querySelector(".next");

  if(slides.length <= 1){
    prev.style.display = "none";
    next.style.display = "none";
    return;
  }

  let index = 0;

  next.onclick = () => {
    slides[index].classList.remove("active");
    index = (index+1)%slides.length;
    slides[index].classList.add("active");
  };

  prev.onclick = () => {
    slides[index].classList.remove("active");
    index = (index-1+slides.length)%slides.length;
    slides[index].classList.add("active");
  };
}

function setupColorSwitch(card){
  const dots = card.querySelectorAll(".color-dot");
  const images = card.querySelectorAll(".product-slider img");

  dots.forEach(dot=>{
    dot.onclick = ()=>{
      dots.forEach(d=>d.classList.remove("active"));
      dot.classList.add("active");

      const i = dot.dataset.index;
      images.forEach(img=>img.classList.remove("active"));
      images[i].classList.add("active");
    }
  });
}

function setupVariants(card, available){
  const priceEl = card.querySelector(".product-price");
  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");

  let selectedStorage = null;
  let selectedRam = null;
  let selectedColor = colorDots[0]?.dataset.name || null;

  function refresh(){
    storageBtns.forEach(btn=>{
      const valid = available.some(v =>
        (!selectedColor || v.color === selectedColor) &&
        (!selectedRam || v.ram === selectedRam) &&
        v.storage === btn.dataset.value
      );
      btn.classList.toggle("disabled", !valid);
    });

    ramBtns.forEach(btn=>{
      const valid = available.some(v =>
        (!selectedColor || v.color === selectedColor) &&
        (!selectedStorage || v.storage === selectedStorage) &&
        v.ram === btn.dataset.value
      );
      btn.classList.toggle("disabled", !valid);
    });

    const match = available.find(v =>
      v.color === selectedColor &&
      v.storage === selectedStorage &&
      v.ram === selectedRam
    );

    if(match){
      priceText.textContent = "₱" + match.price.toLocaleString();
    } else {
      priceText.textContent = "Select Variant";
    }
  }

  colorDots.forEach(dot=>{
    dot.onclick = ()=>{
      colorDots.forEach(d=>d.classList.remove("active"));
      dot.classList.add("active");

      selectedColor = dot.dataset.name;
      selectedStorage = null;
      selectedRam = null;

      storageBtns.forEach(b=>b.classList.remove("active"));
      ramBtns.forEach(b=>b.classList.remove("active"));

      priceText.textContent = "Select Variant";
      colorLabel.textContent = selectedColor;
      colorLabel.style.color = dot.style.background;

      refresh();
    }
  });

  storageBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      if(selectedStorage === btn.dataset.value){
        btn.classList.remove("active");
        selectedStorage = null;
      } else {
        storageBtns.forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        selectedStorage = btn.dataset.value;
      }

      refresh();
    }
  });

  ramBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      if(selectedRam === btn.dataset.value){
        btn.classList.remove("active");
        selectedRam = null;
      } else {
        ramBtns.forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        selectedRam = btn.dataset.value;
      }

      refresh();
    }
  });

  refresh();
}

const modal = document.getElementById("specsModal");
const specsText = document.getElementById("specsText");
const closeModal = document.getElementById("closeModal");

document.addEventListener("click", function(e){
  if(e.target.classList.contains("view-specs")){
    specsText.textContent = e.target.dataset.specs;
    modal.classList.add("active");
  }

  if(e.target === closeModal || e.target === modal){
    modal.classList.remove("active");
  }
});