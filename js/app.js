/* =========================================================
   KASIR - APP.JS
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzayanvm5sak3mvjcf_ikudaESu40WgH6Ck4mWzXeqHAinjy8CUXr8pQkudICfdUPugMQ/exec";


/* =========================================================
   STATE
   ========================================================= */

let menus = [];
let cart = [];
let sales = [];

let currentSalesDate = "";
let editingMenuId = null;


/* =========================================================
   ELEMENT HELPER
   ========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   FORMAT RUPIAH
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


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value) || 0
  );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   DATE
   ========================================================= */

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

  toast.textContent = message;

  toast.className = "toast";

  if (type) {
    toast.classList.add(type);
  }

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(action, data = {}) {
  const payload = {
    action,
    ...data
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error(
        "Response server bukan JSON. Periksa deployment Google Apps Script."
      );
    }

    if (
      result &&
      result.success === false
    ) {
      throw new Error(
        result.message || "Terjadi kesalahan pada server."
      );
    }

    return result;

  } catch (error) {
    console.error("API ERROR:", error);

    throw error;
  }
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setConnectionStatus(connected, message) {
  const dot = $("connectionDot");
  const text = $("connectionText");

  if (dot) {
    dot.classList.remove("online", "offline");

    dot.classList.add(
      connected ? "online" : "offline"
    );
  }

  if (text) {
    text.textContent =
      message ||
      (connected
        ? "Terhubung"
        : "Tidak terhubung");
  }
}


async function checkConnection() {
  try {
    await apiRequest("ping");

    setConnectionStatus(
      true,
      "Terhubung"
    );

  } catch (error) {
    console.error(error);

    setConnectionStatus(
      false,
      "Tidak terhubung"
    );
  }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initNavigation() {
  const buttons =
    document.querySelectorAll(".nav-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {

      const pageName =
        button.dataset.page;

      openPage(pageName);
    });
  });
}


function openPage(pageName) {
  document
    .querySelectorAll(".nav-btn")
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.page === pageName
      );

    });


  document
    .querySelectorAll(".page")
    .forEach((page) => {

      page.classList.toggle(
        "active",
        page.id === `page-${pageName}`
      );

    });


  if (pageName === "kasir") {
    loadMenus();
  }

  if (pageName === "penjualan") {
    loadSales();
  }

  if (pageName === "menu") {
    loadMenuTable();
  }
}


/* =========================================================
   LOAD MENU
   ========================================================= */

async function loadMenus() {
  try {
    showLoading();

    const result =
      await apiRequest("getMenus");

    menus =
      Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.menus)
          ? result.menus
          : [];

    renderCategoryFilter();
    renderMenuGrid();
    renderMenuTable();

    setConnectionStatus(
      true,
      "Terhubung"
    );

  } catch (error) {
    console.error(error);

    showToast(
      error.message ||
      "Gagal mengambil data menu.",
      "error"
    );

    setConnectionStatus(
      false,
      "Gagal terhubung"
    );

  } finally {
    hideLoading();
  }
}


/* =========================================================
   CATEGORY FILTER
   ========================================================= */

