/* =========================================================
   KASIR APP.JS
   ---------------------------------------------------------
   Fitur:
   - Tambah / edit / hapus menu
   - Menu tanpa data dummy
   - Pencarian menu
   - Filter kategori
   - Keranjang
   - Tambah / kurang jumlah
   - Total pembayaran
   - Hitung kembalian
   - Simpan transaksi
   - Riwayat penjualan hari ini
   - Download penjualan hari ini
   - Setel ulang penjualan hari ini
   - Print struk
   - Siap dihubungkan ke Google Apps Script
========================================================= */


/* =========================================================
   KONFIGURASI GOOGLE SHEETS
   ---------------------------------------------------------
   MASUKKAN URL WEB APP GOOGLE APPS SCRIPT DI SINI.

   Contoh:
   const GOOGLE_SCRIPT_URL =
       "https://script.google.com/macros/s/XXXXXXXX/exec";

   Jangan isi dengan URL palsu.
========================================================= */

const GOOGLE_SCRIPT_URL = "";


/* =========================================================
   KEY LOCAL STORAGE
========================================================= */

const STORAGE_KEYS = {
    menus: "kasir_menus",
    todaySales: "kasir_today_sales",
    transactionNumber: "kasir_transaction_number"
};


/* =========================================================
   STATE
========================================================= */

const state = {

    menus: [],

    cart: [],

    todaySales: [],

    selectedCategory: "all",

    searchText: "",

    editingMenuId: null,

    selectedSale: null,

    lastCompletedSale: null,

    isSaving: false

};


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
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);

}


/* =========================================================
   FORMAT ANGKA
========================================================= */

function formatNumber(value) {

    return new Intl.NumberFormat("id-ID").format(
        Number(value) || 0
    );

}


/* =========================================================
   DATE
========================================================= */

function getDateObject() {

    return new Date();

}


function getTodayKey() {

    const date = getDateObject();

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDateIndonesia(dateValue) {

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);

}


function formatDateTimeIndonesia(dateValue) {

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(date);

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   GENERATE ID
========================================================= */

function generateId(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );

}


/* =========================================================
   LOAD DATA
========================================================= */

function loadLocalData() {

    try {

        const menus =
            localStorage.getItem(
                STORAGE_KEYS.menus
            );

        const sales =
            localStorage.getItem(
                STORAGE_KEYS.todaySales
            );

        state.menus =
            menus
                ? JSON.parse(menus)
                : [];

        state.todaySales =
            sales
                ? JSON.parse(sales)
                : [];


        if (!Array.isArray(state.menus)) {
            state.menus = [];
        }

        if (!Array.isArray(state.todaySales)) {
            state.todaySales = [];
        }


        /*
         * Hanya tampilkan penjualan hari ini.
         * Penjualan hari sebelumnya tidak dihapus
         * dari Google Sheets.
         */

        const today = getTodayKey();

        state.todaySales =
            state.todaySales.filter(
                sale => sale.dateKey === today
            );

        saveTodaySalesLocal();

    } catch (error) {

        console.error(
            "Gagal membaca data lokal:",
            error
        );

        state.menus = [];
        state.todaySales = [];

    }

}


/* =========================================================
   SAVE MENU LOCAL
========================================================= */

function saveMenusLocal() {

    localStorage.setItem(
        STORAGE_KEYS.menus,
        JSON.stringify(state.menus)
    );

}


/* =========================================================
   SAVE SALES LOCAL
========================================================= */

function saveTodaySalesLocal() {

    localStorage.setItem(
        STORAGE_KEYS.todaySales,
        JSON.stringify(state.todaySales)
    );

}


/* =========================================================
   CURRENT DATE UI
========================================================= */

