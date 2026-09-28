/* =========================================================
   KASIR APP
   js/app.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const STORAGE_KEYS = {
  MENUS: "kasir_menus",
  SALES: "kasir_sales"
};


/* =========================================================
   STATE
   ========================================================= */

let menus = [];
let sales = [];
let cart = [];

let currentSalesFilter = "all";
let editingMenuId = null;


/* =========================================================
   DOM HELPER
   ========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   FORMAT
   ========================================================= */

function formatRupiah(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}


function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value) || 0
  );
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDateTime(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}


/* =========================================================
   STORAGE
   ========================================================= */

function loadData() {
  try {
    const savedMenus = localStorage.getItem(
      STORAGE_KEYS.MENUS
    );

    const savedSales = localStorage.getItem(
      STORAGE_KEYS.SALES
    );

    menus = savedMenus
      ? JSON.parse(savedMenus)
      : [];

    sales = savedSales
      ? JSON.parse(savedSales)
      : [];

    if (!Array.isArray(menus)) {
      menus = [];
    }

    if (!Array.isArray(sales)) {
      sales = [];
    }

  } catch (error) {
    console.error("Gagal membaca data:", error);

    menus = [];
    sales = [];

    showToast(
      "Data lokal tidak dapat dibaca.",
      "error"
    );
  }
}


function saveMenus() {
  localStorage.setItem(
    STORAGE_KEYS.MENUS,
    JSON.stringify(menus)
  );
}


function saveSales() {
  localStorage.setItem(
    STORAGE_KEYS.SALES,
    JSON.stringify(sales)
  );
}


/* =========================================================
   CONNECTION
   ========================================================= */

function updateConnectionStatus() {
  const dot = $("connectionDot");
  const text = $("connectionText");

  if (!dot || !text) return;

  if (navigator.onLine) {
    dot.classList.add("online");
    dot.classList.remove("offline");

    text.textContent = "Online";
  } else {
    dot.classList.add("offline");
    dot.classList.remove("online");

    text.textContent = "Offline";
  }
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {
  const loading = $("loading");

  if (!loading) return;

  loading.classList.add("show");
  loading.setAttribute("aria-hidden", "false");
}


function hideLoading() {
  const loading = $("loading");

  if (!loading) return;

  loading.classList.remove("show");
  loading.setAttribute("aria-hidden", "true");
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  clearTimeout(toastTimer);

  toast.textContent = message;

  toast.className = "toast";

  toast.classList.add("show");

  if (type) {
    toast.classList.add(type);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {
  const buttons = document.querySelectorAll(
    ".nav-btn"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      if (!page) return;

      openPage(page);
    });
  });
}


function openPage(pageName) {
  const pages = document.querySelectorAll(".page");
  const buttons = document.querySelectorAll(".nav-btn");

  pages.forEach((page) => {
    page.classList.remove("active");
  });

  buttons.forEach((button) => {
    button.classList.remove("active");
  });

  const targetPage = $(`page-${pageName}`);

  if (targetPage) {
    targetPage.classList.add("active");
  }

  const activeButton = document.querySelector(
    `.nav-btn[data-page="${pageName}"]`
  );

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (pageName === "kasir") {
    renderMenuGrid();
    renderCart();
  }

  if (pageName === "penjualan") {
    renderSales();
    updateSalesStats();
  }

  if (pageName === "menu") {
    renderMenuTable();
  }
}


/* =========================================================
   MENU
   ========================================================= */

function generateId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );
}


