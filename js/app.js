/* =========================================================
   KASIR - APP.JS
   Google Apps Script API
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzHWZpR2WsKULMdbqv6mn64rI8E7R-NZ_BDEVWx6NdmVmMBRHA1Kg3_YuhGWCHmMgKWmQ/exec";


/* =========================================================
   STATE
   ========================================================= */

const state = {
  menus: [],
  sales: [],
  cart: [],
  currentSale: null,
  salesFilter: "all"
};


/* =========================================================
   HELPER DOM
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
    minimumFractionDigits: 0
  }).format(number);
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
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(action, data = {}) {

  try {

    const payload = {
      action,
      ...data
    };

    console.log("API REQUEST:", payload);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const text = await response.text();

    console.log("API RESPONSE:", text);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error(
        "Respons Google Apps Script bukan JSON:",
        text
      );

      throw new Error(
        "Respons Google Apps Script bukan JSON."
      );
    }

    if (
      result &&
      result.success === false
    ) {
      throw new Error(
        result.message ||
        result.error ||
        "Terjadi kesalahan pada server."
      );
    }

    return result;

  } catch (error) {

    console.error("API ERROR:", error);

    throw error;
  }
}


/* =========================================================
   CONNECTION
   ========================================================= */

async function checkConnection() {

  const dot = $("connectionDot");
  const text = $("connectionText");

  if (!dot || !text) {
    return;
  }

  text.textContent = "Memeriksa koneksi...";
  dot.classList.remove("online");
  dot.classList.remove("offline");

  try {

    await apiRequest("ping");

    dot.classList.add("online");
    text.textContent = "Terhubung";

  } catch (error) {

    dot.classList.add("offline");
    text.textContent = "Tidak terhubung";

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

  toast.textContent = message;

  toast.classList.remove(
    "show",
    "success",
    "error",
    "warning"
  );

  toast.classList.add(type);
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initNavigation() {

  const buttons = document.querySelectorAll(
    ".nav-btn"
  );

  buttons.forEach((button) => {

    button.addEventListener("click", () => {

      const pageName =
        button.dataset.page;

      switchPage(pageName);

    });

  });
}


function switchPage(pageName) {

  document.querySelectorAll(".nav-btn")
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.page === pageName
      );

    });


  document.querySelectorAll(".page")
    .forEach((page) => {

      page.classList.toggle(
        "active",
        page.id === `page-${pageName}`
      );

    });


  if (pageName === "penjualan") {
    loadSales();
  }

  if (pageName === "menu") {
    renderMenuTable();
  }

}


/* =========================================================
   LOAD ALL DATA
   ========================================================= */

async function loadAllData() {

  showLoading();

  try {

    await Promise.all([
      loadMenus(),
      loadSales()
    ]);

    renderCart();
    updateStatistics();

  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Gagal mengambil data.",
      "error"
    );

  } finally {

    hideLoading();

  }
}


/* =========================================================
   MENUS
   ========================================================= */

async function loadMenus() {

  const result =
    await apiRequest("getMenus");

  state.menus =
    normalizeArray(
      result.menus ??
      result.data ??
      result.rows ??
      []
    );

  renderMenus();
  renderMenuTable();
  renderCategoryFilter();
}


/* =========================================================
   NORMALIZE ARRAY
   ========================================================= */

function normalizeArray(data) {

  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object"
  ) {

    if (Array.isArray(data.data)) {
      return data.data;
    }

    if (Array.isArray(data.rows)) {
      return data.rows;
    }

    return Object.values(data);
  }

  return [];
}


/* =========================================================
   MENU VALUE HELPER
   ========================================================= */

function getMenuId(menu) {

  return (
    menu.id ??
    menu.ID ??
    menu.menuId ??
    menu.menu_id ??
    ""
  );
}


function getMenuName(menu) {

  return (
    menu.name ??
    menu.nama ??
    menu.Nama ??
    menu.menuName ??
    ""
  );
}


function getMenuCategory(menu) {

  return (
    menu.category ??
    menu.kategori ??
    menu.Kategori ??
    ""
  );
}


