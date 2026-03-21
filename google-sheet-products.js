(function () {
    const productTrack = document.querySelector(".product_track");

    if (!productTrack) {
        return;
    }

    const sheetId = productTrack.dataset.sheetId?.trim();
    const sheetGid = productTrack.dataset.sheetGid?.trim() || "0";
    const callbackName = `googleSheetProductsCallback_${Date.now()}`;
    const popupProduct = document.querySelector(".popup_product");
    const popupProductOverlay = document.querySelector(".popup_product--overlay");
    const popupProductClose = document.getElementById("btn_closePopup");
    const popupProductImage = document.querySelector(".popup_product--img");
    const popupProductTitle = document.querySelector(".popup_product--title");
    const popupProductPrice = document.querySelector(".popup_product--price");
    const popupProductSummary = document.querySelector(".popup_product--summary");
    const popupProductDesc = document.querySelector(".popup_product--desc");
    const popupProductBuyBtn = document.querySelector(".popup_product--buyBtn");
    const popupProductQty = document.getElementById("qty");
    const popupProductSuggestList = document.querySelector(".popup_productSuggestList");
    const popupProductSuggestViewport = document.querySelector(".popup_productSuggestViewport");
    const popupProductSuggestPrev = document.querySelector(".popup_productSuggestNav--prev");
    const popupProductSuggestNext = document.querySelector(".popup_productSuggestNav--next");

    window.googleSheetProductsForOrder = [];
    window.googleSheetCatalog = [];

    function normalizeHeader(value = "") {
        return value
            .toString()
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
    }

    function normalizeCategory(value = "") {
        const category = normalizeHeader(value);

        if (category.includes("mypham")) {
            return "mypham";
        }

        if (category.includes("thietbi") || category.includes("giadung")) {
            return "thietbi";
        }

        if (category.includes("thucpham")) {
            return "thucpham";
        }

        return "all";
    }

    function escapeHtml(value = "") {
        return value
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatPrice(value = "") {
        const numericValue = Number(value.toString().replace(/[^\d.-]/g, ""));

        if (Number.isNaN(numericValue)) {
            return value || "Lien he";
        }

        return `${numericValue.toLocaleString("vi-VN")} đ`;
    }

    function getCellValue(cell) {
        if (!cell) {
            return "";
        }

        if (typeof cell.f === "string" && cell.f.trim()) {
            return cell.f.trim();
        }

        if (cell.v === null || cell.v === undefined) {
            return "";
        }

        return cell.v.toString().trim();
    }

    function getFieldValue(product, fieldNames) {
        for (const fieldName of fieldNames) {
            const matchedKey = Object.keys(product).find(
                (key) => normalizeHeader(key) === normalizeHeader(fieldName)
            );

            if (matchedKey && product[matchedKey]) {
                return product[matchedKey];
            }
        }

        return "";
    }

    function cleanup(scriptEl) {
        if (scriptEl && scriptEl.parentNode) {
            scriptEl.parentNode.removeChild(scriptEl);
        }

        try {
            delete window[callbackName];
        } catch (error) {
            window[callbackName] = undefined;
        }
    }

    function toListHtml(value = "", listClassName = "popup_product--descList", emptyText = "") {
        const items = value
            .split(/\r?\n+/)
            .map((item) => item.trim())
            .filter(Boolean);

        if (!items.length) {
            return emptyText ? `<ul class="${listClassName}"><li>${escapeHtml(emptyText)}</li></ul>` : "";
        }

        return `<ul class="${listClassName}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }

    function renderSuggestedProducts(currentProduct, currentIndex) {
        if (!popupProductSuggestList) {
            return;
        }

        const sameCategorySuggestions = window.googleSheetCatalog
            .map((product, index) => ({ ...product, index }))
            .filter((product) => product.index !== currentIndex && product.categoryKey === currentProduct.categoryKey)
            .slice(0, 10);

        const extraSuggestions = window.googleSheetCatalog
            .map((product, index) => ({ ...product, index }))
            .filter((product) =>
                product.index !== currentIndex &&
                product.categoryKey !== currentProduct.categoryKey &&
                !sameCategorySuggestions.some((item) => item.index === product.index)
            )
            .slice(0, Math.max(0, 10 - sameCategorySuggestions.length));

        const suggestions = [...sameCategorySuggestions, ...extraSuggestions];

        if (!suggestions.length) {
            popupProductSuggestList.innerHTML = '<div class="popup_productSuggestEmpty">Chua co san pham goi y cung danh muc.</div>';
            popupProductSuggestViewport.scrollLeft = 0;
            updateSuggestSliderButtons();
            return;
        }

        popupProductSuggestList.innerHTML = suggestions.map((product) => `
            <article class="popup_productSuggestItem" data-product-index="${product.index}">
                <img src="${escapeHtml(product.image || "https://placehold.co/300x300?text=No+Image")}" alt="${escapeHtml(product.name || "San pham")}">
                <h4 class="popup_productSuggestTitle">${escapeHtml(product.name || "San pham")}</h4>
                <p class="popup_productSuggestPrice">${escapeHtml(formatPrice(product.price))}</p>
            </article>
        `).join("");

        popupProductSuggestViewport.scrollLeft = 0;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                updateSuggestSliderButtons();
            });
        });

        popupProductSuggestList.querySelectorAll(".popup_productSuggestItem").forEach((item) => {
            item.addEventListener("click", () => {
                openProductDetail(Number(item.dataset.productIndex));
            });
        });

        popupProductSuggestList.querySelectorAll("img").forEach((img) => {
            img.addEventListener("load", updateSuggestSliderButtons, { once: true });
            img.addEventListener("error", updateSuggestSliderButtons, { once: true });
        });
    }

    function getSuggestSlideWidth() {
        const firstItem = popupProductSuggestList?.querySelector(".popup_productSuggestItem");

        if (!firstItem) {
            return 0;
        }

        const styles = window.getComputedStyle(popupProductSuggestList);
        const gap = parseFloat(styles.columnGap || styles.gap || "0");

        const measuredWidth = firstItem.getBoundingClientRect().width + gap;

        if (measuredWidth > 0) {
            return measuredWidth;
        }

        return popupProductSuggestViewport
            ? Math.max(240, popupProductSuggestViewport.clientWidth * 0.85)
            : 320;
    }

    function updateSuggestSliderButtons() {
        if (!popupProductSuggestList || !popupProductSuggestViewport || !popupProductSuggestPrev || !popupProductSuggestNext) {
            return;
        }

        const maxTranslate = Math.max(0, popupProductSuggestViewport.scrollWidth - popupProductSuggestViewport.clientWidth);
        const currentTranslate = popupProductSuggestViewport.scrollLeft;

        popupProductSuggestPrev.disabled = currentTranslate <= 0;
        popupProductSuggestNext.disabled = currentTranslate >= maxTranslate - 1;
    }

    function moveSuggestSlider(direction) {
        if (!popupProductSuggestList || !popupProductSuggestViewport) {
            return;
        }

        const step = getSuggestSlideWidth();
        const delta = direction === "next" ? step : -step;

        popupProductSuggestViewport.scrollBy({
            left: delta,
            behavior: "smooth"
        });

        window.setTimeout(updateSuggestSliderButtons, 320);
    }

    function openProductDetail(productIndex) {
        const product = window.googleSheetCatalog[productIndex];

        if (!product || !popupProduct) {
            return;
        }

        popupProductImage.src = product.image || "https://placehold.co/600x400?text=No+Image";
        popupProductImage.alt = product.name || "San pham";
        popupProductTitle.textContent = product.name || "San pham";
        popupProductPrice.textContent = formatPrice(product.price);
        if (popupProductSummary) {
            popupProductSummary.innerHTML = toListHtml(product.summary || "", "popup_product--summaryList");
            popupProductSummary.style.display = product.summary ? "block" : "none";
        }
        popupProductDesc.innerHTML = toListHtml(product.description || "", "popup_product--descList", "Chua co mo ta san pham.");
        popupProductBuyBtn.dataset.name = product.name || "";
        popupProductBuyBtn.dataset.price = product.price || "";
        popupProductQty.value = "1";
        renderSuggestedProducts(product, productIndex);
        popupProduct.style.display = "flex";
    }

    function closeProductDetail() {
        if (!popupProduct) {
            return;
        }

        popupProduct.style.display = "none";
    }

    function bindProductDetailEvents() {
        productTrack.querySelectorAll(".product_detailTrigger").forEach((button) => {
            if (button.dataset.detailBound === "true") {
                return;
            }

            button.dataset.detailBound = "true";
            button.addEventListener("click", () => {
                openProductDetail(Number(button.dataset.productIndex));
            });
        });

        productTrack.querySelectorAll(".product_detailImage").forEach((image) => {
            if (image.dataset.detailBound === "true") {
                return;
            }

            image.dataset.detailBound = "true";
            image.addEventListener("click", () => {
                openProductDetail(Number(image.dataset.productIndex));
            });
        });
    }

    if (popupProductClose) {
        popupProductClose.addEventListener("click", closeProductDetail);
    }

    if (popupProductOverlay) {
        popupProductOverlay.addEventListener("click", closeProductDetail);
    }

    if (popupProductSuggestPrev) {
        popupProductSuggestPrev.addEventListener("click", () => moveSuggestSlider("prev"));
    }

    if (popupProductSuggestNext) {
        popupProductSuggestNext.addEventListener("click", () => moveSuggestSlider("next"));
    }

    if (popupProductSuggestViewport) {
        popupProductSuggestViewport.addEventListener("scroll", updateSuggestSliderButtons);
    }

    window.addEventListener("resize", updateSuggestSliderButtons);

    if (popupProductBuyBtn) {
        popupProductBuyBtn.addEventListener("click", () => {
            const qty = Math.max(1, Number(popupProductQty?.value || 1));

            closeProductDetail();

            if (typeof window.openOrder === "function") {
                window.openOrder();
            }

            if (typeof window.addProduct === "function") {
                window.addProduct(
                    popupProductBuyBtn.dataset.name || "",
                    popupProductBuyBtn.dataset.price || ""
                );
            }

            const rows = document.querySelectorAll(".order__productRow");
            const lastRowQty = rows.length ? rows[rows.length - 1].querySelector(".order__qty") : null;

            if (lastRowQty) {
                lastRowQty.value = qty;
                lastRowQty.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });
    }

    function parseProducts(response) {
        const table = response.table || {};
        const headers = (table.cols || []).map((col) => col.label || col.id || "");
        const rows = table.rows || [];

        return rows.map((row) => {
            const item = {};

            headers.forEach((header, index) => {
                item[header] = getCellValue(row.c ? row.c[index] : null);
            });

            return item;
        }).filter((item) => Object.values(item).some(Boolean));
    }

    function renderProducts(products) {
        if (!products.length) {
            productTrack.innerHTML = '<p class="google-sheet-status">Google Sheet chua co du lieu san pham.</p>';
            return;
        }

        window.googleSheetCatalog = products.map((product) => ({
            name: getFieldValue(product, ["ten", "tensanpham", "sanpham", "name", "productname"]),
            image: getFieldValue(product, ["hinh", "hinhanh", "image", "img", "anh", "photo"]),
            price: getFieldValue(product, ["gia", "price", "giaban"]),
            summary: getFieldValue(product, ["summary", "tomtat", "subtitle"]),
            description: getFieldValue(product, ["description", "mota", "motasanpham", "desc"]),
            categoryKey: normalizeCategory(getFieldValue(product, ["category", "danhmuc", "loai"]))
        }));

        window.googleSheetProductsForOrder = products.map((product) => ({
            name: getFieldValue(product, ["ten", "tensanpham", "sanpham", "name", "productname"]),
            price: getFieldValue(product, ["gia", "price", "giaban"])
        })).filter((product) => product.name);

        const html = products.map((product, index) => {
            const name = getFieldValue(product, ["ten", "tensanpham", "sanpham", "name", "productname"]);
            const image = getFieldValue(product, ["hinh", "hinhanh", "image", "img", "anh", "photo"]);
            const price = getFieldValue(product, ["gia", "price", "giaban"]);
            const category = getFieldValue(product, ["category", "danhmuc", "loai"]);
            const categoryKey = normalizeCategory(category);

            return `
                <div class="product_listItem" data-category="${escapeHtml(categoryKey)}">
                    <div class="product_imgWrap">
                        <img
                            src="${escapeHtml(image || "https://placehold.co/600x400?text=No+Image")}"
                            alt="${escapeHtml(name || "San pham")}"
                            class="product_listItem--img product_detailImage"
                            data-product-index="${index}"
                        >
                    </div>
                    <h3
                        class="product_listItem--title product_detailTrigger"
                        data-product-index="${index}"
                    >${escapeHtml(name || "Chua co ten san pham")}</h3>
                    <div class="product_listItem--cost">${escapeHtml(formatPrice(price))}</div>
                    <button
                        type="button"
                        class="product_hoverBtn"
                        data-name="${escapeHtml(name || "")}"
                        data-price="${escapeHtml(price || "")}"
                    >
                        <svg class="icon_addCart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                            <path d="M24 48C10.7 48 0 58.7 0 72C0 85.3 10.7 96 24 96L69.3 96C73.2 96 76.5 98.8 77.2 102.6L129.3 388.9C135.5 423.1 165.3 448 200.1 448L456 448C469.3 448 480 437.3 480 424C480 410.7 469.3 400 456 400L200.1 400C188.5 400 178.6 391.7 176.5 380.3L171.4 352L475 352C505.8 352 532.2 330.1 537.9 299.8L568.9 133.9C572.6 114.2 557.5 96 537.4 96L124.7 96L124.3 94C119.5 67.4 96.3 48 69.2 48L24 48zM208 576C234.5 576 256 554.5 256 528C256 501.5 234.5 480 208 480C181.5 480 160 501.5 160 528C160 554.5 181.5 576 208 576zM432 576C458.5 576 480 554.5 480 528C480 501.5 458.5 480 432 480C405.5 480 384 501.5 384 528C384 554.5 405.5 576 432 576z" />
                        </svg>
                    </button>
                </div>
            `;
        }).join("");

        productTrack.innerHTML = html;

        if (typeof window.refreshProductSlider === "function") {
            window.refreshProductSlider();
        }

        if (typeof window.filterProducts === "function") {
            const activeBtn = document.querySelector(".product_nav--item.active");
            const activeFilter = activeBtn ? activeBtn.getAttribute("data-filter") : "all";
            window.filterProducts(activeFilter);
        }

        if (typeof window.bindDynamicProductButtons === "function") {
            window.bindDynamicProductButtons();
        }

        bindProductDetailEvents();

        if (typeof window.refreshOrderProductSelects === "function") {
            window.refreshOrderProductSelects();
        }
    }

    if (!sheetId) {
        productTrack.innerHTML = '<p class="google-sheet-status">Thieu data-sheet-id de tai du lieu Google Sheet.</p>';
        return;
    }

    productTrack.innerHTML = '<p class="google-sheet-status">Dang tai san pham...</p>';

    const scriptEl = document.createElement("script");

    window[callbackName] = function (response) {
        cleanup(scriptEl);

        try {
            if (response.status === "error") {
                throw new Error(response.errors?.[0]?.detailed_message || "Google Sheet error");
            }

            const products = parseProducts(response);
            renderProducts(products);
        } catch (error) {
            productTrack.innerHTML = '<p class="google-sheet-status">Khong doc duoc du lieu Google Sheet. Kiem tra lai quyen chia se sheet.</p>';
            console.error("Google Sheet render failed:", error);
        }
    };

    scriptEl.onerror = function () {
        cleanup(scriptEl);
        productTrack.innerHTML = '<p class="google-sheet-status">Khong ket noi duoc Google Sheet.</p>';
    };

    scriptEl.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&gid=${sheetGid}`;
    document.body.appendChild(scriptEl);
})();
