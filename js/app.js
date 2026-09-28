/* =========================================================
   KASIR - APP.JS
   Data tersimpan di Google Sheet melalui Google Apps Script
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzHWZpR2WsKULMdbqv6mn64rI8E7R-NZ_BDEVWx6NdmVmMBRHA1Kg3_YuhGWCHmMgKWmQ/exec";


/* =========================================================
   STATE
   ========================================================= */

let menus = [];
let sales = [];
let cart = [];

let currentSalesFilter = "all";
let editingMenuId = null;
let currentReceipt = null;


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   FORMAT RUPIAH
   ========================================================= */

function formatRupiah(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(number);
}


/* =========================================================
   DATE HELPER
   ========================================================= */

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function normalizeDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.substring(0, 10);
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).substring(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(action, data = {}) {
  try {
    showLoading(true);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        ...data
      })
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error(
        "Respons Google Apps Script bukan JSON."
      );
    }

    if (!result.success) {
      throw new Error(
        result.message || "Terjadi kesalahan pada server."
      );
    }

    return result;

  } catch (error) {
    console.error("API ERROR:", error);

    showToast(
      error.message || "Gagal terhubung ke Google Sheet.",
      "error"
    );

    throw error;

  } finally {
    showLoading(false);
  }
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setConnectionStatus(connected, text) {
  const dot = $("connectionDot");
  const connectionText = $("connectionText");

  if (!dot || !connectionText) return;

  dot.classList.remove(
    "connected",
    "disconnected"
  );

  if (connected) {
    dot.classList.add("connected");
    connectionText.textContent =
      text || "Terhubung";
  } else {
    dot.classList.add("disconnected");
    connectionText.textContent =
      text || "Tidak terhubung";
  }
}


async function checkConnection() {
  try {
    await apiRequest("ping");

    setConnectionStatus(
      true,
      "Terhubung ke Google Sheet"
    );

  } catch (error) {
    setConnectionStatus(
      false,
      "Tidak terhubung"
    );
  }
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(show) {
  const loading = $("loading");

  if (!loading) return;

  loading.classList.toggle("show", show);
  loading.setAttribute(
    "aria-hidden",
    show ? "false" : "true"
  );
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

  if (type) {
    toast.classList.add(type);
  }

  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const pageName = button.dataset.page;

      buttons.forEach(btn => {
        btn.classList.remove("active");
      });

      button.classList.add("active");

      pages.forEach(page => {
        page.classList.remove("active");
      });

      const targetPage =
        $(`page-${pageName}`);

      if (targetPage) {
        targetPage.classList.add("active");
      }

      if (pageName === "penjualan") {
        loadSales();
      }

      if (pageName === "menu") {
        renderMenuTable();
      }

      if (pageName === "kasir") {
        renderMenus();
      }
    });
  });
}


/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadAllData() {
  try {
    await Promise.all([
      loadMenus(),
      loadSales()
    ]);

    setConnectionStatus(
      true,
      "Terhubung ke Google Sheet"
    );

  } catch (error) {
    setConnectionStatus(
      false,
      "Tidak terhubung"
    );
  }
}


/* =========================================================
   LOAD MENUS
   ========================================================= */

async function loadMenus() {
  const result = await apiRequest("getMenus");

  menus = Array.isArray(result.data)
    ? result.data
    : [];

  menus = menus.map(menu => ({
    id:
      menu.id ??
      menu.ID ??
      menu.menuId ??
      "",
    name:
      menu.name ??
      menu.nama ??
      menu.Nama ??
      "",
    category:
      menu.category ??
      menu.kategori ??
      menu.Kategori ??
      "",
    price:
      Number(
        menu.price ??
        menu.harga ??
        menu.Harga ??
        0
      )
  }));

  populateCategories();
  renderMenus();
  renderMenuTable();
}


/* =========================================================
   LOAD SALES
   ========================================================= */

