/* =========================================================
   KASIR APP.JS
   DATABASE UTAMA: GOOGLE SHEETS

   ALUR:
   - MENU -> Google Sheets
   - PENJUALAN -> Google Sheets
   - STATISTIK -> hasil Google Sheets
   - DOWNLOAD -> Google Sheets
   - RESET -> Google Sheets
   - TIDAK memakai localStorage sebagai database
   ========================================================= */


/* =========================================================
   GOOGLE APPS SCRIPT URL
   ========================================================= */

const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbzayanvm5sak3mvjcf_ikudaESu40WgH6Ck4mWzXeqHAinjy8CUXr8pQkudICfdUPugMQ/exec";


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

    lastCompletedSale: null,

    isLoadingMenus: false,

    isLoadingSales: false,

    isSaving: false,

    isResetting: false,

    initialized: false

};


/* =========================================================
   DOM
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   SAFE STRING
   ========================================================= */

function toSafeString(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();

}


/* =========================================================
   SAFE NUMBER
   ========================================================= */

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    if (typeof value === "number") {

        return Number.isFinite(value)
            ? value
            : 0;

    }

    let text =
        String(value).trim();

    if (!text) {
        return 0;
    }

    /*
     * Format Indonesia:
     * 10.000,50
     */

    if (
        text.includes(".") &&
        text.includes(",")
    ) {

        text =
            text
                .replace(/\./g, "")
                .replace(",", ".");

    }

    /*
     * 10000,50
     */

    else if (
        text.includes(",")
    ) {

        text =
            text.replace(",", ".");

    }

    /*
     * Hilangkan Rp
     * dan karakter lainnya.
     */

    text =
        text.replace(
            /[^\d.-]/g,
            ""
        );

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : 0;

}


/* =========================================================
   FORMAT RUPIAH
   ========================================================= */

function formatRupiah(value) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }
    ).format(
        toNumber(value)
    );

}


/* =========================================================
   FORMAT ANGKA
   ========================================================= */

function formatNumber(value) {

    return new Intl.NumberFormat(
        "id-ID"
    ).format(
        toNumber(value)
    );

}


/* =========================================================
   TODAY KEY
   ========================================================= */

function getTodayKey() {

    const now =
        new Date();

    return (
        now.getFullYear() +
        "-" +
        String(
            now.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            now.getDate()
        ).padStart(2, "0")
    );

}


/* =========================================================
   NORMALIZE DATE
   ========================================================= */

function normalizeDateKey(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "";
    }

    if (
        value instanceof Date
    ) {

        if (
            Number.isNaN(
                value.getTime()
            )
        ) {
            return "";
        }

        return (
            value.getFullYear() +
            "-" +
            String(
                value.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                value.getDate()
            ).padStart(2, "0")
        );

    }

    const text =
        String(value).trim();

    /*
     * YYYY-MM-DD
     */

    let match =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

    if (match) {

        return (
            match[1] +
            "-" +
            match[2] +
            "-" +
            match[3]
        );

    }

    /*
     * DD/MM/YYYY
     */

    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );

    if (match) {

        return (
            match[3] +
            "-" +
            String(
                match[2]
            ).padStart(2, "0") +
            "-" +
            String(
                match[1]
            ).padStart(2, "0")
        );

    }

    /*
     * DD-MM-YYYY
     */

    match =
        text.match(
            /^(\d{1,2})-(\d{1,2})-(\d{4})/
        );

    if (match) {

        return (
            match[3] +
            "-" +
            String(
                match[2]
            ).padStart(2, "0") +
            "-" +
            String(
                match[1]
            ).padStart(2, "0")
        );

    }

    const parsed =
        new Date(text);

    if (
        !Number.isNaN(
            parsed.getTime()
        )
    ) {

        return (
            parsed.getFullYear() +
            "-" +
            String(
                parsed.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                parsed.getDate()
            ).padStart(2, "0")
        );

    }

    return "";

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDateIndonesia(value) {

    const key =
        normalizeDateKey(value);

    if (!key) {
        return "-";
    }

    const parts =
        key.split("-");

    if (
        parts.length !== 3
    ) {
        return "-";
    }

    return (
        parts[2] +
        "/" +
        parts[1] +
        "/" +
        parts[0]
    );

}


/* =========================================================
   FORMAT DATE TIME
   ========================================================= */

