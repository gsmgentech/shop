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

    <button class="buy-button view-specs" data-url="${product.specsPage}">
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

  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");

  let selectedColor = null;
  let selectedStorage = null;
  let selectedRam = null;

  function getCheapest(list){
    return list.reduce((min,v)=> v.price < min.price ? v : min);
  }

  function refresh(){

    storageBtns.forEach(btn=>{
      const valid = available.some(v =>
        v.color === selectedColor &&
        v.storage === btn.dataset.value
      );
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", btn.dataset.value === selectedStorage);
    });

    ramBtns.forEach(btn=>{
      const valid = available.some(v =>
        v.color === selectedColor &&
        v.storage === selectedStorage &&
        v.ram === btn.dataset.value
      );
      btn.classList.toggle("disabled", !valid);
      btn.classList.toggle("active", btn.dataset.value === selectedRam);
    });

    colorDots.forEach(dot=>{
      dot.classList.toggle("active", dot.dataset.name === selectedColor);
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

    const activeDot = Array.from(colorDots).find(d => d.dataset.name === selectedColor);
    if(activeDot){
      colorLabel.textContent = selectedColor;
      colorLabel.style.color = activeDot.style.background;
    }
  }

  const cheapestOverall = getCheapest(available);
  selectedColor = cheapestOverall.color;
  selectedStorage = cheapestOverall.storage;
  selectedRam = cheapestOverall.ram;

  colorDots.forEach(dot=>{
    dot.onclick = ()=>{
      const variantsInColor = available.filter(v => v.color === dot.dataset.name);
      if(variantsInColor.length === 0){
        priceText.textContent = "Not available.";
        return;
      }

      const match = variantsInColor.find(v =>
        v.storage === selectedStorage &&
        v.ram === selectedRam
      );

      if(match){
        selectedColor = match.color;
      } else {
        const cheapest = getCheapest(variantsInColor);
        selectedColor = cheapest.color;
        selectedStorage = cheapest.storage;
        selectedRam = cheapest.ram;
      }

      refresh();
    }
  });

  storageBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      const variants = available.filter(v =>
        v.color === selectedColor &&
        v.storage === btn.dataset.value
      );

      if(variants.length === 0) return;

      const match = variants.find(v => v.ram === selectedRam);

      if(match){
        selectedStorage = match.storage;
      } else {
        const cheapest = getCheapest(variants);
        selectedStorage = cheapest.storage;
        selectedRam = cheapest.ram;
      }

      refresh();
    }
  });

  ramBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      const match = available.find(v =>
        v.color === selectedColor &&
        v.storage === selectedStorage &&
        v.ram === btn.dataset.value
      );

      if(match){
        selectedRam = match.ram;
      }

      refresh();
    }
  });

  refresh();
}

document.addEventListener("click", function(e){
  if(e.target.classList.contains("view-specs")){
    const url = e.target.dataset.url;
    if(url){
      window.location.href = url;
    }
  }
});