function renderCategoryFilter() {
  const select =
    $("categoryFilter");

  if (!select) return;

  const currentValue =
    select.value;

  const categories =
    [...new Set(
      menus
        .map((menu) =>
          String(
            menu.category ||
            menu.kategori ||
            ""
          ).trim()
        )
        .filter(Boolean)
    )].sort((a, b) =>
      a.localeCompare(b, "id")
    );


  select.innerHTML = `
    <option value="">
      Semua kategori
    </option>
  `;


  categories.forEach((category) => {

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
   RENDER MENU GRID
   ========================================================= */

function renderMenuGrid() {
  const grid =
    $("menuGrid");

  if (!grid) return;

  const searchInput =
    $("menuSearch");

  const categoryInput =
    $("categoryFilter");


  const search =
    String(
      searchInput?.value || ""
    )
      .trim()
      .toLowerCase();


  const category =
    categoryInput?.value || "";


  const filtered =
    menus.filter((menu) => {

      const name =
        String(
          menu.name ||
          menu.nama ||
          ""
        ).toLowerCase();

      const menuCategory =
        String(
          menu.category ||
          menu.kategori ||
          ""
        );


      const matchesSearch =
        !search ||
        name.includes(search);


      const matchesCategory =
        !category ||
        menuCategory === category;


      return (
        matchesSearch &&
        matchesCategory
      );
    });


  if (!filtered.length) {

    grid.innerHTML = `
      <div class="empty-state">
        Tidak ada menu ditemukan.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    filtered
      .map((menu) => {

        const id =
          menu.id ??
          menu.ID ??
          menu.menuId ??
          menu.menu_id;

        const name =
          menu.name ??
          menu.nama ??
          "";

        const category =
          menu.category ??
          menu.kategori ??
          "";

        const price =
          menu.price ??
          menu.harga ??
          0;


        return `
          <button
            type="button"
            class="menu-card"
            data-menu-id="${escapeHTML(id)}"
          >

            <div class="menu-card-name">
              ${escapeHTML(name)}
            </div>

            <div class="menu-card-category">
              ${escapeHTML(category || "Umum")}
            </div>

            <div class="menu-card-price">
              ${formatRupiah(price)}
            </div>

          </button>
        `;
      })
      .join("");


  grid
    .querySelectorAll(".menu-card")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.menuId;

          const menu =
            menus.find((item) =>
              String(
                item.id ??
                item.ID ??
                item.menuId ??
                item.menu_id
              ) === String(id)
            );


          if (menu) {
            addToCart(menu);
          }

        }
      );

    });
}


/* =========================================================
   SEARCH MENU
   ========================================================= */

function initMenuSearch() {
  const search =
    $("menuSearch");

  const category =
    $("categoryFilter");


  search?.addEventListener(
    "input",
    renderMenuGrid
  );


  category?.addEventListener(
    "change",
    renderMenuGrid
  );
}


/* =========================================================
   CART
   ========================================================= */

function getMenuId(menu) {
  return (
    menu.id ??
    menu.ID ??
    menu.menuId ??
    menu.menu_id
  );
}


function getMenuName(menu) {
  return (
    menu.name ??
    menu.nama ??
    ""
  );
}


function getMenuCategory(menu) {
  return (
    menu.category ??
    menu.kategori ??
    ""
  );
}


function getMenuPrice(menu) {
  return Number(
    menu.price ??
    menu.harga ??
    0
  );
}


function addToCart(menu) {
  const id =
    getMenuId(menu);

  const existing =
    cart.find(
      (item) =>
        String(item.id) === String(id)
    );


  if (existing) {
    existing.qty += 1;
  } else {

    cart.push({
      id,
      name: getMenuName(menu),
      category: getMenuCategory(menu),
      price: getMenuPrice(menu),
      qty: 1
    });

  }


  renderCart();

  showToast(
    `${getMenuName(menu)} ditambahkan`
  );
}


function changeCartQty(id, amount) {
  const item =
    cart.find(
      (cartItem) =>
        String(cartItem.id) === String(id)
    );


  if (!item) return;


  item.qty += amount;


  if (item.qty <= 0) {
    cart =
      cart.filter(
        (cartItem) =>
          String(cartItem.id) !== String(id)
      );
  }


  renderCart();
}


function removeCartItem(id) {
  cart =
    cart.filter(
      (item) =>
        String(item.id) !== String(id)
    );

  renderCart();
}


function clearCart() {
  if (!cart.length) {
    return;
  }


  if (
    !confirm(
      "Kosongkan semua isi keranjang?"
    )
  ) {
    return;
  }


  cart = [];

  const payment =
    $("payment");

  if (payment) {
    payment.value = "";
  }


  renderCart();
}


/* =========================================================
   CART TOTAL
   ========================================================= */

function getCartTotal() {
  return cart.reduce(
    (total, item) =>
      total +
      Number(item.price || 0) *
      Number(item.qty || 0),
    0
  );
}


function renderCart() {
  const container =
    $("cartItems");

  const countElement =
    $("cartItemCount");

  const totalElement =
    $("cartTotal");


  if (!container) return;


  const totalQty =
    cart.reduce(
      (total, item) =>
        total + Number(item.qty || 0),
      0
    );


  if (countElement) {
    countElement.textContent =
      `${totalQty} item`;
  }


  if (totalElement) {
    totalElement.textContent =
      formatRupiah(
        getCartTotal()
      );
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


  container.innerHTML =
    cart
      .map((item) => {

        const subtotal =
          Number(item.price || 0) *
          Number(item.qty || 0);


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


            <div class="cart-item-actions">

              <button
                type="button"
                class="qty-btn"
                data-action="minus"
                data-id="${escapeHTML(item.id)}"
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
                data-id="${escapeHTML(item.id)}"
              >
                +
              </button>

              <button
                type="button"
                class="remove-cart-btn"
                data-action="remove"
                data-id="${escapeHTML(item.id)}"
              >
                ×
              </button>

            </div>


            <div class="cart-item-subtotal">
              ${formatRupiah(subtotal)}
            </div>

          </div>
        `;
      })
      .join("");


  container
    .querySelectorAll("button")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.id;

          const action =
            button.dataset.action;


          if (action === "minus") {
            changeCartQty(id, -1);
          }

          if (action === "plus") {
            changeCartQty(id, 1);
          }

          if (action === "remove") {
            removeCartItem(id);
          }

        }
      );

    });


  updateChange();
}