function formatDateTimeIndonesia(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

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

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   GENERATE ID
   ========================================================= */

function generateId(
    prefix = "id"
) {

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
   GENERATE NO TRANSAKSI
   ========================================================= */

function generateTransactionNumber() {

    const now =
        new Date();

    const date =
        getTodayKey()
            .replaceAll("-", "");

    const hour =
        String(
            now.getHours()
        ).padStart(2, "0");

    const minute =
        String(
            now.getMinutes()
        ).padStart(2, "0");

    const second =
        String(
            now.getSeconds()
        ).padStart(2, "0");

    const ms =
        String(
            now.getMilliseconds()
        ).padStart(3, "0");

    const random =
        String(
            Math.floor(
                Math.random() * 10000
            )
        ).padStart(4, "0");

    return (
        date +
        "-" +
        hour +
        minute +
        second +
        ms +
        "-" +
        random
    );

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

    if (indicator) {

        indicator.classList.remove(
            "online",
            "offline",
            "loading"
        );

        indicator.classList.add(
            status
        );

    }

    if (label) {

        label.textContent =
            text;

    }

}


/* =========================================================
   GOOGLE REQUEST
   ========================================================= */

async function googleRequest(
    payload = {},
    method = "POST"
) {

    if (
        !GOOGLE_SCRIPT_URL
    ) {

        throw new Error(
            "URL Google Apps Script belum diisi."
        );

    }

    let response;

    if (
        method === "GET"
    ) {

        const params =
            new URLSearchParams();

        Object.entries(payload)
            .forEach(
                ([key, value]) => {

                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                    ) {

                        params.set(
                            key,
                            String(value)
                        );

                    }

                }
            );

        const query =
            params.toString();

        const url =
            query
                ? GOOGLE_SCRIPT_URL +
                  "?" +
                  query
                : GOOGLE_SCRIPT_URL;

        response =
            await fetch(
                url,
                {
                    method: "GET",
                    cache: "no-store",
                    redirect: "follow"
                }
            );

    }

    else {

        response =
            await fetch(
                GOOGLE_SCRIPT_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },

                    body:
                        JSON.stringify(
                            payload
                        ),

                    cache:
                        "no-store",

                    redirect:
                        "follow"
                }
            );

    }

    if (
        !response.ok
    ) {

        throw new Error(
            "Google Apps Script HTTP " +
            response.status
        );

    }

    const text =
        await response.text();

    if (
        !text ||
        !text.trim()
    ) {

        throw new Error(
            "Google Apps Script mengembalikan response kosong."
        );

    }

    let result;

    try {

        result =
            JSON.parse(text);

    }

    catch (error) {

        console.error(
            "Response mentah Apps Script:",
            text
        );

        throw new Error(
            "Response Google Apps Script bukan JSON."
        );

    }

    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
            result.error ||
            "Permintaan Google Sheets gagal."
        );

    }

    return result;

}


/* =========================================================
   CONNECTION CHECK
   ========================================================= */

async function checkGoogleSheetsConnection() {

    setConnectionStatus(
        "loading",
        "Menghubungkan Google Sheets..."
    );

    try {

        const result =
            await googleRequest(
                {
                    action: "ping"
                },
                "GET"
            );

        if (
            result &&
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Ping gagal."
            );

        }

        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

        return true;

    }

    catch (error) {

        console.error(
            error
        );

        setConnectionStatus(
            "offline",
            "Google Sheets tidak tersambung"
        );

        showNotification(
            error.message,
            "error"
        );

        return false;

    }

}


/* =========================================================
   LOAD MENU
   ========================================================= */

async function loadMenusFromGoogleSheets() {

    if (
        state.isLoadingMenus
    ) {
        return;
    }

    state.isLoadingMenus =
        true;

    try {

        const result =
            await googleRequest(
                {
                    action: "getMenus"
                },
                "GET"
            );

        const data =
            Array.isArray(
                result?.menus
            )
                ? result.menus
                : Array.isArray(
                    result?.data
                )
                    ? result.data
                    : [];

        state.menus =
            data
                .map(
                    menu => ({

                        id:
                            toSafeString(
                                menu.id ??
                                menu.ID ??
                                menu.ID_MENU ??
                                menu.id_menu
                            ),

                        name:
                            toSafeString(
                                menu.name ??
                                menu.nama ??
                                menu.NAMA
                            ),

                        category:
                            toSafeString(
                                menu.category ??
                                menu.kategori ??
                                menu.KATEGORI
                            ),

                        price:
                            toNumber(
                                menu.price ??
                                menu.harga ??
                                menu.HARGA
                            )

                    })
                )
                .filter(
                    menu =>
                        menu.id &&
                        menu.name
                );

        renderCategories();
        renderMenus();
        renderManagedMenus();

        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

    }

    catch (error) {

        console.error(
            "Load menu:",
            error
        );

        renderCategories();
        renderMenus();
        renderManagedMenus();

        showNotification(
            error.message ||
            "Gagal mengambil menu.",
            "error"
        );

    }

    finally {

        state.isLoadingMenus =
            false;

    }

}


/* =========================================================
   CATEGORIES
   ========================================================= */

function getCategories() {

    return [
        ...new Set(
            state.menus
                .map(
                    menu =>
                        toSafeString(
                            menu.category
                        )
                )
                .filter(Boolean)
        )
    ];

}