async function loadSales() {
  const result = await apiRequest("getSales");

  sales = Array.isArray(result.data)
    ? result.data
    : [];

  sales = sales.map(sale => ({
    id:
      sale.id ??
      sale.ID ??
      sale.saleId ??
      "",

    transactionId:
      sale.transactionId ??
      sale.noTransaksi ??
      sale.no_transaksi ??
      sale.NoTransaksi ??
      "",

    date:
      normalizeDate(
        sale.date ??
        sale.tanggal ??
        sale.Tanggal ??
        ""
      ),

    items:
      sale.items ??
      sale.item ??
      sale.Item ??
      "",

    total:
      Number(
        sale.total ??
        sale.Total ??
        0
      ),

    payment:
      Number(
        sale.payment ??
        sale.pembayaran ??
        sale.Pembayaran ??
        0
      ),

    change:
      Number(
        sale.change ??
        sale.kembalian ??
        sale.Kembalian ??
        0
      ),

    createdAt:
      sale.createdAt ??
      sale.waktu ??
      sale.timestamp ??
      ""
  }));

  renderSales();
}


/* =========================================================
   CATEGORY
   ========================================================= */

function populateCategories() {
  const select = $("categoryFilter");

  if (!select) return;

  const currentValue = select.value;

  const categories = [
    ...new Set(
      menus
        .map(menu => String(menu.category || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, "id")
  );

  select.innerHTML = `
    <option value="">Semua kategori</option>
  `;

  categories.forEach(category => {
    const option =
      document.createElement("option");

    option.value = category;
    option.textContent = category;

    select.appendChild(option);
  });

  if (
    categories.includes(currentValue)
  ) {
    select.value = currentValue;
  }
}


/* =========================================================
   RENDER MENU KASIR
   ========================================================= */

function renderMenus() {
  const grid = $("menuGrid");

  if (!grid) return;

  const search =
    ($("menuSearch")?.value || "")
      .trim()
      .toLowerCase();

  const category =
    $("categoryFilter")?.value || "";

  const filteredMenus = menus.filter(menu => {
    const matchSearch =
      !search ||
      String(menu.name)
        .toLowerCase()
        .includes(search);

    const matchCategory =
      !category ||
      menu.category === category;

    return matchSearch && matchCategory;
  });

  grid.innerHTML = "";

  if (!filteredMenus.length) {
    grid.innerHTML = `
      <div class="empty-state">
        Menu tidak ditemukan.
      </div>
    `;

    return;
  }

  filteredMenus.forEach(menu => {
    const card =
      document.createElement("button");

    card.type = "button";
    card.className = "menu-card";

    card.innerHTML = `
      <div class="menu-card-name">
        ${escapeHtml(menu.name)}
      </div>

      <div class="menu-card-category">
        ${escapeHtml(menu.category || "Umum")}
      </div>

      <div class="menu-card-price">
        ${formatRupiah(menu.price)}
      </div>
    `;

    card.addEventListener("click", () => {
      addToCart(menu);
    });

    grid.appendChild(card);
  });
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   CART
   ========================================================= */

function addToCart(menu) {
  const existing =
    cart.find(item =>
      String(item.id) === String(menu.id)
    );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: menu.id,
      name: menu.name,
      category: menu.category,
      price: Number(menu.price) || 0,
      qty: 1
    });
  }

  renderCart();
}


function removeFromCart(id) {
  cart = cart.filter(item =>
    String(item.id) !== String(id)
  );

  renderCart();
}


function decreaseCartItem(id) {
  const item =
    cart.find(item =>
      String(item.id) === String(id)
    );

  if (!item) return;

  item.qty -= 1;

  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }

  renderCart();
}


function increaseCartItem(id) {
  const item =
    cart.find(item =>
      String(item.id) === String(id)
    );

  if (!item) return;

  item.qty += 1;

  renderCart();
}


function clearCart() {
  if (!cart.length) return;

  cart = [];

  renderCart();

  showToast(
    "Keranjang dikosongkan.",
    "success"
  );
}


/* =========================================================
   CART TOTAL
   ========================================================= */

function getCartTotal() {
  return cart.reduce(
    (total, item) =>
      total +
      (Number(item.price) || 0) *
      (Number(item.qty) || 0),
    0
  );
}


