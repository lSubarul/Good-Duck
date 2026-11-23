const API_BASE = "https://good-duck.onrender.com/api";

let allProducts = [];
let allCategories = [];
let cart = [];
let currentCategory = "ทั้งหมด";
let currentSearch = "";
let isRegisterMode = false;

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatCatLabel(c) {
  const icon = (c.icon || "").trim();
  return icon ? `${escapeHtml(icon)} ${escapeHtml(c.name)}` : escapeHtml(c.name);
}

function getCategoryBadgeHtml(categoryName) {
  const matched = allCategories.find((c) => c.name === categoryName);
  const icon = (matched?.icon || "").trim();
  return icon ? `${escapeHtml(icon)} ${escapeHtml(categoryName)}` : escapeHtml(categoryName);
}

function getAuth() {
  try { return JSON.parse(localStorage.getItem("goodduck_auth") || "null"); }
  catch { return null; }
}

function setAuth(data) {
  if (data) localStorage.setItem("goodduck_auth", JSON.stringify(data));
  else localStorage.removeItem("goodduck_auth");
  syncAuthUI();
}

// ย่อขนาดรูปให้เบา (~40-80KB) แล้วแปลงเป็น Base64 เพื่อเก็บลง MongoDB
function compressImageToBase64(file, maxWidth = 600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 1. ดึงและจัดการหมวดหมู่ (MongoDB categories)
// ==========================================
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) return;
    allCategories = await res.json();
    renderCategoryFilters();
    renderCategorySelect();
    renderAdminCategories();
    if (allProducts.length > 0) {
      renderProducts(allProducts);
      renderAdminTable(allProducts);
    }
  } catch (err) {
    console.error("โหลดหมวดหมู่ไม่สำเร็จ:", err);
  }
}

function renderCategoryFilters() {
  const wrap = document.getElementById("category-filters");
  if (!wrap) return;

  const buttons = [
    `<button class="btn btn-cat ${currentCategory === "ทั้งหมด" ? "active" : ""}" data-cat="ทั้งหมด">ทั้งหมด</button>`,
    ...allCategories.map(
      (c) => `<button class="btn btn-cat ${currentCategory === c.name ? "active" : ""}" data-cat="${escapeHtml(c.name)}">${formatCatLabel(c)}</button>`
    ),
  ];
  wrap.innerHTML = buttons.join("");

  wrap.querySelectorAll(".btn-cat").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.cat;
      renderCategoryFilters();
      fetchProducts();
    });
  });
}

function renderCategorySelect() {
  const select = document.getElementById("pf-category");
  if (!select) return;
  select.innerHTML = allCategories
    .map((c) => `<option value="${escapeHtml(c.name)}">${formatCatLabel(c)}</option>`)
    .join("");
}

function renderAdminCategories() {
  const wrap = document.getElementById("admin-category-list");
  if (!wrap) return;

  if (allCategories.length === 0) {
    wrap.innerHTML = `<span class="text-muted small">ยังไม่มีหมวดหมู่</span>`;
    return;
  }

  wrap.innerHTML = allCategories
    .map(
      (c) => `
      <div class="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill border bg-light">
        <span class="fw-semibold">${formatCatLabel(c)}</span>
        <button type="button" class="btn btn-sm btn-outline-warning py-0 px-2" title="เปลี่ยนชื่อหมวดหมู่" onclick="editCategory('${c._id}', '${escapeHtml(c.name)}', '${escapeHtml(c.icon || "")}')">
          <i class="bi bi-pencil-fill"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" title="ลบหมวดหมู่" onclick="deleteCategory('${c._id}', '${escapeHtml(c.name)}')">
          <i class="bi bi-trash-fill"></i>
        </button>
      </div>`
    )
    .join("");
}

document.getElementById("category-add-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const auth = getAuth();
  if (!auth?.token) return alert("กรุณาเข้าสู่ระบบ Admin ก่อน");

  const name = document.getElementById("new-cat-name").value.trim();
  const icon = document.getElementById("new-cat-icon").value.trim();
  if (!name) return;

  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ name, icon }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "เพิ่มหมวดหมู่ไม่สำเร็จ");

  document.getElementById("new-cat-name").value = "";
  document.getElementById("new-cat-icon").value = "";
  await fetchCategories();
});