function renderCurrentDate() {

    const now = getDateObject();

    const text =
        new Intl.DateTimeFormat(
            "id-ID",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        ).format(now);


    if ($("currentDate")) {
        $("currentDate").textContent = text;
    }

    if ($("salesDate")) {
        $("salesDate").textContent =
            `Tanggal: ${formatDateIndonesia(now)}`;
    }

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function setConnectionStatus(
    status,
    text
) {

    const indicator =
        $("connectionIndicator");

    const label =
        $("connectionText");

    if (!indicator || !label) {
        return;
    }

    indicator.classList.remove(
        "online",
        "offline",
        "loading"
    );

    indicator.classList.add(status);

    label.textContent = text;

}


/* =========================================================
   INITIAL CONNECTION STATUS
========================================================= */

function initializeConnectionStatus() {

    if (GOOGLE_SCRIPT_URL) {

        setConnectionStatus(
            "loading",
            "Terhubung ke Google Sheets..."
        );

    } else {

        setConnectionStatus(
            "offline",
            "Google Sheets belum diatur"
        );

    }

}


/* =========================================================
   MENU
========================================================= */

function getFilteredMenus() {

    const search =
        state.searchText
            .trim()
            .toLowerCase();


    return state.menus.filter(menu => {

        const matchCategory =
            state.selectedCategory === "all" ||
            menu.category ===
                state.selectedCategory;


        const matchSearch =
            !search ||
            menu.name
                .toLowerCase()
                .includes(search) ||
            String(menu.category || "")
                .toLowerCase()
                .includes(search);


        return (
            matchCategory &&
            matchSearch
        );

    });

}


/* =========================================================
   RENDER MENU
========================================================= */

function renderMenus() {

    const list =
        $("menuList");

    const empty =
        $("emptyMenu");

    if (!list) {
        return;
    }


    const menus =
        getFilteredMenus();


    list.innerHTML = "";


    if (
        state.menus.length === 0
    ) {

        if (empty) {
            empty.hidden = false;
        }

        return;
    }


    if (empty) {
        empty.hidden = true;
    }


    if (menus.length === 0) {

        list.innerHTML = `
            <div
                class="empty-state"
                style="grid-column:1/-1;"
            >
                <h3>MENU TIDAK DITEMUKAN</h3>
                <p>
                    Coba gunakan kata pencarian lain.
                </p>
            </div>
        `;

        return;
    }


    const cartMap =
        new Map(
            state.cart.map(
                item => [
                    item.menuId,
                    item.quantity
                ]
            )
        );


    menus.forEach(menu => {

        const quantity =
            cartMap.get(menu.id) || 0;


        const card =
            document.createElement("button");

        card.type = "button";

        card.className =
            "menu-card" +
            (quantity > 0
                ? " selected"
                : "");


        card.dataset.menuId =
            menu.id;


        card.innerHTML = `

            <div>

                <div class="menu-card-name">
                    ${escapeHtml(menu.name)}
                </div>

                ${
                    menu.category
                        ? `
                            <div class="menu-card-category">
                                ${escapeHtml(menu.category)}
                            </div>
                        `
                        : ""
                }

            </div>


            <div class="menu-card-bottom">

                <div class="menu-card-price">
                    ${formatRupiah(menu.price)}
                </div>

                <div class="menu-card-add">
                    ${
                        quantity > 0
                            ? quantity
                            : "+"
                    }
                </div>

            </div>
        `;


        card.addEventListener(
            "click",
            () => addToCart(menu.id)
        );


        list.appendChild(card);

    });

}


/* =========================================================
   CATEGORY
========================================================= */

function getCategories() {

    const categories =
        state.menus
            .map(
                menu =>
                    String(
                        menu.category || ""
                    ).trim()
            )
            .filter(Boolean);


    return [
        ...new Set(categories)
    ];

}


/* =========================================================
   RENDER CATEGORY
========================================================= */

function renderCategories() {

    const container =
        $("categoryButtons");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    const allButton =
        document.createElement("button");

    allButton.type = "button";

    allButton.className =
        "category-button" +
        (
            state.selectedCategory === "all"
                ? " active"
                : ""
        );

    allButton.dataset.category = "all";

    allButton.textContent = "SEMUA";


    allButton.addEventListener(
        "click",
        () => {

            state.selectedCategory = "all";

            renderCategories();
            renderMenus();

        }
    );


    container.appendChild(allButton);


    getCategories().forEach(
        category => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "category-button" +
                (
                    state.selectedCategory === category
                        ? " active"
                        : ""
                );

            button.dataset.category =
                category;

            button.textContent =
                category;


            button.addEventListener(
                "click",
                () => {

                    state.selectedCategory =
                        category;

                    renderCategories();
                    renderMenus();

                }
            );


            container.appendChild(button);

        }
    );

}


/* =========================================================
   ADD TO CART
========================================================= */

function addToCart(menuId) {

    const menu =
        state.menus.find(
            item => item.id === menuId
        );


    if (!menu) {
        return;
    }


    const existing =
        state.cart.find(
            item => item.menuId === menuId
        );


    if (existing) {

        existing.quantity += 1;

    } else {

        state.cart.push({

            menuId: menu.id,

            name: menu.name,

            price: Number(menu.price),

            category:
                menu.category || "",

            quantity: 1

        });

    }


    renderCart();
    renderMenus();

}


/* =========================================================
   REMOVE CART ITEM
========================================================= */

function removeFromCart(menuId) {

    state.cart =
        state.cart.filter(
            item =>
                item.menuId !== menuId
        );


    renderCart();
    renderMenus();

}


/* =========================================================
   CHANGE QUANTITY
========================================================= */

function changeCartQuantity(
    menuId,
    change
) {

    const item =
        state.cart.find(
            cartItem =>
                cartItem.menuId === menuId
        );


    if (!item) {
        return;
    }


    item.quantity += change;


    if (item.quantity <= 0) {

        removeFromCart(menuId);

        return;
    }


    renderCart();
    renderMenus();

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
                    Number(item.quantity)
                )
            );

        },
        0
    );

}


/* =========================================================
   CART ITEM COUNT
========================================================= */

