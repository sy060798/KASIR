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

   SHEET YANG DIGUNAKAN:
   - MENU
   - PENJUALAN
   - DETAIL_PENJUALAN

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
        Number(value) || 0
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
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDateIndonesia(
    dateValue
) {

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


function formatDateTimeIndonesia(
    dateValue
) {

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

                    params.set(
                        key,
                        String(value)
                    );

                }
            );


        response =
            await fetch(
                GOOGLE_SCRIPT_URL +
                "?" +
                params.toString(),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

    } else {

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
                        )
                }
            );

    }


    if (
        !response.ok
    ) {

        throw new Error(
            `Server Google Sheets error: ${response.status}`
        );

    }


    const text =
        await response.text();


    let result;


    try {

        result =
            JSON.parse(text);

    } catch (error) {

        console.error(
            "Response Google Apps Script:",
            text
        );

        throw new Error(
            "Response Google Apps Script bukan JSON yang valid."
        );

    }


    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
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

    } catch (error) {

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
   LOAD MENU DARI GOOGLE SHEETS
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
                : [];


        state.menus =
            menus.map(
                menu => ({

                    id:
                        String(
                            menu.id ??
                            menu.ID ??
                            ""
                        ),

                    name:
                        String(
                            menu.name ??
                            menu.nama ??
                            menu.Nama ??
                            ""
                        ).trim(),

                    category:
                        String(
                            menu.category ??
                            menu.kategori ??
                            menu.Kategori ??
                            ""
                        ).trim(),

                    price:
                        Number(
                            menu.price ??
                            menu.harga ??
                            menu.Harga ??
                            0
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


    } catch (error) {

        console.error(
            "Gagal mengambil menu:",
            error
        );


        state.menus = [];

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


    } finally {

        state.isLoadingMenus =
            false;

    }

}


/* =========================================================
   GET FILTERED MENUS
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
                String(
                    menu.category || ""
                )
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
                                ? quantity
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


    container.innerHTML = "";


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
   ADD CART
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


    const existing =
        state.cart.find(
            item =>
                item.menuId ===
                menuId
        );


    if (existing) {

        existing.quantity += 1;

    } else {

        state.cart.push({

            menuId:
                menu.id,

            name:
                menu.name,

            price:
                Number(
                    menu.price
                ),

            category:
                menu.category || "",

            quantity:
                1

        });

    }


    renderCart();

    renderMenus();

}


/* =========================================================
   REMOVE CART
========================================================= */

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
                cartItem.menuId ===
                menuId
        );


    if (!item) {
        return;
    }


    item.quantity +=
        change;


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
                    Number(
                        item.price
                    ) *
                    Number(
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
            Number(
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


    if (
        state.cart.length === 0
    ) {

        if (empty) {
            empty.style.display = "";
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
                Number(
                    item.price
                ) *
                Number(
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
                            data-id="${item.menuId}"
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


    return (
        Number(
            input.value
        ) || 0
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


    if (
        payButton
    ) {

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

        } else {

            message.textContent =
                "";

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


    if (
        $("menuModalTitle")
    ) {

        $("menuModalTitle")
            .textContent =
                "EDIT MENU";

    }


    $("menuName")
        ?.focus();

}


/* =========================================================
   SAVE MENU KE GOOGLE SHEETS
========================================================= */

async function saveMenu(
    event
) {

    event.preventDefault();


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
        Number(
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
        !Number.isFinite(
            price
        ) ||
        price < 0
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

                    name:
                        name,

                    category:
                        category,

                    price:
                        price

                }

            });


            showNotification(
                "Menu berhasil diperbarui di Google Sheets.",
                "success"
            );

        } else {

            await googleRequest({

                action:
                    "saveMenu",

                menu: {

                    id:
                        generateId(
                            "menu"
                        ),

                    name:
                        name,

                    category:
                        category,

                    price:
                        price

                }

            });


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


    } catch (error) {

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

}


/* =========================================================
   DELETE MENU DARI GOOGLE SHEETS
========================================================= */

async function deleteMenu(
    menuId
) {

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


    try {

        await googleRequest({

            action:
                "deleteMenu",

            menuId:
                menuId

        });


        /*
         * Kalau sedang ada di keranjang,
         * hapus juga dari keranjang.
         */

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


    } catch (error) {

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
   CREATE SALE
========================================================= */

function createSale() {

    const total =
        getCartTotal();

    const payment =
        getPaymentAmount();

    const change =
        payment -
        total;


    if (
        state.cart.length === 0
    ) {

        throw new Error(
            "Keranjang masih kosong."
        );

    }


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
                item => ({

                    menuId:
                        item.menuId,

                    name:
                        item.name,

                    category:
                        item.category || "",

                    price:
                        Number(
                            item.price
                        ),

                    quantity:
                        Number(
                            item.quantity
                        ),

                    subtotal:
                        Number(
                            item.price
                        ) *
                        Number(
                            item.quantity
                        )

                })
            ),

        total:
            total,

        payment:
            payment,

        change:
            change

    };

}


/* =========================================================
   NOMOR TRANSAKSI
   ---------------------------------------------------------
   Nomor dibuat berdasarkan waktu.
   Database transaksi tetap Google Sheets.
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


    const random =
        Math.floor(
            Math.random() *
            100
        )
        .toString()
        .padStart(
            2,
            "0"
        );


    return (
        `${date}-` +
        `${hour}${minute}${second}-` +
        `${random}`
    );

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


    } catch (error) {

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

        /*
         * LANGSUNG KE GOOGLE SHEETS.
         *
         * Tidak disimpan ke localStorage.
         */

        await saveSaleToGoogleSheets(
            sale
        );


        state.lastCompletedSale =
            sale;


        /*
         * Setelah berhasil disimpan,
         * ambil ulang history dari Google Sheets.
         */

        await loadTodaySalesFromGoogleSheets();


        /*
         * Kosongkan keranjang.
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


        /*
         * Tampilkan pilihan:
         * PRINT atau TIDAK PRINT.
         */

        openPaymentSuccessModal(
            sale
        );


    } catch (error) {

        console.error(
            "Pembayaran gagal:",
            error
        );


        setConnectionStatus(
            "offline",
            "Gagal menyimpan ke Google Sheets"
        );


        /*
         * PENTING:
         * Keranjang TIDAK dikosongkan jika
         * transaksi gagal dikirim.
         */

        showNotification(
            error.message ||
            "Transaksi gagal disimpan ke Google Sheets.",
            "error"
        );

    } finally {

        state.isSaving =
            false;

        updatePaymentUI();

    }

}


/* =========================================================
   SAVE SALE GOOGLE SHEETS
========================================================= */

async function saveSaleToGoogleSheets(
    sale
) {

    const result =
        await googleRequest({

            action:
                "saveSale",

            sale:
                sale

        });


    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.message ||
            "Transaksi ditolak Google Sheets."
        );

    }


    return result;

}


/* =========================================================
   LOAD SALES HARI INI
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


        const sales =
            Array.isArray(
                result.sales
            )
                ? result.sales
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


    } catch (error) {

        console.error(
            "Gagal mengambil penjualan:",
            error
        );


        state.todaySales =
            [];


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


    } finally {

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

    return sales.map(
        sale => {

            let items =
                sale.items;


            if (
                typeof items ===
                "string"
            ) {

                try {

                    items =
                        JSON.parse(
                            items
                        );

                } catch (
                    error
                ) {

                    items = [];

                }

            }


            if (
                !Array.isArray(
                    items
                )
            ) {

                items = [];

            }


            return {

                id:
                    String(
                        sale.id ??
                        ""
                    ),

                transactionNumber:
                    String(
                        sale.transactionNumber ??
                        sale.noTransaksi ??
                        sale.no_transaksi ??
                        ""
                    ),

                dateKey:
                    String(
                        sale.dateKey ??
                        sale.tanggal ??
                        getTodayKey()
                    )
                        .slice(
                            0,
                            10
                        ),

                date:
                    sale.date ||
                    sale.timestamp ||
                    new Date()
                        .toISOString(),

                items:
                    items.map(
                        item => ({

                            menuId:
                                String(
                                    item.menuId ??
                                    ""
                                ),

                            name:
                                String(
                                    item.name ??
                                    item.nama ??
                                    ""
                                ),

                            category:
                                String(
                                    item.category ??
                                    item.kategori ??
                                    ""
                                ),

                            price:
                                Number(
                                    item.price ??
                                    item.harga ??
                                    0
                                ),

                            quantity:
                                Number(
                                    item.quantity ??
                                    item.jumlah ??
                                    0
                                ),

                            subtotal:
                                Number(
                                    item.subtotal ??
                                    0
                                )

                        })
                    ),

                total:
                    Number(
                        sale.total ??
                        0
                    ),

                payment:
                    Number(
                        sale.payment ??
                        sale.pembayaran ??
                        0
                    ),

                change:
                    Number(
                        sale.change ??
                        sale.kembalian ??
                        0
                    )

            };

        }
    );

}


/* =========================================================
   PAYMENT SUCCESS MODAL
========================================================= */

function openPaymentSuccessModal(
    sale
) {

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


    /*
     * Support #printArea
     * dan #printReceipt.
     */

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


    const itemsHtml =
        sale.items
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


    /*
     * Browser akan menampilkan
     * dialog printer.
     *
     * Kalau user menekan CANCEL:
     * transaksi tetap aman di Google Sheets.
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


    const sales =
        state.todaySales.filter(
            sale =>
                sale.dateKey ===
                today
        );


    state.todaySales =
        sales;


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
                Number(
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


    /*
     * Terbaru di atas.
     */

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
                    sale.items.reduce(
                        (
                            sum,
                            cartItem
                        ) =>
                            sum +
                            Number(
                                cartItem.quantity
                            ),
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

    state.selectedSale =
        sale;


    if (
        $("saleDetailTransactionNumber")
    ) {

        $("saleDetailTransactionNumber")
            .textContent =
                sale.transactionNumber;

    }


    const content =
        $("saleDetailContent");


    if (!content) {
        return;
    }


    content.innerHTML = "";


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
   DOWNLOAD PENJUALAN HARI INI
   ---------------------------------------------------------
   Data berasal dari Google Sheets.
========================================================= */

async function downloadTodaySales() {

    try {

        /*
         * Ambil data terbaru langsung dari Google Sheets.
         */

        await loadTodaySalesFromGoogleSheets();


        const today =
            getTodayKey();


        const sales =
            state.todaySales.filter(
                sale =>
                    sale.dateKey ===
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


    } catch (error) {

        console.error(
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
   RESET PENJUALAN HARI INI
   ---------------------------------------------------------
   PENTING:
   - MENU TIDAK DIHAPUS
   - HARGA TIDAK DIHAPUS
   - SHEET MENU TIDAK DISENTUH
   - HANYA PENJUALAN HARI INI
   - LANGSUNG HAPUS DI GOOGLE SHEETS
========================================================= */

async function resetTodaySales() {

    const message =
        $("resetMessage");


    if (message) {

        message.textContent =
            "Menghapus penjualan hari ini dari Google Sheets...";

    }


    try {

        const today =
            getTodayKey();


        await googleRequest({

            action:
                "deleteTodaySales",

            dateKey:
                today

        });


        /*
         * Ambil ulang dari Google Sheets
         * untuk memastikan benar-benar kosong.
         */

        await loadTodaySalesFromGoogleSheets();


        closeResetModal();


        showNotification(
            "Penjualan hari ini sudah bersih. Data menu dan harga tetap aman.",
            "success"
        );


    } catch (error) {

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
                event.target.value;


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

    /*
     * MENU
     */

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


    /*
     * CART
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


                if (
                    window.confirm(
                        "Kosongkan semua pesanan?"
                    )
                ) {

                    clearCart();

                }

            }
        );


    /*
     * PAYMENT
     */

    $("payButton")
        ?.addEventListener(
            "click",
            processPayment
        );


    /*
     * SUCCESS
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
     * DETAIL
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
   ---------------------------------------------------------
   Semua data database diambil ulang
   dari Google Sheets.
========================================================= */

async function refreshAllData() {

    await Promise.all([
        loadMenusFromGoogleSheets(),
        loadTodaySalesFromGoogleSheets()
    ]);

}


/* =========================================================
   AUTO REFRESH PENJUALAN
   ---------------------------------------------------------
   Setiap 60 detik mengambil ulang
   data dari Google Sheets.
========================================================= */

function initializeAutoRefresh() {

    setInterval(
        async () => {

            try {

                await loadTodaySalesFromGoogleSheets();

            } catch (error) {

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

    renderCurrentDate();

    renderCategories();

    renderMenus();

    renderCart();

    renderSalesHistory();

    initializeSearch();

    initializePaymentInput();

    initializeEvents();


    /*
     * Pastikan database Google Sheets
     * dapat diakses.
     */

    const connected =
        await checkGoogleSheetsConnection();


    if (!connected) {

        /*
         * Jangan membuat database lokal.
         * Aplikasi tetap kosong sampai
         * Google Sheets tersambung.
         */

        renderMenus();

        renderSalesHistory();

        return;

    }


    /*
     * Ambil database langsung
     * dari Google Sheets.
     */

    await refreshAllData();


    initializeAutoRefresh();


    /*
     * Update tanggal setiap menit.
     */

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
        initializeApp
    );

} else {

    initializeApp();

}