function renderCart() {
  const container = $("cartItems");

  if (!container) return;

  container.innerHTML = "";

  const itemCount =
    cart.reduce(
      (total, item) =>
        total + Number(item.qty || 0),
      0
    );

  const countElement =
    $("cartItemCount");

  if (countElement) {
    countElement.textContent =
      `${itemCount} item`;
  }

  const total =
    getCartTotal();

  const totalElement =
    $("cartTotal");

  if (totalElement) {
    totalElement.textContent =
      formatRupiah(total);
  }

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-state">
        Keranjang masih kosong.
      </div>
    `;

    updateChange();

    return;
  }

  cart.forEach(item => {
    const row =
      document.createElement("div");

    row.className = "cart-item";

    row.innerHTML = `
      <div class="cart-item-info">

        <div class="cart-item-name">
          ${escapeHtml(item.name)}
        </div>

        <div class="cart-item-price">
          ${formatRupiah(item.price)}
        </div>

      </div>

      <div class="cart-item-controls">

        <button
          type="button"
          class="qty-btn"
          data-action="minus"
        >
          −
        </button>

        <span class="cart-item-qty">
          ${item.qty}
        </span>

        <button
          type="button"
          class="qty-btn"
          data-action="plus"
        >
          +
        </button>

      </div>

      <div class="cart-item-subtotal">
        ${formatRupiah(
          item.price * item.qty
        )}
      </div>
    `;

    row
      .querySelector('[data-action="minus"]')
      .addEventListener("click", () => {
        decreaseCartItem(item.id);
      });

    row
      .querySelector('[data-action="plus"]')
      .addEventListener("click", () => {
        increaseCartItem(item.id);
      });

    container.appendChild(row);
  });

  updateChange();
}


/* =========================================================
   PAYMENT / CHANGE
   ========================================================= */

function updateChange() {
  const payment =
    Number(
      $("payment")?.value || 0
    );

  const total =
    getCartTotal();

  const change =
    Math.max(
      0,
      payment - total
    );

  const element =
    $("changeAmount");

  if (element) {
    element.textContent =
      formatRupiah(change);
  }
}


/* =========================================================
   SAVE SALE
   ========================================================= */

async function saveSale() {
  if (!cart.length) {
    showToast(
      "Keranjang masih kosong.",
      "error"
    );

    return;
  }

  const total =
    getCartTotal();

  const payment =
    Number(
      $("payment")?.value || 0
    );

  if (payment < total) {
    showToast(
      "Pembayaran masih kurang.",
      "error"
    );

    return;
  }

  const change =
    payment - total;

  const saleItems =
    cart.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      qty: item.qty,
      subtotal:
        item.price * item.qty
    }));

  try {
    const result =
      await apiRequest(
        "saveSale",
        {
          date: getToday(),
          items: saleItems,
          total,
          payment,
          change
        }
      );

    const savedSale =
      result.data || {
        transactionId:
          generateTransactionId(),
        date: getToday(),
        items: saleItems,
        total,
        payment,
        change
      };

    currentReceipt = {
      ...savedSale,
      total,
      payment,
      change,
      items: saleItems
    };

    cart = [];

    if ($("payment")) {
      $("payment").value = "";
    }

    renderCart();

    await loadSales();

    openReceiptModal(
      currentReceipt
    );

    showToast(
      "Transaksi berhasil disimpan.",
      "success"
    );

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   TRANSACTION ID
   ========================================================= */

function generateTransactionId() {
  const now = new Date();

  const date =
    now.getFullYear() +
    String(now.getMonth() + 1)
      .padStart(2, "0") +
    String(now.getDate())
      .padStart(2, "0");

  const time =
    String(now.getHours())
      .padStart(2, "0") +
    String(now.getMinutes())
      .padStart(2, "0") +
    String(now.getSeconds())
      .padStart(2, "0");

  return `TRX-${date}-${time}`;
}


/* =========================================================
   SALES FILTER
   ========================================================= */

function getFilteredSales() {
  if (currentSalesFilter === "today") {
    const today = getToday();

    return sales.filter(sale =>
      normalizeDate(sale.date) === today
    );
  }

  if (currentSalesFilter === "date") {
    const date =
      $("salesDate")?.value || "";

    if (!date) {
      return sales;
    }

    return sales.filter(sale =>
      normalizeDate(sale.date) === date
    );
  }

  return sales;
}


/* =========================================================
   RENDER SALES
   ========================================================= */

function renderSales() {
  const tbody =
    $("salesTableBody");

  if (!tbody) return;

  const filteredSales =
    getFilteredSales();

  tbody.innerHTML = "";

  updateSalesStats(filteredSales);

  if (!filteredSales.length) {
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

  filteredSales.forEach((sale, index) => {
    const row =
      document.createElement("tr");

    const itemText =
      getSaleItemsText(sale.items);

    row.innerHTML = `
      <td>
        ${index + 1}
      </td>

      <td>
        ${escapeHtml(
          sale.transactionId || "-"
        )}
      </td>

      <td>
        ${escapeHtml(
          formatDate(sale.date)
        )}
      </td>

      <td>
        ${escapeHtml(itemText)}
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
            data-action="receipt"
          >
            Struk
          </button>

          <button
            type="button"
            class="btn btn-danger btn-small"
            data-action="delete"
          >
            Hapus
          </button>

        </div>

      </td>
    `;

    row
      .querySelector(
        '[data-action="receipt"]'
      )
      .addEventListener(
        "click",
        () => {
          openReceiptModal(
            sale
          );
        }
      );

    row
      .querySelector(
        '[data-action="delete"]'
      )
      .addEventListener(
        "click",
        () => {
          deleteSale(sale);
        }
      );

    tbody.appendChild(row);
  });
}


/* =========================================================
   SALES ITEMS TEXT
   ========================================================= */

function getSaleItemsText(items) {
  if (Array.isArray(items)) {
    return items
      .map(item =>
        `${item.name || "-"} x${item.qty || 1}`
      )
      .join(", ");
  }

  if (typeof items === "string") {
    try {
      const parsed =
        JSON.parse(items);

      if (Array.isArray(parsed)) {
        return parsed
          .map(item =>
            `${item.name || "-"} x${item.qty || 1}`
          )
          .join(", ");
      }
    } catch (error) {
      return items;
    }

    return items;
  }

  return "-";
}


/* =========================================================
   SALES STATISTICS
   ========================================================= */

function updateSalesStats(list) {
  const totalTransactions =
    list.length;

  const totalSales =
    list.reduce(
      (sum, sale) =>
        sum +
        (Number(sale.total) || 0),
      0
    );

  const average =
    totalTransactions
      ? totalSales / totalTransactions
      : 0;

  if ($("totalTransactions")) {
    $("totalTransactions").textContent =
      totalTransactions;
  }

  if ($("totalSales")) {
    $("totalSales").textContent =
      formatRupiah(totalSales);
  }

  if ($("averageSales")) {
    $("averageSales").textContent =
      formatRupiah(average);
  }
}


/* =========================================================
   DELETE SALE
   ========================================================= */

async function deleteSale(sale) {
  const confirmed =
    confirm(
      `Hapus transaksi ${sale.transactionId || ""}?`
    );

  if (!confirmed) return;

  try {
    await apiRequest(
      "deleteSale",
      {
        id: sale.id,
        transactionId:
          sale.transactionId
      }
    );

    showToast(
      "Transaksi berhasil dihapus.",
      "success"
    );

    await loadSales();

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   RESET SALES TODAY
   ========================================================= */

async function resetSalesToday() {
  const confirmed =
    confirm(
      "Yakin ingin menghapus semua transaksi hari ini?"
    );

  if (!confirmed) return;

  try {
    await apiRequest(
      "resetTodaySales",
      {
        date: getToday()
      }
    );

    closeModal("resetModal");

    showToast(
      "Penjualan hari ini berhasil direset.",
      "success"
    );

    await loadSales();

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {
  const date =
    normalizeDate(value);

  if (!date) return "-";

  const parts =
    date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


/* =========================================================
   MENU TABLE
   ========================================================= */

function renderMenuTable() {
  const tbody =
    $("menuTableBody");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!menus.length) {
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

  menus.forEach((menu, index) => {
    const row =
      document.createElement("tr");

    row.innerHTML = `
      <td>
        ${index + 1}
      </td>

      <td>
        ${escapeHtml(menu.name)}
      </td>

      <td>
        ${escapeHtml(
          menu.category || "-"
        )}
      </td>

      <td class="text-right">
        ${formatRupiah(menu.price)}
      </td>

      <td>

        <div class="table-actions">

          <button
            type="button"
            class="btn btn-light btn-small"
            data-action="edit"
          >
            Edit
          </button>

          <button
            type="button"
            class="btn btn-danger btn-small"
            data-action="delete"
          >
            Hapus
          </button>

        </div>

      </td>
    `;

    row
      .querySelector(
        '[data-action="edit"]'
      )
      .addEventListener(
        "click",
        () => {
          openMenuModal(menu);
        }
      );

    row
      .querySelector(
        '[data-action="delete"]'
      )
      .addEventListener(
        "click",
        () => {
          deleteMenu(menu);
        }
      );

    tbody.appendChild(row);
  });
}


/* =========================================================
   ADD / EDIT MENU MODAL
   ========================================================= */

function openMenuModal(menu = null) {
  const modal =
    $("menuModal");

  if (!modal) return;

  editingMenuId =
    menu ? menu.id : null;

  if (menu) {
    $("menuModalTitle").textContent =
      "Edit Menu";

    $("menuId").value =
      menu.id ?? "";

    $("menuName").value =
      menu.name ?? "";

    $("menuCategory").value =
      menu.category ?? "";

    $("menuPrice").value =
      menu.price ?? "";

  } else {
    $("menuModalTitle").textContent =
      "Tambah Menu";

    $("menuId").value = "";
    $("menuName").value = "";
    $("menuCategory").value = "";
    $("menuPrice").value = "";
  }

  openModal("menuModal");

  setTimeout(() => {
    $("menuName")?.focus();
  }, 100);
}


async function saveMenu(event) {
  event.preventDefault();

  const name =
    $("menuName")
      ?.value
      .trim();

  const category =
    $("menuCategory")
      ?.value
      .trim();

  const price =
    Number(
      $("menuPrice")?.value || 0
    );

  const id =
    $("menuId")?.value ||
    editingMenuId ||
    "";

  if (!name) {
    showToast(
      "Nama menu wajib diisi.",
      "error"
    );

    return;
  }

  if (price < 0) {
    showToast(
      "Harga tidak valid.",
      "error"
    );

    return;
  }

  try {
    if (id) {
      await apiRequest(
        "updateMenu",
        {
          id,
          name,
          category,
          price
        }
      );

      showToast(
        "Menu berhasil diperbarui.",
        "success"
      );

    } else {
      await apiRequest(
        "addMenu",
        {
          name,
          category,
          price
        }
      );

      showToast(
        "Menu berhasil ditambahkan.",
        "success"
      );
    }

    closeModal("menuModal");

    editingMenuId = null;

    await loadMenus();

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   DELETE MENU
   ========================================================= */

async function deleteMenu(menu) {
  const confirmed =
    confirm(
      `Hapus menu "${menu.name}"?`
    );

  if (!confirmed) return;

  try {
    await apiRequest(
      "deleteMenu",
      {
        id: menu.id
      }
    );

    cart =
      cart.filter(item =>
        String(item.id) !==
        String(menu.id)
      );

    renderCart();

    showToast(
      "Menu berhasil dihapus.",
      "success"
    );

    await loadMenus();

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   MODAL HELPER
   ========================================================= */

function openModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}


/* =========================================================
   RECEIPT
   ========================================================= */

function openReceiptModal(sale) {
  currentReceipt = sale;

  const content =
    $("receiptContent");

  if (!content) return;

  const items =
    parseReceiptItems(
      sale.items
    );

  const transactionId =
    sale.transactionId ||
    sale.noTransaksi ||
    "-";

  const date =
    sale.date ||
    getToday();

  let itemsHtml = "";

  if (items.length) {
    itemsHtml = items
      .map(item => {
        const subtotal =
          Number(item.subtotal) ||
          (
            Number(item.price || 0) *
            Number(item.qty || 0)
          );

        return `
          <div class="receipt-item">

            <div>
              ${escapeHtml(
                item.name || "-"
              )}
              x${item.qty || 1}
            </div>

            <div>
              ${formatRupiah(subtotal)}
            </div>

          </div>
        `;
      })
      .join("");
  } else {
    itemsHtml = `
      <div class="receipt-item">
        <div>
          ${escapeHtml(
            getSaleItemsText(
              sale.items
            )
          )}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="receipt">

      <div class="receipt-store">
        KASIR
      </div>

      <div class="receipt-info">
        <div>
          No. Transaksi
        </div>

        <div>
          ${escapeHtml(transactionId)}
        </div>
      </div>

      <div class="receipt-info">
        <div>
          Tanggal
        </div>

        <div>
          ${escapeHtml(
            formatDate(date)
          )}
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-items">
        ${itemsHtml}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-total-row">
        <span>
          Total
        </span>

        <strong>
          ${formatRupiah(
            sale.total
          )}
        </strong>
      </div>

      <div class="receipt-info">
        <div>
          Pembayaran
        </div>

        <div>
          ${formatRupiah(
            sale.payment
          )}
        </div>
      </div>

      <div class="receipt-info">
        <div>
          Kembalian
        </div>

        <div>
          ${formatRupiah(
            sale.change
          )}
        </div>
      </div>

      <div class="receipt-footer">
        Terima kasih
      </div>

    </div>
  `;

  openModal("receiptModal");
}


function parseReceiptItems(items) {
  if (Array.isArray(items)) {
    return items;
  }

  if (typeof items === "string") {
    try {
      const parsed =
        JSON.parse(items);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return [];
    }
  }

  return [];
}


/* =========================================================
   PRINT RECEIPT
   ========================================================= */

function printReceipt() {
  if (!currentReceipt) return;

  const content =
    $("receiptContent");

  if (!content) return;

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

      <title>Struk</title>

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
          max-width: 320px;
          margin: 0 auto;
          font-size: 13px;
        }

        .receipt-store {
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .receipt-info {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 6px;
        }

        .receipt-divider {
          border-top:
            1px dashed #999;
          margin: 12px 0;
        }

        .receipt-item {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
        }

        .receipt-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          margin-bottom: 10px;
        }

        .receipt-footer {
          text-align: center;
          margin-top: 20px;
        }

        @media print {
          body {
            padding: 0;
          }

          .receipt {
            max-width: none;
            width: 100%;
          }
        }

      </style>

    </head>

    <body>

      ${content.innerHTML}

    </body>

    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}


/* =========================================================
   CSV DOWNLOAD
   ========================================================= */

function downloadSalesCSV() {
  const list =
    getFilteredSales();

  if (!list.length) {
    showToast(
      "Tidak ada transaksi untuk di-download.",
      "error"
    );

    return;
  }

  const headers = [
    "No",
    "No. Transaksi",
    "Tanggal",
    "Item",
    "Total",
    "Pembayaran",
    "Kembalian"
  ];

  const rows = list.map(
    (sale, index) => [
      index + 1,
      sale.transactionId || "",
      sale.date || "",
      getSaleItemsText(
        sale.items
      ),
      sale.total || 0,
      sale.payment || 0,
      sale.change || 0
    ]
  );

  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row
        .map(value =>
          csvEscape(value)
        )
        .join(",")
    )
    .join("\n");

  const blob =
    new Blob(
      ["\ufeff" + csv],
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
}


function csvEscape(value) {
  const string =
    String(value ?? "");

  return `"${string.replace(
    /"/g,
    '""'
  )}"`;
}


