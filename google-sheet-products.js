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

        syncCartWithGoogleSheet();
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

    // *********************Cart*****************************
    const cartWrap = document.querySelector(".main_cart--wrap");
    const totalCartEl = document.getElementById("total_cart");
    const checkAllEl = document.querySelector(".end_cart--checkAll input");
    const btnOrderCart = document.querySelector(".btn_buyCart");

    let carts = [];

    function saveCart() {
        localStorage.setItem("cart", JSON.stringify(carts));
    }

    function loadCart() {
        const data = localStorage.getItem("cart");
        carts = data ? JSON.parse(data) : [];
    }

    function syncCartWithGoogleSheet() {
        if (!carts.length || !window.googleSheetCatalog.length) return;

        let hasChanged = false;

        carts.forEach(cartItem => {
            // Tìm sản phẩm tương ứng trên Google Sheet (dựa vào tên)
            const liveProduct = window.googleSheetCatalog.find(p => p.name === cartItem.name);

            if (liveProduct) {
                const livePrice = Number(liveProduct.price);
                
                // Nếu giá trên LocalStorage khác giá trên Sheet thì cập nhật lại
                if (cartItem.price !== livePrice) {
                    cartItem.price = livePrice;
                    hasChanged = true;
                }
                
                // Cập nhật luôn hình ảnh phòng trường hợp ông đổi link ảnh trên Sheet
                if (cartItem.image !== liveProduct.image) {
                    cartItem.image = liveProduct.image;
                    hasChanged = true;
                }
            }
        });

        // Nếu phát hiện có sự thay đổi giá/hình thì lưu đè lại LocalStorage và vẽ lại giỏ hàng
        if (hasChanged) {
            saveCart();
            renderCart();
            updateCartTotal();
        }
    }

    const cartCountEl = document.querySelectorAll(".cart_count");

    function updateCartCount() {
        const totalQty = carts.reduce((sum, item) => sum + item.qty, 0);
        cartCountEl.forEach(qty => {
            qty.innerHTML = totalQty;
        })
    }

    loadCart();
    renderCart();
    updateCartTotal();
    updateCartCount();
    function formatPriceCart(price) {
        return Number(price).toLocaleString("vi-VN") + "đ";
    }

    

    function renderCart() {

        const emptyCartMsg = document.querySelector(".main_cart--empty");
        const cartDetailHeader = document.querySelector(".main_cart--detail");
        

        if (!carts.length) {
            cartWrap.innerHTML = "";
            totalCartEl.innerText = "0đ";
            
            
            emptyCartMsg.style.display = "flex"; 
            
            cartDetailHeader.style.display = "none";
            
            return;
        }

        emptyCartMsg.style.display = "none";
        
        cartDetailHeader.style.display = "flex"; 

        cartWrap.innerHTML = carts.map((item, index) => `
            <div class="main_cart--item" data-index="${index}">
                <div class="main_cart--itemBtnRemove">✕</div>
                <input type="checkbox" class="cart_check">
                <img src="${item.image}" class="main_cart--itemImg">

                <div class="main_cart--itemContent">
                    <h5 class="main_cart--itemName">${item.name}</h5>

                    <div class="main_cart--itemQty">
                        <div>Số lượng:</div>
                        <div class="qty-wrapper">
                            <button type="button" class="qty-btn qty-minus">-</button>
                            <input type="number" class="cart_qty" value="${item.qty}" min="1">
                            <button type="button" class="qty-btn qty-plus">+</button>
                        </div>
                    </div>

                    <div class="main_cart--itemPrice">
                        <div>Giá: </div>
                        <div>${formatPriceCart(item.price)}</div>
                    </div>
                </div>

                <div class="main_cart--itemTotal">${formatPriceCart(item.price * item.qty)}</div>
            </div>
        `).join("");

        bindCartEvents();
        updateCartTotal();
        updateCartCount();
    }

    function showAddCartSuccess() {
        
        const toast = document.createElement("div");
        toast.className = "toast-msg";
        toast.innerHTML = "✔ Đã thêm sản phẩm vào giỏ hàng!";

        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("show");
        }, 10);

        setTimeout(() => {
            toast.classList.remove("show");
            
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 3000);
    }

    const addCartBtn = document.querySelector(".popup_product--addCartBtn");

    if (addCartBtn) {
        addCartBtn.addEventListener("click", () => {

            const name = popupProductTitle.textContent;
            const price = Number(popupProductBuyBtn.dataset.price || 0);
            const image = popupProductImage.src;
            const qty = Number(popupProductQty.value || 1);

            const exist = carts.find(item => item.name === name);

            if (exist) {
                exist.qty += qty;
            } else {
                carts.push({ name, price, image, qty });
                
            }

            saveCart();
            renderCart();
            showAddCartSuccess();
        });
    }

