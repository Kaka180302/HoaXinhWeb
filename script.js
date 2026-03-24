window.addEventListener("DOMContentLoaded", () => {
  
  // *******************Header********************
const header = document.querySelector('.header_info');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

const headerMobile = document.querySelector('.header_mobile');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        headerMobile.classList.add('scrolled');
    } else {
        headerMobile.classList.remove('scrolled');
    }
});

// *******************Slider_top****************

const slides = document.querySelector(".slider_item")

let index = 1
const total = 4

slides.style.transform = "translateX(-100%)"

function updateDot(i){
  document.getElementById("s"+i).checked = true
}

function nextSlide(){

  index++

  slides.style.transition = "0.6s"
  slides.style.transform = `translateX(-${index*100}%)`

  if(index <= total){
    updateDot(index)
  }

  if(index == total + 1){

    setTimeout(()=>{
      slides.style.transition = "none"
      index = 1
      slides.style.transform = "translateX(-100%)"
      updateDot(1)
    },600)

  }

}
setInterval(nextSlide,3000)
// *****************End_Slider_Top*********************

// **************************Form_Popup***********************

const orderPopup = document.getElementById("order")
const closeBtn = document.querySelector(".order__close")
const productBtnSelector = ".product_buyBtn, .product_hoverBtn, .product_buyBtn--detail"

const productBox = document.getElementById("orderProducts")
const addProductBtn = document.getElementById("addProduct")
const totalEl = document.getElementById("orderTotal")

const paymentMethod = document.getElementById("paymentMethod")
const qrBox = document.getElementById("qrBox")
const invoiceToggle = document.getElementById("invoiceToggle")
const invoiceFields = document.getElementById("invoiceFields")
const invoiceInputs = document.querySelectorAll("#companyName,#companyTaxCode,#companyAddress,#companyEmail")

let products = []

function getSheetProductsForOrder() {
  return Array.isArray(window.googleSheetProductsForOrder)
    ? window.googleSheetProductsForOrder
    : []
}