function renderCategories() {

    const container =
        $("categoryButtons");

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    const categories =
        getCategories();

    const all =
        document.createElement(
            "button"
        );

    all.type =
        "button";

    all.className =
        "category-button" +
        (
            state.selectedCategory === "all"
                ? " active"
                : ""
        );

    all.textContent =
        "SEMUA";

    all.addEventListener(
        "click",
        () => {

            state.selectedCategory =
                "all";

            renderCategories();
            renderMenus();

        }
    );

    container.appendChild(
        all
    );

    categories.forEach(
        category => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "category-button" +
                (
                    state.selectedCategory === category
                        ? " active"
                        : ""
                );

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

            container.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   FILTER MENU
   ========================================================= */

function getFilteredMenus() {

    const search =
        state.searchText
            .trim()
            .toLowerCase();

    return state.menus.filter(
        menu => {

            const categoryMatch =
                state.selectedCategory === "all" ||
                menu.category ===
                    state.selectedCategory;

            const searchMatch =
                !search ||
                menu.name
                    .toLowerCase()
                    .includes(search) ||
                menu.category
                    .toLowerCase()
                    .includes(search);

            return (
                categoryMatch &&
                searchMatch
            );

        }
    );

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

    list.innerHTML =
        "";

    if (
        state.menus.length === 0
    ) {

        if (empty) {
            empty.hidden =
                false;
        }

        return;

    }

    if (empty) {
        empty.hidden =
            true;
    }

    const menus =
        getFilteredMenus();

    if (
        menus.length === 0
    ) {

        list.innerHTML = `

            <div
                class="empty-state"
                style="grid-column:1/-1;"
            >

                <h3>
                    MENU TIDAK DITEMUKAN
                </h3>

                <p>
                    Coba gunakan pencarian lain.
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

    menus.forEach(
        menu => {

            const quantity =
                cartMap.get(
                    menu.id
                ) || 0;

            const card =
                document.createElement(
                    "button"
                );

            card.type =
                "button";

            card.className =
                "menu-card" +
                (
                    quantity > 0
                        ? " selected"
                        : ""
                );

            card.innerHTML = `

                <div>

                    <div class="menu-card-name">
                        ${escapeHtml(
                            menu.name
                        )}
                    </div>

                    ${
                        menu.category
                            ? `
                                <div class="menu-card-category">
                                    ${escapeHtml(
                                        menu.category
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>

                <div class="menu-card-bottom">

                    <div class="menu-card-price">
                        ${formatRupiah(
                            menu.price
                        )}
                    </div>

                    <div class="menu-card-add">
                        ${
                            quantity > 0
                                ? formatNumber(
                                    quantity
                                )
                                : "+"
                        }
                    </div>

                </div>

            `;

            card.addEventListener(
                "click",
                () => {

                    addToCart(
                        menu.id
                    );

                }
            );

            list.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   CART
   ========================================================= */

function addToCart(menuId) {

    const menu =
        state.menus.find(
            item =>
                item.id ===
                menuId
        );

    if (!menu) {

        showNotification(
            "Menu tidak ditemukan.",
            "error"
        );

        return;

    }

    const existing =
        state.cart.find(
            item =>
                item.menuId ===
                menuId
        );

    if (existing) {

        existing.quantity += 1;

    }

    else {

        state.cart.push({

            menuId:
                menu.id,

            name:
                menu.name,

            category:
                menu.category || "",

            price:
                toNumber(
                    menu.price
                ),

            quantity:
                1

        });

    }

    renderCart();
    renderMenus();

}


function removeFromCart(menuId) {

    state.cart =
        state.cart.filter(
            item =>
                item.menuId !==
                menuId
        );

    renderCart();
    renderMenus();

}


function changeCartQuantity(
    menuId,
    change
) {

    const item =
        state.cart.find(
            cartItem =>
                cartItem.menuId ===
                menuId
        );

    if (!item) {
        return;
    }

    item.quantity =
        Number(item.quantity) +
        Number(change);

    if (
        item.quantity <= 0
    ) {

        removeFromCart(
            menuId
        );

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
        (
            total,
            item
        ) => {

            return (
                total +
                (
                    toNumber(
                        item.price
                    ) *
                    toNumber(
                        item.quantity
                    )
                )
            );

        },
        0
    );

}


function getCartItemCount() {

    return state.cart.reduce(
        (
            total,
            item
        ) =>
            total +
            toNumber(
                item.quantity
            ),
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

    list.innerHTML =
        "";

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

    if (
        state.cart.length === 0
    ) {

        if (empty) {
            empty.style.display =
                "";
        }

        updatePaymentUI();

        return;

    }

    if (empty) {
        empty.style.display =
            "none";
    }

    state.cart.forEach(
        item => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "cart-item";

            const subtotal =
                toNumber(
                    item.price
                ) *
                toNumber(
                    item.quantity
                );

            row.innerHTML = `

                <div class="cart-item-header">

                    <div>

                        <div class="cart-item-name">
                            ${escapeHtml(
                                item.name
                            )}
                        </div>

                        <div class="cart-item-subtotal">

                            ${formatRupiah(
                                item.price
                            )}

                            ×

                            ${formatNumber(
                                item.quantity
                            )}

                        </div>

                    </div>

                    <div class="cart-item-price">
                        ${formatRupiah(
                            subtotal
                        )}
                    </div>

                </div>

                <div class="cart-item-controls">

                    <div class="quantity-controls">

                        <button
                            type="button"
                            class="quantity-button"
                            data-action="minus"
                            data-id="${escapeHtml(
                                item.menuId
                            )}"
                        >
                            −
                        </button>

                        <div class="quantity-value">
                            ${formatNumber(
                                item.quantity
                            )}
                        </div>

                        <button
                            type="button"
                            class="quantity-button"
                            data-action="plus"
                            data-id="${escapeHtml(
                                item.menuId
                            )}"
                        >
                            +
                        </button>

                    </div>

                    <button
                        type="button"
                        class="remove-cart-item"
                        data-id="${escapeHtml(
                            item.menuId
                        )}"
                    >
                        HAPUS
                    </button>

                </div>

            `;

            list.appendChild(
                row
            );

        }
    );

    list.querySelectorAll(
        ".quantity-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    changeCartQuantity(
                        button.dataset.id,
                        button.dataset.action === "plus"
                            ? 1
                            : -1
                    );

                }
            );

        }
    );

    list.querySelectorAll(
        ".remove-cart-item"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    removeFromCart(
                        button.dataset.id
                    );

                }
            );

        }
    );

    updatePaymentUI();

}


/* =========================================================
   PAYMENT
   ========================================================= */