window.editCategory = async function (id, oldName, oldIcon) {
  const newName = prompt("ตั้งชื่อหมวดหมู่ใหม่:", oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const auth = getAuth();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth?.token}`,
    },
    body: JSON.stringify({ name: newName.trim(), icon: oldIcon }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "แก้ไขหมวดหมู่ไม่สำเร็จ");

  if (currentCategory === oldName) currentCategory = newName.trim();
  await fetchCategories();
  await fetchProducts();
};

window.deleteCategory = async function (id, name) {
  if (!confirm(`ยืนยันการลบหมวดหมู่ "${name}"?`)) return;
  const auth = getAuth();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth?.token}` },
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "ลบหมวดหมู่ไม่สำเร็จ");

  if (currentCategory === name) currentCategory = "ทั้งหมด";
  await fetchCategories();
  await fetchProducts();
};

// ==========================================
// 2. ดึงข้อมูลสินค้าจาก MongoDB ผ่าน API
// ==========================================
async function fetchProducts() {
  const params = new URLSearchParams();
  if (currentCategory !== "ทั้งหมด") params.set("category", currentCategory);
  if (currentSearch.trim()) params.set("q", currentSearch.trim());

  const grid = document.getElementById("product-grid");
  try {
    const res = await fetch(`${API_BASE}/products?${params.toString()}`);
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    allProducts = await res.json();
    renderProducts(allProducts);
    renderAdminTable(allProducts);
  } catch (err) {
    grid.innerHTML = `<div class="col-12 text-center py-5 text-danger">เชื่อมต่อฐานข้อมูลไม่ได้: ${escapeHtml(err.message)}</div>`;
  }
}

function renderProducts(list) {
  const grid = document.getElementById("product-grid");
  document.getElementById("product-count").textContent = list.length;

  const headingTitle = document.getElementById("menu-heading-title");
  if (headingTitle) {
    headingTitle.innerHTML =
      currentCategory === "ทั้งหมด"
        ? "เมนูทั้งหมด"
        : getCategoryBadgeHtml(currentCategory);
  }
  
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5 text-muted d-flex flex-column align-items-center gap-2">
        <img src="IMG/Good Duck.png" alt="Good Duck" height="56">
        <span>ไม่พบเมนูที่ค้นหา</span>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((p) => `
    <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div class="product-card h-100 d-flex flex-column">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onclick="openDetail('${p._id}')">
        <div class="p-3 d-flex flex-column flex-grow-1">
          <span class="badge badge-cactus align-self-start mb-2">${getCategoryBadgeHtml(p.category)}</span>
          <h6 class="fw-bold mb-1">${escapeHtml(p.name)}</h6>
          <p class="small text-muted flex-grow-1 mb-3">${escapeHtml(p.description || "")}</p>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold fs-5 text-cowboy">฿${p.price}</span>
            <small class="text-muted">คงเหลือ ${p.stock}</small>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-duck-outline btn-sm flex-fill" onclick="openDetail('${p._id}')">รายละเอียด</button>
            <button class="btn btn-cowboy btn-sm flex-fill" ${p.stock <= 0 ? "disabled" : ""} onclick="addToCart('${p._id}')">
              ${p.stock <= 0 ? "หมด" : "+ ใส่ตะกร้า"}
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

// ==========================================
// 3. ดูรายละเอียดสินค้าทีละชิ้น (ดึงจาก API /:id)
// ==========================================
window.openDetail = async function (id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  if (!res.ok) return alert("ไม่พบรายละเอียดสินค้า");
  const p = await res.json();

  document.getElementById("detail-name").textContent = p.name;
  document.getElementById("detail-img").src = p.image;
  document.getElementById("detail-cat").innerHTML = getCategoryBadgeHtml(p.category);
  document.getElementById("detail-desc").textContent = p.description || "เมนูพิเศษจาก Good Duck";
  document.getElementById("detail-price").textContent = `฿${p.price}`;
  document.getElementById("detail-stock").textContent = `คงเหลือในสต็อก ${p.stock} ชิ้น`;

  const btn = document.getElementById("detail-add-cart-btn");
  btn.disabled = p.stock <= 0;
  btn.onclick = () => {
    addToCart(p._id);
    bootstrap.Modal.getInstance(document.getElementById("detailModal")).hide();
  };

  new bootstrap.Modal(document.getElementById("detailModal")).show();
};

// ==========================================
// 4. ตะกร้าสินค้า & สั่งซื้อ (ต้องล็อกอินก่อนสั่งซื้อ)
// ==========================================
function showCartToast(message) {
  let container = document.getElementById("cart-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cart-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "cart-toast";
  toast.innerHTML = `<i class="bi bi-basket2-fill text-warning"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

window.addToCart = function (productId) {
  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;

  const existing = cart.find((c) => c.productId === productId);
  if (existing) {
    if (existing.qty >= product.stock) {
      showCartToast(`"${product.name}" ครบจำนวนสต็อกที่มีแล้ว`);
      return;
    }
    existing.qty++;
  } else {
    cart.push({ productId, name: product.name, price: product.price, qty: 1 });
  }

  renderCart();
  showCartToast(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);

  // ทำเอฟเฟกต์ปุ่มตะกร้าเด้ง
  const cartBtn = document.getElementById("cart-badge")?.closest("button");
  if (cartBtn) {
    cartBtn.classList.remove("cart-bounce");
    void cartBtn.offsetWidth; // รีเซ็ต animation ให้เล่นซ้ำได้ทันที
    cartBtn.classList.add("cart-bounce");
  }
};

window.changeQty = function (productId, delta) {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.productId !== productId);
  renderCart();
};

function renderCart() {
  const wrap = document.getElementById("cart-items");
  const badge = document.getElementById("cart-badge");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-submit-btn");

  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  badge.textContent = count;
  totalEl.textContent = `฿${total}`;

  // ล็อกปุ่มสั่งซื้อเมื่อไม่มีสินค้าในตะกร้า
  if (checkoutBtn) {
    checkoutBtn.disabled = cart.length === 0;
  }

  if (cart.length === 0) {
    wrap.innerHTML = `<p class="text-center text-muted mt-4">ยังไม่มีสินค้าในตะกร้า</p>`;
    return;
  }

  wrap.innerHTML = cart.map((i) => `
    <div class="d-flex justify-content-between align-items-center border-bottom py-2">
      <div>
        <div class="fw-semibold">${escapeHtml(i.name)}</div>
        <small class="text-muted">฿${i.price} x ${i.qty}</small>
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" onclick="changeQty('${i.productId}', -1)">-</button>
        <button class="btn btn-outline-secondary" onclick="changeQty('${i.productId}', 1)">+</button>
      </div>
    </div>
  `).join("");
}

// กรองช่องเบอร์โทรให้พิมพ์ได้เฉพาะตัวเลข 0-9 สูงสุด 10 ตัว
const phoneInput = document.getElementById("order-phone");
if (phoneInput) {
  // บล็อกไม่ให้กดพิมพ์ปุ่มอื่นที่ไม่ใช่ตัวเลข 0-9 (ยกเว้นปุ่มลบ/ลูกศร/Ctrl+V)
  phoneInput.addEventListener("keydown", (e) => {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });

  // กันกรณีพิมพ์ภาษาไทยหรือก๊อปวางตัวอักษร ให้ลบออกและตัดไม่เกิน 10 ตัวทันที
  phoneInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });
}