function buildOrderOptionsHtml(selectedName = "", selectedPrice = "") {
  const sheetProducts = getSheetProductsForOrder()

  let optionsHtml = '<option value="">--Chon san pham--</option>'

  if (sheetProducts.length) {
    optionsHtml += sheetProducts.map((product) => {
      const isSelected = product.name === selectedName ? " selected" : ""
      const safeName = String(product.name || "").replace(/"/g, "&quot;")
      const safePrice = String(product.price || "").replace(/"/g, "&quot;")

      return `<option value="${safeName}" data-price="${safePrice}"${isSelected}>${safeName}</option>`
    }).join("")

    return optionsHtml
  }

  return optionsHtml
}

function refreshOrderProductSelects() {
  document.querySelectorAll(".order__productRow .order__select").forEach((select) => {
    const selectedOption = select.options[select.selectedIndex]
    const selectedName = selectedOption ? selectedOption.text : ""
    const selectedPrice = selectedOption ? selectedOption.dataset.price || "" : ""

    select.innerHTML = buildOrderOptionsHtml(selectedName, selectedPrice)

    if (selectedName && !Array.from(select.options).some((option) => option.text === selectedName)) {
      const customOption = document.createElement("option")
      customOption.text = selectedName
      customOption.value = selectedName
      customOption.dataset.price = selectedPrice || 0
      customOption.selected = true
      select.appendChild(customOption)
    }
  })

  updateTotal()
}

function openOrder(){
  orderPopup.classList.add("active")
}

window.openOrder = openOrder

function resetOrderForm(){

    // xoá danh sách sản phẩm
    productBox.innerHTML = ""

    // reset tổng tiền
    totalEl.innerText = "0"

    // reset form
    document.getElementById("orderForm").reset()

    // ẩn QR
    qrBox.style.display = "none"

}

function closeOrder(){
  orderPopup.classList.remove("active")

  resetOrderForm()

  if(invoiceToggle){
    invoiceToggle.checked = false
  }

  if(invoiceFields){
    invoiceFields.classList.remove("active")
  }
}

if(invoiceToggle){
  invoiceToggle.onchange = ()=>{
    invoiceFields.classList.toggle("active", invoiceToggle.checked)
    checkForm()
  }
}

closeBtn.onclick = closeOrder



function bindDynamicProductButtons() {
  document.querySelectorAll(productBtnSelector).forEach(btn=>{
    if (btn.dataset.orderBound === "true") {
      return
    }

    btn.dataset.orderBound = "true"

    btn.addEventListener("click",()=>{

        openOrder()

        addProduct(
          btn.dataset.name,
          btn.dataset.price
        )
    })
  })
}

bindDynamicProductButtons()
window.bindDynamicProductButtons = bindDynamicProductButtons
window.refreshOrderProductSelects = refreshOrderProductSelects

window.addProduct = addProduct

function addProduct(name = "", price = 0 ,qty = 1){
  console.log("ADD PRODUCT:", name, price, qty);

  const row = document.createElement("div")
  row.className = "order__productRow"

  row.innerHTML = `

    <select class="order__select">
      ${buildOrderOptionsHtml(name, price)}
    </select>

    <input
      type="number"
      name = "qty"
      class="order__qty"
      value="${qty}"
      min="1"
    >

    <button type="button" class="order__remove">
      x
    </button>
  `

  productBox.appendChild(row)

  if(name){

    const select = row.querySelector("select")
    let hasMatchedOption = false

    for(let option of select.options){

      if(option.text === name){
        option.selected = true
        hasMatchedOption = true
      }

    }

    if(!hasMatchedOption){
      const customOption = document.createElement("option")
      customOption.text = name
      customOption.value = name
      customOption.dataset.price = price || 0
      customOption.selected = true
      select.appendChild(customOption)
    }

  }

  updateTotal()
}



  addProductBtn.onclick = ()=>{

  const rows = document.querySelectorAll(".order__productRow")
  const lastRow = rows[rows.length - 1]

  if (lastRow) {
    const select = lastRow.querySelector("select")
    if (!select.value) {
      alert("Chọn sản phẩm trước đã 😅")
      return
    }
  }
    addProduct()

  }



  productBox.addEventListener("click",(e)=>{

    if(e.target.classList.contains("order__remove")){

    e.target.parentElement.remove()

    updateTotal()

    }

  })


productBox.addEventListener("change",updateTotal)
productBox.addEventListener("input",updateTotal)



function updateTotal(){

  let total = 0

  document.querySelectorAll(".order__productRow")
  .forEach(row=>{

    const select = row.querySelector("select")
    const qty = row.querySelector("input").value

    const price = select.options[select.selectedIndex]?.dataset.price

    if(price){

      total += price * qty

    }

  })

    totalEl.innerText = total.toLocaleString()
    document.getElementById("orderTotalInput").value = total

}



paymentMethod.onchange = ()=>{

  if(paymentMethod.value === "qr"){

    qrBox.style.display="block"

  }else{

  qrBox.style.display="none"

  }
}

// **********Validate*********************

function validatePhone(phone){

  const regex = /^(0[3|5|7|8|9])[0-9]{8}$/

  return regex.test(phone)

}


const submitBtn = document.getElementById("orderSubmit")
const customerPhone = document.getElementById("customerPhone")
const inputs = document.querySelectorAll("#customerName,#customerEmail,#customerPhone,#customerAddress")

function checkForm(){

  let valid = true

  inputs.forEach(input=>{

    if(input.value.trim()===""){
    valid=false
  }

  })

  if(document.querySelectorAll(".order__productRow").length === 0){
    valid = false
  }

  if(!validatePhone(customerPhone.value)){
    valid=false
  }

  if(invoiceToggle?.checked){
    invoiceInputs.forEach(input=>{
      if(input.value.trim()===""){
        valid=false
      }
    })
  }

  submitBtn.disabled = !valid

}

inputs.forEach(input=>{

  input.addEventListener("input",checkForm)

})

invoiceInputs.forEach(input=>{
  input.addEventListener("input",checkForm)
})

// ***********Notification***********************

const successPopup = document.getElementById("successPopup")
const successOk = document.getElementById("successOk")

successOk.onclick = ()=>{
  successPopup.classList.remove("active")
}

// ******************Form_Submit*****************

const scriptURL = "https://script.google.com/macros/s/AKfycbzQp_u8op-b0uJMOjFS-yq2LH46j_eoI-M4JeTRjqrDkG_7buRqJte98WIZjPXC5fuPug/exec"
const form = document.getElementById("orderForm")

form.addEventListener("submit", function(e){

  e.preventDefault()
  submitBtn.classList.add("loading")
  submitBtn.textContent = "Đang gửi..."

let productList = []

document.querySelectorAll(".order__productRow").forEach(row=>{

  const select = row.querySelector("select")
  const productName = select.options[select.selectedIndex].text.split(" - ")[0]

  const price = select.options[select.selectedIndex].dataset.price
  const qty = row.querySelector(".order__qty").value

  const subtotal = price * qty

  productList.push({
    name: productName,
    price: price,
    qty: qty,
    subtotal: subtotal
  })

})

const products = JSON.stringify(productList)

  const formData = new FormData()

  formData.append("name", document.getElementById("customerName").value)
  formData.append("email", document.getElementById("customerEmail").value)
  formData.append("phone", document.getElementById("customerPhone").value)
  formData.append("address", document.getElementById("customerAddress").value)
  formData.append("product", products)
  formData.append("total", document.getElementById("orderTotalInput").value)
  formData.append("invoiceRequired", invoiceToggle?.checked ? "yes" : "no")
  formData.append("companyName", document.getElementById("companyName")?.value || "")
  formData.append("companyTaxCode", document.getElementById("companyTaxCode")?.value || "")
  formData.append("companyAddress", document.getElementById("companyAddress")?.value || "")
  formData.append("companyEmail", document.getElementById("companyEmail")?.value || "")

  fetch(scriptURL,{
    method:"POST",
    body: formData
  })
  .then(res=>{
    successPopup.classList.add("active")
    submitBtn.classList.remove("loading")
    submitBtn.textContent = "Đặt hàng"
    closeOrder()
  })
.catch(err=>{
    successPopup.querySelector("p").innerText =
    "❌ Gửi đơn thất bại. Vui lòng thử lại."

    successPopup.classList.add("active")
})
})

// ******************Menu mobile**************************

const menu = document.querySelector(".menu_nav")
const openBtn = document.getElementById("menuToggle")
const closeBtnMobile = document.getElementById("btn_close")

if (openBtn) {
  openBtn.onclick = function(){
    menu.classList.add("active")
  }
}

if (closeBtnMobile) {
  closeBtnMobile.onclick = function(){
    menu.classList.remove("active")
  }
}

document.addEventListener("click", (e) => {

    if(!menu.contains(e.target) && !openBtn.contains(e.target)){
        menu.classList.remove("active")
    }

})

// ************ SLIDER *************

const track = document.querySelector(".product_track");
const nextBtn_product = document.querySelector(".product_button--next");
const prevBtn_product = document.querySelector(".product_button--prev");

let index_product = 0;
let maxIndex = 0;

function getVisibleItems() {
    // Nếu màn hình nhỏ hơn hoặc bằng 768px (điện thoại/tablet nhỏ) thì trả về 2
    if (window.innerWidth <= 768) {
        return 2;
    }
    // Còn lại (PC) thì trả về 3
    return 3; 
}

function getProductItems() {
    return Array.from(document.querySelectorAll(".product_listItem"));
}

function getVisibleProductItems() {
    return getProductItems().filter((item) => item.style.display !== "none");
}


function getItemWidth() {
    const firstVisibleItem = getVisibleProductItems()[0] || getProductItems()[0];

    if (!firstVisibleItem) return 0;

    const style = window.getComputedStyle(track);
    const gap = parseInt(style.columnGap || style.gap || 0);

    return firstVisibleItem.offsetWidth + gap;
}

function updateButtons() {
    if (!prevBtn_product || !nextBtn_product) return;

    prevBtn_product.classList.toggle("disabled", index_product === 0);
    nextBtn_product.classList.toggle("disabled", index_product >= maxIndex);
}


function moveSlider() {
    track.style.transform = `translateX(-${index_product * getItemWidth()}px)`;
}

window.refreshProductSlider = function () {
    const items = getVisibleProductItems();

    if (!items.length) {
        maxIndex = 0;
        index_product = 0;
        moveSlider();
        updateButtons();
        return;
    }

    const totalItems = items.length;

    maxIndex = Math.max(0, totalItems - getVisibleItems());

    index_product = 0;
    moveSlider();

    updateButtons();
};

if (nextBtn_product) {
    nextBtn_product.addEventListener("click", () => {
        if (index_product < maxIndex) {
            index_product++;
            moveSlider();
            updateButtons();
        }
    });
}

if (prevBtn_product) {
    prevBtn_product.addEventListener("click", () => {
        if (index_product > 0) {
            index_product--;
            moveSlider();
            updateButtons();
        }
    });
}

window.addEventListener("load", () => {
    window.refreshProductSlider();
});

let startX = 0;
let currentX = 0;
let isDragging = false;

track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
});