function getPaymentAmount() {

    const input =
        $("paymentAmount");

    return input
        ? toNumber(input.value)
        : 0;

}


function updatePaymentUI() {

    const total =
        getCartTotal();

    const payment =
        getPaymentAmount();

    const change =
        payment -
        total;

    const changeElement =
        $("changeAmount");

    const button =
        $("payButton");

    const message =
        $("paymentMessage");

    if (changeElement) {

        changeElement.textContent =
            formatRupiah(
                Math.max(
                    0,
                    change
                )
            );

    }

    if (message) {

        message.textContent =
            payment > 0 &&
            payment < total
                ? `Uang kurang ${formatRupiah(
                    total - payment
                )}`
                : "";

    }

    if (button) {

        button.disabled =
            state.cart.length === 0 ||
            total <= 0 ||
            payment < total ||
            state.isSaving;

    }

}


/* =========================================================
   CLEAR CART
   ========================================================= */

function clearCart() {

    state.cart =
        [];

    const input =
        $("paymentAmount");

    if (input) {
        input.value =
            "";
    }

    renderCart();
    renderMenus();

}


/* =========================================================
   CREATE SALE
   ========================================================= */

function createSale() {

    if (
        state.cart.length === 0
    ) {

        throw new Error(
            "Keranjang masih kosong."
        );

    }

    const total =
        getCartTotal();

    const payment =
        getPaymentAmount();

    if (
        total <= 0
    ) {

        throw new Error(
            "Total transaksi tidak valid."
        );

    }

    if (
        payment < total
    ) {

        throw new Error(
            "Pembayaran masih kurang."
        );

    }

    const now =
        new Date();

    return {

        id:
            generateId(
                "sale"
            ),

        transactionNumber:
            generateTransactionNumber(),

        dateKey:
            getTodayKey(),

        date:
            now.toISOString(),

        items:
            state.cart.map(
                item => {

                    const price =
                        toNumber(
                            item.price
                        );

                    const quantity =
                        toNumber(
                            item.quantity
                        );

                    return {

                        menuId:
                            item.menuId,

                        name:
                            item.name,

                        category:
                            item.category || "",

                        price,

                        quantity,

                        subtotal:
                            price *
                            quantity

                    };

                }
            ),

        total,

        payment,

        change:
            payment - total

    };

}


/* =========================================================
   SAVE SALE
   ========================================================= */

async function saveSaleToGoogleSheets(
    sale
) {

    const result =
        await googleRequest({

            action:
                "saveSale",

            sale

        });

    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
            "Transaksi gagal disimpan."
        );

    }

    return result;

}


/* =========================================================
   PROCESS PAYMENT
   ========================================================= */

async function processPayment() {

    if (
        state.isSaving
    ) {
        return;
    }

    let sale;

    try {

        sale =
            createSale();

    }

    catch (error) {

        showNotification(
            error.message,
            "error"
        );

        return;

    }

    state.isSaving =
        true;

    updatePaymentUI();

    try {

        setConnectionStatus(
            "loading",
            "Menyimpan transaksi..."
        );

        await saveSaleToGoogleSheets(
            sale
        );

        state.lastCompletedSale =
            sale;

        /*
         * Setelah berhasil:
         * langsung ambil ulang dari Sheets.
         */

        await loadTodaySalesFromGoogleSheets();

        /*
         * Baru kosongkan keranjang.
         */

        clearCart();

        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

        showNotification(
            "Pembayaran berhasil disimpan.",
            "success"
        );

        openPaymentSuccessModal(
            sale
        );

    }

    catch (error) {

        console.error(
            "Pembayaran:",
            error
        );

        /*
         * JANGAN kosongkan keranjang
         * jika gagal.
         */

        setConnectionStatus(
            "offline",
            "Gagal menyimpan transaksi"
        );

        showNotification(
            error.message ||
            "Transaksi gagal.",
            "error"
        );

    }

    finally {

        state.isSaving =
            false;

        updatePaymentUI();

    }

}


/* =========================================================
   EXTRACT SALES
   ========================================================= */

function extractSalesFromResponse(
    result
) {

    if (!result) {
        return [];
    }

    if (
        Array.isArray(
            result.sales
        )
    ) {

        return result.sales;

    }

    if (
        Array.isArray(
            result.data
        )
    ) {

        return result.data;

    }

    if (
        Array.isArray(
            result.result
        )
    ) {

        return result.result;

    }

    if (
        Array.isArray(
            result.rows
        )
    ) {

        return result.rows;

    }

    if (
        Array.isArray(
            result
        )
    ) {

        return result;

    }

    return [];

}


/* =========================================================
   NORMALIZE SALES
   ========================================================= */