/* =========================================================
   PAYMENT / CHANGE
   ========================================================= */

function updateChange() {
  const paymentInput =
    $("payment");

  const changeElement =
    $("changeAmount");


  if (!paymentInput || !changeElement) {
    return;
  }


  const payment =
    Number(paymentInput.value) || 0;

  const total =
    getCartTotal();


  const change =
    payment - total;


  changeElement.textContent =
    formatRupiah(
      change > 0 ? change : 0
    );


  if (payment > 0 && payment < total) {

    changeElement.classList.add(
      "insufficient"
    );

  } else {

    changeElement.classList.remove(
      "insufficient"
    );

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
      "Pembayaran kurang.",
      "error"
    );

    return;
  }


  const change =
    payment - total;


  const items =
    cart.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      qty: item.qty,
      subtotal:
        Number(item.price) *
        Number(item.qty)
    }));


  const transaction = {
    items,
    total,
    payment,
    change,
    date: getToday(),
    createdAt:
      new Date().toISOString()
  };


  try {

    showLoading();


    const result =
      await apiRequest(
        "saveSale",
        {
          transaction
        }
      );


    const savedSale =
      result.data ||
      result.sale ||
      transaction;


    showToast(
      "Transaksi berhasil disimpan."
    );


    cart = [];

    if ($("payment")) {
      $("payment").value = "";
    }


    renderCart();


    openReceipt(
      savedSale
    );


    await loadSales(false);


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal menyimpan transaksi.",
      "error"
    );

  } finally {

    hideLoading();

  }
}


/* =========================================================
   RECEIPT
   ========================================================= */

let currentReceipt = null;