track.addEventListener("touchmove", (e) => {
    if (!isDragging) return;

    currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    
    track.style.transform = `translateX(${-index_product * getItemWidth() + diff}px)`;
});

track.addEventListener("touchend", () => {
    if (!isDragging) return;

    const diff = currentX - startX;

    const threshold = 50;

    if (diff < -threshold && index_product < maxIndex) {
        
        index_product++;
    } else if (diff > threshold && index_product > 0) {
        
        index_product--;
    }

    moveSlider();
    updateButtons();

    isDragging = false;
});

function updateButtons() {
    prevBtn_product.classList.toggle("disabled", index_product === 0);
    nextBtn_product.classList.toggle("disabled", index_product >= maxIndex);
}

nextBtn_product.addEventListener("click", () => {
    if (index_product < maxIndex) {
        index_product++;
        track.style.transform = `translateX(-${index_product * getItemWidth()}px)`;
        updateButtons();
    }
});

prevBtn_product.addEventListener("click", () => {
    if (index_product > 0) {
        index_product--;
        track.style.transform = `translateX(-${index_product * getItemWidth()}px)`;
        updateButtons();
    }
});

window.addEventListener("resize", () => {
    const visibleProducts = getVisibleProductItems();
    maxIndex = Math.max(0, visibleProducts.length - getVisibleItems());
    
    // Ép index_product lùi lại nếu màn hình to ra làm maxIndex bị giảm
    if (index_product > maxIndex) {
        index_product = Math.max(0, maxIndex);
        moveSlider();
    }
    updateButtons();
});