function renderCategoryFilter() {
  const select = $("categoryFilter");

  if (!select) return;

  const currentValue = select.value;

  const categories = [
    ...new Set(
      menus
        .map((menu) => String(menu.category || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "id"));

  select.innerHTML = `
    <option value="">Semua kategori</option>
    ${categories
      .map(
        (category) =>
          `<option value="${escapeHTML(category)}">
            ${escapeHTML(category)}
          </option>`
      )
      .join("")}
  `;

  if (
    categories.includes(currentValue)
  ) {
    select.value = currentValue;
  }
}


function getFilteredMenus() {
  const searchInput = $("menuSearch");
  const categorySelect = $("categoryFilter");

  const search = (
    searchInput?.value || ""
  )
    .trim()
    .toLowerCase();

  const category =
    categorySelect?.value || "";

  return menus.filter((menu) => {
    const name = String(
      menu.name || ""
    ).toLowerCase();

    const menuCategory = String(
      menu.category || ""
    );

    const matchesSearch =
      !search ||
      name.includes(search) ||
      menuCategory.toLowerCase().includes(search);

    const matchesCategory =
      !category ||
      menuCategory === category;

    return (
      matchesSearch &&
      matchesCategory
    );
  });
}


function renderMenuGrid() {
  const grid = $("menuGrid");

  if (!grid) return;

  renderCategoryFilter();

  const filteredMenus = getFilteredMenus();

  if (filteredMenus.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">
          Belum ada menu
        </div>

        <div class="empty-state-text">
          Tambahkan menu terlebih dahulu
          melalui halaman Menu.
        </div>
      </div>
    `;

    return;
  }

  grid.innerHTML = filteredMenus
    .map((menu) => {
      return `
        <button
          type="button"
          class="menu-card"
          data-menu-id="${escapeHTML(menu.id)}"
        >

          <div class="menu-card-name">
            ${escapeHTML(menu.name)}
          </div>

          <div class="menu-card-category">
            ${escapeHTML(menu.category || "Umum")}
          </div>

          <div class="menu-card-price">
            ${formatRupiah(menu.price)}
          </div>

        </button>
      `;
    })
    .join("");

  grid
    .querySelectorAll(".menu-card")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const menuId =
          button.dataset.menuId;

        addToCart(menuId);
      });
    });
}


/* =========================================================
   MENU TABLE
   ========================================================= */

function renderMenuTable() {
  const tbody = $("menuTableBody");

  if (!tbody) return;

  if (menus.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-table"
        >
          Belum ada menu.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = menus
    .map((menu, index) => {
      return `
        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            <strong>
              ${escapeHTML(menu.name)}
            </strong>
          </td>

          <td>
            ${escapeHTML(menu.category || "-")}
          </td>

          <td class="text-right">
            ${formatRupiah(menu.price)}
          </td>

          <td>

            <div class="table-actions">

              <button
                type="button"
                class="btn btn-light btn-small"
                data-edit-menu="${escapeHTML(menu.id)}"
              >
                Edit
              </button>

              <button
                type="button"
                class="btn btn-danger btn-small"
                data-delete-menu="${escapeHTML(menu.id)}"
              >
                Hapus
              </button>

            </div>

          </td>

        </tr>
      `;
    })
    .join("");

  tbody
    .querySelectorAll("[data-edit-menu]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openEditMenu(
          button.dataset.editMenu
        );
      });
    });

  tbody
    .querySelectorAll("[data-delete-menu]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteMenu(
          button.dataset.deleteMenu
        );
      });
    });
}


/* =========================================================
   ADD / EDIT MENU
   ========================================================= */

function openMenuModal() {
  const modal = $("menuModal");

  if (!modal) return;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}


function closeMenuModal() {
  const modal = $("menuModal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");

  editingMenuId = null;

  const form = $("menuForm");

  if (form) {
    form.reset();
  }

  const idInput = $("menuId");

  if (idInput) {
    idInput.value = "";
  }

  const title = $("menuModalTitle");

  if (title) {
    title.textContent = "Tambah Menu";
  }
}


function openAddMenu() {
  editingMenuId = null;

  const form = $("menuForm");

  if (form) {
    form.reset();
  }

  $("menuId").value = "";

  $("menuModalTitle").textContent =
    "Tambah Menu";

  openMenuModal();

  setTimeout(() => {
    $("menuName")?.focus();
  }, 100);
}


function openEditMenu(menuId) {
  const menu = menus.find(
    (item) => String(item.id) === String(menuId)
  );

  if (!menu) {
    showToast(
      "Menu tidak ditemukan.",
      "error"
    );

    return;
  }

  editingMenuId = menu.id;

  $("menuId").value = menu.id;
  $("menuName").value = menu.name || "";
  $("menuCategory").value =
    menu.category || "";
  $("menuPrice").value =
    Number(menu.price) || 0;

  $("menuModalTitle").textContent =
    "Edit Menu";

  openMenuModal();

  setTimeout(() => {
    $("menuName")?.focus();
  }, 100);
}


function handleMenuSubmit(event) {
  event.preventDefault();

  const name = $("menuName")
    .value
    .trim();

  const category = $("menuCategory")
    .value
    .trim();

  const price = Number(
    $("menuPrice").value
  );

  if (!name) {
    showToast(
      "Nama menu wajib diisi.",
      "error"
    );

    $("menuName").focus();

    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    showToast(
      "Harga menu tidak valid.",
      "error"
    );

    $("menuPrice").focus();

    return;
  }

  if (editingMenuId) {
    const index = menus.findIndex(
      (menu) =>
        String(menu.id) ===
        String(editingMenuId)
    );

    if (index === -1) {
      showToast(
        "Menu tidak ditemukan.",
        "error"
      );

      return;
    }

    menus[index] = {
      ...menus[index],
      name,
      category,
      price
    };

    saveMenus();

    showToast(
      "Menu berhasil diperbarui."
    );

  } else {
    const newMenu = {
      id: generateId("menu"),
      name,
      category,
      price,
      createdAt:
        new Date().toISOString()
    };

    menus.push(newMenu);

    saveMenus();

    showToast(
      "Menu berhasil ditambahkan."
    );
  }

  closeMenuModal();

  renderMenuTable();
  renderMenuGrid();
  renderCategoryFilter();
}


function deleteMenu(menuId) {
  const menu = menus.find(
    (item) =>
      String(item.id) ===
      String(menuId)
  );

  if (!menu) {
    showToast(
      "Menu tidak ditemukan.",
      "error"
    );

    return;
  }

  const usedInCart = cart.some(
    (item) =>
      String(item.menuId) ===
      String(menuId)
  );

  if (usedInCart) {
    showToast(
      "Menu masih ada di keranjang. Kosongkan keranjang terlebih dahulu.",
      "error"
    );

    return;
  }

  const confirmed = window.confirm(
    `Hapus menu "${menu.name}"?`
  );

  if (!confirmed) return;

  menus = menus.filter(
    (item) =>
      String(item.id) !==
      String(menuId)
  );

  saveMenus();

  renderMenuTable();
  renderMenuGrid();
  renderCategoryFilter();

  showToast(
    "Menu berhasil dihapus."
  );
}


/* =========================================================
   CART
   ========================================================= */

function addToCart(menuId) {
  const menu = menus.find(
    (item) =>
      String(item.id) ===
      String(menuId)
  );

  if (!menu) {
    showToast(
      "Menu tidak ditemukan.",
      "error"
    );

    return;
  }

  const existing = cart.find(
    (item) =>
      String(item.menuId) ===
      String(menuId)
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      menuId: menu.id,
      name: menu.name,
      price: Number(menu.price) || 0,
      qty: 1
    });
  }

  renderCart();
}


function decreaseCartItem(menuId) {
  const item = cart.find(
    (cartItem) =>
      String(cartItem.menuId) ===
      String(menuId)
  );

  if (!item) return;

  item.qty -= 1;

  if (item.qty <= 0) {
    cart = cart.filter(
      (cartItem) =>
        String(cartItem.menuId) !==
        String(menuId)
    );
  }

  renderCart();
}


function increaseCartItem(menuId) {
  const item = cart.find(
    (cartItem) =>
      String(cartItem.menuId) ===
      String(menuId)
  );

  if (!item) return;

  item.qty += 1;

  renderCart();
}


function removeCartItem(menuId) {
  cart = cart.filter(
    (item) =>
      String(item.menuId) !==
      String(menuId)
  );

  renderCart();
}


function clearCart() {
  if (cart.length === 0) {
    return;
  }

  const confirmed = window.confirm(
    "Kosongkan semua item di keranjang?"
  );

  if (!confirmed) return;

  cart = [];

  const payment = $("payment");

  if (payment) {
    payment.value = "";
  }

  renderCart();

  showToast(
    "Keranjang dikosongkan."
  );
}


function getCartTotal() {
  return cart.reduce(
    (total, item) =>
      total +
      Number(item.price) *
        Number(item.qty),
    0
  );
}


function getCartItemCount() {
  return cart.reduce(
    (total, item) =>
      total + Number(item.qty),
    0
  );
}


function renderCart() {
  const container = $("cartItems");
  const countElement = $("cartItemCount");
  const totalElement = $("cartTotal");

  if (!container) return;

  const itemCount =
    getCartItemCount();

  const total =
    getCartTotal();

  if (countElement) {
    countElement.textContent =
      `${formatNumber(itemCount)} item`;
  }

  if (totalElement) {
    totalElement.textContent =
      formatRupiah(total);
  }

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-title">
          Keranjang kosong
        </div>

        <div class="cart-empty-text">
          Pilih menu untuk menambahkan
          item ke keranjang.
        </div>
      </div>
    `;

    updateChange();

    return;
  }

  container.innerHTML = cart
    .map((item) => {
      const subtotal =
        Number(item.price) *
        Number(item.qty);

      return `
        <div class="cart-item">

          <div class="cart-item-info">

            <div class="cart-item-name">
              ${escapeHTML(item.name)}
            </div>

            <div class="cart-item-price">
              ${formatRupiah(item.price)}
            </div>

          </div>


          <div class="cart-item-right">

            <div class="cart-item-controls">

              <button
                type="button"
                class="qty-btn"
                data-decrease="${escapeHTML(item.menuId)}"
                aria-label="Kurangi"
              >
                −
              </button>

              <span class="qty">
                ${item.qty}
              </span>

              <button
                type="button"
                class="qty-btn"
                data-increase="${escapeHTML(item.menuId)}"
                aria-label="Tambah"
              >
                +
              </button>

            </div>

            <div class="cart-item-subtotal">
              ${formatRupiah(subtotal)}
            </div>

            <button
              type="button"
              class="cart-remove"
              data-remove="${escapeHTML(item.menuId)}"
            >
              Hapus
            </button>

          </div>

        </div>
      `;
    })
    .join("");

  container
    .querySelectorAll("[data-decrease]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        decreaseCartItem(
          button.dataset.decrease
        );
      });
    });

  container
    .querySelectorAll("[data-increase]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        increaseCartItem(
          button.dataset.increase
        );
      });
    });

  container
    .querySelectorAll("[data-remove]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        removeCartItem(
          button.dataset.remove
        );
      });
    });

  updateChange();
}