function normalizeSales(
    sales
) {

    if (
        !Array.isArray(
            sales
        )
    ) {

        return [];

    }

    return sales
        .map(
            sale => {

                /*
                 * =================================================
                 * ARRAY / ROW SHEET
                 *
                 * 0 ID_PENJUALAN
                 * 1 NO_TRANSAKSI
                 * 2 TANGGAL
                 * 3 TANGGAL_KEY
                 * 4 TOTAL
                 * 5 PEMBAYARAN
                 * 6 KEMBALIAN
                 * 7 JUMLAH_ITEM
                 * =================================================
                 */

                if (
                    Array.isArray(
                        sale
                    )
                ) {

                    return {

                        id:
                            toSafeString(
                                sale[0]
                            ),

                        transactionNumber:
                            toSafeString(
                                sale[1]
                            ),

                        date:
                            sale[2] ||
                            "",

                        dateKey:
                            normalizeDateKey(
                                sale[3]
                            ),

                        total:
                            toNumber(
                                sale[4]
                            ),

                        payment:
                            toNumber(
                                sale[5]
                            ),

                        change:
                            toNumber(
                                sale[6]
                            ),

                        itemCount:
                            toNumber(
                                sale[7]
                            ),

                        items:
                            []

                    };

                }

                /*
                 * OBJECT
                 */

                const id =
                    toSafeString(
                        sale.id ??
                        sale.ID ??
                        sale.ID_PENJUALAN ??
                        sale.id_penjualan
                    );

                const transactionNumber =
                    toSafeString(
                        sale.transactionNumber ??
                        sale.noTransaksi ??
                        sale.no_transaksi ??
                        sale.NO_TRANSAKSI
                    );

                const date =
                    sale.date ??
                    sale.tanggal ??
                    sale.TANGGAL ??
                    sale.timestamp ??
                    "";

                const dateKey =
                    normalizeDateKey(
                        sale.dateKey ??
                        sale.tanggal_key ??
                        sale.TANGGAL_KEY ??
                        sale.DATE_KEY
                    );

                const total =
                    toNumber(
                        sale.total ??
                        sale.TOTAL
                    );

                const payment =
                    toNumber(
                        sale.payment ??
                        sale.pembayaran ??
                        sale.PEMBAYARAN
                    );

                const change =
                    toNumber(
                        sale.change ??
                        sale.kembalian ??
                        sale.KEMBALIAN
                    );

                const itemCount =
                    toNumber(
                        sale.itemCount ??
                        sale.jumlahItem ??
                        sale.JUMLAH_ITEM
                    );

                let items =
                    sale.items ??
                    sale.ITEMS ??
                    sale.detail ??
                    sale.details ??
                    [];

                if (
                    typeof items ===
                    "string"
                ) {

                    try {

                        items =
                            JSON.parse(
                                items
                            );

                    }

                    catch (error) {

                        items =
                            [];

                    }

                }

                if (
                    !Array.isArray(
                        items
                    )
                ) {

                    items =
                        [];

                }

                return {

                    id,

                    transactionNumber,

                    date,

                    dateKey,

                    total,

                    payment,

                    change,

                    itemCount,

                    items

                };

            }
        )
        .filter(
            sale =>
                sale.id ||
                sale.transactionNumber
        );

}


/* =========================================================
   LOAD PENJUALAN DARI GOOGLE SHEETS
   =========================================================

   PENTING:

   Tidak mengirim dateKey.

   Apps Script menentukan data
   penjualan yang dikembalikan.

   Frontend hanya memakai response.
   ========================================================= */

async function loadTodaySalesFromGoogleSheets() {

    if (
        state.isLoadingSales
    ) {
        return;
    }

    state.isLoadingSales =
        true;

    try {

        const result =
            await googleRequest(
                {
                    action:
                        "getTodaySales"
                },
                "GET"
            );

        console.log(
            "[PENJUALAN GOOGLE SHEETS]",
            result
        );

        const rawSales =
            extractSalesFromResponse(
                result
            );

        state.todaySales =
            normalizeSales(
                rawSales
            );

        /*
         * LANGSUNG tampilkan response.
         * Tidak filter lagi di browser.
         */

        renderSalesHistory();

        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

        return state.todaySales;

    }

    catch (error) {

        console.error(
            "Gagal mengambil penjualan:",
            error
        );

        state.todaySales =
            [];

        renderSalesHistory();

        setConnectionStatus(
            "offline",
            "Gagal mengambil penjualan"
        );

        showNotification(
            error.message ||
            "Gagal mengambil penjualan dari Google Sheets.",
            "error"
        );

        return [];

    }

    finally {

        state.isLoadingSales =
            false;

    }

}


/* =========================================================
   RENDER STATISTIK PENJUALAN
   ========================================================= */

function renderSalesHistory() {

    const count =
        $("todayTransactionCount");

    const total =
        $("todaySalesTotal");

    const list =
        $("salesHistory");

    const empty =
        $("emptySales");

    const sales =
        Array.isArray(
            state.todaySales
        )
            ? state.todaySales
            : [];

    /*
     * TRANSAKSI
     */

    if (count) {

        count.textContent =
            formatNumber(
                sales.length
            );

    }

    /*
     * TOTAL
     */

    const totalPenjualan =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                toNumber(
                    sale.total
                ),
            0
        );

    if (total) {

        total.textContent =
            formatRupiah(
                totalPenjualan
            );

    }

    /*
     * Riwayat tidak wajib ditampilkan.
     */

    if (list) {

        list.innerHTML =
            "";

    }

    if (empty) {

        empty.hidden =
            true;

        empty.style.display =
            "none";

    }

}


/* =========================================================
   DOWNLOAD PENJUALAN
   ========================================================= */

