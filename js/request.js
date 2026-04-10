const TELEGRAM_BOT_TOKEN = "8723860650:AAHTO4sq_j2Px4iAfUDf1DkI_k7bmY0hzhc";
const TELEGRAM_CHAT_ID = "6892566157";

const requestModal = document.getElementById("requestModal");
const closeRequestModalBtn = document.getElementById("closeRequestModal");
const requestForm = document.getElementById("requestUnitForm");
const requestSubmitBtn = document.getElementById("requestSubmitBtn");
const requestResellerKey = document.getElementById("requestResellerKey");
const requestPageUrl = document.getElementById("requestPageUrl");
const requestBrand = document.getElementById("requestBrand");
const requestModel = document.getElementById("requestModel");
const requestNotes = document.getElementById("requestNotes");
const toastWrap = document.getElementById("toastWrap");

const REQUEST_COUNT_KEY = "gt_request_submit_count";
const REQUEST_COOLDOWN_KEY = "gt_request_cooldown_until";

let cooldownTimer = null;

function removeToast(toast) {
  if (!toast || toast.dataset.removing === "1") return;

  toast.dataset.removing = "1";
  toast.classList.remove("show");
  toast.classList.add("hide");

  clearTimeout(Number(toast.dataset.hideTimer || 0));

  setTimeout(() => {
    toast.remove();
  }, 250);
}

function attachToastSwipe(toast) {
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const start = (x) => {
    dragging = true;
    startX = x;
    currentX = x;
    toast.classList.add("dragging");
  };

  const move = (x) => {
    if (!dragging) return;
    currentX = x;
    const diff = currentX - startX;
    toast.style.transform = `translateX(${diff}px)`;
    toast.style.opacity = String(Math.max(0.35, 1 - (Math.abs(diff) / 220)));
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove("dragging");

    const diff = currentX - startX;

    if (Math.abs(diff) >= 90) {
      removeToast(toast);
      return;
    }

    toast.style.transform = "";
    toast.style.opacity = "";
  };

  toast.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches[0]) return;
    start(e.touches[0].clientX);
  }, { passive: true });

  toast.addEventListener("touchmove", (e) => {
    if (!e.touches || !e.touches[0]) return;
    move(e.touches[0].clientX);
  }, { passive: true });

  toast.addEventListener("touchend", end);

  toast.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start(e.clientX);
  });

  window.addEventListener("pointermove", (e) => {
    move(e.clientX);
  });

  window.addEventListener("pointerup", end);

  toast.addEventListener("click", () => {
    removeToast(toast);
  });
}

function showToast(message, type = "error", duration = 10000) {
  if (!toastWrap) return;

  const safeDuration = Math.max(1000, Number(duration) || 10000);

  const toast = document.createElement("div");
  toast.className = `toast-message ${type}`;
  toast.innerHTML = `
    <div class="toast-message-body">
      <span class="toast-message-text">${escapeHtml(message)}</span>
      <button type="button" class="toast-close-btn" aria-label="Close message">&times;</button>
    </div>
    <div class="toast-progress"></div>
  `;

  toastWrap.appendChild(toast);

  const closeBtn = toast.querySelector(".toast-close-btn");
  const progressEl = toast.querySelector(".toast-progress");

  if (progressEl) {
    progressEl.style.animationDuration = `${safeDuration}ms`;
  }

  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    removeToast(toast);
  });

  attachToastSwipe(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  const timer = setTimeout(() => {
    removeToast(toast);
  }, safeDuration);

  toast.dataset.hideTimer = String(timer);
}

window.showToast = showToast;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openRequestModal(prefill = "") {
  if (!requestModal) return;

  requestModal.classList.add("active");

  if (requestResellerKey) {
    requestResellerKey.value = window.APP_STATE?.resellerKey || "";
  }

  if (requestPageUrl) {
    requestPageUrl.value = window.location.href;
  }

  if (prefill && requestModel && !requestModel.value.trim()) {
    requestModel.value = prefill;
  }

  if (requestBrand && !requestBrand.value.trim()) {
    requestBrand.focus();
  }

  startCooldownWatcher();
}

function closeRequestModal() {
  if (!requestModal) return;
  requestModal.classList.remove("active");
}