function getMenuPrice(menu) {

  return Number(
    menu.price ??
    menu.harga ??
    menu.Harga ??
    0
  );
}


/* =========================================================
   RENDER MENU
   ========================================================= */

function renderMenus() {

  const grid = $("menuGrid");

  if (!grid) return;

  const search =
    (
      $("menuSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();

  const category =
    $("categoryFilter")?.value ||
    "";


  const filtered =
    state.menus.filter((menu) => {

      const name =
        getMenuName(menu)
          .toLowerCase();

      const menuCategory =
        getMenuCategory(menu);

      const matchSearch =
        !search ||
        name.includes(search);

      const matchCategory =
        !category ||
        menuCategory === category;

      return (
        matchSearch &&
        matchCategory
      );

    });


  if (!filtered.length) {

    grid.innerHTML = `
      <div class="empty-state">
        Tidak ada menu.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    filtered.map((menu) => {

      const id =
        getMenuId(menu);

      const name =
        getMenuName(menu);

      const category =
        getMenuCategory(menu);

      const price =
        getMenuPrice(menu);


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

    }).join("");


  grid
    .querySelectorAll(".menu-card")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          addToCart(
            button.dataset.menuId
          );

        }
      );

    });

}


/* =========================================================
   CATEGORY FILTER
   ========================================================= */

function renderCategoryFilter() {

  const select =
    $("categoryFilter");

  if (!select) return;

  const current =
    select.value;


  const categories =
    [...new Set(
      state.menus
        .map(getMenuCategory)
        .filter(Boolean)
    )]
      .sort();


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
    categories.includes(current)
  ) {
    select.value = current;
  }

}


/* =========================================================
   SEARCH MENU
   ========================================================= */

function initMenuSearch() {

  $("menuSearch")
    ?.addEventListener(
      "input",
      renderMenus
    );


  $("categoryFilter")
    ?.addEventListener(
      "change",
      renderMenus
    );


  $("refreshMenusBtn")
    ?.addEventListener(
      "click",
      async () => {

        showLoading();

        try {

          await loadMenus();

          showToast(
            "Menu berhasil diperbarui."
          );

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        } finally {

          hideLoading();

        }

      }
    );

}


/* =========================================================
   CART
   ========================================================= */

function addToCart(menuId) {

  const menu =
    state.menus.find(
      (item) =>
        String(getMenuId(item)) ===
        String(menuId)
    );


  if (!menu) {
    showToast(
      "Menu tidak ditemukan.",
      "error"
    );

    return;
  }


  const existing =
    state.cart.find(
      (item) =>
        String(item.id) ===
        String(menuId)
    );


  if (existing) {

    existing.qty += 1;

  } else {

    state.cart.push({
      id: getMenuId(menu),
      name: getMenuName(menu),
      category: getMenuCategory(menu),
      price: getMenuPrice(menu),
      qty: 1
    });

  }


  renderCart();
}


/* =========================================================
   CART REMOVE
   ========================================================= */

function removeFromCart(menuId) {

  state.cart =
    state.cart.filter(
      (item) =>
        String(item.id) !==
        String(menuId)
    );

  renderCart();
}


/* =========================================================
   CART QUANTITY
   ========================================================= */

function changeCartQty(menuId, amount) {

  const item =
    state.cart.find(
      (cartItem) =>
        String(cartItem.id) ===
        String(menuId)
    );


  if (!item) return;


  item.qty += amount;


  if (item.qty <= 0) {

    removeFromCart(menuId);
    return;

  }


  renderCart();
}


/* =========================================================
   CART TOTAL
   ========================================================= */

function getCartTotal() {

  return state.cart.reduce(
    (total, item) => {

      return (
        total +
        (
          Number(item.price) *
          Number(item.qty)
        )
      );

    },
    0
  );

}


/* =========================================================
   RENDER CART
   ========================================================= */

function renderCart() {

  const container =
    $("cartItems");

  if (!container) return;


  const count =
    state.cart.reduce(
      (total, item) =>
        total + item.qty,
      0
    );


  const total =
    getCartTotal();


  if ($("cartItemCount")) {

    $("cartItemCount")
      .textContent =
      `${count} item`;

  }


  if ($("cartTotal")) {

    $("cartTotal")
      .textContent =
      formatRupiah(total);

  }


  if (!state.cart.length) {

    container.innerHTML = `
      <div class="empty-cart">
        Keranjang masih kosong.
      </div>
    `;

  } else {

    container.innerHTML =
      state.cart.map((item) => {

        const subtotal =
          item.price *
          item.qty;


        return `
          <div
            class="cart-item"
            data-id="${escapeHTML(item.id)}"
          >

            <div class="cart-item-info">

              <div class="cart-item-name">
                ${escapeHTML(item.name)}
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
                data-id="${escapeHTML(item.id)}"
              >
                −
              </button>

              <span class="qty">
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

            </div>


            <div class="cart-item-subtotal">
              ${formatRupiah(subtotal)}
            </div>


            <button
              type="button"
              class="cart-remove"
              data-action="remove"
              data-id="${escapeHTML(item.id)}"
            >
              ×
            </button>

          </div>
        `;

      }).join("");

  }


  container
    .querySelectorAll("[data-action]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.id;

          const action =
            button.dataset.action;


          if (action === "plus") {
            changeCartQty(id, 1);
          }

          if (action === "minus") {
            changeCartQty(id, -1);
          }

          if (action === "remove") {
            removeFromCart(id);
          }

        }
      );

    });


  updateChange();
}


/* =========================================================
   PAYMENT
   ========================================================= */

function updateChange() {

  const payment =
    Number(
      $("payment")?.value || 0
    );

  const total =
    getCartTotal();


  const change =
    payment - total;


  if ($("changeAmount")) {

    $("changeAmount")
      .textContent =
      formatRupiah(
        change > 0 ? change : 0
      );

  }

}


/* =========================================================
   CLEAR CART
   ========================================================= */

function clearCart() {

  if (!state.cart.length) {
    return;
  }


  if (
    !confirm(
      "Kosongkan semua item di keranjang?"
    )
  ) {
    return;
  }


  state.cart = [];

  if ($("payment")) {
    $("payment").value = "";
  }

  renderCart();

}


/* =========================================================
   SAVE SALE
   ========================================================= */

async function saveSale() {

  if (!state.cart.length) {

    showToast(
      "Keranjang masih kosong.",
      "warning"
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
      "warning"
    );

    return;
  }


  const change =
    payment - total;


  const items =
    state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      qty: item.qty,
      subtotal:
        item.price * item.qty
    }));


  showLoading();


  try {

    const result =
      await apiRequest(
        "saveSale",
        {
          date: getToday(),
          total,
          payment,
          change,
          items
        }
      );


    const sale =
      result.sale ||
      result.data ||
      {
        id:
          result.id ||
          `TRX-${Date.now()}`,
        date: getToday(),
        total,
        payment,
        change,
        items
      };


    state.currentSale = sale;


    state.cart = [];


    if ($("payment")) {
      $("payment").value = "";
    }


    renderCart();


    await loadSales();


    showToast(
      "Transaksi berhasil disimpan."
    );


    openReceipt(sale);


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
   SALES
   ========================================================= */

async function loadSales() {

  try {

    const result =
      await apiRequest("getSales");


    state.sales =
      normalizeArray(
        result.sales ??
        result.data ??
        result.rows ??
        []
      );


    renderSalesTable();
    updateStatistics();

  } catch (error) {

    console.error(error);

    throw error;

  }

}


/* =========================================================
   SALES VALUE HELPER
   ========================================================= */

function getSaleId(sale) {

  return (
    sale.id ??
    sale.ID ??
    sale.saleId ??
    sale.transactionId ??
    sale.noTransaksi ??
    sale.no_transaksi ??
    ""
  );

}


function getSaleDate(sale) {

  return (
    sale.date ??
    sale.tanggal ??
    sale.Tanggal ??
    ""
  );

}


function getSaleTotal(sale) {

  return Number(
    sale.total ??
    sale.Total ??
    0
  );

}


function getSalePayment(sale) {

  return Number(
    sale.payment ??
    sale.pembayaran ??
    sale.Pembayaran ??
    0
  );

}


function getSaleChange(sale) {

  return Number(
    sale.change ??
    sale.kembalian ??
    sale.Kembalian ??
    0
  );

}


function getSaleItems(sale) {

  return (
    sale.items ??
    sale.item ??
    sale.Items ??
    []
  );

}


function getSaleItemCount(sale) {

  const items =
    getSaleItems(sale);


  if (Array.isArray(items)) {

    return items.reduce(
      (total, item) =>
        total +
        Number(
          item.qty ??
          item.quantity ??
          1
        ),
      0
    );

  }


  return Number(
    sale.itemCount ??
    sale.jumlahItem ??
    0
  );

}


/* =========================================================
   SALES FILTER
   ========================================================= */

function getFilteredSales() {

  if (
    state.salesFilter === "all"
  ) {

    return [...state.sales];

  }


  return state.sales.filter(
    (sale) => {

      const date =
        String(
          getSaleDate(sale)
        ).slice(0, 10);


      return (
        date ===
        state.salesFilter
      );

    }
  );

}


/* =========================================================
   RENDER SALES TABLE
   ========================================================= */

function renderSalesTable() {

  const tbody =
    $("salesTableBody");

  if (!tbody) return;


  const sales =
    getFilteredSales();


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
    sales.map((sale, index) => {

      const id =
        getSaleId(sale);

      const date =
        getSaleDate(sale);

      const items =
        getSaleItemCount(sale);

      const total =
        getSaleTotal(sale);

      const payment =
        getSalePayment(sale);

      const change =
        getSaleChange(sale);


      return `
        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHTML(id)}
          </td>

          <td>
            ${escapeHTML(date)}
          </td>

          <td>
            ${items}
          </td>

          <td class="text-right">
            ${formatRupiah(total)}
          </td>

          <td class="text-right">
            ${formatRupiah(payment)}
          </td>

          <td class="text-right">
            ${formatRupiah(change)}
          </td>

          <td>

            <button
              type="button"
              class="btn btn-small btn-light"
              data-sale-action="receipt"
              data-sale-id="${escapeHTML(id)}"
            >
              Struk
            </button>

            <button
              type="button"
              class="btn btn-small btn-danger"
              data-sale-action="delete"
              data-sale-id="${escapeHTML(id)}"
            >
              Hapus
            </button>

          </td>

        </tr>
      `;

    }).join("");


  tbody
    .querySelectorAll(
      "[data-sale-action]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.saleId;

          const action =
            button.dataset.saleAction;


          if (
            action === "receipt"
          ) {

            const sale =
              state.sales.find(
                (item) =>
                  String(
                    getSaleId(item)
                  ) === String(id)
              );

            if (sale) {
              openReceipt(sale);
            }

          }


          if (
            action === "delete"
          ) {

            deleteSale(id);

          }

        }
      );

    });

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

  const sales =
    getFilteredSales();


  const totalTransactions =
    sales.length;


  const totalSales =
    sales.reduce(
      (total, sale) =>
        total +
        getSaleTotal(sale),
      0
    );


  const average =
    totalTransactions
      ? totalSales /
        totalTransactions
      : 0;


  if ($("totalTransactions")) {

    $("totalTransactions")
      .textContent =
      totalTransactions;

  }


  if ($("totalSales")) {

    $("totalSales")
      .textContent =
      formatRupiah(totalSales);

  }


  if ($("averageSales")) {

    $("averageSales")
      .textContent =
      formatRupiah(average);

  }

}


/* =========================================================
   SALES FILTER INIT
   ========================================================= */

function initSalesFilter() {

  $("salesDate")
    ?.addEventListener(
      "change",
      () => {

        state.salesFilter =
          $("salesDate").value ||
          "all";

        renderSalesTable();
        updateStatistics();

      }
    );


  $("todaySalesBtn")
    ?.addEventListener(
      "click",
      () => {

        const today =
          getToday();

        state.salesFilter =
          today;

        if ($("salesDate")) {
          $("salesDate").value =
            today;
        }

        renderSalesTable();
        updateStatistics();

      }
    );


  $("allSalesBtn")
    ?.addEventListener(
      "click",
      () => {

        state.salesFilter =
          "all";

        if ($("salesDate")) {
          $("salesDate").value = "";
        }

        renderSalesTable();
        updateStatistics();

      }
    );


  $("refreshSalesBtn")
    ?.addEventListener(
      "click",
      async () => {

        showLoading();

        try {

          await loadSales();

          showToast(
            "Data penjualan diperbarui."
          );

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        } finally {

          hideLoading();

        }

      }
    );

}


/* =========================================================
   DELETE SALE
   ========================================================= */

async function deleteSale(id) {

  if (
    !confirm(
      "Hapus transaksi ini?"
    )
  ) {
    return;
  }


  showLoading();


  try {

    await apiRequest(
      "deleteSale",
      {
        id
      }
    );


    showToast(
      "Transaksi berhasil dihapus."
    );


    await loadSales();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  } finally {

    hideLoading();

  }

}


/* =========================================================
   MENU TABLE
   ========================================================= */

function renderMenuTable() {

  const tbody =
    $("menuTableBody");

  if (!tbody) return;


  if (!state.menus.length) {

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
    state.menus.map(
      (menu, index) => {

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
                category || "Umum"
              )}
            </td>

            <td class="text-right">
              ${formatRupiah(price)}
            </td>

            <td>

              <button
                type="button"
                class="btn btn-small btn-light"
                data-menu-action="edit"
                data-menu-id="${escapeHTML(id)}"
              >
                Edit
              </button>

              <button
                type="button"
                class="btn btn-small btn-danger"
                data-menu-action="delete"
                data-menu-id="${escapeHTML(id)}"
              >
                Hapus
              </button>

            </td>

          </tr>
        `;

      }
    ).join("");


  tbody
    .querySelectorAll(
      "[data-menu-action]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.menuId;

          const action =
            button.dataset.menuAction;


          if (action === "edit") {
            editMenu(id);
          }


          if (action === "delete") {
            deleteMenu(id);
          }

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


  $("menuModalTitle").textContent =
    menu
      ? "Edit Menu"
      : "Tambah Menu";


  $("menuId").value =
    menu
      ? getMenuId(menu)
      : "";


  $("menuName").value =
    menu
      ? getMenuName(menu)
      : "";


  $("menuCategory").value =
    menu
      ? getMenuCategory(menu)
      : "";


  $("menuPrice").value =
    menu
      ? getMenuPrice(menu)
      : "";


  modal.classList.add("show");
  modal.setAttribute(
    "aria-hidden",
    "false"
  );

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

}


/* =========================================================
   EDIT MENU
   ========================================================= */

function editMenu(id) {

  const menu =
    state.menus.find(
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
    $("menuId").value.trim();

  const name =
    $("menuName").value.trim();

  const category =
    $("menuCategory").value.trim();

  const price =
    Number(
      $("menuPrice").value
    );


  if (!name) {

    showToast(
      "Nama menu wajib diisi.",
      "warning"
    );

    return;
  }


  if (!Number.isFinite(price) || price < 0) {

    showToast(
      "Harga menu tidak valid.",
      "warning"
    );

    return;
  }


  showLoading();


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
        "Menu berhasil diperbarui."
      );

    } else {

      await apiRequest(
        "saveMenu",
        {
          name,
          category,
          price
        }
      );


      showToast(
        "Menu berhasil ditambahkan."
      );

    }


    closeMenuModal();

    await loadMenus();


  } catch (error) {

    console.error(error);

    showToast(
      error.message,
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

  if (
    !confirm(
      "Hapus menu ini?"
    )
  ) {
    return;
  }


  showLoading();


  try {

    await apiRequest(
      "deleteMenu",
      {
        id
      }
    );


    showToast(
      "Menu berhasil dihapus."
    );


    await loadMenus();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  } finally {

    hideLoading();

  }

}


/* =========================================================
   MENU INIT
   ========================================================= */

function initMenuManagement() {

  $("addMenuBtn")
    ?.addEventListener(
      "click",
      () => openMenuModal()
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


  $("menuForm")
    ?.addEventListener(
      "submit",
      saveMenu
    );


  $("refreshMenuTableBtn")
    ?.addEventListener(
      "click",
      async () => {

        showLoading();

        try {

          await loadMenus();

          showToast(
            "Menu berhasil diperbarui."
          );

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        } finally {

          hideLoading();

        }

      }
    );

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

  if (
    !confirm(
      "Yakin ingin menghapus semua transaksi hari ini?"
    )
  ) {
    return;
  }


  showLoading();


  try {

    await apiRequest(
      "resetSales",
      {
        date: getToday()
      }
    );


    showToast(
      "Penjualan hari ini berhasil direset."
    );


    closeResetModal();

    await loadSales();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  } finally {

    hideLoading();

  }

}


/* =========================================================
   RESET INIT
   ========================================================= */

function initReset() {

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

}


/* =========================================================
   RECEIPT
   ========================================================= */

function openReceipt(sale) {

  const modal =
    $("receiptModal");

  const content =
    $("receiptContent");

  if (!modal || !content) {
    return;
  }


  state.currentSale =
    sale;


  const id =
    getSaleId(sale);

  const date =
    getSaleDate(sale);

  const total =
    getSaleTotal(sale);

  const payment =
    getSalePayment(sale);

  const change =
    getSaleChange(sale);

  const items =
    getSaleItems(sale);


  let itemsHTML = "";


  if (Array.isArray(items)) {

    itemsHTML =
      items.map((item) => {

        const name =
          item.name ??
          item.nama ??
          "";

        const qty =
          Number(
            item.qty ??
            item.quantity ??
            1
          );

        const price =
          Number(
            item.price ??
            item.harga ??
            0
          );

        const subtotal =
          Number(
            item.subtotal ??
            (
              price * qty
            )
          );


        return `
          <div class="receipt-row">

            <div>
              ${escapeHTML(name)}
              × ${qty}
            </div>

            <div>
              ${formatRupiah(subtotal)}
            </div>

          </div>
        `;

      }).join("");

  }


  content.innerHTML = `
    <div class="receipt">

      <div class="receipt-title">
        KASIR
      </div>

      <div class="receipt-info">
        No: ${escapeHTML(id)}
      </div>

      <div class="receipt-info">
        ${escapeHTML(date)}
      </div>

      <hr>

      ${itemsHTML}

      <hr>

      <div class="receipt-row">
        <strong>Total</strong>
        <strong>
          ${formatRupiah(total)}
        </strong>
      </div>

      <div class="receipt-row">
        <span>Pembayaran</span>
        <span>
          ${formatRupiah(payment)}
        </span>
      </div>

      <div class="receipt-row">
        <span>Kembalian</span>
        <span>
          ${formatRupiah(change)}
        </span>
      </div>

      <hr>

      <div class="receipt-thanks">
        Terima kasih.
      </div>

    </div>
  `;


  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

}


/* =========================================================
   CLOSE RECEIPT
   ========================================================= */

function closeReceipt() {

  const modal =
    $("receiptModal");

  if (!modal) return;

  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

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
      "Popup diblokir browser.",
      "warning"
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

        body {
          font-family:
            Arial,
            sans-serif;

          width: 300px;
          margin: 20px auto;
          color: #000;
        }

        .receipt-title {
          text-align: center;
          font-weight: bold;
          font-size: 20px;
          margin-bottom: 8px;
        }

        .receipt-info {
          font-size: 12px;
          margin-bottom: 3px;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          margin: 5px 0;
        }

        hr {
          border: 0;
          border-top: 1px dashed #000;
          margin: 10px 0;
        }

        .receipt-thanks {
          text-align: center;
          font-size: 13px;
          margin-top: 15px;
        }

      </style>

    </head>

    <body>

      ${content.innerHTML}

      <script>
        window.onload = function() {
          window.print();
          window.close();
        };
      <\/script>

    </body>

    </html>
  `);


  printWindow.document.close();

}


/* =========================================================
   RECEIPT INIT
   ========================================================= */

function initReceipt() {

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

}


/* =========================================================
   DOWNLOAD CSV
   ========================================================= */

function downloadSalesCSV() {

  const sales =
    getFilteredSales();


  if (!sales.length) {

    showToast(
      "Tidak ada data untuk di-download.",
      "warning"
    );

    return;
  }


  const rows = [
    [
      "No",
      "No. Transaksi",
      "Tanggal",
      "Item",
      "Total",
      "Pembayaran",
      "Kembalian"
    ]
  ];


  sales.forEach(
    (sale, index) => {

      rows.push([
        index + 1,
        getSaleId(sale),
        getSaleDate(sale),
        getSaleItemCount(sale),
        getSaleTotal(sale),
        getSalePayment(sale),
        getSaleChange(sale)
      ]);

    }
  );


  const csv =
    rows.map(
      (row) =>
        row.map(
          (value) =>
            `"${String(value)
              .replace(/"/g, '""')}"`
        ).join(",")
    ).join("\n");


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

  const sales =
    getFilteredSales();


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1000,height=700"
    );


  if (!printWindow) {

    showToast(
      "Popup diblokir browser.",
      "warning"
    );

    return;
  }


  const rows =
    sales.map(
      (sale, index) => {

        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHTML(
                getSaleId(sale)
              )}
            </td>

            <td>
              ${escapeHTML(
                getSaleDate(sale)
              )}
            </td>

            <td>
              ${getSaleItemCount(sale)}
            </td>

            <td>
              ${formatRupiah(
                getSaleTotal(sale)
              )}
            </td>

            <td>
              ${formatRupiah(
                getSalePayment(sale)
              )}
            </td>

            <td>
              ${formatRupiah(
                getSaleChange(sale)
              )}
            </td>

          </tr>
        `;

      }
    ).join("");


  printWindow.document.write(`
    <!DOCTYPE html>

    <html lang="id">

    <head>

      <meta charset="UTF-8">

      <title>Laporan Penjualan</title>

      <style>

        body {
          font-family: Arial, sans-serif;
          margin: 30px;
          color: #111;
        }

        h1 {
          margin-bottom: 5px;
        }

        p {
          margin-top: 0;
          color: #666;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th,
        td {
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
        }

        th {
          background: #f3f3f3;
        }

        td:nth-child(n+5) {
          text-align: right;
        }

      </style>

    </head>

    <body>

      <h1>
        Laporan Penjualan
      </h1>

      <p>
        Dicetak: ${new Date().toLocaleString("id-ID")}
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

      <script>
        window.onload = function() {
          window.print();
          window.close();
        };
      <\/script>

    </body>

    </html>
  `);


  printWindow.document.close();

}


/* =========================================================
   SALES BUTTON INIT
   ========================================================= */

function initSalesActions() {

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

}


/* =========================================================
   MODAL BACKDROP
   ========================================================= */

function initModalBackdrop() {

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


          modal.classList.remove(
            "show"
          );

          modal.setAttribute(
            "aria-hidden",
            "true"
          );

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
        event.key !== "Escape"
      ) {
        return;
      }


      document
        .querySelectorAll(
          ".modal.show"
        )
        .forEach((modal) => {

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
   CART INIT
   ========================================================= */

function initCart() {

  $("payment")
    ?.addEventListener(
      "input",
      updateChange
    );


  $("clearCartBtn")
    ?.addEventListener(
      "click",
      clearCart
    );


  $("saveSaleBtn")
    ?.addEventListener(
      "click",
      saveSale
    );

}


/* =========================================================
   INIT
   ========================================================= */

async function init() {

  console.log(
    "KASIR APP START"
  );

  console.log(
    "API URL:",
    API_URL
  );


  initNavigation();

  initMenuSearch();

  initCart();

  initSalesFilter();

  initMenuManagement();

  initReset();

  initReceipt();

  initSalesActions();

  initModalBackdrop();

  initEscapeKey();


  state.salesFilter =
    "all";


  renderCart();


  await checkConnection();


  try {

    await loadAllData();

  } catch (error) {

    console.error(
      "INIT ERROR:",
      error
    );

    showToast(
      "Gagal mengambil data dari server.",
      "error"
    );

  }

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);
