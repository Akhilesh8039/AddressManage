const form = document.querySelector("#address-form");
const errorMessage = document.querySelector("#form-error");
const addressList = document.querySelector("#address-list");
const emptyState = document.querySelector("#empty-state");
const addressCount = document.querySelector("#address-count");
const prevButton = document.querySelector("#prev-page");
const nextButton = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
const pinInput = document.querySelector("#pin");
const alphaNumericInputs = document.querySelectorAll("[data-alpha-numeric]");

const pageSize = 4;
let addresses = [];
let currentPage = 1;

alphaNumericInputs.forEach((input) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^a-zA-Z0-9 ]/g, "");
  });
});

pinInput.addEventListener("input", () => {
  pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const formData = new FormData(form);
  const address = {
    street: clean(formData.get("street")),
    area: clean(formData.get("area")),
    city: clean(formData.get("city")),
    pin: clean(formData.get("pin")),
  };

  const validationError = validateAddress(address);
  if (validationError) {
    showError(validationError);
    return;
  }

  try {
    const response = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Address could not be saved.");
    }

    addresses.unshift(result);
    form.reset();
    currentPage = 1;
    renderAddresses();
  } catch (error) {
    showError(error.message);
  }
});

prevButton.addEventListener("click", () => {
  currentPage -= 1;
  renderAddresses();
});

nextButton.addEventListener("click", () => {
  currentPage += 1;
  renderAddresses();
});

addressList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) {
    return;
  }

  const id = button.dataset.deleteId;
  try {
    const response = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Address could not be deleted.");
    }

    addresses = addresses.filter((address) => address.id !== id);
    const totalPages = getTotalPages();
    currentPage = Math.min(currentPage, totalPages);
    renderAddresses();
  } catch (error) {
    showError(error.message);
  }
});

loadAddresses();

async function loadAddresses() {
  try {
    const response = await fetch("/api/addresses");
    addresses = await response.json();
    renderAddresses();
  } catch {
    showError("Start the JavaScript server to save and load addresses.");
  }
}

function renderAddresses() {
  addressList.innerHTML = "";

  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleAddresses = addresses.slice(start, start + pageSize);

  visibleAddresses.forEach((address) => {
    const card = document.createElement("article");
    card.className = "address-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(address.street)}</strong>
        <p>${escapeHtml(address.area)}, ${escapeHtml(address.city)}</p>
        <p>PIN: ${escapeHtml(address.pin)}</p>
      </div>
      <button class="delete-button" type="button" data-delete-id="${address.id}">Delete</button>
    `;
    addressList.append(card);
  });

  emptyState.hidden = addresses.length > 0;
  addressCount.textContent = `${addresses.length} saved`;
  pageStatus.textContent = `Page ${currentPage} of ${totalPages}`;
  prevButton.disabled = currentPage === 1;
  nextButton.disabled = currentPage === totalPages;
}

function validateAddress(address) {
  if (!address.street && !address.area && !address.city && !address.pin) {
    return "Street/Flat no. textfield cannot be empty";
  }

  if (!address.street) {
    return "Street/Flat no. textfield cannot be empty";
  }

  if (!address.area || !address.city || !address.pin) {
    return "All textfields must be filled before saving.";
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(address.street)
    || !/^[a-zA-Z0-9 ]+$/.test(address.area)
    || !/^[a-zA-Z0-9 ]+$/.test(address.city)) {
    return "First three textfields can contain only alphanumeric characters.";
  }

  if (!/^\d{6}$/.test(address.pin)) {
    return "PIN code must contain exactly 6 digits.";
  }

  return "";
}

function clean(value) {
  return String(value || "").trim();
}

function clearError() {
  errorMessage.textContent = "";
}

function showError(message) {
  errorMessage.textContent = message;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(addresses.length / pageSize));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