/* =========================================================
   PRINT SALES REPORT
   ========================================================= */

function printSalesReport() {
  const list =
    getFilteredSales();

  if (!list.length) {
    showToast(
      "Tidak ada transaksi untuk dicetak.",
      "error"
    );

    return;
  }

  const rows =
    list
      .map(
        (sale, index) => `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(
                sale.transactionId || "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                formatDate(sale.date)
              )}
            </td>

            <td>
              ${escapeHtml(
                getSaleItemsText(
                  sale.items
                )
              )}
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
        `
      )
      .join("");

  const total =
    list.reduce(
      (sum, sale) =>
        sum +
        Number(sale.total || 0),
      0
    );

  const printWindow =
    window.open(
      "",
      "_blank"
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
        Laporan Penjualan
      </title>

      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #111;
        }

        h1 {
          margin: 0 0 8px;
        }

        p {
          margin: 0 0 20px;
          color: #555;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        th {
          background: #f5f5f5;
        }

        .right {
          text-align: right;
        }

        .summary {
          margin-top: 20px;
          font-size: 18px;
          font-weight: bold;
          text-align: right;
        }

      </style>

    </head>

    <body>

      <h1>
        Laporan Penjualan
      </h1>

      <p>
        Dicetak:
        ${new Date().toLocaleString("id-ID")}
      </p>

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
        Total Penjualan:
        ${formatRupiah(total)}
      </div>

    </body>

    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

  /* SEARCH MENU */

  $("menuSearch")
    ?.addEventListener(
      "input",
      renderMenus
    );


  /* CATEGORY */

  $("categoryFilter")
    ?.addEventListener(
      "change",
      renderMenus
    );


  /* REFRESH MENUS */

  $("refreshMenusBtn")
    ?.addEventListener(
      "click",
      loadMenus
    );


  /* CLEAR CART */

  $("clearCartBtn")
    ?.addEventListener(
      "click",
      clearCart
    );


  /* PAYMENT */

  $("payment")
    ?.addEventListener(
      "input",
      updateChange
    );


  /* SAVE SALE */

  $("saveSaleBtn")
    ?.addEventListener(
      "click",
      saveSale
    );


  /* SALES DATE */

  $("salesDate")
    ?.addEventListener(
      "change",
      () => {
        currentSalesFilter =
          $("salesDate").value
            ? "date"
            : "all";

        renderSales();
      }
    );


  /* TODAY SALES */

  $("todaySalesBtn")
    ?.addEventListener(
      "click",
      () => {
        currentSalesFilter =
          "today";

        if ($("salesDate")) {
          $("salesDate").value =
            getToday();
        }

        renderSales();
      }
    );


  /* ALL SALES */

  $("allSalesBtn")
    ?.addEventListener(
      "click",
      () => {
        currentSalesFilter =
          "all";

        if ($("salesDate")) {
          $("salesDate").value =
            "";
        }

        renderSales();
      }
    );


  /* REFRESH SALES */

  $("refreshSalesBtn")
    ?.addEventListener(
      "click",
      loadSales
    );


  /* DOWNLOAD CSV */

  $("downloadSalesBtn")
    ?.addEventListener(
      "click",
      downloadSalesCSV
    );


  /* PRINT REPORT */

  $("printSalesBtn")
    ?.addEventListener(
      "click",
      printSalesReport
    );


  /* RESET SALES */

  $("resetSalesBtn")
    ?.addEventListener(
      "click",
      () => {
        openModal("resetModal");
      }
    );


  /* CONFIRM RESET */

  $("confirmResetBtn")
    ?.addEventListener(
      "click",
      resetSalesToday
    );


  /* CANCEL RESET */

  $("cancelResetBtn")
    ?.addEventListener(
      "click",
      () => {
        closeModal("resetModal");
      }
    );


  /* CLOSE RESET */

  $("closeResetModal")
    ?.addEventListener(
      "click",
      () => {
        closeModal("resetModal");
      }
    );


  /* ADD MENU */

  $("addMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        openMenuModal();
      }
    );


  /* REFRESH MENU TABLE */

  $("refreshMenuTableBtn")
    ?.addEventListener(
      "click",
      loadMenus
    );


  /* MENU FORM */

  $("menuForm")
    ?.addEventListener(
      "submit",
      saveMenu
    );


  /* CANCEL MENU */

  $("cancelMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        closeModal("menuModal");
      }
    );


  /* CLOSE MENU */

  $("closeMenuModal")
    ?.addEventListener(
      "click",
      () => {
        closeModal("menuModal");
      }
    );


  /* CLOSE RECEIPT */

  $("closeReceiptModal")
    ?.addEventListener(
      "click",
      () => {
        closeModal("receiptModal");
      }
    );


  /* CLOSE RECEIPT BUTTON */

  $("closeReceiptBtn")
    ?.addEventListener(
      "click",
      () => {
        closeModal("receiptModal");
      }
    );


  /* PRINT RECEIPT */

  $("printReceiptBtn")
    ?.addEventListener(
      "click",
      printReceipt
    );


  /* MODAL BACKDROP */

  document
    .querySelectorAll(".modal")
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target === modal
          ) {
            modal.classList.remove(
              "show"
            );

            modal.setAttribute(
              "aria-hidden",
              "true"
            );
          }

        }
      );

    });


  /* ESCAPE */

  document.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Escape") {
        return;
      }

      document
        .querySelectorAll(
          ".modal.show"
        )
        .forEach(modal => {

          modal.classList.remove(
            "show"
          );

          modal.setAttribute(
            "aria-hidden",
            "true"
          );

        });

    }
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

  setupNavigation();

  setupEvents();

  renderCart();

  setConnectionStatus(
    false,
    "Memeriksa koneksi..."
  );

  await loadAllData();
}


/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);
