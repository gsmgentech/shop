const container = document.getElementById("productsContainer");

async function loadProducts() {
  try {
    const res = await fetch("./products.json");
    if (!res.ok) throw new Error("JSON not found");
    let products = await res.json();

    products = products.sort((a, b) => {
      const cheapestA = getCheapest(a.availableVariants).price;
      const cheapestB = getCheapest(b.availableVariants).price;
      return cheapestA - cheapestB;
    });

    products.forEach(product => renderProduct(product));

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load products.json</p>";
  }
}

function getCheapest(list){
  return list.reduce((min,v)=> v.price < min.price ? v : min);
}

loadProducts();

function renderProduct(product) {

  const cheapestVariant = getCheapest(product.availableVariants);
  const cheapestColorObj = product.colors.find(c=>c.name===cheapestVariant.color);

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
        ${product.colors.map(color=>
          `<span class="color-dot ${color.name===cheapestVariant.color?'active':''}" 
            style="background:${color.code}" 
            data-name="${color.name}"></span>`
        ).join("")}
      </div>
    </div>

    <div class="product-price">
      <span class="price-text">₱${cheapestVariant.price.toLocaleString()}</span>
      <span class="selected-color" style="color:${cheapestColorObj.code}">
        ${cheapestVariant.color}
      </span>
    </div>

    <div class="product-note">${product.note}</div>

    <div class="variant-group">
      <label>Storage</label>
      <div class="variant-options storage-options">
        ${product.storageOptions.map(s=>
          `<span class="variant ${s===cheapestVariant.storage?'active':''}" data-value="${s}">${s}</span>`
        ).join("")}
      </div>
    </div>

    <div class="variant-group">
      <label>RAM</label>
      <div class="variant-options ram-options">
        ${product.ramOptions.map(r=>
          `<span class="variant ${r===cheapestVariant.ram?'active':''}" data-value="${r}">${r}</span>`
        ).join("")}
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

function setupVariants(card, available, initial){

  const priceText = card.querySelector(".price-text");
  const colorLabel = card.querySelector(".selected-color");
  const storageBtns = card.querySelectorAll(".storage-options .variant");
  const ramBtns = card.querySelectorAll(".ram-options .variant");
  const colorDots = card.querySelectorAll(".color-dot");

  let selectedColor = initial.color;
  let selectedStorage = initial.storage;
  let selectedRam = initial.ram;

  function disableAll(){
    storageBtns.forEach(btn=>{
      btn.classList.add("disabled");
      btn.classList.remove("active");
    });
    ramBtns.forEach(btn=>{
      btn.classList.add("disabled");
      btn.classList.remove("active");
    });
  }

  function refresh(){

    const variantsInColor = available.filter(v => v.color === selectedColor);

    if(variantsInColor.length === 0){
      priceText.textContent = "Not available.";
      disableAll();
      return;
    }

    storageBtns.forEach(btn=>{
      const valid = variantsInColor.some(v => v.storage === btn.dataset.value);
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
      selectedColor = dot.dataset.name;

      colorDots.forEach(d=>d.classList.remove("active"));
      dot.classList.add("active");

      const variantsInColor = available.filter(v => v.color === selectedColor);

      if(variantsInColor.length === 0){
        selectedStorage = null;
        selectedRam = null;
        disableAll();
        priceText.textContent = "Not available.";
      } else {
        const cheapest = getCheapest(variantsInColor);
        selectedStorage = cheapest.storage;
        selectedRam = cheapest.ram;
      }

      colorLabel.textContent = selectedColor;
      colorLabel.style.color = dot.style.background;

      refresh();
    }
  });

  storageBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      selectedStorage = btn.dataset.value;

      const variants = available.filter(v =>
        v.color === selectedColor &&
        v.storage === selectedStorage
      );

      if(variants.length){
        selectedRam = variants[0].ram;
      }

      refresh();
    }
  });

  ramBtns.forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.classList.contains("disabled")) return;

      selectedRam = btn.dataset.value;
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