function getCartItemCount() {

    return state.cart.reduce(
        (total, item) =>
            total + Number(item.quantity),
        0
    );

}


/* =========================================================
   RENDER CART
========================================================= */

function renderCart() {

    const list =
        $("cartList");

    const empty =
        $("emptyCart");

    const count =
        $("cartItemCount");

    const total =
        $("cartTotal");


    if (!list) {
        return;
    }


    list.innerHTML = "";


    if (count) {
        count.textContent =
            formatNumber(
                getCartItemCount()
            );
    }


    if (total) {
        total.textContent =
            formatRupiah(
                getCartTotal()
            );
    }


    if (state.cart.length === 0) {

        if (empty) {
            empty.style.display = "";
        }

        updatePaymentUI();

        return;
    }


    if (empty) {
        empty.style.display = "none";
    }


    state.cart.forEach(item => {

        const row =
            document.createElement("div");

        row.className = "cart-item";


        const subtotal =
            Number(item.price) *
            Number(item.quantity);


        row.innerHTML = `

            <div class="cart-item-header">

                <div>

                    <div class="cart-item-name">
                        ${escapeHtml(item.name)}
                    </div>

                    <div class="cart-item-subtotal">
                        ${formatRupiah(item.price)}
                        ×
                        ${formatNumber(item.quantity)}
                    </div>

                </div>

                <div class="cart-item-price">
                    ${formatRupiah(subtotal)}
                </div>

            </div>


            <div class="cart-item-controls">

                <div class="quantity-controls">

                    <button
                        type="button"
                        class="quantity-button"
                        data-action="minus"
                        data-id="${item.menuId}"
                    >
                        −
                    </button>

                    <div class="quantity-value">
                        ${formatNumber(item.quantity)}
                    </div>

                    <button
                        type="button"
                        class="quantity-button"
                        data-action="plus"
                        data-id="${item.menuId}"
                    >
                        +
                    </button>

                </div>


                <button
                    type="button"
                    class="remove-cart-item"
                    data-id="${item.menuId}"
                >
                    HAPUS
                </button>

            </div>
        `;


        list.appendChild(row);

    });


    list.querySelectorAll(
        ".quantity-button"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const id =
                    button.dataset.id;

                const action =
                    button.dataset.action;

                changeCartQuantity(
                    id,
                    action === "plus"
                        ? 1
                        : -1
                );

            }
        );

    });


    list.querySelectorAll(
        ".remove-cart-item"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                removeFromCart(
                    button.dataset.id
                );

            }
        );

    });


    updatePaymentUI();

}


/* =========================================================
   PAYMENT
========================================================= */

function getPaymentAmount() {

    const input =
        $("paymentAmount");

    if (!input) {
        return 0;
    }

    return Number(input.value) || 0;

}


function getChangeAmount() {

    return (
        getPaymentAmount() -
        getCartTotal()
    );

}


/* =========================================================
   PAYMENT UI
========================================================= */

function updatePaymentUI() {

    const payment =
        getPaymentAmount();

    const total =
        getCartTotal();

    const change =
        payment - total;


    const changeElement =
        $("changeAmount");

    const payButton =
        $("payButton");

    const message =
        $("paymentMessage");


    if (changeElement) {

        changeElement.textContent =
            formatRupiah(
                Math.max(0, change)
            );

    }


    if (!payButton) {
        return;
    }


    payButton.disabled =
        state.cart.length === 0 ||
        payment < total ||
        total <= 0;


    if (message) {

        if (
            state.cart.length > 0 &&
            payment > 0 &&
            payment < total
        ) {

            message.textContent =
                `Uang kurang ${formatRupiah(
                    total - payment
                )}`;

        } else {

            message.textContent = "";

        }

    }

}


/* =========================================================
   CLEAR CART
========================================================= */

function clearCart() {

    state.cart = [];

    const payment =
        $("paymentAmount");

    if (payment) {
        payment.value = "";
    }

    renderCart();
    renderMenus();

}


/* =========================================================
   MENU MODAL
========================================================= */

function openMenuModal() {

    const modal =
        $("menuModal");

    if (!modal) {
        return;
    }

    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    renderManagedMenus();

}


function closeMenuModal() {

    const modal =
        $("menuModal");

    if (!modal) {
        return;
    }

    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    resetMenuForm();

}


/* =========================================================
   RESET MENU FORM
========================================================= */

function resetMenuForm() {

    state.editingMenuId = null;


    const form =
        $("menuForm");

    const id =
        $("menuId");

    const name =
        $("menuName");

    const category =
        $("menuCategory");

    const price =
        $("menuPrice");

    const message =
        $("menuFormMessage");


    if (form) {
        form.reset();
    }

    if (id) {
        id.value = "";
    }

    if (name) {
        name.value = "";
    }

    if (category) {
        category.value = "";
    }

    if (price) {
        price.value = "";
    }

    if (message) {
        message.textContent = "";
    }

}


/* =========================================================
   EDIT MENU
========================================================= */