// ************* FILTER FUNCTION (CHUNG) *************
function filterProducts(filter) {

    index_product = 0;
    track.style.transform = `translateX(0px)`;

    getProductItems().forEach(item => {
        const category = item.getAttribute("data-category");

        item.style.display =
            (filter === "all" || filter === category) ? "block" : "none";
    });

    const visibleProducts = getVisibleProductItems();
    maxIndex = Math.max(0, visibleProducts.length - getVisibleItems());

    updateButtons();
}

function refreshProductSlider() {
    index_product = 0;
    track.style.transform = `translateX(0px)`;
    maxIndex = Math.max(0, getVisibleProductItems().length - getVisibleItems());
    updateButtons();
}


// ************* CLICK TAB (PRODUCT NAV) *************
const navBtns = document.querySelectorAll(".product_nav--item");

navBtns.forEach(btn => {
    btn.addEventListener("click", () => {

        const filter = btn.getAttribute("data-filter");

        // active tab
        navBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        filterProducts(filter);
    });
});


// ************* CLICK SUBMENU *************
const menuItems = document.querySelectorAll(".menu_product--item");

menuItems.forEach(menu => {
    menu.addEventListener("click", () => {

        const filter = menu.getAttribute("data-filter");

        // active tab bên dưới
        navBtns.forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.getAttribute("data-filter") === filter
            );
        });

        filterProducts(filter);
    });
});

window.filterProducts = filterProducts;
window.refreshProductSlider = refreshProductSlider;
refreshProductSlider();

// ************************Cart*************************************

const cart = document.querySelector(".cart")
const openBtn_cart = document.querySelectorAll(".icon_cartWrap")
const closeBtnCart = document.getElementById("btn_closeCart")

openBtn_cart.forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    cart.classList.add("active_cart")
    menu.classList.remove("active")
  })

})
if (closeBtnCart) {
  closeBtnCart.onclick = function(){
    cart.classList.remove("active_cart")
  }
}

document.addEventListener("click", (e) => {

    if(!cart.contains(e.target)){
        cart.classList.remove("active_cart")
    }

})

window.addProduct = addProduct;
window.updateTotal = updateTotal;
window.openOrder = openOrder;
window.productBox = productBox;




// End Cart

// **************logo_xoay******************
const orbits = document.querySelectorAll('.orbit');
const totals = orbits.length;

const radius = 190;
const duration = 20;

orbits.forEach((item, index) => {
    const angle = (360 / totals) * index;

    item.style.setProperty('--angle', angle + 'deg');
    item.style.setProperty('--radius', radius + 'px');

    item.style.animation = `spinOrbit ${duration}s linear infinite`;
});

});

