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
                            menu.ID_MENU ??
                            ""
                        ),

                    name:
                        String(
                            menu.name ??
                            menu.nama ??
                            menu.Nama ??
                            menu.NAMA ??
                            ""
                        ).trim(),

                    category:
                        String(
                            menu.category ??
                            menu.kategori ??
                            menu.Kategori ??
                            menu.KATEGORI ??
                            ""
                        ).trim(),

                    price:
                        Number(
                            menu.price ??
                            menu.harga ??
                            menu.Harga ??
                            menu.HARGA ??
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

        await saveSaleToGoogleSheets(
            sale
        );


        state.lastCompletedSale =
            sale;


        await loadTodaySalesFromGoogleSheets();


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


    } catch (error) {

        console.error(
            "Pembayaran gagal:",
            error
        );


        setConnectionStatus(
            "offline",
            "Gagal menyimpan ke Google Sheets"
        );


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


        /*
         * PENTING:
         * Selalu minta data berdasarkan
         * TANGGAL_KEY Google Sheets.
         */

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


        /*
         * Debug agar bisa melihat
         * bentuk response sebenarnya
         * dari Apps Script.
         */

        console.log(
            "[GOOGLE SHEETS] getTodaySales response:",
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
                    : [];


        state.todaySales =
            normalizeSales(
                sales
            );


        console.log(
            "[PENJUALAN] setelah normalize:",
            state.todaySales
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
   ---------------------------------------------------------
   PERBAIKAN UTAMA:
   Mendukung format JSON:
     id
     transactionNumber
     dateKey
     total

   DAN FORMAT LANGSUNG DARI HEADER SHEET:
     ID_PENJUALAN
     NO_TRANSAKSI
     TANGGAL
     TANGGAL_KEY
     TOTAL
     PEMBAYARAN
     KEMBALIAN
     JUMLAH_ITEM

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
                 * -------------------------------------------------
                 * ID TRANSAKSI
                 * -------------------------------------------------
                 */

                const id =
                    String(
                        sale.id ??
                        sale.ID ??
                        sale.ID_PENJUALAN ??
                        sale.id_penjualan ??
                        ""
                    ).trim();


                /*
                 * -------------------------------------------------
                 * NOMOR TRANSAKSI
                 * -------------------------------------------------
                 */

                const transactionNumber =
                    String(
                        sale.transactionNumber ??
                        sale.noTransaksi ??
                        sale.no_transaksi ??
                        sale.NO_TRANSAKSI ??
                        ""
                    ).trim();


                /*
                 * -------------------------------------------------
                 * TANGGAL KEY
                 *
                 * INI YANG SEBELUMNYA BERMASALAH.
                 *
                 * Google Sheet kamu punya:
                 *
                 * TANGGAL_KEY = 2026-09-28
                 *
                 * Jadi wajib membaca TANGGAL_KEY.
                 * -------------------------------------------------
                 */

                let dateKey =
                    String(
                        sale.dateKey ??
                        sale.DATE_KEY ??
                        sale.TANGGAL_KEY ??
                        sale.tanggal_key ??
                        ""
                    ).trim();


                /*
                 * Jika dateKey belum ada,
                 * coba ambil dari tanggal.
                 */

                if (
                    !dateKey
                ) {

                    const rawDate =
                        String(
                            sale.date ??
                            sale.timestamp ??
                            sale.TANGGAL ??
                            sale.tanggal ??
                            ""
                        ).trim();


                    /*
                     * Format:
                     *
                     * 2026-09-28T04:45:39.000Z
                     */

                    if (
                        /^\d{4}-\d{2}-\d{2}/
                            .test(
                                rawDate
                            )
                    ) {

                        dateKey =
                            rawDate.slice(
                                0,
                                10
                            );

                    }


                    /*
                     * Format:
                     *
                     * 28/09/2026 11:45:39
                     */

                    else {

                        const match =
                            rawDate.match(
                                /^(\d{2})\/(\d{2})\/(\d{4})/
                            );


                        if (match) {

                            dateKey =
                                `${match[3]}-${match[2]}-${match[1]}`;

                        }

                    }

                }


                /*
                 * -------------------------------------------------
                 * TANGGAL DISPLAY
                 * -------------------------------------------------
                 */

                const rawDate =
                    sale.date ??
                    sale.timestamp ??
                    sale.TANGGAL ??
                    sale.tanggal ??
                    "";


                /*
                 * -------------------------------------------------
                 * TOTAL
                 * -------------------------------------------------
                 */

                const total =
                    Number(
                        sale.total ??
                        sale.TOTAL ??
                        0
                    ) || 0;


                /*
                 * -------------------------------------------------
                 * PEMBAYARAN
                 * -------------------------------------------------
                 */

                const payment =
                    Number(
                        sale.payment ??
                        sale.pembayaran ??
                        sale.PEMBAYARAN ??
                        0
                    ) || 0;


                /*
                 * -------------------------------------------------
                 * KEMBALIAN
                 * -------------------------------------------------
                 */

                const change =
                    Number(
                        sale.change ??
                        sale.kembalian ??
                        sale.KEMBALIAN ??
                        0
                    ) || 0;


                /*
                 * -------------------------------------------------
                 * ITEM
                 *
                 * Kalau Apps Script mengirim detail item,
                 * tetap digunakan.
                 * -------------------------------------------------
                 */

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


                /*
                 * -------------------------------------------------
                 * NORMALIZE DETAIL ITEM
                 * -------------------------------------------------
                 */

                items =
                    items.map(
                        item => ({

                            menuId:
                                String(
                                    item.menuId ??
                                    item.MENU_ID ??
                                    item.id ??
                                    item.ID_MENU ??
                                    ""
                                ),

                            name:
                                String(
                                    item.name ??
                                    item.nama ??
                                    item.NAMA ??
                                    ""
                                ),

                            category:
                                String(
                                    item.category ??
                                    item.kategori ??
                                    item.KATEGORI ??
                                    ""
                                ),

                            price:
                                Number(
                                    item.price ??
                                    item.harga ??
                                    item.HARGA ??
                                    0
                                ) || 0,

                            quantity:
                                Number(
                                    item.quantity ??
                                    item.jumlah ??
                                    item.JUMLAH ??
                                    0
                                ) || 0,

                            subtotal:
                                Number(
                                    item.subtotal ??
                                    item.SUBTOTAL ??
                                    0
                                ) || 0

                        })
                    );


                /*
                 * -------------------------------------------------
                 * JUMLAH ITEM DARI SHEET
                 * -------------------------------------------------
                 */

                const itemCount =
                    Number(
                        sale.itemCount ??
                        sale.jumlahItem ??
                        sale.JUMLAH_ITEM ??
                        sale.jumlah_item ??
                        items.reduce(
                            (
                                sum,
                                item
                            ) =>
                                sum +
                                Number(
                                    item.quantity
                                ),
                            0
                        )
                    ) || 0;


                return {

                    id:
                        id,

                    transactionNumber:
                        transactionNumber,

                    dateKey:
                        dateKey,

                    date:
                        rawDate ||
                        new Date().toISOString(),

                    items:
                        items,

                    total:
                        total,

                    payment:
                        payment,

                    change:
                        change,

                    itemCount:
                        itemCount

                };

            }
        )
        .filter(
            sale => {

                /*
                 * Jangan buang transaksi
                 * hanya karena detail item kosong.
                 *
                 * Yang paling penting untuk
                 * history adalah ID + TANGGAL_KEY.
                 */

                return (
                    sale.id ||
                    sale.transactionNumber
                );

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


    /*
     * PENTING:
     * Sekarang dateKey sudah dibaca dari
     * TANGGAL_KEY Google Sheets.
     */

    const sales =
        state.todaySales.filter(
            sale => {

                const saleDateKey =
                    String(
                        sale.dateKey || ""
                    ).trim();


                return (
                    saleDateKey ===
                    today
                );

            }
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


                /*
                 * Kalau detail tersedia,
                 * hitung jumlah item dari detail.
                 *
                 * Kalau tidak tersedia,
                 * gunakan JUMLAH_ITEM dari Sheet.
                 */

                const itemCount =
                    sale.items.length > 0
                        ? sale.items.reduce(
                            (
                                sum,
                                cartItem
                            ) =>
                                sum +
                                Number(
                                    cartItem.quantity
                                ),
                            0
                        )
                        : Number(
                            sale.itemCount ||
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


    if (
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

    } else {

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
   DOWNLOAD PENJUALAN HARI INI
========================================================= */

async function downloadTodaySales() {

    try {

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

                /*
                 * Kalau detail ada,
                 * download per item.
                 */

                if (
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

                } else {

                    /*
                     * Kalau DETAIL_PENJUALAN
                     * belum dikirim API,
                     * tetap masukkan transaksi.
                     */

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

    await Promise.all([
        loadMenusFromGoogleSheets(),
        loadTodaySalesFromGoogleSheets()
    ]);

}


/* =========================================================
   AUTO REFRESH PENJUALAN
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
        initializeApp
    );

} else {

    initializeApp();

}