function editMenu(menuId) {

    const menu =
        state.menus.find(
            item => item.id === menuId
        );


    if (!menu) {
        return;
    }


    state.editingMenuId =
        menuId;


    $("menuId").value =
        menu.id;

    $("menuName").value =
        menu.name;

    $("menuCategory").value =
        menu.category || "";

    $("menuPrice").value =
        menu.price;


    $("menuModalTitle").textContent =
        "EDIT MENU";


    $("menuName").focus();

}


/* =========================================================
   DELETE MENU
========================================================= */

function deleteMenu(menuId) {

    const menu =
        state.menus.find(
            item => item.id === menuId
        );


    if (!menu) {
        return;
    }


    const confirmed =
        window.confirm(
            `Hapus menu "${menu.name}"?`
        );


    if (!confirmed) {
        return;
    }


    state.menus =
        state.menus.filter(
            item => item.id !== menuId
        );


    /*
     * Jika menu sedang berada di keranjang,
     * ikut dihapus dari keranjang.
     */

    state.cart =
        state.cart.filter(
            item => item.menuId !== menuId
        );


    saveMenusLocal();

    renderMenus();
    renderCategories();
    renderCart();
    renderManagedMenus();


    showNotification(
        "Menu berhasil dihapus.",
        "success"
    );

}


/* =========================================================
   SAVE MENU
========================================================= */

function saveMenu(event) {

    event.preventDefault();


    const name =
        $("menuName")
            .value
            .trim();

    const category =
        $("menuCategory")
            .value
            .trim();

    const price =
        Number(
            $("menuPrice").value
        );


    const message =
        $("menuFormMessage");


    if (!name) {

        message.textContent =
            "Nama menu wajib diisi.";

        return;
    }


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        message.textContent =
            "Harga menu tidak valid.";

        return;
    }


    /*
     * EDIT
     */

    if (state.editingMenuId) {

        const menu =
            state.menus.find(
                item =>
                    item.id ===
                    state.editingMenuId
            );


        if (menu) {

            menu.name =
                name;

            menu.category =
                category;

            menu.price =
                price;

            /*
             * Update data di keranjang
             * jika menu sedang dipesan.
             */

            state.cart.forEach(
                cartItem => {

                    if (
                        cartItem.menuId ===
                        menu.id
                    ) {

                        cartItem.name =
                            name;

                        cartItem.category =
                            category;

                        cartItem.price =
                            price;

                    }

                }
            );

        }


        showNotification(
            "Menu berhasil diperbarui.",
            "success"
        );

    }

    /*
     * TAMBAH
     */

    else {

        const newMenu = {

            id:
                generateId("menu"),

            name:
                name,

            category:
                category,

            price:
                price

        };


        state.menus.push(
            newMenu
        );


        showNotification(
            "Menu berhasil ditambahkan.",
            "success"
        );

    }


    saveMenusLocal();

    resetMenuForm();

    $("menuModalTitle").textContent =
        "KELOLA MENU";


    renderMenus();
    renderCategories();
    renderCart();
    renderManagedMenus();

}


/* =========================================================
   RENDER MANAGED MENU
========================================================= */

function renderManagedMenus() {

    const list =
        $("managedMenuList");

    const empty =
        $("emptyManagedMenu");


    if (!list) {
        return;
    }


    list.innerHTML = "";


    if (state.menus.length === 0) {

        if (empty) {
            empty.style.display = "";
        }

        return;
    }


    if (empty) {
        empty.style.display = "none";
    }


    state.menus.forEach(menu => {

        const item =
            document.createElement("div");

        item.className =
            "managed-menu-item";


        item.innerHTML = `

            <div class="managed-menu-info">

                <div class="managed-menu-name">
                    ${escapeHtml(menu.name)}
                </div>

                <div class="managed-menu-price">
                    ${formatRupiah(menu.price)}
                    ${
                        menu.category
                            ? " • " +
                              escapeHtml(
                                  menu.category
                              )
                            : ""
                    }
                </div>

            </div>


            <div class="managed-menu-actions">

                <button
                    type="button"
                    class="menu-edit-button"
                    data-id="${menu.id}"
                >
                    EDIT
                </button>

                <button
                    type="button"
                    class="menu-delete-button"
                    data-id="${menu.id}"
                >
                    HAPUS
                </button>

            </div>
        `;


        list.appendChild(item);

    });


    list.querySelectorAll(
        ".menu-edit-button"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                editMenu(
                    button.dataset.id
                );

            }
        );

    });


    list.querySelectorAll(
        ".menu-delete-button"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                deleteMenu(
                    button.dataset.id
                );

            }
        );

    });

}


/* =========================================================
   TRANSACTION NUMBER
========================================================= */

function getNextTransactionNumber() {

    let number =
        Number(
            localStorage.getItem(
                STORAGE_KEYS.transactionNumber
            )
        ) || 0;


    number += 1;


    localStorage.setItem(
        STORAGE_KEYS.transactionNumber,
        String(number)
    );


    const date =
        getTodayKey()
            .replaceAll("-", "");


    return `${date}-${String(number).padStart(4, "0")}`;

}