/* =========================================================
   PAYMENT
   ========================================================= */

function getPayment() {
  const paymentInput = $("payment");

  if (!paymentInput) return 0;

  const value = Number(
    paymentInput.value
  );

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}


function updateChange() {
  const changeElement =
    $("changeAmount");

  if (!changeElement) return;

  const total = getCartTotal();
  const payment = getPayment();

  if (payment <= 0) {
    changeElement.textContent =
      "Rp0";

    changeElement.classList.remove(
      "negative"
    );

    return;
  }

  const change =
    payment - total;

  changeElement.textContent =
    formatRupiah(change);

  if (change < 0) {
    changeElement.classList.add(
      "negative"
    );
  } else {
    changeElement.classList.remove(
      "negative"
    );
  }
}


/* =========================================================
   SALE NUMBER
   ========================================================= */

function generateSaleNumber() {
  const date = getToday()
    .replace(/-/g, "");

  const todaySales = sales.filter(
    (sale) =>
      String(sale.date || "") ===
      getToday()
  );

  const sequence =
    todaySales.length + 1;

  return `TRX-${date}-${String(
    sequence
  ).padStart(4, "0")}`;
}


/* =========================================================
   SAVE SALE
   ========================================================= */

function saveSale() {
  if (cart.length === 0) {
    showToast(
      "Keranjang masih kosong.",
      "error"
    );

    return;
  }

  const total = getCartTotal();
  const payment = getPayment();

  if (payment < total) {
    showToast(
      "Pembayaran masih kurang.",
      "error"
    );

    $("payment")?.focus();

    return;
  }

  const now =
    new Date().toISOString();

  const sale = {
    id: generateId("sale"),

    transactionNumber:
      generateSaleNumber(),

    date: getToday(),

    createdAt: now,

    items: cart.map((item) => ({
      menuId: item.menuId,
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty),
      subtotal:
        Number(item.price) *
        Number(item.qty)
    })),

    total,

    payment,

    change:
      payment - total
  };

  showLoading();

  setTimeout(() => {
    try {
      sales.unshift(sale);

      saveSales();

      showToast(
        "Transaksi berhasil disimpan."
      );

      openReceipt(sale);

      cart = [];

      const paymentInput =
        $("payment");

      if (paymentInput) {
        paymentInput.value = "";
      }

      renderCart();
      renderSales();
      updateSalesStats();

    } catch (error) {
      console.error(
        "Gagal menyimpan transaksi:",
        error
      );

      showToast(
        "Transaksi gagal disimpan.",
        "error"
      );

    } finally {
      hideLoading();
    }
  }, 200);
}