async function downloadTodaySales() {

    try {

        showNotification(
            "Mengambil data penjualan dari Google Sheets...",
            "success"
        );

        /*
         * Ambil ulang data TERBARU.
         */

        const result =
            await googleRequest(
                {
                    action:
                        "getTodaySales"
                },
                "GET"
            );

        console.log(
            "[DOWNLOAD PENJUALAN]",
            result
        );

        const rawSales =
            extractSalesFromResponse(
                result
            );

        const sales =
            normalizeSales(
                rawSales
            );

        state.todaySales =
            sales;

        renderSalesHistory();

        if (
            sales.length === 0
        ) {

            showNotification(
                "Tidak ada data penjualan dari Google Sheets.",
                "warning"
            );

            return;

        }

        const rows = [];

        rows.push([
            "ID_PENJUALAN",
            "NO_TRANSAKSI",
            "TANGGAL",
            "TANGGAL_KEY",
            "TOTAL",
            "PEMBAYARAN",
            "KEMBALIAN",
            "JUMLAH_ITEM"
        ]);

        sales.forEach(
            sale => {

                rows.push([

                    sale.id,

                    sale.transactionNumber,

                    sale.date,

                    sale.dateKey,

                    sale.total,

                    sale.payment,

                    sale.change,

                    sale.itemCount

                ]);

            }
        );

        const totalPenjualan =
            sales.reduce(
                (
                    sum,
                    sale
                ) =>
                    sum +
                    toNumber(
                        sale.total
                    ),
                0
            );

        rows.push([]);

        rows.push([
            "TOTAL TRANSAKSI",
            sales.length
        ]);

        rows.push([
            "TOTAL PENJUALAN",
            totalPenjualan
        ]);

        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                csvEscape
                            )
                            .join(",")
                )
                .join("\r\n");

        const blob =
            new Blob(
                [
                    "\uFEFF" +
                    csv
                ],
                {
                    type:
                        "text/csv;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href =
            url;

        link.download =
            "penjualan-" +
            getTodayKey() +
            ".csv";

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );

        showNotification(
            "Download penjualan berhasil.",
            "success"
        );

    }

    catch (error) {

        console.error(
            "Download:",
            error
        );

        showNotification(
            error.message ||
            "Download penjualan gagal.",
            "error"
        );

    }

}


/* =========================================================
   CSV ESCAPE
   ========================================================= */