/* =========================================================
   CREATE SALE
========================================================= */

function createSale() {

    const total =
        getCartTotal();

    const payment =
        getPaymentAmount();

    const change =
        payment - total;


    if (state.cart.length === 0) {

        throw new Error(
            "Keranjang masih kosong."
        );

    }


    if (payment < total) {

        throw new Error(
            "Uang pembayaran masih kurang."
        );

    }


    const now =
        new Date();


    const sale = {

        id:
            generateId("sale"),

        transactionNumber:
            getNextTransactionNumber(),

        dateKey:
            getTodayKey(),

        date:
            now.toISOString(),

        items:
            state.cart.map(item => ({

                menuId:
                    item.menuId,

                name:
                    item.name,

                category:
                    item.category || "",

                price:
                    Number(item.price),

                quantity:
                    Number(item.quantity),

                subtotal:
                    Number(item.price) *
                    Number(item.quantity)

            })),

        total:
            total,

        payment:
            payment,

        change:
            change

    };


    return sale;

}


/* =========================================================
   BAYAR
========================================================= */

async function processPayment() {

    if (state.isSaving) {
        return;
    }


    try {

        const sale =
            createSale();


        state.isSaving = true;


        $("payButton").disabled = true;


        /*
         * Simpan lokal dulu.
         * Jadi transaksi tidak hilang
         * kalau koneksi Google Sheets bermasalah.
         */

        state.todaySales.push(
            sale
        );

        saveTodaySalesLocal();


        /*
         * Kirim ke Google Sheets
         * kalau URL sudah diisi.
         */

        if (GOOGLE_SCRIPT_URL) {

            try {

                await saveSaleToGoogleSheets(
                    sale
                );

                setConnectionStatus(
                    "online",
                    "Google Sheets tersambung"
                );

            } catch (error) {

                console.error(
                    "Google Sheets error:",
                    error
                );


                setConnectionStatus(
                    "offline",
                    "Gagal sinkron ke Google Sheets"
                );


                showNotification(
                    "Transaksi tersimpan di aplikasi, tetapi belum masuk Google Sheets.",
                    "warning"
                );

            }

        }


        state.lastCompletedSale =
            sale;


        /*
         * Bersihkan keranjang
         */

        clearCart();


        /*
         * Update history
         */

        renderSalesHistory();


        /*
         * Buka pilihan PRINT
         */

        openPaymentSuccessModal(
            sale
        );


    } catch (error) {

        console.error(error);

        showNotification(
            error.message ||
            "Pembayaran gagal.",
            "error"
        );

    } finally {

        state.isSaving = false;

        updatePaymentUI();

    }

}


/* =========================================================
   GOOGLE SHEETS
========================================================= */

async function saveSaleToGoogleSheets(
    sale
) {

    const response =
        await fetch(
            GOOGLE_SCRIPT_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body:
                    JSON.stringify({
                        action: "saveSale",
                        sale: sale
                    })
            }
        );


    if (!response.ok) {

        throw new Error(
            "Server Google Sheets mengembalikan error."
        );

    }


    const result =
        await response.json();


    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
            "Google Sheets menolak transaksi."
        );

    }


    return result;

}


/* =========================================================
   PAYMENT SUCCESS MODAL
========================================================= */