document.getElementById("checkout-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) return alert("กรุณาเลือกสินค้าก่อนสั่งซื้อ");

  const auth = getAuth();
  if (!auth?.token) {
    const cartEl = document.getElementById("cartOffcanvas");
    bootstrap.Offcanvas.getInstance(cartEl)?.hide();
    new bootstrap.Modal(document.getElementById("loginRequiredModal")).show();
    return;
  }

  const phone = document.getElementById("order-phone").value.trim();
  if (!/^\d{10}$/.test(phone)) {
    return alert("กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขให้ครบ 10 หลัก");
  }

  const payload = {
    customerName: auth.username,
    customerPhone: phone,
    note: document.getElementById("order-note").value.trim(),
    items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "สั่งซื้อไม่สำเร็จ");

    alert(`สั่งซื้อสำเร็จ! รหัสออเดอร์: ${data._id} (ยอดรวม ฿${data.totalPrice})`);
    cart = [];
    renderCart();
    e.target.reset();
    fetchProducts();
  } catch {
    alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
  }
});

  const payload = {
    customerName: auth.username,
    customerPhone: document.getElementById("order-phone").value.trim(),
    note: document.getElementById("order-note").value.trim(),
    items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "สั่งซื้อไม่สำเร็จ");

    alert(`สั่งซื้อสำเร็จ! รหัสออเดอร์: ${data._id} (ยอดรวม ฿${data.totalPrice})`);
    cart = [];
    renderCart();
    e.target.reset();
    fetchProducts();
  } catch {
    alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
  }

document.getElementById("btn-go-login")?.addEventListener("click", () => {
  bootstrap.Modal.getInstance(document.getElementById("loginRequiredModal"))?.hide();
  setAuthMode(false);
  new bootstrap.Modal(document.getElementById("authModal")).show();
});

