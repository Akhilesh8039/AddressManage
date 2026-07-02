const form = document.querySelector("#address-form");
const errorMessage = document.querySelector("#form-error");
const addressList = document.querySelector("#address-list");
const emptyState = document.querySelector("#empty-state");
const addressCount = document.querySelector("#address-count");
const prevButton = document.querySelector("#prev-page");
const nextButton = document.querySelector("#next-page");
const pageStatus = document.querySelector("#page-status");
const pinInput = document.querySelector("#pin");
const searchInput = document.querySelector("#search-address");
const alphaNumericInputs = document.querySelectorAll("[data-alpha-numeric]");

const pageSize = 4;
let addresses = [];
let currentPage = 1;
let editingAddressId = "";

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

searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderAddresses();
});

addressList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const cancelButton = event.target.closest("[data-cancel-edit]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (editButton) {
    editingAddressId = editButton.dataset.editId;
    renderAddresses();
    return;
  }

  if (cancelButton) {
    editingAddressId = "";
    renderAddresses();
    return;
  }

  if (deleteButton) {
    deleteAddress(deleteButton.dataset.deleteId);
  }
});

addressList.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editForm = event.target.closest("[data-edit-form]");
  if (!editForm) {
    return;
  }

  const formData = new FormData(editForm);
  const id = editForm.dataset.editForm;
  const address = {
    street: clean(formData.get("street")),
    area: clean(formData.get("area")),
    city: clean(formData.get("city")),
    pin: clean(formData.get("pin")),
  };
  const error = validateAddress(address);

  if (error) {
    editForm.querySelector(".edit-error").textContent = error;
    return;
  }

  try {
    const response = await fetch(`/api/addresses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Address could not be updated.");
    }

    addresses = addresses.map((savedAddress) => (
      savedAddress.id === id ? result : savedAddress
    ));
    editingAddressId = "";
    renderAddresses();
  } catch (error) {
    editForm.querySelector(".edit-error").textContent = error.message;
  }
});

addressList.addEventListener("input", (event) => {
  const input = event.target;
  if (input.matches("[data-edit-alpha-numeric]")) {
    input.value = input.value.replace(/[^a-zA-Z0-9 ]/g, "");
  }

  if (input.matches("[data-edit-pin]")) {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
  }
});

async function deleteAddress(id) {
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
}

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

  const filteredAddresses = getFilteredAddresses();
  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleAddresses = filteredAddresses.slice(start, start + pageSize);

  visibleAddresses.forEach((address) => {
    const card = document.createElement("article");
    card.className = "address-card";
    card.innerHTML = editingAddressId === address.id
      ? getEditCardHtml(address)
      : getAddressCardHtml(address);
    addressList.append(card);
  });

  const searchTerm = getSearchTerm();
  emptyState.hidden = filteredAddresses.length > 0;
  emptyState.textContent = addresses.length === 0
    ? "No addresses saved yet."
    : `No addresses match "${searchTerm}".`;
  addressCount.textContent = searchTerm
    ? `${filteredAddresses.length} of ${addresses.length} shown`
    : `${addresses.length} saved`;
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
  return Math.max(1, Math.ceil(getFilteredAddresses().length / pageSize));
}

function getFilteredAddresses() {
  const searchTerm = getSearchTerm();
  if (!searchTerm) {
    return addresses;
  }

  return addresses.filter((address) => {
    const searchableText = `${address.street} ${address.area} ${address.city} ${address.pin}`;
    return searchableText.toLowerCase().includes(searchTerm);
  });
}

function getSearchTerm() {
  return searchInput.value.trim().toLowerCase();
}

function getAddressCardHtml(address) {
  return `
    <div>
      <strong>${escapeHtml(address.street)}</strong>
      <p>${escapeHtml(address.area)}, ${escapeHtml(address.city)}</p>
      <p>PIN: ${escapeHtml(address.pin)}</p>
    </div>
    <div class="card-actions">
      <button class="edit-button" type="button" data-edit-id="${address.id}">Edit</button>
      <button class="delete-button" type="button" data-delete-id="${address.id}">Delete</button>
    </div>
  `;
}

function getEditCardHtml(address) {
  return `
    <form class="edit-form" data-edit-form="${address.id}">
      <label>
        <span>Street/Flat no.</span>
        <input name="street" type="text" maxlength="60" value="${escapeHtml(address.street)}" data-edit-alpha-numeric>
      </label>
      <label>
        <span>Area</span>
        <input name="area" type="text" maxlength="60" value="${escapeHtml(address.area)}" data-edit-alpha-numeric>
      </label>
      <label>
        <span>City</span>
        <input name="city" type="text" maxlength="60" value="${escapeHtml(address.city)}" data-edit-alpha-numeric>
      </label>
      <label>
        <span>PIN code</span>
        <input name="pin" type="text" inputmode="numeric" maxlength="6" value="${escapeHtml(address.pin)}" data-edit-pin>
      </label>
      <p class="edit-error" role="alert"></p>
      <div class="card-actions">
        <button class="save-button" type="submit">Update</button>
        <button class="cancel-button" type="button" data-cancel-edit>Cancel</button>
      </div>
    </form>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