/* =========================================================
   SALES
   ========================================================= */

function getFilteredSales() {
  if (currentSalesFilter === "all") {
    return [...sales];
  }

  return sales.filter(
    (sale) =>
      String(sale.date || "") ===
      currentSalesFilter
  );
}


function renderSales() {
  const tbody =
    $("salesTableBody");

  if (!tbody) return;

  const filteredSales =
    getFilteredSales();

  if (filteredSales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="empty-table"
        >
          Belum ada transaksi.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    filteredSales
      .map((sale, index) => {
        const itemCount =
          (sale.items || []).reduce(
            (total, item) =>
              total +
              Number(item.qty || 0),
            0
          );

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              <strong>
                ${escapeHTML(
                  sale.transactionNumber
                )}
              </strong>
            </td>

            <td>
              ${formatDateTime(
                sale.createdAt
              )}
            </td>

            <td>
              ${formatNumber(itemCount)} item
            </td>

            <td class="text-right">
              ${formatRupiah(sale.total)}
            </td>

            <td class="text-right">
              ${formatRupiah(sale.payment)}
            </td>

            <td class="text-right">
              ${formatRupiah(sale.change)}
            </td>

            <td>

              <div class="table-actions">

                <button
                  type="button"
                  class="btn btn-light btn-small"
                  data-view-sale="${escapeHTML(sale.id)}"
                >
                  Struk
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-small"
                  data-delete-sale="${escapeHTML(sale.id)}"
                >
                  Hapus
                </button>

              </div>

            </td>

          </tr>
        `;
      })
      .join("");

  tbody
    .querySelectorAll("[data-view-sale]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const sale =
          sales.find(
            (item) =>
              String(item.id) ===
              String(
                button.dataset.viewSale
              )
          );

        if (sale) {
          openReceipt(sale);
        }
      });
    });

  tbody
    .querySelectorAll("[data-delete-sale]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteSale(
          button.dataset.deleteSale
        );
      });
    });
}


/* =========================================================
   SALES STATS
   ========================================================= */

function updateSalesStats() {
  const transactionElement =
    $("totalTransactions");

  const totalElement =
    $("totalSales");

  const averageElement =
    $("averageSales");

  const filteredSales =
    getFilteredSales();

  const total =
    filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );

  const count =
    filteredSales.length;

  const average =
    count > 0
      ? total / count
      : 0;

  if (transactionElement) {
    transactionElement.textContent =
      formatNumber(count);
  }

  if (totalElement) {
    totalElement.textContent =
      formatRupiah(total);
  }

  if (averageElement) {
    averageElement.textContent =
      formatRupiah(average);
  }
}


/* =========================================================
   SALES FILTER
   ========================================================= */

function setSalesDate(date) {
  currentSalesFilter =
    date || "all";

  renderSales();
  updateSalesStats();
}


function handleSalesDateChange() {
  const input = $("salesDate");

  if (!input) return;

  setSalesDate(
    input.value || "all"
  );
}


function setTodaySales() {
  const today = getToday();

  const input = $("salesDate");

  if (input) {
    input.value = today;
  }

  setSalesDate(today);
}


function setAllSales() {
  const input = $("salesDate");

  if (input) {
    input.value = "";
  }

  setSalesDate("all");
}


/* =========================================================
   DELETE SALE
   ========================================================= */

function deleteSale(saleId) {
  const sale = sales.find(
    (item) =>
      String(item.id) ===
      String(saleId)
  );

  if (!sale) {
    showToast(
      "Transaksi tidak ditemukan.",
      "error"
    );

    return;
  }

  const confirmed = window.confirm(
    `Hapus transaksi ${sale.transactionNumber}?`
  );

  if (!confirmed) return;

  sales = sales.filter(
    (item) =>
      String(item.id) !==
      String(saleId)
  );

  saveSales();

  renderSales();
  updateSalesStats();

  showToast(
    "Transaksi berhasil dihapus."
  );
}


/* =========================================================
   RESET TODAY SALES
   ========================================================= */

function openResetModal() {
  const modal = $("resetModal");

  if (!modal) return;

  modal.classList.add("show");
  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeResetModal() {
  const modal = $("resetModal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}


function resetTodaySales() {
  const today = getToday();

  const before =
    sales.length;

  sales = sales.filter(
    (sale) =>
      String(sale.date || "") !==
      today
  );

  const removed =
    before - sales.length;

  saveSales();

  closeResetModal();

  renderSales();
  updateSalesStats();

  showToast(
    removed > 0
      ? `${removed} transaksi hari ini berhasil dihapus.`
      : "Tidak ada transaksi hari ini."
  );
}


/* =========================================================
   RECEIPT
   ========================================================= */

let currentReceiptSale = null;


function openReceipt(sale) {
  if (!sale) return;

  currentReceiptSale = sale;

  const modal =
    $("receiptModal");

  const content =
    $("receiptContent");

  if (!modal || !content) {
    return;
  }

  const items =
    Array.isArray(sale.items)
      ? sale.items
      : [];

  content.innerHTML = `
    <div class="receipt">

      <div class="receipt-shop">
        KASIR
      </div>

      <div class="receipt-title">
        STRUK TRANSAKSI
      </div>

      <div class="receipt-line"></div>

      <div class="receipt-info">
        <div>
          <span>No. Transaksi</span>
          <strong>
            ${escapeHTML(
              sale.transactionNumber
            )}
          </strong>
        </div>

        <div>
          <span>Tanggal</span>
          <strong>
            ${escapeHTML(
              formatDateTime(
                sale.createdAt
              )
            )}
          </strong>
        </div>
      </div>

      <div class="receipt-line"></div>

      <div class="receipt-items">

        ${items
          .map(
            (item) => `
              <div class="receipt-item">

                <div class="receipt-item-name">
                  ${escapeHTML(item.name)}
                </div>

                <div class="receipt-item-detail">
                  ${item.qty} × ${formatRupiah(item.price)}
                </div>

                <div class="receipt-item-total">
                  ${formatRupiah(item.subtotal)}
                </div>

              </div>
            `
          )
          .join("")}

      </div>

      <div class="receipt-line"></div>

      <div class="receipt-summary">

        <div>
          <span>Total</span>
          <strong>
            ${formatRupiah(sale.total)}
          </strong>
        </div>

        <div>
          <span>Pembayaran</span>
          <strong>
            ${formatRupiah(sale.payment)}
          </strong>
        </div>

        <div>
          <span>Kembalian</span>
          <strong>
            ${formatRupiah(sale.change)}
          </strong>
        </div>

      </div>

      <div class="receipt-line"></div>

      <div class="receipt-thanks">
        Terima kasih
      </div>

    </div>
  `;

  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeReceiptModal() {
  const modal =
    $("receiptModal");

  if (!modal) return;

  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  currentReceiptSale = null;
}


/* =========================================================
   PRINT RECEIPT
   ========================================================= */

function printReceipt() {
  if (!currentReceiptSale) {
    showToast(
      "Struk tidak tersedia.",
      "error"
    );

    return;
  }

  const sale =
    currentReceiptSale;

  const items =
    Array.isArray(sale.items)
      ? sale.items
      : [];

  const itemHTML = items
    .map(
      (item) => `
        <tr>
          <td>
            ${escapeHTML(item.name)}
          </td>

          <td style="text-align:center;">
            ${item.qty}
          </td>

          <td style="text-align:right;">
            ${formatRupiah(item.subtotal)}
          </td>
        </tr>
      `
    )
    .join("");

  const printWindow =
    window.open(
      "",
      "_blank",
      "width=420,height=700"
    );

  if (!printWindow) {
    showToast(
      "Popup print diblokir browser.",
      "error"
    );

    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>

    <html lang="id">

    <head>

      <meta charset="UTF-8">

      <title>
        Struk ${escapeHTML(
          sale.transactionNumber
        )}
      </title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 20px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #111;
          background: #fff;
        }

        .receipt {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
        }

        .center {
          text-align: center;
        }

        .shop {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .title {
          font-size: 13px;
          margin-bottom: 15px;
        }

        .line {
          border-top:
            1px dashed #555;
          margin: 12px 0;
        }

        .info {
          font-size: 12px;
          line-height: 1.7;
        }

        table {
          width: 100%;
          border-collapse:
            collapse;
          font-size: 12px;
        }

        td {
          padding: 5px 0;
          vertical-align: top;
        }

        .summary {
          font-size: 13px;
        }

        .summary-row {
          display: flex;
          justify-content:
            space-between;
          margin: 6px 0;
        }

        .total {
          font-weight: 700;
          font-size: 15px;
        }

        .thanks {
          text-align: center;
          margin-top: 18px;
          font-size: 12px;
        }

        @media print {
          body {
            padding: 0;
          }

          .receipt {
            max-width: none;
          }
        }

      </style>

    </head>

    <body>

      <div class="receipt">

        <div class="center">

          <div class="shop">
            KASIR
          </div>

          <div class="title">
            STRUK TRANSAKSI
          </div>

        </div>

        <div class="line"></div>

        <div class="info">

          <div>
            No. Transaksi:
            ${escapeHTML(
              sale.transactionNumber
            )}
          </div>

          <div>
            Tanggal:
            ${escapeHTML(
              formatDateTime(
                sale.createdAt
              )
            )}
          </div>

        </div>

        <div class="line"></div>

        <table>

          <tbody>
            ${itemHTML}
          </tbody>

        </table>

        <div class="line"></div>

        <div class="summary">

          <div class="summary-row total">
            <span>Total</span>
            <span>
              ${formatRupiah(
                sale.total
              )}
            </span>
          </div>

          <div class="summary-row">
            <span>Pembayaran</span>
            <span>
              ${formatRupiah(
                sale.payment
              )}
            </span>
          </div>

          <div class="summary-row">
            <span>Kembalian</span>
            <span>
              ${formatRupiah(
                sale.change
              )}
            </span>
          </div>

        </div>

        <div class="line"></div>

        <div class="thanks">
          Terima kasih
        </div>

      </div>

      <script>
        window.onload = function () {
          window.print();

          setTimeout(function () {
            window.close();
          }, 500);
        };
      <\/script>

    </body>

    </html>
  `);

  printWindow.document.close();
}


/* =========================================================
   DOWNLOAD CSV
   ========================================================= */

function downloadSalesCSV() {
  const filteredSales =
    getFilteredSales();

  if (filteredSales.length === 0) {
    showToast(
      "Tidak ada data untuk di-download.",
      "error"
    );

    return;
  }

  const rows = [];

  rows.push([
    "No",
    "No Transaksi",
    "Tanggal",
    "Item",
    "Total",
    "Pembayaran",
    "Kembalian"
  ]);

  filteredSales.forEach(
    (sale, index) => {
      const itemCount =
        (sale.items || []).reduce(
          (total, item) =>
            total +
            Number(item.qty || 0),
          0
        );

      rows.push([
        index + 1,
        sale.transactionNumber,
        formatDateTime(
          sale.createdAt
        ),
        itemCount,
        sale.total,
        sale.payment,
        sale.change
      ]);
    }
  );

  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue =
            String(value ?? "");

          return `"${stringValue.replace(
            /"/g,
            '""'
          )}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    {
      type:
        "text/csv;charset=utf-8;"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `laporan-penjualan-${getToday()}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  showToast(
    "CSV berhasil di-download."
  );
}


/* =========================================================
   PRINT SALES REPORT
   ========================================================= */

function printSalesReport() {
  const filteredSales =
    getFilteredSales();

  if (filteredSales.length === 0) {
    showToast(
      "Tidak ada data untuk dicetak.",
      "error"
    );

    return;
  }

  const total =
    filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );

  const printWindow =
    window.open(
      "",
      "_blank",
      "width=900,height=700"
    );

  if (!printWindow) {
    showToast(
      "Popup print diblokir browser.",
      "error"
    );

    return;
  }

  const rows =
    filteredSales
      .map(
        (sale, index) => {
          const itemCount =
            (sale.items || []).reduce(
              (sum, item) =>
                sum +
                Number(item.qty || 0),
              0
            );

          return `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHTML(
                  sale.transactionNumber
                )}
              </td>

              <td>
                ${escapeHTML(
                  formatDateTime(
                    sale.createdAt
                  )
                )}
              </td>

              <td>
                ${itemCount}
              </td>

              <td>
                ${formatRupiah(
                  sale.total
                )}
              </td>

              <td>
                ${formatRupiah(
                  sale.payment
                )}
              </td>

              <td>
                ${formatRupiah(
                  sale.change
                )}
              </td>

            </tr>
          `;
        }
      )
      .join("");

  printWindow.document.write(`
    <!DOCTYPE html>

    <html lang="id">

    <head>

      <meta charset="UTF-8">

      <title>
        Laporan Penjualan
      </title>

      <style>

        body {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #111;
          padding: 30px;
        }

        h1 {
          margin: 0 0 5px;
        }

        .subtitle {
          color: #555;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse:
            collapse;
        }

        th,
        td {
          border: 1px solid #ddd;
          padding: 8px;
          font-size: 12px;
        }

        th {
          background: #f3f4f6;
          text-align: left;
        }

        .right {
          text-align: right;
        }

        .summary {
          margin-top: 20px;
          font-size: 14px;
        }

      </style>

    </head>

    <body>

      <h1>
        Laporan Penjualan
      </h1>

      <div class="subtitle">
        Dicetak:
        ${escapeHTML(
          formatDateTime(
            new Date().toISOString()
          )
        )}
      </div>

      <table>

        <thead>

          <tr>

            <th>No</th>
            <th>No. Transaksi</th>
            <th>Tanggal</th>
            <th>Item</th>
            <th>Total</th>
            <th>Pembayaran</th>
            <th>Kembalian</th>

          </tr>

        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

      <div class="summary">

        <strong>
          Jumlah Transaksi:
        </strong>

        ${filteredSales.length}

        &nbsp;&nbsp;&nbsp;

        <strong>
          Total Penjualan:
        </strong>

        ${formatRupiah(total)}

      </div>

      <script>
        window.onload = function () {
          window.print();

          setTimeout(function () {
            window.close();
          }, 500);
        };
      <\/script>

    </body>

    </html>
  `);

  printWindow.document.close();
}


/* =========================================================
   MODAL CLICK OUTSIDE
   ========================================================= */

function setupModalEvents() {
  const menuModal =
    $("menuModal");

  const resetModal =
    $("resetModal");

  const receiptModal =
    $("receiptModal");

  if (menuModal) {
    menuModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          menuModal
        ) {
          closeMenuModal();
        }
      }
    );
  }

  if (resetModal) {
    resetModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          resetModal
        ) {
          closeResetModal();
        }
      }
    );
  }

  if (receiptModal) {
    receiptModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          receiptModal
        ) {
          closeReceiptModal();
        }
      }
    );
  }
}