function openPaymentSuccessModal(
    sale
) {

    $("successTransactionNumber")
        .textContent =
            sale.transactionNumber;

    $("successTotal")
        .textContent =
            formatRupiah(
                sale.total
            );

    $("successPayment")
        .textContent =
            formatRupiah(
                sale.payment
            );

    $("successChange")
        .textContent =
            formatRupiah(
                sale.change
            );


    const modal =
        $("paymentSuccessModal");


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closePaymentSuccessModal() {

    const modal =
        $("paymentSuccessModal");


    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   PRINT RECEIPT
========================================================= */

function printReceipt(
    sale
) {

    if (!sale) {
        return;
    }


    const printArea =
        $("printArea");


    if (!printArea) {
        return;
    }


    const itemsHtml =
        sale.items
            .map(item => {

                return `
                    <div class="receipt-item">
                        <div>
                            ${escapeHtml(item.name)}
                        </div>

                        <div>
                            ${item.quantity}
                            x
                            ${formatRupiah(item.price)}
                        </div>

                        <div>
                            ${formatRupiah(item.subtotal)}
                        </div>
                    </div>
                `;

            })
            .join("");


    printArea.innerHTML = `

        <div class="thermal-receipt">

            <div class="receipt-center">
                <strong>KASIR</strong>
            </div>


            <div class="receipt-center">
                ${formatDateTimeIndonesia(
                    sale.date
                )}
            </div>


            <div class="receipt-center">
                ${escapeHtml(
                    sale.transactionNumber
                )}
            </div>


            <div class="receipt-line">
                --------------------------------
            </div>


            ${itemsHtml}


            <div class="receipt-line">
                --------------------------------
            </div>


            <div class="receipt-total">
                <span>TOTAL</span>
                <strong>
                    ${formatRupiah(sale.total)}
                </strong>
            </div>


            <div class="receipt-total">
                <span>BAYAR</span>
                <strong>
                    ${formatRupiah(sale.payment)}
                </strong>
            </div>


            <div class="receipt-total">
                <span>KEMBALI</span>
                <strong>
                    ${formatRupiah(sale.change)}
                </strong>
            </div>


            <div class="receipt-line">
                --------------------------------
            </div>


            <div class="receipt-center">
                TERIMA KASIH
            </div>

        </div>
    `;


    /*
     * Print menggunakan browser.
     * print.css akan mengatur agar yang
     * keluar hanya struk.
     */

    window.print();

}


/* =========================================================
   SALES HISTORY
========================================================= */

function renderSalesHistory() {

    const list =
        $("salesHistory");

    const empty =
        $("emptySales");

    const count =
        $("todayTransactionCount");

    const total =
        $("todaySalesTotal");


    if (!list) {
        return;
    }


    list.innerHTML = "";


    const today =
        getTodayKey();


    state.todaySales =
        state.todaySales.filter(
            sale =>
                sale.dateKey === today
        );


    saveTodaySalesLocal();


    if (count) {

        count.textContent =
            formatNumber(
                state.todaySales.length
            );

    }


    const salesTotal =
        state.todaySales.reduce(
            (sum, sale) =>
                sum + Number(sale.total),
            0
        );


    if (total) {

        total.textContent =
            formatRupiah(
                salesTotal
            );

    }


    if (state.todaySales.length === 0) {

        if (empty) {
            empty.style.display = "";
        }

        return;
    }


    if (empty) {
        empty.style.display = "none";
    }


    /*
     * Terbaru di atas.
     */

    const sales =
        [...state.todaySales]
            .reverse();


    sales.forEach(sale => {

        const item =
            document.createElement("div");

        item.className =
            "sale-item";


        const itemCount =
            sale.items.reduce(
                (sum, item) =>
                    sum +
                    Number(item.quantity),
                0
            );


        item.innerHTML = `

            <div class="sale-item-header">

                <div class="sale-item-number">
                    ${escapeHtml(
                        sale.transactionNumber
                    )}
                </div>

                <div class="sale-item-total">
                    ${formatRupiah(
                        sale.total
                    )}
                </div>

            </div>


            <div class="sale-item-info">

                ${formatDateTimeIndonesia(
                    sale.date
                )}

                •
                ${formatNumber(itemCount)}
                item

            </div>

        `;


        item.addEventListener(
            "click",
            () => openSaleDetail(sale)
        );


        list.appendChild(item);

    });

}


/* =========================================================
   SALE DETAIL
========================================================= */

function openSaleDetail(
    sale
) {

    state.selectedSale =
        sale;


    $("saleDetailTransactionNumber")
        .textContent =
            sale.transactionNumber;


    const content =
        $("saleDetailContent");


    content.innerHTML = "";


    sale.items.forEach(item => {

        const row =
            document.createElement("div");

        row.className =
            "sale-detail-row";


        row.innerHTML = `

            <div class="sale-detail-name">

                ${escapeHtml(item.name)}

                <br>

                <small>
                    ${item.quantity}
                    ×
                    ${formatRupiah(item.price)}
                </small>

            </div>


            <div class="sale-detail-value">
                ${formatRupiah(item.subtotal)}
            </div>

        `;


        content.appendChild(row);

    });


    const summary =
        document.createElement("div");

    summary.innerHTML = `

        <div class="summary-row">
            <span>TOTAL</span>
            <strong>
                ${formatRupiah(sale.total)}
            </strong>
        </div>

        <div class="summary-row">
            <span>BAYAR</span>
            <strong>
                ${formatRupiah(sale.payment)}
            </strong>
        </div>

        <div class="summary-row">
            <span>KEMBALIAN</span>
            <strong>
                ${formatRupiah(sale.change)}
            </strong>
        </div>

    `;


    content.appendChild(summary);


    const modal =
        $("saleDetailModal");


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeSaleDetail() {

    const modal =
        $("saleDetailModal");


    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    state.selectedSale =
        null;

}


/* =========================================================
   DOWNLOAD PENJUALAN HARI INI
========================================================= */

function downloadTodaySales() {

    const today =
        getTodayKey();


    const sales =
        state.todaySales.filter(
            sale =>
                sale.dateKey === today
        );


    if (sales.length === 0) {

        showNotification(
            "Belum ada penjualan hari ini.",
            "warning"
        );

        return;
    }


    /*
     * Nama file menyertakan tanggal.
     */

    const filename =
        `penjualan-${today}.csv`;


    const rows = [];


    rows.push([
        "Tanggal",
        "No Transaksi",
        "Menu",
        "Kategori",
        "Harga",
        "Jumlah",
        "Subtotal",
        "Total Transaksi",
        "Pembayaran",
        "Kembalian"
    ]);


    sales.forEach(sale => {

        sale.items.forEach(item => {

            rows.push([
                formatDateTimeIndonesia(
                    sale.date
                ),

                sale.transactionNumber,

                item.name,

                item.category || "",

                item.price,

                item.quantity,

                item.subtotal,

                sale.total,

                sale.payment,

                sale.change
            ]);

        });

    });


    const csv =
        rows
            .map(row =>
                row.map(value =>
                    csvEscape(value)
                ).join(",")
            )
            .join("\r\n");


    /*
     * BOM agar Excel membaca
     * UTF-8 dengan benar.
     */

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
        filename;


    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


    showNotification(
        `Penjualan ${today} berhasil didownload.`,
        "success"
    );

}


/* =========================================================
   CSV ESCAPE
========================================================= */

function csvEscape(value) {

    const text =
        String(value ?? "");


    if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
    ) {

        return (
            '"' +
            text.replaceAll(
                '"',
                '""'
            ) +
            '"'
        );

    }


    return text;

}


/* =========================================================
   RESET SALES MODAL
========================================================= */

function openResetModal() {

    const modal =
        $("resetModal");


    $("resetMessage")
        .textContent = "";


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeResetModal() {

    const modal =
        $("resetModal");


    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   RESET PENJUALAN HARI INI
   ---------------------------------------------------------
   PERHATIAN:
   - MENU TIDAK DIHAPUS
   - HARGA TIDAK DIHAPUS
   - DATABASE MENU TIDAK DIHAPUS
   - PENJUALAN HARI INI DIHAPUS
   - GOOGLE SHEETS PENJUALAN HARI INI
     AKAN DIHAPUS MELALUI Code.gs
========================================================= */

async function resetTodaySales() {

    const message =
        $("resetMessage");


    if (message) {
        message.textContent =
            "Menghapus penjualan hari ini...";
    }


    try {

        const today =
            getTodayKey();


        /*
         * Kalau Google Sheets sudah
         * dikonfigurasi, hapus juga
         * transaksi hari ini di server.
         */

        if (GOOGLE_SCRIPT_URL) {

            await deleteTodaySalesFromGoogleSheets(
                today
            );

        }


        /*
         * HAPUS HISTORY LOKAL SAJA.
         *
         * MENU TETAP AMAN.
         */

        state.todaySales = [];

        saveTodaySalesLocal();


        renderSalesHistory();


        closeResetModal();


        showNotification(
            "Penjualan hari ini berhasil direset. Menu dan harga tetap aman.",
            "success"
        );


    } catch (error) {

        console.error(
            "Reset penjualan gagal:",
            error
        );


        if (message) {

            message.textContent =
                error.message ||
                "Gagal menghapus penjualan.";

        }


        showNotification(
            "Penjualan belum direset karena Google Sheets gagal diakses.",
            "error"
        );

    }

}


/* =========================================================
   DELETE SALES FROM GOOGLE SHEETS
========================================================= */

async function deleteTodaySalesFromGoogleSheets(
    dateKey
) {

    const response =
        await fetch(
            GOOGLE_SCRIPT_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body:
                    JSON.stringify({
                        action:
                            "deleteTodaySales",
                        dateKey:
                            dateKey
                    })
            }
        );


    if (!response.ok) {

        throw new Error(
            "Tidak dapat menghubungi Google Sheets."
        );

    }


    const result =
        await response.json();


    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
            "Google Sheets gagal menghapus penjualan."
        );

    }


    return result;

}


/* =========================================================
   NOTIFICATION
========================================================= */

let notificationTimer = null;


function showNotification(
    message,
    type = "success"
) {

    const notification =
        $("notification");


    if (!notification) {
        return;
    }


    clearTimeout(
        notificationTimer
    );


    notification.hidden = false;

    notification.className =
        `notification ${type}`;


    notification.textContent =
        message;


    notificationTimer =
        setTimeout(
            () => {

                notification.hidden =
                    true;

            },
            3500
        );

}


/* =========================================================
   SEARCH EVENT
========================================================= */

function initializeSearch() {

    const input =
        $("menuSearch");


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        event => {

            state.searchText =
                event.target.value;

            renderMenus();

        }
    );

}