function csvEscape(value) {

    const text =
        String(
            value ?? ""
        );

    if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n") ||
        text.includes("\r")
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
   RESET MODAL
   ========================================================= */

function openResetModal() {

    const modal =
        $("resetModal");

    if (!modal) {

        /*
         * Kalau HTML tidak mempunyai modal,
         * tetap jalankan konfirmasi browser.
         */

        resetTodaySales();

        return;

    }

    const message =
        $("resetMessage");

    if (message) {

        message.textContent =
            "";

    }

    modal.hidden =
        false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeResetModal() {

    const modal =
        $("resetModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   RESET SEMUA PENJUALAN
   =========================================================

   TIDAK mengirim dateKey.

   Apps Script menerima:

       action: deleteTodaySales

   dan bertugas menghapus DATA PENJUALAN
   pada sheet PENJUALAN.

   MENU tidak disentuh.
   ========================================================= */

async function resetTodaySales() {

    if (
        state.isResetting
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            "YAKIN? Semua data penjualan pada sheet PENJUALAN akan dihapus. Menu dan harga tidak dihapus."
        );

    if (!confirmed) {
        return;
    }

    state.isResetting =
        true;

    const message =
        $("resetMessage");

    if (message) {

        message.textContent =
            "Menghapus data penjualan...";

    }

    try {

        setConnectionStatus(
            "loading",
            "Menghapus data penjualan..."
        );

        /*
         * HANYA action.
         *
         * Tidak ada dateKey.
         */

        const result =
            await googleRequest({

                action:
                    "deleteTodaySales"

            });

        console.log(
            "[RESET PENJUALAN]",
            result
        );

        if (
            result &&
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Google Sheets menolak reset."
            );

        }

        /*
         * Kosongkan tampilan dulu.
         */

        state.todaySales =
            [];

        renderSalesHistory();

        /*
         * Ambil ulang dari Sheets.
         *
         * Jika Apps Script memang sudah
         * menghapus data, hasilnya kosong.
         */

        await loadTodaySalesFromGoogleSheets();

        closeResetModal();

        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

        showNotification(
            "Data penjualan berhasil dihapus dari Google Sheets.",
            "success"
        );

    }

    catch (error) {

        console.error(
            "RESET ERROR:",
            error
        );

        setConnectionStatus(
            "offline",
            "Reset penjualan gagal"
        );

        if (message) {

            message.textContent =
                error.message ||
                "Reset gagal.";

        }

        showNotification(
            error.message ||
            "Gagal menghapus data penjualan.",
            "error"
        );

    }

    finally {

        state.isResetting =
            false;

    }

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

    modal.hidden =
        false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    resetMenuForm();

    renderManagedMenus();

}


function closeMenuModal() {

    const modal =
        $("menuModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    resetMenuForm();

}


function resetMenuForm() {

    state.editingMenuId =
        null;

    const form =
        $("menuForm");

    if (form) {
        form.reset();
    }

    if ($("menuId")) {
        $("menuId").value =
            "";
    }

    if ($("menuFormMessage")) {
        $("menuFormMessage").textContent =
            "";
    }

    if ($("menuModalTitle")) {

        $("menuModalTitle")
            .textContent =
                "KELOLA MENU";

    }

}


/* =========================================================
   EDIT MENU
   ========================================================= */

function editMenu(menuId) {

    const menu =
        state.menus.find(
            item =>
                item.id ===
                menuId
        );

    if (!menu) {
        return;
    }

    state.editingMenuId =
        menuId;

    if ($("menuId")) {
        $("menuId").value =
            menu.id;
    }

    if ($("menuName")) {
        $("menuName").value =
            menu.name;
    }

    if ($("menuCategory")) {
        $("menuCategory").value =
            menu.category || "";
    }

    if ($("menuPrice")) {
        $("menuPrice").value =
            menu.price;
    }

    if ($("menuModalTitle")) {

        $("menuModalTitle")
            .textContent =
                "EDIT MENU";

    }

}


/* =========================================================
   SAVE MENU
   ========================================================= */

async function saveMenu(event) {

    event.preventDefault();

    if (
        state.isSaving
    ) {
        return;
    }

    const name =
        $("menuName")
            ?.value
            .trim();

    const category =
        $("menuCategory")
            ?.value
            .trim() ||
        "";

    const price =
        toNumber(
            $("menuPrice")
                ?.value
        );

    if (!name) {

        showNotification(
            "Nama menu wajib diisi.",
            "error"
        );

        return;

    }

    state.isSaving =
        true;

    try {

        if (
            state.editingMenuId
        ) {

            await googleRequest({

                action:
                    "updateMenu",

                menu: {

                    id:
                        state.editingMenuId,

                    name,

                    category,

                    price

                }

            });

            showNotification(
                "Menu berhasil diperbarui.",
                "success"
            );

        }

        else {

            await googleRequest({

                action:
                    "saveMenu",

                menu: {

                    id:
                        generateId(
                            "menu"
                        ),

                    name,

                    category,

                    price

                }

            });

            showNotification(
                "Menu berhasil ditambahkan.",
                "success"
            );

        }

        resetMenuForm();

        await loadMenusFromGoogleSheets();

    }

    catch (error) {

        console.error(
            error
        );

        showNotification(
            error.message ||
            "Gagal menyimpan menu.",
            "error"
        );

    }

    finally {

        state.isSaving =
            false;

    }

}


/* =========================================================
   DELETE MENU
   ========================================================= */

async function deleteMenu(menuId) {

    const menu =
        state.menus.find(
            item =>
                item.id ===
                menuId
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

    state.isSaving =
        true;

    try {

        await googleRequest({

            action:
                "deleteMenu",

            menuId

        });

        state.cart =
            state.cart.filter(
                item =>
                    item.menuId !==
                    menuId
            );

        await loadMenusFromGoogleSheets();

        renderCart();

        showNotification(
            "Menu berhasil dihapus.",
            "success"
        );

    }

    catch (error) {

        console.error(
            error
        );

        showNotification(
            error.message ||
            "Gagal menghapus menu.",
            "error"
        );

    }

    finally {

        state.isSaving =
            false;

    }

}


/* =========================================================
   MANAGED MENU
   ========================================================= */

function renderManagedMenus() {

    const list =
        $("managedMenuList");

    const empty =
        $("emptyManagedMenu");

    if (!list) {
        return;
    }

    list.innerHTML =
        "";

    if (
        state.menus.length === 0
    ) {

        if (empty) {
            empty.style.display =
                "";
        }

        return;

    }

    if (empty) {
        empty.style.display =
            "none";
    }

    state.menus.forEach(
        menu => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "managed-menu-item";

            item.innerHTML = `

                <div class="managed-menu-info">

                    <div class="managed-menu-name">
                        ${escapeHtml(
                            menu.name
                        )}
                    </div>

                    <div class="managed-menu-price">
                        ${formatRupiah(
                            menu.price
                        )}
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
                        data-id="${escapeHtml(
                            menu.id
                        )}"
                    >
                        EDIT
                    </button>

                    <button
                        type="button"
                        class="menu-delete-button"
                        data-id="${escapeHtml(
                            menu.id
                        )}"
                    >
                        HAPUS
                    </button>

                </div>

            `;

            list.appendChild(
                item
            );

        }
    );

    list.querySelectorAll(
        ".menu-edit-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    editMenu(
                        button.dataset.id
                    );

                }
            );

        }
    );

    list.querySelectorAll(
        ".menu-delete-button"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    deleteMenu(
                        button.dataset.id
                    );

                }
            );

        }
    );

}


/* =========================================================
   PAYMENT SUCCESS
   ========================================================= */