function bindCartEvents() {
    // 1. Nút xóa sản phẩm
    document.querySelectorAll(".main_cart--itemBtnRemove").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const index = e.target.closest(".main_cart--item").dataset.index;
            carts.splice(index, 1);
            updateCartCount();
            saveCart();
            renderCart(); // Xóa sản phẩm thì bắt buộc phải render lại để cập nhật danh sách
            
            // Nếu xóa hết giỏ hàng thì bỏ check "Chọn tất cả"
            if(carts.length === 0) checkAllEl.checked = false; 
        };
    });

    // 2. Ô input thay đổi số lượng
    document.querySelectorAll(".cart_qty").forEach(input => {
        input.oninput = (e) => {
            const itemEl = e.target.closest(".main_cart--item");
            const index = itemEl.dataset.index;
            let newQty = Number(e.target.value);

            // Đảm bảo số lượng không được nhỏ hơn 1
            if (newQty < 1) {
                newQty = 1;
                e.target.value = 1;
            }

            // Cập nhật mảng giỏ hàng và lưu lại
            carts[index].qty = newQty;
            saveCart();

            // Chỉ cập nhật DOM: tính lại thành tiền của RIÊNG sản phẩm này thay vì render toàn bộ giỏ hàng
            const itemTotalEl = itemEl.querySelector(".main_cart--itemTotal");
            if (itemTotalEl) {
                itemTotalEl.innerText = formatPriceCart(carts[index].price * carts[index].qty);
            }

            // Cập nhật tổng số lượng icon giỏ hàng và tổng tiền đang chọn
            updateCartCount();
            updateCartTotal();
        };
    });

    // 3. Tự động cập nhật nút "Chọn tất cả" nếu user check tay từng sản phẩm
    document.querySelectorAll(".cart_check").forEach(cb => {
        cb.onchange = () => {
            updateCartTotal();
            
            // Kiểm tra xem tất cả các sản phẩm có đang được check không
            const totalChecks = document.querySelectorAll(".cart_check").length;
            const checkedCount = document.querySelectorAll(".cart_check:checked").length;
            
            // Nếu tổng số check bằng với số sản phẩm, tự động đánh dấu checkAll
            checkAllEl.checked = (totalChecks > 0 && totalChecks === checkedCount);
        };
    });

    // 4. Bắt sự kiện bấm nút Trừ
    document.querySelectorAll(".qty-minus").forEach(btn => {
        btn.onclick = (e) => {
            // Tìm ô input nằm ngay kế bên nút Trừ
            const input = e.target.nextElementSibling;
            if (input.value > 1) {
                input.value = Number(input.value) - 1;
                // Kích hoạt sự kiện 'input' để nó tự chạy logic tính tiền ở trên
                input.dispatchEvent(new Event('input', { bubbles: true })); 
            }
        };
    });

    // 5. Bắt sự kiện bấm nút Cộng
    document.querySelectorAll(".qty-plus").forEach(btn => {
        btn.onclick = (e) => {
            // Tìm ô input nằm ngay kế bên trước nút Cộng
            const input = e.target.previousElementSibling;
            input.value = Number(input.value) + 1;
            // Kích hoạt sự kiện 'input' để nó tự chạy logic tính tiền ở trên
            input.dispatchEvent(new Event('input', { bubbles: true })); 
        };
    });
}

    function updateCartTotal() {
        let total = 0;

        document.querySelectorAll(".main_cart--item").forEach((itemEl, index) => {
            const checked = itemEl.querySelector(".cart_check").checked;

            if (checked) {
                total += carts[index].price * carts[index].qty;
            }
        });

        totalCartEl.innerText = formatPriceCart(total);
    }

    checkAllEl.onchange = () => {
        const checked = checkAllEl.checked;

        document.querySelectorAll(".cart_check").forEach(cb => {
            cb.checked = checked;
        });

        updateCartTotal();
    };

    btnOrderCart.onclick = () => {

    const selectedItems = carts.filter((item, index) => {
        const el = document.querySelector(`.main_cart--item[data-index="${index}"]`);
        return el && el.querySelector(".cart_check").checked;
    });

    if (!selectedItems.length) {
        alert("Chọn ít nhất 1 sản phẩm");
        return;
    }

    console.log("addProduct hiện tại:", window.addProduct);

    if (typeof window.addProduct !== "function") {
        console.error("addProduct chưa sẵn sàng!");
        return;
    }

    window.productBox.innerHTML = "";

    window.openOrder();

    selectedItems.forEach(item => {
        console.log("CALL addProduct:", item);
        window.addProduct(item.name, item.price, item.qty);
    });

    window.updateTotal();
};

// ================= XỬ LÝ NÚT TĂNG GIẢM SỐ LƯỢNG Ở POPUP =================
const popupQtyMinus = document.getElementById("popup-qty-minus");
const popupQtyPlus = document.getElementById("popup-qty-plus");
const popupQtyInput = document.getElementById("qty");

if (popupQtyMinus && popupQtyPlus && popupQtyInput) {
    // Bấm nút Trừ
    popupQtyMinus.addEventListener("click", () => {
        let currentQty = Number(popupQtyInput.value);
        if (currentQty > 1) {
            popupQtyInput.value = currentQty - 1;
        }
    });

    // Bấm nút Cộng
    popupQtyPlus.addEventListener("click", () => {
        let currentQty = Number(popupQtyInput.value);
        popupQtyInput.value = currentQty + 1;
    });

    // Ngăn khách hàng tự gõ số âm hoặc số 0 vào ô
    popupQtyInput.addEventListener("input", () => {
        if (popupQtyInput.value !== "" && Number(popupQtyInput.value) < 1) {
            popupQtyInput.value = 1;
        }
    });
}
    
})();