/* =========================================================
   KEYBOARD
   ========================================================= */

function setupKeyboard() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeMenuModal();
        closeResetModal();
        closeReceiptModal();
      }
    }
  );
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

  /* -------------------------
     MENU
     ------------------------- */

  $("menuSearch")?.addEventListener(
    "input",
    renderMenuGrid
  );

  $("categoryFilter")?.addEventListener(
    "change",
    renderMenuGrid
  );

  $("refreshMenusBtn")?.addEventListener(
    "click",
    () => {
      loadData();
      renderMenuGrid();

      showToast(
        "Daftar menu diperbarui."
      );
    }
  );

  $("refreshMenuTableBtn")?.addEventListener(
    "click",
    () => {
      loadData();
      renderMenuTable();
      renderMenuGrid();
      renderCategoryFilter();

      showToast(
        "Data menu diperbarui."
      );
    }
  );

  $("addMenuBtn")?.addEventListener(
    "click",
    openAddMenu
  );

  $("closeMenuModal")?.addEventListener(
    "click",
    closeMenuModal
  );

  $("cancelMenuBtn")?.addEventListener(
    "click",
    closeMenuModal
  );

  $("menuForm")?.addEventListener(
    "submit",
    handleMenuSubmit
  );


  /* -------------------------
     CART
     ------------------------- */

  $("clearCartBtn")?.addEventListener(
    "click",
    clearCart
  );

  $("payment")?.addEventListener(
    "input",
    updateChange
  );

  $("saveSaleBtn")?.addEventListener(
    "click",
    saveSale
  );


  /* -------------------------
     SALES
     ------------------------- */

  $("salesDate")?.addEventListener(
    "change",
    handleSalesDateChange
  );

  $("todaySalesBtn")?.addEventListener(
    "click",
    setTodaySales
  );

  $("allSalesBtn")?.addEventListener(
    "click",
    setAllSales
  );

  $("refreshSalesBtn")?.addEventListener(
    "click",
    () => {
      loadData();
      renderSales();
      updateSalesStats();

      showToast(
        "Data penjualan diperbarui."
      );
    }
  );

  $("downloadSalesBtn")?.addEventListener(
    "click",
    downloadSalesCSV
  );

  $("printSalesBtn")?.addEventListener(
    "click",
    printSalesReport
  );


  /* -------------------------
     RESET
     ------------------------- */

  $("resetSalesBtn")?.addEventListener(
    "click",
    openResetModal
  );

  $("closeResetModal")?.addEventListener(
    "click",
    closeResetModal
  );

  $("cancelResetBtn")?.addEventListener(
    "click",
    closeResetModal
  );

  $("confirmResetBtn")?.addEventListener(
    "click",
    resetTodaySales
  );


  /* -------------------------
     RECEIPT
     ------------------------- */

  $("closeReceiptModal")?.addEventListener(
    "click",
    closeReceiptModal
  );

  $("closeReceiptBtn")?.addEventListener(
    "click",
    closeReceiptModal
  );

  $("printReceiptBtn")?.addEventListener(
    "click",
    printReceipt
  );


  /* -------------------------
     CONNECTION
     ------------------------- */

  window.addEventListener(
    "online",
    updateConnectionStatus
  );

  window.addEventListener(
    "offline",
    updateConnectionStatus
  );
}