function openPaymentSuccessModal(
    sale
) {

    if (!sale) {
        return;
    }

    if (
        $("successTransactionNumber")
    ) {

        $("successTransactionNumber")
            .textContent =
                sale.transactionNumber;

    }

    if (
        $("successTotal")
    ) {

        $("successTotal")
            .textContent =
                formatRupiah(
                    sale.total
                );

    }

    if (
        $("successPayment")
    ) {

        $("successPayment")
            .textContent =
                formatRupiah(
                    sale.payment
                );

    }

    if (
        $("successChange")
    ) {

        $("successChange")
            .textContent =
                formatRupiah(
                    sale.change
                );

    }

    const modal =
        $("paymentSuccessModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closePaymentSuccessModal() {

    const modal =
        $("paymentSuccessModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   PRINT
   ========================================================= */

function printReceipt(sale) {

    if (!sale) {
        return;
    }

    const printArea =
        $("printArea") ||
        $("printReceipt");

    if (!printArea) {

        showNotification(
            "Area struk tidak ditemukan.",
            "error"
        );

        return;

    }

    const items =
        Array.isArray(
            sale.items
        )
            ? sale.items
            : [];

    printArea.innerHTML = `

        <div class="receipt-header">

            <div class="receipt-store-name">
                KASIR
            </div>

        </div>

        <div class="receipt-info">

            <div class="receipt-info-row">

                <span>
                    Tanggal
                </span>

                <span>
                    ${formatDateTimeIndonesia(
                        sale.date
                    )}
                </span>

            </div>

            <div class="receipt-info-row">

                <span>
                    No. Transaksi
                </span>

                <span>
                    ${escapeHtml(
                        sale.transactionNumber
                    )}
                </span>

            </div>

        </div>

        <div class="receipt-line"></div>

        <div class="receipt-items">

            ${
                items.map(
                    item => `

                        <div class="receipt-item">

                            <div class="receipt-item-name">
                                ${escapeHtml(
                                    item.name
                                )}
                            </div>

                            <div class="receipt-item-detail">

                                <span>
                                    ${formatNumber(
                                        item.quantity
                                    )}
                                    ×
                                    ${formatRupiah(
                                        item.price
                                    )}
                                </span>

                                <strong>
                                    ${formatRupiah(
                                        item.subtotal
                                    )}
                                </strong>

                            </div>

                        </div>

                    `
                ).join("")
            }

        </div>

        <div class="receipt-line"></div>

        <div class="receipt-total-section">

            <div class="receipt-total-row">

                <span>
                    TOTAL
                </span>

                <strong>
                    ${formatRupiah(
                        sale.total
                    )}
                </strong>

            </div>

            <div class="receipt-total-row">

                <span>
                    BAYAR
                </span>

                <strong>
                    ${formatRupiah(
                        sale.payment
                    )}
                </strong>

            </div>

            <div class="receipt-total-row">

                <span>
                    KEMBALI
                </span>

                <strong>
                    ${formatRupiah(
                        sale.change
                    )}
                </strong>

            </div>

        </div>

        <div class="receipt-footer">

            <div>
                TERIMA KASIH
            </div>

        </div>

    `;

    window.print();

}


/* =========================================================
   SEARCH
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
                event.target.value ||
                "";

            renderMenus();

        }
    );

}


/* =========================================================
   PAYMENT INPUT
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
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                if (
                    $("payButton") &&
                    !$("payButton").disabled
                ) {

                    processPayment();

                }

            }

        }
    );

}


/* =========================================================
   EVENTS
   ========================================================= */

function initializeEvents() {

    $("manageMenuButton")
        ?.addEventListener(
            "click",
            openMenuModal
        );

    $("addMenuFromEmpty")
        ?.addEventListener(
            "click",
            openMenuModal
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

                if (
                    $("menuModalTitle")
                ) {

                    $("menuModalTitle")
                        .textContent =
                            "MENU BARU";

                }

                $("menuName")
                    ?.focus();

            }
        );

    $("menuForm")
        ?.addEventListener(
            "submit",
            saveMenu
        );

    $("clearCartButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.cart.length === 0
                ) {
                    return;
                }

                if (
                    confirm(
                        "Kosongkan semua pesanan?"
                    )
                ) {

                    clearCart();

                }

            }
        );

    $("payButton")
        ?.addEventListener(
            "click",
            processPayment
        );

    $("printReceiptButton")
        ?.addEventListener(
            "click",
            () => {

                printReceipt(
                    state.lastCompletedSale
                );

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
     * DOWNLOAD
     */

    $("downloadTodayButton")
        ?.addEventListener(
            "click",
            downloadTodaySales
        );

    /*
     * RESET
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
     * ESC
     */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            const menuModal =
                $("menuModal");

            const resetModal =
                $("resetModal");

            const successModal =
                $("paymentSuccessModal");

            if (
                menuModal &&
                !menuModal.hidden
            ) {

                closeMenuModal();

            }

            if (
                resetModal &&
                !resetModal.hidden
            ) {

                closeResetModal();

            }

            if (
                successModal &&
                !successModal.hidden
            ) {

                closePaymentSuccessModal();

            }

        }
    );

}


/* =========================================================
   CURRENT DATE
   ========================================================= */

function renderCurrentDate() {

    const now =
        new Date();

    const text =
        new Intl.DateTimeFormat(
            "id-ID",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        ).format(
            now
        );

    if (
        $("currentDate")
    ) {

        $("currentDate")
            .textContent =
                text;

    }

    if (
        $("salesDate")
    ) {

        $("salesDate")
            .textContent =
                "Tanggal: " +
                formatDateIndonesia(
                    now
                );

    }

}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshAllData() {

    await loadMenusFromGoogleSheets();

    await loadTodaySalesFromGoogleSheets();

}


/* =========================================================
   AUTO REFRESH PENJUALAN
   ========================================================= */

function initializeAutoRefresh() {

    setInterval(
        async () => {

            if (
                state.isSaving ||
                state.isResetting
            ) {
                return;
            }

            await loadTodaySalesFromGoogleSheets();

        },
        60 * 1000
    );

}


/* =========================================================
   INIT
   ========================================================= */

async function initializeApp() {

    if (
        state.initialized
    ) {
        return;
    }

    state.initialized =
        true;

    renderCurrentDate();

    renderCategories();

    renderMenus();

    renderCart();

    renderSalesHistory();

    initializeSearch();

    initializePaymentInput();

    initializeEvents();

    const connected =
        await checkGoogleSheetsConnection();

    if (!connected) {
        return;
    }

    await refreshAllData();

    initializeAutoRefresh();

    setInterval(
        renderCurrentDate,
        60 * 1000
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
        initializeApp,
        {
            once: true
        }
    );

}

else {

    initializeApp();

}