function openReceipt(sale) {
  currentReceipt = sale;


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


  const total =
    Number(
      sale.total || 0
    );


  const payment =
    Number(
      sale.payment || 0
    );


  const change =
    Number(
      sale.change || 0
    );


  const transactionNumber =
    sale.transactionNumber ||
    sale.invoice ||
    sale.no ||
    sale.id ||
    "-";


  const date =
    sale.createdAt ||
    sale.date ||
    new Date().toISOString();


  content.innerHTML = `
    <div class="receipt">

      <div class="receipt-shop">
        KASIR
      </div>

      <div class="receipt-number">
        ${escapeHTML(transactionNumber)}
      </div>

      <div class="receipt-date">
        ${escapeHTML(formatDateTime(date))}
      </div>

      <hr>

      <div class="receipt-items">

        ${
          items
            .map((item) => {

              const subtotal =
                Number(
                  item.subtotal ??
                  (
                    Number(item.price || 0) *
                    Number(item.qty || 0)
                  )
                );


              return `
                <div class="receipt-item">

                  <div>
                    ${escapeHTML(item.name)}
                  </div>

                  <div>
                    ${item.qty} x
                    ${formatRupiah(item.price)}
                  </div>

                  <div>
                    ${formatRupiah(subtotal)}
                  </div>

                </div>
              `;

            })
            .join("")
        }

      </div>

      <hr>

      <div class="receipt-row">
        <span>Total</span>
        <strong>${formatRupiah(total)}</strong>
      </div>

      <div class="receipt-row">
        <span>Pembayaran</span>
        <span>${formatRupiah(payment)}</span>
      </div>

      <div class="receipt-row">
        <span>Kembalian</span>
        <strong>${formatRupiah(change)}</strong>
      </div>

      <hr>

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


function closeReceipt() {
  const modal =
    $("receiptModal");

  if (!modal) return;

  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  currentReceipt = null;
}


/* =========================================================
   PRINT RECEIPT
   ========================================================= */

function printReceipt() {
  const content =
    $("receiptContent");

  if (!content) return;


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=400,height=700"
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
          font-family:
            Arial,
            Helvetica,
            sans-serif;

          margin: 0;
          padding: 15px;

          color: #000;

          background: #fff;
        }

        .receipt {
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
        }

        .receipt-shop {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .receipt-number,
        .receipt-date {
          text-align: center;
          font-size: 12px;
        }

        hr {
          border: 0;
          border-top: 1px dashed #000;
          margin: 10px 0;
        }

        .receipt-item {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .receipt-item > div:last-child {
          text-align: right;
          font-weight: bold;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          margin: 5px 0;
        }

        .receipt-thanks {
          text-align: center;
          font-weight: bold;
          margin-top: 10px;
        }

        @media print {
          body {
            padding: 0;
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
   LOAD SALES
   ========================================================= */

async function loadSales(showLoader = true) {
  try {

    if (showLoader) {
      showLoading();
    }


    const result =
      await apiRequest(
        "getSales",
        {
          date: currentSalesDate || ""
        }
      );


    sales =
      Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.sales)
          ? result.sales
          : [];


    renderSalesStats();
    renderSalesTable();


    setConnectionStatus(
      true,
      "Terhubung"
    );


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal mengambil data penjualan.",
      "error"
    );


    setConnectionStatus(
      false,
      "Tidak terhubung"
    );


  } finally {

    if (showLoader) {
      hideLoading();
    }

  }
}


/* =========================================================
   SALES HELPERS
   ========================================================= */

function getSaleTotal(sale) {
  return Number(
    sale.total ??
    sale.Total ??
    sale.totalSales ??
    0
  );
}


function getSalePayment(sale) {
  return Number(
    sale.payment ??
    sale.pembayaran ??
    0
  );
}


function getSaleChange(sale) {
  return Number(
    sale.change ??
    sale.kembalian ??
    0
  );
}


function getSaleItems(sale) {
  if (Array.isArray(sale.items)) {
    return sale.items;
  }

  if (
    typeof sale.items === "string"
  ) {

    try {
      return JSON.parse(
        sale.items
      );
    } catch (error) {
      return [];
    }

  }

  return [];
}


function getSaleNumber(sale) {
  return (
    sale.transactionNumber ??
    sale.transactionNo ??
    sale.invoice ??
    sale.noTransaksi ??
    sale.id ??
    "-"
  );
}


function getSaleDate(sale) {
  return (
    sale.createdAt ??
    sale.datetime ??
    sale.date ??
    sale.tanggal ??
    ""
  );
}


/* =========================================================
   SALES STATS
   ========================================================= */

function renderSalesStats() {
  const totalTransactions =
    $("totalTransactions");

  const totalSales =
    $("totalSales");

  const averageSales =
    $("averageSales");


  const count =
    sales.length;


  const total =
    sales.reduce(
      (sum, sale) =>
        sum + getSaleTotal(sale),
      0
    );


  const average =
    count
      ? total / count
      : 0;


  if (totalTransactions) {
    totalTransactions.textContent =
      formatNumber(count);
  }


  if (totalSales) {
    totalSales.textContent =
      formatRupiah(total);
  }


  if (averageSales) {
    averageSales.textContent =
      formatRupiah(average);
  }
}


/* =========================================================
   SALES TABLE
   ========================================================= */

function renderSalesTable() {
  const tbody =
    $("salesTableBody");

  if (!tbody) return;


  if (!sales.length) {

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
    sales
      .map((sale, index) => {

        const items =
          getSaleItems(sale);


        const itemText =
          items.length
            ? items
                .map((item) =>
                  `${escapeHTML(item.name)} x${item.qty}`
                )
                .join(", ")
            : (
                sale.item ||
                sale.itemsText ||
                "-"
              );


        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHTML(
                getSaleNumber(sale)
              )}
            </td>

            <td>
              ${escapeHTML(
                formatDateTime(
                  getSaleDate(sale)
                )
              )}
            </td>

            <td>
              ${itemText}
            </td>

            <td class="text-right">
              ${formatRupiah(
                getSaleTotal(sale)
              )}
            </td>

            <td class="text-right">
              ${formatRupiah(
                getSalePayment(sale)
              )}
            </td>

            <td class="text-right">
              ${formatRupiah(
                getSaleChange(sale)
              )}
            </td>

            <td>

              <button
                type="button"
                class="btn btn-light btn-small"
                data-sale-index="${index}"
              >
                Struk
              </button>

            </td>

          </tr>
        `;
      })
      .join("");


  tbody
    .querySelectorAll(
      "[data-sale-index]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.saleIndex
            );

          const sale =
            sales[index];


          if (sale) {
            openReceipt(sale);
          }

        }
      );

    });
}