// ==========================================
// 5. ระบบ Login / Register + ปุ่มเปิดดูรหัสผ่าน
// ==========================================
document.querySelectorAll(".toggle-pw-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector("i");
    if (!input) return;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    icon.className = isHidden ? "bi bi-eye-slash" : "bi bi-eye";
  });
});

function showAuthError(msg) {
  const box = document.getElementById("auth-error-box");
  if (!box) return alert(msg);
  if (!msg) {
    box.classList.add("d-none");
    box.textContent = "";
  } else {
    box.textContent = msg;
    box.classList.remove("d-none");
  }
}

function setAuthMode(register) {
  isRegisterMode = register;
  showAuthError("");
  const title = document.getElementById("auth-modal-title");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const confirmWrap = document.getElementById("confirm-password-wrap");
  const confirmInput = document.getElementById("login-confirm-password");
  const submitBtn = document.getElementById("auth-submit-btn");
  const demoBox = document.getElementById("demo-account-box");
  const regInfoBox = document.getElementById("register-info-box");

  if (register) {
    title.innerHTML = `<i class="bi bi-person-plus-fill text-success me-2"></i>สมัครสมาชิกใหม่ Good Duck`;
    tabLogin.className = "btn btn-sm flex-fill fw-semibold text-muted";
    tabRegister.className = "btn btn-success btn-sm flex-fill fw-semibold";
    confirmWrap.classList.remove("d-none");
    confirmInput.required = true;
    submitBtn.className = "btn btn-success fw-semibold py-2";
    submitBtn.innerHTML = `<i class="bi bi-person-plus-fill me-1"></i>ยืนยันการสมัครสมาชิก`;
    demoBox.classList.add("d-none");
    regInfoBox.classList.remove("d-none");
  } else {
    title.innerHTML = `<i class="bi bi-box-arrow-in-right text-cowboy me-2"></i>เข้าสู่ระบบ Good Duck`;
    tabLogin.className = "btn btn-cowboy btn-sm flex-fill fw-semibold";
    tabRegister.className = "btn btn-sm flex-fill fw-semibold text-muted";
    confirmWrap.classList.add("d-none");
    confirmInput.required = false;
    confirmInput.value = "";
    submitBtn.className = "btn btn-cowboy fw-semibold py-2";
    submitBtn.innerHTML = `<i class="bi bi-box-arrow-in-right me-1"></i>เข้าสู่ระบบ`;
    demoBox.classList.remove("d-none");
    regInfoBox.classList.add("d-none");
  }
}

document.getElementById("tab-login")?.addEventListener("click", () => setAuthMode(false));
document.getElementById("tab-register")?.addEventListener("click", () => setAuthMode(true));

function syncAuthUI() {
  const auth = getAuth();
  const authWrap = document.getElementById("auth-btn-wrap");
  const adminNav = document.getElementById("admin-nav-item");
  const adminPanel = document.getElementById("admin-panel");
  const userInfo = document.getElementById("checkout-user-info");

  if (!auth) {
    authWrap.innerHTML = `<button class="btn btn-cowboy" data-bs-toggle="modal" data-bs-target="#authModal"><i class="bi bi-person-circle me-1"></i>เข้าสู่ระบบ</button>`;
    adminNav.classList.add("d-none");
    adminPanel.classList.add("d-none");
    if (userInfo) userInfo.innerHTML = `<i class="bi bi-info-circle me-1"></i>กรุณาเข้าสู่ระบบก่อนกดสั่งซื้อ`;
    return;
  }

  authWrap.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <span class="badge ${auth.role === "admin" ? "bg-danger" : "bg-success"}">${escapeHtml(auth.username)} (${auth.role})</span>
      <button class="btn btn-outline-secondary btn-sm" onclick="setAuth(null)">ออกจากระบบ</button>
    </div>`;

  if (userInfo) userInfo.innerHTML = `<i class="bi bi-person-check-fill text-success me-1"></i>สั่งซื้อในชื่อ: <strong>${escapeHtml(auth.username)}</strong>`;

  const isAdmin = auth.role === "admin";
  adminNav.classList.toggle("d-none", !isAdmin);
  adminPanel.classList.toggle("d-none", !isAdmin);
}

document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAuthError("");

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const submitBtn = document.getElementById("auth-submit-btn");

  if (isRegisterMode) {
    const confirmPassword = document.getElementById("login-confirm-password").value;
    if (password !== confirmPassword) {
      return showAuthError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
    }
  }

  const oldHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>กำลังเชื่อมต่อ...`;

  try {
    const endpoint = isRegisterMode ? "/auth/register" : "/auth/login";
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    if (isRegisterMode) {
      alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบด้วยบัญชีที่คุณเพิ่งสร้าง");
      e.target.reset();
      setAuthMode(false);
    } else {
      setAuth(data);
      bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
      e.target.reset();
    }
  } catch {
    showAuthError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (รอ Render ตื่นสักครู่แล้วกดลองใหม่)");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = oldHtml;
  }
});