/* =========================================================
   PAYMENT INPUT EVENT
========================================================= */

function initializePaymentInput() {

    const input =
        $("paymentAmount");


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        updatePaymentUI
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                if (
                    !$("payButton").disabled
                ) {

                    processPayment();

                }

            }

        }
    );

}


/* =========================================================
   GENERAL EVENTS
========================================================= */

function initializeEvents() {

    /*
     * Kelola menu
     */

    $("manageMenuButton")
        ?.addEventListener(
            "click",
            openMenuModal
        );


    $("addMenuFromEmpty")
        ?.addEventListener(
            "click",
            () => {

                openMenuModal();

            }
        );


    $("closeMenuModal")
        ?.addEventListener(
            "click",
            closeMenuModal
        );


    $("menuModalOverlay")
        ?.addEventListener(
            "click",
            closeMenuModal
        );


    $("cancelMenuForm")
        ?.addEventListener(
            "click",
            resetMenuForm
        );


    $("newMenuButton")
        ?.addEventListener(
            "click",
            () => {

                resetMenuForm();

                $("menuModalTitle")
                    .textContent =
                        "MENU BARU";

                $("menuName")
                    ?.focus();

            }
        );


    $("menuForm")
        ?.addEventListener(
            "submit",
            saveMenu
        );


    /*
     * Keranjang
     */

    $("clearCartButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.cart.length === 0
                ) {
                    return;
                }


                const confirmed =
                    window.confirm(
                        "Kosongkan semua pesanan?"
                    );


                if (confirmed) {
                    clearCart();
                }

            }
        );


    /*
     * Bayar
     */

    $("payButton")
        ?.addEventListener(
            "click",
            processPayment
        );


    /*
     * Payment success
     */

    $("printReceiptButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.lastCompletedSale
                ) {

                    printReceipt(
                        state.lastCompletedSale
                    );

                }

            }
        );


    $("finishWithoutPrintButton")
        ?.addEventListener(
            "click",
            closePaymentSuccessModal
        );


    $("paymentSuccessOverlay")
        ?.addEventListener(
            "click",
            closePaymentSuccessModal
        );


    /*
     * Detail
     */

    $("closeSaleDetail")
        ?.addEventListener(
            "click",
            closeSaleDetail
        );


    $("closeSaleDetailButton")
        ?.addEventListener(
            "click",
            closeSaleDetail
        );


    $("saleDetailOverlay")
        ?.addEventListener(
            "click",
            closeSaleDetail
        );


    $("printDetailReceipt")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.selectedSale
                ) {

                    printReceipt(
                        state.selectedSale
                    );

                }

            }
        );


    /*
     * Download
     */

    $("downloadTodayButton")
        ?.addEventListener(
            "click",
            downloadTodaySales
        );


    /*
     * Reset
     */

    $("resetTodayButton")
        ?.addEventListener(
            "click",
            openResetModal
        );


    $("closeResetModal")
        ?.addEventListener(
            "click",
            closeResetModal
        );


    $("cancelReset")
        ?.addEventListener(
            "click",
            closeResetModal
        );


    $("resetModalOverlay")
        ?.addEventListener(
            "click",
            closeResetModal
        );


    $("confirmReset")
        ?.addEventListener(
            "click",
            resetTodaySales
        );


    /*
     * Escape untuk menutup modal
     */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }


            if (
                !$("menuModal").hidden
            ) {
                closeMenuModal();
            }


            if (
                !$("resetModal").hidden
            ) {
                closeResetModal();
            }


            if (
                !$("paymentSuccessModal").hidden
            ) {
                closePaymentSuccessModal();
            }


            if (
                !$("saleDetailModal").hidden
            ) {
                closeSaleDetail();
            }

        }
    );

}


