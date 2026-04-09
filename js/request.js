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

function showToast(message, type = "error") {
  if (!toastWrap) return;

  const toast = document.createElement("div");
  toast.className = `toast-message ${type}`;
  toast.textContent = message;
  toastWrap.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 2600);
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
      showToast("Request sent successfully.", "success");
    } catch (error) {
      console.error("Telegram submit error:", error);
      showToast(error.message || "Failed to submit request.", "error");
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