// ==========================================
// 6. ระบบ Admin จัดการสินค้า + อัปโหลดรูปภาพ
// ==========================================
document.getElementById("pf-image-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const base64 = await compressImageToBase64(file);
    document.getElementById("pf-image").value = base64;
    const preview = document.getElementById("pf-preview");
    preview.src = base64;
    preview.classList.remove("d-none");
  } catch {
    alert("ไม่สามารถอ่านไฟล์รูปภาพได้");
  }
});

document.getElementById("pf-image")?.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  const preview = document.getElementById("pf-preview");
  if (val) {
    preview.src = val;
    preview.classList.remove("d-none");
  } else {
    preview.classList.add("d-none");
  }
});

function renderAdminTable(list) {
  const tbody = document.getElementById("admin-product-tbody");
  if (!tbody) return;
  tbody.innerHTML = list.map((p) => `
    <tr>
      <td><img src="${escapeHtml(p.image)}" width="48" height="48" class="rounded object-fit-cover"></td>
      <td class="fw-semibold">${escapeHtml(p.name)}</td>
      <td>${getCategoryBadgeHtml(p.category)}</td>
      <td>฿${p.price}</td>
      <td>${p.stock}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-warning me-1" onclick="openEditProduct('${p._id}')"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p._id}')"><i class="bi bi-trash-fill"></i></button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("btn-open-add-product")?.addEventListener("click", () => {
  document.getElementById("product-crud-form").reset();
  document.getElementById("pf-id").value = "";
  document.getElementById("pf-preview").classList.add("d-none");
  document.getElementById("product-form-title").textContent = "เพิ่มสินค้าใหม่";
  new bootstrap.Modal(document.getElementById("productFormModal")).show();
});

window.openEditProduct = function (id) {
  const p = allProducts.find((item) => item._id === id);
  if (!p) return;
  document.getElementById("pf-id").value = p._id;
  document.getElementById("pf-name").value = p.name;
  document.getElementById("pf-category").value = p.category;
  document.getElementById("pf-price").value = p.price;
  document.getElementById("pf-stock").value = p.stock;
  document.getElementById("pf-image").value = p.image;
  document.getElementById("pf-desc").value = p.description || "";
  document.getElementById("pf-image-file").value = "";

  const preview = document.getElementById("pf-preview");
  if (p.image) {
    preview.src = p.image;
    preview.classList.remove("d-none");
  } else {
    preview.classList.add("d-none");
  }

  document.getElementById("product-form-title").textContent = "แก้ไขข้อมูลสินค้า";
  new bootstrap.Modal(document.getElementById("productFormModal")).show();
};

document.getElementById("product-crud-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const auth = getAuth();
  if (!auth?.token) return alert("กรุณาเข้าสู่ระบบ Admin ก่อน");

  const id = document.getElementById("pf-id").value;
  const body = {
    name: document.getElementById("pf-name").value.trim(),
    category: document.getElementById("pf-category").value,
    price: Number(document.getElementById("pf-price").value),
    stock: Number(document.getElementById("pf-stock").value),
    image: document.getElementById("pf-image").value.trim(),
    description: document.getElementById("pf-desc").value.trim(),
  };

  const res = await fetch(id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`, {
    method: id ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "บันทึกไม่สำเร็จ");

  bootstrap.Modal.getInstance(document.getElementById("productFormModal")).hide();
  fetchProducts();
});

window.deleteProduct = async function (id) {
  if (!confirm("ยืนยันการลบสินค้านี้ออกจาก MongoDB?")) return;
  const auth = getAuth();
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth?.token}` },
  });
  if (!res.ok) return alert("ลบไม่สำเร็จ");
  fetchProducts();
};

// ==========================================
// 7. ค้นหาสินค้า
// ==========================================
let searchTimer;
document.getElementById("search-input")?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = e.target.value;
    fetchProducts();
  }, 250);
});

// เริ่มต้นทำงาน
syncAuthUI();
renderCart();
fetchCategories();
fetchProducts();