/* =========================================================
   DEFAULT DATA
   ========================================================= */

function createDefaultMenus() {
  if (menus.length > 0) {
    return;
  }

  menus = [
    {
      id: generateId("menu"),
      name: "Nasi Goreng",
      category: "Makanan",
      price: 15000,
      createdAt:
        new Date().toISOString()
    },
    {
      id: generateId("menu"),
      name: "Mie Goreng",
      category: "Makanan",
      price: 13000,
      createdAt:
        new Date().toISOString()
    },
    {
      id: generateId("menu"),
      name: "Ayam Geprek",
      category: "Makanan",
      price: 18000,
      createdAt:
        new Date().toISOString()
    },
    {
      id: generateId("menu"),
      name: "Es Teh",
      category: "Minuman",
      price: 5000,
      createdAt:
        new Date().toISOString()
    },
    {
      id: generateId("menu"),
      name: "Es Jeruk",
      category: "Minuman",
      price: 7000,
      createdAt:
        new Date().toISOString()
    }
  ];

  saveMenus();
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {
  loadData();

  createDefaultMenus();

  setupNavigation();
  setupEvents();
  setupModalEvents();
  setupKeyboard();

  updateConnectionStatus();

  renderCategoryFilter();
  renderMenuGrid();
  renderMenuTable();

  setAllSales();

  hideLoading();

  console.log(
    "Kasir berhasil dijalankan."
  );
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init
  );
} else {
  init();
}