function validateForm() {
  const brand = requestBrand ? requestBrand.value.trim() : "";
  const model = requestModel ? requestModel.value.trim() : "";

  if (!brand) {
    showToast("Please add the brand.", "error");
    requestBrand?.focus();
    return false;
  }

  if (!model) {
    showToast("Please add the model.", "error");
    requestModel?.focus();
    return false;
  }

  return true;
}

function getSubmitCount() {
  return Number(localStorage.getItem(REQUEST_COUNT_KEY) || "0");
}

function setSubmitCount(value) {
  localStorage.setItem(REQUEST_COUNT_KEY, String(value));
}

function getCooldownUntil() {
  return Number(localStorage.getItem(REQUEST_COOLDOWN_KEY) || "0");
}

function setCooldownUntil(value) {
  localStorage.setItem(REQUEST_COOLDOWN_KEY, String(value));
}

function getRemainingCooldownSeconds() {
  const cooldownUntil = getCooldownUntil();
  const diff = cooldownUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

function isCooldownActive() {
  return getRemainingCooldownSeconds() > 0;
}

function applyCooldownAfterSubmit() {
  const nextCount = getSubmitCount() + 1;
  setSubmitCount(nextCount);

  if (nextCount >= 3) {
    setCooldownUntil(Date.now() + 30000);
  } else {
    setCooldownUntil(0);
  }

  updateSubmitButtonState();
}

function updateSubmitButtonState() {
  if (!requestSubmitBtn) return;

  const remaining = getRemainingCooldownSeconds();

  if (remaining > 0) {
    requestSubmitBtn.disabled = true;
    requestSubmitBtn.textContent = `Wait ${remaining}s`;
    return;
  }

  requestSubmitBtn.disabled = false;
  requestSubmitBtn.textContent = "Submit Request";
}

function startCooldownWatcher() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
  }

  updateSubmitButtonState();

  cooldownTimer = setInterval(() => {
    updateSubmitButtonState();

    if (!isCooldownActive()) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
}

document.addEventListener("click", function (e) {
  const openBtn = e.target.closest(".open-request-modal");

  if (openBtn) {
    e.preventDefault();
    openRequestModal(openBtn.dataset.prefill || "");
    return;
  }

  if (e.target === requestModal) {
    closeRequestModal();
  }
});

if (closeRequestModalBtn) {
  closeRequestModalBtn.addEventListener("click", closeRequestModal);
}

if (requestForm) {
  requestForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (isCooldownActive()) {
      const remaining = getRemainingCooldownSeconds();
      showToast(`Please wait ${remaining}s before sending another request.`, "error");
      startCooldownWatcher();
      return;
    }

    if (!validateForm()) return;

    const brand = requestBrand.value.trim();
    const model = requestModel.value.trim();
    const notes = requestNotes ? requestNotes.value.trim() : "";
    const paymentPlan = window.APP_STATE?.selectedPaymentPlan || "cash";
    const reseller = requestResellerKey ? requestResellerKey.value.trim() : "";
    const pageUrl = requestPageUrl ? requestPageUrl.value.trim() : window.location.href;

    const message =
`📦 New Unit Request

📱 Brand: ${brand}
📱 Model: ${model}
💳 Payment Plan: ${paymentPlan}
👤 Reseller: ${reseller || "-"}
📝 Notes: ${notes || "-"}
🌐 Page: ${pageUrl}`;

    requestSubmitBtn.disabled = true;
    requestSubmitBtn.textContent = "Submitting...";

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data?.ok) {
        const telegramMessage = data?.description || "Failed to submit request.";
        throw new Error(telegramMessage);
      }

      applyCooldownAfterSubmit();
      requestForm.reset();
      closeRequestModal();
      showToast("Request sent successfully.", "success", 10000);
    } catch (error) {
      console.error("Telegram submit error:", error);
      showToast(error.message || "Failed to submit request.", "error", 10000);
      updateSubmitButtonState();
    } finally {
      if (!isCooldownActive()) {
        requestSubmitBtn.disabled = false;
        requestSubmitBtn.textContent = "Submit Request";
      } else {
        startCooldownWatcher();
      }
    }
  });
}

startCooldownWatcher();