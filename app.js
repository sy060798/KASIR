/* =========================================================
   KASIR APP.JS
   DATABASE UTAMA: GOOGLE SHEETS
   =========================================================

   FITUR:
   - Ambil menu langsung dari Google Sheets
   - Tambah menu langsung ke Google Sheets
   - Edit menu langsung ke Google Sheets
   - Hapus menu langsung dari Google Sheets
   - Pencarian menu
   - Filter kategori
   - Keranjang
   - Tambah / kurang jumlah
   - Total pembayaran
   - Hitung kembalian
   - Simpan transaksi langsung ke Google Sheets
   - Riwayat penjualan hari ini dari Google Sheets
   - Download penjualan hari ini
   - Reset penjualan hari ini di Google Sheets
   - Print struk
   - Tidak menggunakan localStorage sebagai database

   SHEET:
   - MENU
   - PENJUALAN
   - DETAIL_PENJUALAN

   UPDATE:
   - Validasi response server
   - Validasi data menu
   - Validasi transaksi
   - Normalisasi angka Google Sheets
   - Normalisasi TANGGAL_KEY
   - Mencegah double payment
   - Tidak mengosongkan keranjang jika save gagal
   - Refresh data setelah operasi penting
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

    selectedSale: null,

    lastCompletedSale: null,

    isLoadingMenus: false,

    isLoadingSales: false,

    isSaving: false,

    isResetting: false,

    initialized: false

};


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
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


    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : 0;

    }


    let text =
        String(value)
            .trim();


    if (!text) {
        return 0;
    }


    /*
     * Format Indonesia:
     * 10.000
     * 10.000,50
     */

    if (
        text.includes(",") &&
        text.includes(".")
    ) {

        text =
            text
                .replaceAll(".", "")
                .replace(",", ".");

    }

    else if (
        text.includes(",")
    ) {

        text =
            text.replace(",", ".");

    }


    const number =
        Number(text);


    return Number.isFinite(number)
        ? number
        : 0;

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
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {

    const number =
        toNumber(value);


    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }
    ).format(number);

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
   TANGGAL
========================================================= */

function getDateObject() {

    return new Date();

}