/* =========================================================
   GOOGLE SHEETS STATUS
========================================================= */

async function checkGoogleSheetsConnection() {

    if (!GOOGLE_SCRIPT_URL) {

        setConnectionStatus(
            "offline",
            "Google Sheets belum diatur"
        );

        return;

    }


    try {

        const response =
            await fetch(
                GOOGLE_SCRIPT_URL +
                "?action=ping",
                {
                    method: "GET"
                }
            );


        if (!response.ok) {
            throw new Error();
        }


        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );


    } catch (error) {

        console.error(
            "Google Sheets tidak dapat diakses:",
            error
        );


        setConnectionStatus(
            "offline",
            "Google Sheets tidak tersambung"
        );

    }

}


/* =========================================================
   DAILY CLEANUP
   ---------------------------------------------------------
   Hanya membersihkan history lokal yang bukan hari ini.
   Tidak menyentuh menu.
   Tidak menyentuh Google Sheets.
========================================================= */

function cleanupOldLocalHistory() {

    const today =
        getTodayKey();


    state.todaySales =
        state.todaySales.filter(
            sale =>
                sale.dateKey === today
        );


    saveTodaySalesLocal();

}


/* =========================================================
   INIT
========================================================= */

function initializeApp() {

    loadLocalData();

    cleanupOldLocalHistory();

    renderCurrentDate();

    renderCategories();

    renderMenus();

    renderCart();

    renderSalesHistory();

    initializeSearch();

    initializePaymentInput();

    initializeEvents();

    initializeConnectionStatus();


    if (GOOGLE_SCRIPT_URL) {

        checkGoogleSheetsConnection();

    }


    /*
     * Refresh tanggal setiap menit.
     */

    setInterval(
        renderCurrentDate,
        60 * 1000
    );

}


/* =========================================================
   START
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();

}