/* =========================================================
   SALES FILTER
   ========================================================= */

function initSalesFilter() {
  const dateInput =
    $("salesDate");


  dateInput?.addEventListener(
    "change",
    async () => {

      currentSalesDate =
        dateInput.value || "";

      await loadSales();

    }
  );
}


function setTodaySales() {
  const today =
    getToday();

  currentSalesDate =
    today;


  const dateInput =
    $("salesDate");

  if (dateInput) {
    dateInput.value =
      today;
  }


  loadSales();
}


function setAllSales() {
  currentSalesDate = "";


  const dateInput =
    $("salesDate");

  if (dateInput) {
    dateInput.value = "";
  }


  loadSales();
}


/* =========================================================
   MENU TABLE
   ========================================================= */

function renderMenuTable() {
  const tbody =
    $("menuTableBody");

  if (!tbody) return;


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


  tbody.innerHTML =
    menus
      .map((menu, index) => {

        const id =
          getMenuId(menu);

        const name =
          getMenuName(menu);

        const category =
          getMenuCategory(menu);

        const price =
          getMenuPrice(menu);


        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHTML(name)}
            </td>

            <td>
              ${escapeHTML(
                category || "-"
              )}
            </td>

            <td class="text-right">
              ${formatRupiah(price)}
            </td>

            <td>

              <button
                type="button"
                class="btn btn-light btn-small"
                data-edit-menu="${escapeHTML(id)}"
              >
                Edit
              </button>

              <button
                type="button"
                class="btn btn-danger btn-small"
                data-delete-menu="${escapeHTML(id)}"
              >
                Hapus
              </button>

            </td>

          </tr>
        `;
      })
      .join("");


  tbody
    .querySelectorAll(
      "[data-edit-menu]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.editMenu;

          openEditMenu(id);

        }
      );

    });


  tbody
    .querySelectorAll(
      "[data-delete-menu]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.deleteMenu;

          deleteMenu(id);

        }
      );

    });
}


/* =========================================================
   MENU MODAL
   ========================================================= */

function openMenuModal(menu = null) {
  const modal =
    $("menuModal");

  if (!modal) return;


  editingMenuId =
    menu
      ? getMenuId(menu)
      : null;


  const title =
    $("menuModalTitle");

  const idInput =
    $("menuId");

  const nameInput =
    $("menuName");

  const categoryInput =
    $("menuCategory");

  const priceInput =
    $("menuPrice");


  if (menu) {

    if (title) {
      title.textContent =
        "Edit Menu";
    }


    if (idInput) {
      idInput.value =
        getMenuId(menu);
    }


    if (nameInput) {
      nameInput.value =
        getMenuName(menu);
    }


    if (categoryInput) {
      categoryInput.value =
        getMenuCategory(menu);
    }


    if (priceInput) {
      priceInput.value =
        getMenuPrice(menu);
    }

  } else {

    if (title) {
      title.textContent =
        "Tambah Menu";
    }


    if (idInput) {
      idInput.value = "";
    }


    if (nameInput) {
      nameInput.value = "";
    }


    if (categoryInput) {
      categoryInput.value = "";
    }


    if (priceInput) {
      priceInput.value = "";
    }

  }


  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  setTimeout(() => {
    nameInput?.focus();
  }, 100);
}


function closeMenuModal() {
  const modal =
    $("menuModal");

  if (!modal) return;


  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  editingMenuId = null;
}


/* =========================================================
   EDIT MENU
   ========================================================= */

function openEditMenu(id) {
  const menu =
    menus.find(
      (item) =>
        String(
          getMenuId(item)
        ) === String(id)
    );


  if (!menu) {

    showToast(
      "Menu tidak ditemukan.",
      "error"
    );

    return;
  }


  openMenuModal(menu);
}


/* =========================================================
   SAVE MENU
   ========================================================= */

async function saveMenu(event) {
  event.preventDefault();


  const id =
    $("menuId")?.value || "";


  const name =
    $("menuName")?.value.trim() || "";


  const category =
    $("menuCategory")?.value.trim() || "";


  const price =
    Number(
      $("menuPrice")?.value || 0
    );


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


  const menu = {
    id,
    name,
    category,
    price
  };


  try {

    showLoading();


    await apiRequest(
      id
        ? "updateMenu"
        : "addMenu",
      {
        menu
      }
    );


    closeMenuModal();


    showToast(
      id
        ? "Menu berhasil diubah."
        : "Menu berhasil ditambahkan."
    );


    await loadMenus();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal menyimpan menu.",
      "error"
    );

  } finally {

    hideLoading();

  }
}


/* =========================================================
   DELETE MENU
   ========================================================= */

async function deleteMenu(id) {
  const menu =
    menus.find(
      (item) =>
        String(
          getMenuId(item)
        ) === String(id)
    );


  if (!menu) {
    return;
  }


  const confirmed =
    confirm(
      `Hapus menu "${getMenuName(menu)}"?`
    );


  if (!confirmed) {
    return;
  }


  try {

    showLoading();


    await apiRequest(
      "deleteMenu",
      {
        id
      }
    );


    showToast(
      "Menu berhasil dihapus."
    );


    cart =
      cart.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );


    renderCart();


    await loadMenus();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal menghapus menu.",
      "error"
    );

  } finally {

    hideLoading();

  }
}


/* =========================================================
   RESET SALES MODAL
   ========================================================= */

function openResetModal() {
  const modal =
    $("resetModal");

  if (!modal) return;


  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeResetModal() {
  const modal =
    $("resetModal");

  if (!modal) return;


  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}


/* =========================================================
   RESET TODAY
   ========================================================= */

async function resetTodaySales() {
  try {

    showLoading();


    await apiRequest(
      "resetTodaySales",
      {
        date: getToday()
      }
    );


    closeResetModal();


    showToast(
      "Penjualan hari ini berhasil direset."
    );


    await loadSales();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal mereset penjualan.",
      "error"
    );

  } finally {

    hideLoading();

  }
}


/* =========================================================
   DOWNLOAD CSV
   ========================================================= */

function downloadSalesCSV() {
  if (!sales.length) {

    showToast(
      "Tidak ada data penjualan.",
      "error"
    );

    return;
  }


  const rows = [];


  rows.push([
    "No",
    "No. Transaksi",
    "Tanggal",
    "Item",
    "Total",
    "Pembayaran",
    "Kembalian"
  ]);


  sales.forEach((sale, index) => {

    const items =
      getSaleItems(sale);


    const itemText =
      items.length
        ? items
            .map(
              (item) =>
                `${item.name} x${item.qty}`
            )
            .join(" | ")
        : (
            sale.item ||
            sale.itemsText ||
            ""
          );


    rows.push([
      index + 1,
      getSaleNumber(sale),
      formatDateTime(
        getSaleDate(sale)
      ),
      itemText,
      getSaleTotal(sale),
      getSalePayment(sale),
      getSaleChange(sale)
    ]);

  });


  const csv =
    rows
      .map((row) =>
        row
          .map((value) => {

            const text =
              String(
                value ?? ""
              );

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;

          })
          .join(",")
      )
      .join("\n");


  const blob =
    new Blob(
      [
        "\uFEFF" + csv
      ],
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
    `penjualan-${getToday()}.csv`;


  document.body.appendChild(link);

  link.click();

  link.remove();


  URL.revokeObjectURL(url);


  showToast(
    "CSV berhasil dibuat."
  );
}


/* =========================================================
   PRINT SALES REPORT
   ========================================================= */

function printSalesReport() {
  if (!sales.length) {

    showToast(
      "Tidak ada data penjualan.",
      "error"
    );

    return;
  }


  const total =
    sales.reduce(
      (sum, sale) =>
        sum + getSaleTotal(sale),
      0
    );


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1000,height=800"
    );


  if (!printWindow) {

    showToast(
      "Popup print diblokir browser.",
      "error"
    );

    return;
  }


  const rows =
    sales
      .map((sale, index) => {

        const items =
          getSaleItems(sale);


        const itemText =
          items.length
            ? items
                .map(
                  (item) =>
                    `${escapeHTML(item.name)} x${item.qty}`
                )
                .join("<br>")
            : "-";


        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHTML(
                getSaleNumber(sale)
              )}
            </td>

            <td>
              ${escapeHTML(
                formatDateTime(
                  getSaleDate(sale)
                )
              )}
            </td>

            <td>
              ${itemText}
            </td>

            <td class="right">
              ${formatRupiah(
                getSaleTotal(sale)
              )}
            </td>

            <td class="right">
              ${formatRupiah(
                getSalePayment(sale)
              )}
            </td>

            <td class="right">
              ${formatRupiah(
                getSaleChange(sale)
              )}
            </td>

          </tr>
        `;
      })
      .join("");


  printWindow.document.write(`
    <!DOCTYPE html>

    <html lang="id">

    <head>

      <meta charset="UTF-8">

      <title>Laporan Penjualan</title>

      <style>

        body {
          font-family:
            Arial,
            Helvetica,
            sans-serif;

          color: #111;

          padding: 25px;
        }

        h1 {
          margin-bottom: 5px;
        }

        .date {
          color: #666;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          border: 1px solid #ccc;
          padding: 8px;
          vertical-align: top;
        }

        th {
          background: #f3f3f3;
        }

        .right {
          text-align: right;
        }

        .total {
          margin-top: 20px;
          text-align: right;
          font-size: 18px;
          font-weight: bold;
        }

        @media print {
          body {
            padding: 0;
          }
        }

      </style>

    </head>

    <body>

      <h1>
        Laporan Penjualan
      </h1>

      <div class="date">
        ${currentSalesDate
          ? `Tanggal: ${currentSalesDate}`
          : "Semua transaksi"}
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

      <div class="total">
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

function initEvents() {

  /* CART */

  $("clearCartBtn")
    ?.addEventListener(
      "click",
      clearCart
    );


  $("payment")
    ?.addEventListener(
      "input",
      updateChange
    );


  $("saveSaleBtn")
    ?.addEventListener(
      "click",
      saveSale
    );


  /* MENU */

  $("refreshMenusBtn")
    ?.addEventListener(
      "click",
      loadMenus
    );


  $("refreshMenuTableBtn")
    ?.addEventListener(
      "click",
      loadMenus
    );


  $("addMenuBtn")
    ?.addEventListener(
      "click",
      () =>
        openMenuModal()
    );


  $("menuForm")
    ?.addEventListener(
      "submit",
      saveMenu
    );


  $("closeMenuModal")
    ?.addEventListener(
      "click",
      closeMenuModal
    );


  $("cancelMenuBtn")
    ?.addEventListener(
      "click",
      closeMenuModal
    );


  /* SALES */

  $("todaySalesBtn")
    ?.addEventListener(
      "click",
      setTodaySales
    );


  $("allSalesBtn")
    ?.addEventListener(
      "click",
      setAllSales
    );


  $("refreshSalesBtn")
    ?.addEventListener(
      "click",
      () => loadSales()
    );


  $("downloadSalesBtn")
    ?.addEventListener(
      "click",
      downloadSalesCSV
    );


  $("printSalesBtn")
    ?.addEventListener(
      "click",
      printSalesReport
    );


  $("resetSalesBtn")
    ?.addEventListener(
      "click",
      openResetModal
    );


  $("closeResetModal")
    ?.addEventListener(
      "click",
      closeResetModal
    );


  $("cancelResetBtn")
    ?.addEventListener(
      "click",
      closeResetModal
    );


  $("confirmResetBtn")
    ?.addEventListener(
      "click",
      resetTodaySales
    );


  /* RECEIPT */

  $("closeReceiptModal")
    ?.addEventListener(
      "click",
      closeReceipt
    );


  $("closeReceiptBtn")
    ?.addEventListener(
      "click",
      closeReceipt
    );


  $("printReceiptBtn")
    ?.addEventListener(
      "click",
      printReceipt
    );


  /* SALES DATE */

  initSalesFilter();

}


/* =========================================================
   MODAL CLICK OUTSIDE
   ========================================================= */

function initModalOutsideClick() {

  document
    .querySelectorAll(".modal")
    .forEach((modal) => {

      modal.addEventListener(
        "click",
        (event) => {

          if (
            event.target !== modal
          ) {
            return;
          }


          if (
            modal.id ===
            "menuModal"
          ) {
            closeMenuModal();
          }


          if (
            modal.id ===
            "resetModal"
          ) {
            closeResetModal();
          }


          if (
            modal.id ===
            "receiptModal"
          ) {
            closeReceipt();
          }

        }
      );

    });

}


/* =========================================================
   ESC KEY
   ========================================================= */

function initEscapeKey() {
  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !==
        "Escape"
      ) {
        return;
      }


      closeMenuModal();

      closeResetModal();

      closeReceipt();

    }
  );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initApp() {

  console.log(
    "KASIR APP STARTED"
  );


  console.log(
    "API URL:",
    API_URL
  );


  initNavigation();

  initEvents();

  initMenuSearch();

  initModalOutsideClick();

  initEscapeKey();


  const salesDate =
    $("salesDate");

  if (salesDate) {
    salesDate.value =
      getToday();
  }


  currentSalesDate =
    getToday();


  renderCart();


  await checkConnection();


  await loadMenus();


  await loadSales(false);


  console.log(
    "KASIR APP READY"
  );
}


/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initApp
);