function getTodayKey() {

    const date =
        getDateObject();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/* =========================================================
   NORMALIZE DATE KEY
========================================================= */

function normalizeDateKey(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    const text =
        String(value)
            .trim();


    if (!text) {
        return "";
    }


    /*
     * YYYY-MM-DD
     */

    const isoMatch =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (isoMatch) {

        return (
            `${isoMatch[1]}-` +
            `${isoMatch[2]}-` +
            `${isoMatch[3]}`
        );

    }


    /*
     * DD/MM/YYYY
     */

    const indoMatch =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (indoMatch) {

        return (
            `${indoMatch[3]}-` +
            `${String(
                indoMatch[2]
            ).padStart(2, "0")}-` +
            `${String(
                indoMatch[1]
            ).padStart(2, "0")}`
        );

    }


    /*
     * DD-MM-YYYY
     */

    const dashMatch =
        text.match(
            /^(\d{1,2})-(\d{1,2})-(\d{4})/
        );


    if (dashMatch) {

        return (
            `${dashMatch[3]}-` +
            `${String(
                dashMatch[2]
            ).padStart(2, "0")}-` +
            `${String(
                dashMatch[1]
            ).padStart(2, "0")}`
        );

    }


    /*
     * Coba Date.
     */

    const parsed =
        new Date(text);


    if (
        !Number.isNaN(
            parsed.getTime()
        )
    ) {

        const year =
            parsed.getFullYear();


        const month =
            String(
                parsed.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                parsed.getDate()
            ).padStart(
                2,
                "0"
            );


        return (
            `${year}-${month}-${day}`
        );

    }


    return "";

}


/* =========================================================
   FORMAT DATE INDONESIA
========================================================= */

function formatDateIndonesia(
    dateValue
) {

    if (
        dateValue === null ||
        dateValue === undefined ||
        dateValue === ""
    ) {
        return "-";
    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
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


/* =========================================================
   FORMAT DATE TIME
========================================================= */

function formatDateTimeIndonesia(
    dateValue
) {

    if (
        dateValue === null ||
        dateValue === undefined ||
        dateValue === ""
    ) {
        return "-";
    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
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
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   ID
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
   TRANSACTION NUMBER
========================================================= */

function generateTransactionNumber() {

    const now =
        new Date();


    const date =
        getTodayKey()
            .replaceAll(
                "-",
                ""
            );


    const hour =
        String(
            now.getHours()
        ).padStart(
            2,
            "0"
        );


    const minute =
        String(
            now.getMinutes()
        ).padStart(
            2,
            "0"
        );


    const second =
        String(
            now.getSeconds()
        ).padStart(
            2,
            "0"
        );


    const millisecond =
        String(
            now.getMilliseconds()
        ).padStart(
            3,
            "0"
        );


    const random =
        Math.floor(
            Math.random() * 1000
        )
        .toString()
        .padStart(
            3,
            "0"
        );


    return (
        `${date}-` +
        `${hour}${minute}${second}` +
        `${millisecond}-` +
        `${random}`
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


    if (
        !indicator ||
        !label
    ) {
        return;
    }


    indicator.classList.remove(
        "online",
        "offline",
        "loading"
    );


    indicator.classList.add(
        status
    );


    label.textContent =
        text;

}


/* =========================================================
   API REQUEST
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
                        value !== null
                    ) {

                        params.set(
                            key,
                            String(value)
                        );

                    }

                }
            );


        response =
            await fetch(
                GOOGLE_SCRIPT_URL +
                "?" +
                params.toString(),
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
            `Server Google Sheets error: HTTP ${response.status}`
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
            JSON.parse(
                text
            );

    }

    catch (error) {

        console.error(
            "Response Google Apps Script:",
            text
        );


        throw new Error(
            "Response Google Apps Script bukan JSON yang valid."
        );

    }


    if (
        result === null ||
        result === undefined
    ) {

        throw new Error(
            "Response Google Apps Script kosong."
        );

    }


    if (
        result.success === false
    ) {

        throw new Error(
            result.message ||
            result.error ||
            "Google Sheets menolak permintaan."
        );

    }


    return result;

}


/* =========================================================
   PING GOOGLE SHEETS
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
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Ping Google Sheets gagal."
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
            "Google Sheets:",
            error
        );


        setConnectionStatus(
            "offline",
            "Google Sheets tidak tersambung"
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


        const menus =
            Array.isArray(
                result.menus
            )
                ? result.menus
                : Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];


        state.menus =
            menus
                .map(
                    menu => {

                        const id =
                            toSafeString(
                                menu.id ??
                                menu.ID ??
                                menu.ID_MENU ??
                                menu.id_menu
                            );


                        const name =
                            toSafeString(
                                menu.name ??
                                menu.nama ??
                                menu.Nama ??
                                menu.NAMA
                            );


                        const category =
                            toSafeString(
                                menu.category ??
                                menu.kategori ??
                                menu.Kategori ??
                                menu.KATEGORI
                            );


                        const price =
                            toNumber(
                                menu.price ??
                                menu.harga ??
                                menu.Harga ??
                                menu.HARGA
                            );


                        return {

                            id,

                            name,

                            category,

                            price

                        };

                    }
                )
                .filter(
                    menu =>
                        menu.id &&
                        menu.name
                );


        /*
         * Jika kategori yang sedang dipilih
         * sudah tidak tersedia, kembali ke SEMUA.
         */

        const categories =
            getCategories();


        if (
            state.selectedCategory !== "all" &&
            !categories.includes(
                state.selectedCategory
            )
        ) {

            state.selectedCategory =
                "all";

        }


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
            "Gagal mengambil menu:",
            error
        );


        /*
         * Jangan menghapus data menu lama
         * hanya karena request sementara gagal.
         */

        renderCategories();

        renderMenus();

        renderManagedMenus();


        setConnectionStatus(
            "offline",
            "Gagal mengambil menu dari Google Sheets"
        );


        showNotification(
            error.message ||
            "Gagal mengambil menu dari Google Sheets.",
            "error"
        );

    }

    finally {

        state.isLoadingMenus =
            false;

    }

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

            const matchCategory =
                state.selectedCategory ===
                    "all" ||
                menu.category ===
                    state.selectedCategory;


            const matchSearch =
                !search ||
                menu.name
                    .toLowerCase()
                    .includes(search) ||
                menu.category
                    .toLowerCase()
                    .includes(search);


            return (
                matchCategory &&
                matchSearch
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


            card.dataset.menuId =
                menu.id;


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
   CATEGORIES
========================================================= */

function getCategories() {

    const categories =
        state.menus
            .map(
                menu =>
                    toSafeString(
                        menu.category
                    )
            )
            .filter(Boolean);


    return [
        ...new Set(
            categories
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


    const allButton =
        document.createElement(
            "button"
        );


    allButton.type =
        "button";


    allButton.className =
        "category-button" +
        (
            state.selectedCategory ===
                "all"
                ? " active"
                : ""
        );


    allButton.textContent =
        "SEMUA";


    allButton.addEventListener(
        "click",
        () => {

            state.selectedCategory =
                "all";

            renderCategories();

            renderMenus();

        }
    );


    container.appendChild(
        allButton
    );


    getCategories().forEach(
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
                    state.selectedCategory ===
                        category
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
   CART
========================================================= */

function addToCart(
    menuId
) {

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


    const price =
        toNumber(
            menu.price
        );


    if (
        price < 0
    ) {

        showNotification(
            "Harga menu tidak valid.",
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

            price:
                price,

            category:
                menu.category || "",

            quantity:
                1

        });

    }


    renderCart();

    renderMenus();

}


function removeFromCart(
    menuId
) {

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


    const nextQuantity =
        Number(
            item.quantity
        ) +
        Number(
            change
        );


    if (
        nextQuantity <= 0
    ) {

        removeFromCart(
            menuId
        );

        return;

    }


    item.quantity =
        nextQuantity;


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
                        button.dataset.action ===
                            "plus"
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


    if (!input) {
        return 0;
    }


    return toNumber(
        input.value
    );

}


function updatePaymentUI() {

    const payment =
        getPaymentAmount();


    const total =
        getCartTotal();


    const change =
        payment -
        total;


    const changeElement =
        $("changeAmount");


    const payButton =
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


    if (payButton) {

        payButton.disabled =
            state.cart.length === 0 ||
            total <= 0 ||
            payment < total ||
            state.isSaving;

    }


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

        }

        else if (
            state.cart.length > 0 &&
            payment >= total
        ) {

            message.textContent =
                "";

        }

        else {

            message.textContent =
                "";

        }

    }

}


/* =========================================================
   CLEAR CART
========================================================= */

function clearCart() {

    state.cart =
        [];


    const payment =
        $("paymentAmount");


    if (payment) {
        payment.value =
            "";
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


/* =========================================================
   RESET MENU FORM
========================================================= */

function resetMenuForm() {

    state.editingMenuId =
        null;


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


    const title =
        $("menuModalTitle");


    if (form) {
        form.reset();
    }


    if (id) {
        id.value =
            "";
    }


    if (name) {
        name.value =
            "";
    }


    if (category) {
        category.value =
            "";
    }


    if (price) {
        price.value =
            "";
    }


    if (message) {
        message.textContent =
            "";
    }


    if (title) {
        title.textContent =
            "KELOLA MENU";
    }

}


/* =========================================================
   EDIT MENU
========================================================= */

function editMenu(
    menuId
) {

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


    $("menuName")
        ?.focus();

}


/* =========================================================
   SAVE MENU
========================================================= */

async function saveMenu(
    event
) {

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


    const message =
        $("menuFormMessage");


    if (!name) {

        if (message) {
            message.textContent =
                "Nama menu wajib diisi.";
        }

        return;

    }


    if (
        price < 0 ||
        !Number.isFinite(price)
    ) {

        if (message) {
            message.textContent =
                "Harga menu tidak valid.";
        }

        return;

    }


    if (message) {

        message.textContent =
            "Menyimpan ke Google Sheets...";

    }


    state.isSaving =
        true;


    try {

        if (
            state.editingMenuId
        ) {

            const result =
                await googleRequest({

                    action:
                        "updateMenu",

                    menu: {

                        id:
                            state.editingMenuId,

                        name:
                            name,

                        category:
                            category,

                        price:
                            price

                    }

                });


            if (
                result.success === false
            ) {

                throw new Error(
                    result.message ||
                    "Update menu gagal."
                );

            }


            showNotification(
                "Menu berhasil diperbarui di Google Sheets.",
                "success"
            );

        }

        else {

            const menuId =
                generateId(
                    "menu"
                );


            const result =
                await googleRequest({

                    action:
                        "saveMenu",

                    menu: {

                        id:
                            menuId,

                        name:
                            name,

                        category:
                            category,

                        price:
                            price

                    }

                });


            if (
                result.success === false
            ) {

                throw new Error(
                    result.message ||
                    "Penyimpanan menu gagal."
                );

            }


            showNotification(
                "Menu berhasil ditambahkan ke Google Sheets.",
                "success"
            );

        }


        resetMenuForm();

        await loadMenusFromGoogleSheets();

        renderManagedMenus();

        renderMenus();

        renderCategories();

    }

    catch (error) {

        console.error(
            "Gagal menyimpan menu:",
            error
        );


        if (message) {

            message.textContent =
                error.message ||
                "Gagal menyimpan menu.";

        }


        showNotification(
            error.message ||
            "Gagal menyimpan menu ke Google Sheets.",
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

async function deleteMenu(
    menuId
) {

    if (
        state.isSaving
    ) {
        return;
    }


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
            `Hapus menu "${menu.name}" dari Google Sheets?`
        );


    if (!confirmed) {
        return;
    }


    state.isSaving =
        true;


    try {

        const result =
            await googleRequest({

                action:
                    "deleteMenu",

                menuId:
                    menuId

            });


        if (
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Penghapusan menu gagal."
            );

        }


        state.cart =
            state.cart.filter(
                item =>
                    item.menuId !==
                    menuId
            );


        await loadMenusFromGoogleSheets();

        renderCart();

        renderMenus();

        renderCategories();

        renderManagedMenus();


        showNotification(
            "Menu berhasil dihapus dari Google Sheets.",
            "success"
        );

    }

    catch (error) {

        console.error(
            "Gagal menghapus menu:",
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
   VALIDATE CART
========================================================= */

function validateCart() {

    if (
        !Array.isArray(
            state.cart
        ) ||
        state.cart.length === 0
    ) {

        throw new Error(
            "Keranjang masih kosong."
        );

    }


    for (
        const item of state.cart
    ) {

        if (
            !item.menuId ||
            !item.name
        ) {

            throw new Error(
                "Ada item keranjang yang tidak valid."
            );

        }


        const quantity =
            toNumber(
                item.quantity
            );


        const price =
            toNumber(
                item.price
            );


        if (
            quantity <= 0 ||
            !Number.isInteger(
                quantity
            )
        ) {

            throw new Error(
                `Jumlah "${item.name}" tidak valid.`
            );

        }


        if (
            price < 0
        ) {

            throw new Error(
                `Harga "${item.name}" tidak valid.`
            );

        }

    }

}


/* =========================================================
   CREATE SALE
========================================================= */

function createSale() {

    validateCart();


    const total =
        getCartTotal();


    const payment =
        getPaymentAmount();


    const change =
        payment -
        total;


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
            "Uang pembayaran masih kurang."
        );

    }


    const now =
        new Date();


    const transactionNumber =
        generateTransactionNumber();


    const sale = {

        id:
            generateId(
                "sale"
            ),

        transactionNumber,

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
                            item.category ||
                            "",

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

        change

    };


    /*
     * Validasi akhir sebelum dikirim.
     */

    if (
        !sale.id ||
        !sale.transactionNumber ||
        !sale.dateKey ||
        !Array.isArray(
            sale.items
        ) ||
        sale.items.length === 0 ||
        sale.total <= 0 ||
        sale.payment < sale.total ||
        sale.change < 0
    ) {

        throw new Error(
            "Data transaksi tidak valid."
        );

    }


    return sale;

}


/* =========================================================
   VALIDATE SAVED SALE RESPONSE
========================================================= */

function validateSaleResponse(
    result,
    sale
) {

    if (!result) {

        throw new Error(
            "Server tidak memberikan response transaksi."
        );

    }


    if (
        result.success === false
    ) {

        throw new Error(
            result.message ||
            result.error ||
            "Transaksi ditolak server."
        );

    }


    /*
     * Beberapa Apps Script mengembalikan:
     *
     * {
     *   success: true,
     *   sale: {...}
     * }
     *
     * atau:
     *
     * {
     *   success: true,
     *   id: "...",
     *   transactionNumber: "..."
     * }
     *
     * Keduanya diterima.
     */

    const savedSale =
        result.sale ||
        result.data ||
        result;


    const returnedId =
        toSafeString(
            savedSale.id ??
            savedSale.ID ??
            savedSale.ID_PENJUALAN
        );


    const returnedNumber =
        toSafeString(
            savedSale.transactionNumber ??
            savedSale.noTransaksi ??
            savedSale.NO_TRANSAKSI
        );


    /*
     * Jika server mengirim ID,
     * pastikan ID sama.
     */

    if (
        returnedId &&
        returnedId !== sale.id
    ) {

        console.warn(
            "ID transaksi response berbeda:",
            {
                local:
                    sale.id,
                server:
                    returnedId
            }
        );

    }


    /*
     * Jika server mengirim nomor transaksi,
     * pastikan tidak kosong.
     */

    if (
        "transactionNumber" in savedSale ||
        "NO_TRANSAKSI" in savedSale ||
        "noTransaksi" in savedSale
    ) {

        if (
            !returnedNumber
        ) {

            throw new Error(
                "Server mengembalikan nomor transaksi kosong."
            );

        }

    }


    return true;

}


/* =========================================================
   BAYAR
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
            error.message ||
            "Transaksi tidak valid.",
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


        /*
         * Hanya setelah server menerima transaksi,
         * transaksi dianggap berhasil.
         */

        state.lastCompletedSale =
            sale;


        /*
         * Ambil ulang data dari server.
         */

        await loadTodaySalesFromGoogleSheets();


        /*
         * Baru kosongkan keranjang.
         * Jika save gagal, keranjang tetap ada.
         */

        clearCart();


        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );


        showNotification(
            "Pembayaran berhasil disimpan ke Google Sheets.",
            "success"
        );


        openPaymentSuccessModal(
            sale
        );

    }

    catch (error) {

        console.error(
            "Pembayaran gagal:",
            error
        );


        setConnectionStatus(
            "offline",
            "Gagal menyimpan transaksi"
        );


        showNotification(
            error.message ||
            "Transaksi gagal disimpan ke Google Sheets.",
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
   SAVE SALE
========================================================= */

async function saveSaleToGoogleSheets(
    sale
) {

    if (!sale) {

        throw new Error(
            "Data transaksi kosong."
        );

    }


    const result =
        await googleRequest({

            action:
                "saveSale",

            sale:
                sale

        });


    validateSaleResponse(
        result,
        sale
    );


    return result;

}


/* =========================================================
   LOAD TODAY SALES
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

        const today =
            getTodayKey();


        const result =
            await googleRequest(
                {
                    action:
                        "getTodaySales",

                    dateKey:
                        today

                },
                "GET"
            );


        console.log(
            "[GOOGLE SHEETS] getTodaySales:",
            result
        );


        const sales =
            Array.isArray(
                result?.sales
            )
                ? result.sales
                : Array.isArray(
                    result?.data
                )
                    ? result.data
                    : Array.isArray(
                        result
                    )
                        ? result
                        : [];


        state.todaySales =
            normalizeSales(
                sales
            );


        renderSalesHistory();


        setConnectionStatus(
            "online",
            "Google Sheets tersambung"
        );

    }

    catch (error) {

        console.error(
            "Gagal mengambil penjualan:",
            error
        );


        /*
         * Jangan menghapus state lama
         * jika request gagal.
         */

        renderSalesHistory();


        setConnectionStatus(
            "offline",
            "Gagal mengambil riwayat Google Sheets"
        );


        showNotification(
            error.message ||
            "Gagal mengambil riwayat penjualan.",
            "error"
        );

    }

    finally {

        state.isLoadingSales =
            false;

    }

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


                let dateKey =
                    normalizeDateKey(
                        sale.dateKey ??
                        sale.DATE_KEY ??
                        sale.TANGGAL_KEY ??
                        sale.tanggal_key
                    );


                const rawDate =
                    sale.date ??
                    sale.timestamp ??
                    sale.TANGGAL ??
                    sale.tanggal ??
                    "";


                /*
                 * Fallback tanggal.
                 */

                if (
                    !dateKey
                ) {

                    dateKey =
                        normalizeDateKey(
                            rawDate
                        );

                }


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


                let items =
                    sale.items ??
                    sale.ITEMS ??
                    sale.detail ??
                    sale.details ??
                    sale.DETAIL ??
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


                items =
                    items.map(
                        item => {

                            const price =
                                toNumber(
                                    item.price ??
                                    item.harga ??
                                    item.HARGA
                                );


                            const quantity =
                                toNumber(
                                    item.quantity ??
                                    item.jumlah ??
                                    item.JUMLAH
                                );


                            const subtotalValue =
                                item.subtotal ??
                                item.SUBTOTAL;


                            const subtotal =
                                subtotalValue !==
                                    undefined &&
                                subtotalValue !==
                                    null &&
                                subtotalValue !==
                                    ""
                                    ? toNumber(
                                        subtotalValue
                                    )
                                    : price *
                                      quantity;


                            return {

                                menuId:
                                    toSafeString(
                                        item.menuId ??
                                        item.MENU_ID ??
                                        item.id ??
                                        item.ID_MENU
                                    ),

                                name:
                                    toSafeString(
                                        item.name ??
                                        item.nama ??
                                        item.NAMA
                                    ),

                                category:
                                    toSafeString(
                                        item.category ??
                                        item.kategori ??
                                        item.KATEGORI
                                    ),

                                price,

                                quantity,

                                subtotal

                            };

                        }
                    );


                const itemCount =
                    toNumber(
                        sale.itemCount ??
                        sale.jumlahItem ??
                        sale.JUMLAH_ITEM ??
                        sale.jumlah_item
                    ) ||
                    items.reduce(
                        (
                            sum,
                            item
                        ) =>
                            sum +
                            toNumber(
                                item.quantity
                            ),
                        0
                    );


                return {

                    id,

                    transactionNumber,

                    dateKey,

                    date:
                        rawDate ||
                        new Date().toISOString(),

                    items,

                    total,

                    payment,

                    change,

                    itemCount

                };

            }
        )
        .filter(
            sale =>
                Boolean(
                    sale.id ||
                    sale.transactionNumber
                )
        );

}


/* =========================================================
   PAYMENT SUCCESS MODAL
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
   PRINT RECEIPT
========================================================= */

function printReceipt(
    sale
) {

    if (!sale) {
        return;
    }


    const printArea =
        $("printArea") ||
        $("printReceipt");


    if (!printArea) {

        showNotification(
            "Area struk tidak ditemukan di HTML.",
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


    const itemsHtml =
        items
            .map(
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
            )
            .join("");


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

            ${itemsHtml}

        </div>

        <div class="receipt-line"></div>

        <div class="receipt-total-section">

            <div class="receipt-total-row">

                <span class="receipt-total-label">
                    TOTAL
                </span>

                <span class="receipt-total-value">
                    ${formatRupiah(
                        sale.total
                    )}
                </span>

            </div>

            <div class="receipt-total-row">

                <span class="receipt-total-label">
                    BAYAR
                </span>

                <span class="receipt-total-value">
                    ${formatRupiah(
                        sale.payment
                    )}
                </span>

            </div>

            <div class="receipt-total-row receipt-change">

                <span class="receipt-total-label">
                    KEMBALI
                </span>

                <span class="receipt-total-value">
                    ${formatRupiah(
                        sale.change
                    )}
                </span>

            </div>

        </div>

        <div class="receipt-footer">

            <div class="receipt-footer-title">
                TERIMA KASIH
            </div>

            <div class="receipt-footer-message">
                Selamat datang kembali
            </div>

        </div>

    `;


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


    list.innerHTML =
        "";


    const today =
        getTodayKey();


    const sales =
        state.todaySales.filter(
            sale =>
                normalizeDateKey(
                    sale.dateKey
                ) ===
                today
        );


    /*
     * Hanya tampilkan transaksi hari ini.
     */

    if (count) {

        count.textContent =
            formatNumber(
                sales.length
            );

    }


    const salesTotal =
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
                salesTotal
            );

    }


    if (
        sales.length === 0
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


    [...sales]
        .reverse()
        .forEach(
            sale => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "sale-item";


                const itemCount =
                    sale.items.length > 0
                        ? sale.items.reduce(
                            (
                                sum,
                                cartItem
                            ) =>
                                sum +
                                toNumber(
                                    cartItem.quantity
                                ),
                            0
                        )
                        : toNumber(
                            sale.itemCount
                        );


                item.innerHTML = `

                    <div class="sale-item-header">

                        <div class="sale-item-number">
                            ${escapeHtml(
                                sale.transactionNumber ||
                                sale.id ||
                                "-"
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

                        ${formatNumber(
                            itemCount
                        )}
                        item

                    </div>

                `;


                item.addEventListener(
                    "click",
                    () => {

                        openSaleDetail(
                            sale
                        );

                    }
                );


                list.appendChild(
                    item
                );

            }
        );

}


/* =========================================================
   SALE DETAIL
========================================================= */

function openSaleDetail(
    sale
) {

    if (!sale) {
        return;
    }


    state.selectedSale =
        sale;


    if (
        $("saleDetailTransactionNumber")
    ) {

        $("saleDetailTransactionNumber")
            .textContent =
                sale.transactionNumber ||
                sale.id ||
                "-";

    }


    const content =
        $("saleDetailContent");


    if (!content) {
        return;
    }


    content.innerHTML =
        "";


    if (
        !sale.items ||
        sale.items.length === 0
    ) {

        const noDetail =
            document.createElement(
                "div"
            );


        noDetail.className =
            "sale-detail-row";


        noDetail.innerHTML = `

            <div class="sale-detail-name">

                Detail item transaksi
                tidak dikirim oleh server.

            </div>

            <div class="sale-detail-value">

                ${formatNumber(
                    sale.itemCount
                )}
                item

            </div>

        `;


        content.appendChild(
            noDetail
        );

    }

    else {

        sale.items.forEach(
            item => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "sale-detail-row";


                row.innerHTML = `

                    <div class="sale-detail-name">

                        ${escapeHtml(
                            item.name
                        )}

                        <br>

                        <small>

                            ${formatNumber(
                                item.quantity
                            )}
                            ×
                            ${formatRupiah(
                                item.price
                            )}

                        </small>

                    </div>

                    <div class="sale-detail-value">

                        ${formatRupiah(
                            item.subtotal
                        )}

                    </div>

                `;


                content.appendChild(
                    row
                );

            }
        );

    }


    const summary =
        document.createElement(
            "div"
        );


    summary.innerHTML = `

        <div class="summary-row">

            <span>
                TOTAL
            </span>

            <strong>
                ${formatRupiah(
                    sale.total
                )}
            </strong>

        </div>

        <div class="summary-row">

            <span>
                BAYAR
            </span>

            <strong>
                ${formatRupiah(
                    sale.payment
                )}
            </strong>

        </div>

        <div class="summary-row">

            <span>
                KEMBALIAN
            </span>

            <strong>
                ${formatRupiah(
                    sale.change
                )}
            </strong>

        </div>

    `;


    content.appendChild(
        summary
    );


    const modal =
        $("saleDetailModal");


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


function closeSaleDetail() {

    const modal =
        $("saleDetailModal");


    if (!modal) {
        return;
    }


    modal.hidden =
        true;


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    state.selectedSale =
        null;

}


/* =========================================================
   DOWNLOAD TODAY SALES
========================================================= */

async function downloadTodaySales() {

    try {

        await loadTodaySalesFromGoogleSheets();


        const today =
            getTodayKey();


        const sales =
            state.todaySales.filter(
                sale =>
                    normalizeDateKey(
                        sale.dateKey
                    ) ===
                    today
            );


        if (
            sales.length === 0
        ) {

            showNotification(
                "Belum ada penjualan hari ini.",
                "warning"
            );

            return;

        }


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


        sales.forEach(
            sale => {

                if (
                    sale.items &&
                    sale.items.length > 0
                ) {

                    sale.items.forEach(
                        item => {

                            rows.push([

                                formatDateTimeIndonesia(
                                    sale.date
                                ),

                                sale.transactionNumber,

                                item.name,

                                item.category ||
                                    "",

                                item.price,

                                item.quantity,

                                item.subtotal,

                                sale.total,

                                sale.payment,

                                sale.change

                            ]);

                        }
                    );

                }

                else {

                    rows.push([

                        formatDateTimeIndonesia(
                            sale.date
                        ),

                        sale.transactionNumber,

                        "",

                        "",

                        "",

                        sale.itemCount,

                        "",

                        sale.total,

                        sale.payment,

                        sale.change

                    ]);

                }

            }
        );


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                value =>
                                    csvEscape(
                                        value
                                    )
                            )
                            .join(",")
                )
                .join(
                    "\r\n"
                );


        const blob =
            new Blob(
                [
                    "\uFEFF" +
                    csv
                ],
                {
                    type:
                        "text/csv;charset=utf-8;"
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
            `penjualan-${today}.csv`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        showNotification(
            `Penjualan ${today} berhasil didownload.`,
            "success"
        );

    }

    catch (error) {

        console.error(
            "Download gagal:",
            error
        );


        showNotification(
            error.message ||
            "Gagal download penjualan.",
            "error"
        );

    }

}


/* =========================================================
   CSV ESCAPE
========================================================= */

function csvEscape(
    value
) {

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
        return;
    }


    if (
        $("resetMessage")
    ) {

        $("resetMessage")
            .textContent =
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
   RESET TODAY SALES
========================================================= */

async function resetTodaySales() {

    if (
        state.isResetting
    ) {
        return;
    }


    const message =
        $("resetMessage");


    const confirmed =
        window.confirm(
            "Yakin ingin menghapus seluruh penjualan hari ini?"
        );


    if (!confirmed) {
        return;
    }


    state.isResetting =
        true;


    if (message) {

        message.textContent =
            "Menghapus penjualan hari ini dari Google Sheets...";

    }


    try {

        const today =
            getTodayKey();


        const result =
            await googleRequest({

                action:
                    "deleteTodaySales",

                dateKey:
                    today

            });


        if (
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Reset penjualan gagal."
            );

        }


        /*
         * Ambil ulang dari server.
         */

        await loadTodaySalesFromGoogleSheets();


        closeResetModal();


        showNotification(
            "Penjualan hari ini sudah dibersihkan. Data menu dan harga tetap aman.",
            "success"
        );

    }

    catch (error) {

        console.error(
            "Reset gagal:",
            error
        );


        if (message) {

            message.textContent =
                error.message ||
                "Gagal menghapus penjualan.";

        }


        showNotification(
            error.message ||
            "Gagal menghapus penjualan hari ini.",
            "error"
        );

    }

    finally {

        state.isResetting =
            false;

    }

}


/* =========================================================
   NOTIFICATION
========================================================= */

let notificationTimer =
    null;


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


    notification.hidden =
        false;


    notification.className =
        `notification ${type}`;


    notification.textContent =
        String(
            message ?? ""
        );


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


                const button =
                    $("payButton");


                if (
                    button &&
                    !button.disabled
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
                    window.confirm(
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


    $("downloadTodayButton")
        ?.addEventListener(
            "click",
            downloadTodaySales
        );


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


            const detailModal =
                $("saleDetailModal");


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


            if (
                detailModal &&
                !detailModal.hidden
            ) {

                closeSaleDetail();

            }

        }
    );

}


/* =========================================================
   CURRENT DATE
========================================================= */

function renderCurrentDate() {

    const now =
        getDateObject();


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
                `Tanggal: ${formatDateIndonesia(
                    now
                )}`;

    }

}


/* =========================================================
   REFRESH DATA
========================================================= */

async function refreshAllData() {

    /*
     * Tetap paralel agar aplikasi cepat.
     */

    await Promise.all([
        loadMenusFromGoogleSheets(),
        loadTodaySalesFromGoogleSheets()
    ]);

}


/* =========================================================
   AUTO REFRESH
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


            try {

                await loadTodaySalesFromGoogleSheets();

            }

            catch (error) {

                console.error(
                    "Auto refresh gagal:",
                    error
                );

            }

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

        renderMenus();

        renderSalesHistory();

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
   START APPLICATION
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
