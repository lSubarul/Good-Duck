// เปลี่ยน URL นี้เป็นลิงก์ Backend บน Render ของคุณเมื่อ Deploy แล้ว
const API_BASE = "https://good-duck.onrender.com/api";

let allProducts = [];
let cart = [];
let currentCategory = "ทั้งหมด";
let currentSearch = "";
let isRegisterMode = false;

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

// ==========================================
// 1. ดึงข้อมูลสินค้าจาก MongoDB ผ่าน API
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

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">ไม่พบเมนูที่ค้นหา 🦆</div>`;
    return;
  }

  grid.innerHTML = list.map((p) => `
    <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div class="product-card h-100 d-flex flex-column">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onclick="openDetail('${p._id}')">
        <div class="p-3 d-flex flex-column flex-grow-1">
          <span class="badge badge-cactus align-self-start mb-2">${escapeHtml(p.category)}</span>
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
// 2. ดูรายละเอียดสินค้าทีละชิ้น (ดึงจาก API /:id)
// ==========================================
window.openDetail = async function (id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  if (!res.ok) return alert("ไม่พบรายละเอียดสินค้า");
  const p = await res.json();

  document.getElementById("detail-name").textContent = p.name;
  document.getElementById("detail-img").src = p.image;
  document.getElementById("detail-cat").textContent = p.category;
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
// 3. ตะกร้าสินค้า & สั่งซื้อ (บันทึกลง MongoDB orders)
// ==========================================
window.addToCart = function (productId) {
  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;
  const existing = cart.find((c) => c.productId === productId);
  if (existing) {
    if (existing.qty < product.stock) existing.qty++;
  } else {
    cart.push({ productId, name: product.name, price: product.price, qty: 1 });
  }
  renderCart();
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

  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  badge.textContent = count;
  totalEl.textContent = `฿${total}`;

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

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) return alert("กรุณาเลือกสินค้าก่อนสั่งซื้อ");

  const payload = {
    customerName: document.getElementById("order-name").value.trim(),
    customerPhone: document.getElementById("order-phone").value.trim(),
    note: document.getElementById("order-note").value.trim(),
    items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
  };

  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "สั่งซื้อไม่สำเร็จ");

  alert(`สั่งซื้อสำเร็จ! รหัสออเดอร์: ${data._id} (ยอดรวม ฿${data.totalPrice})`);
  cart = [];
  renderCart();
  e.target.reset();
  fetchProducts(); // รีเฟรชสต็อกล่าสุดจาก MongoDB
});

// ==========================================
// 4. ระบบ Login / Register & แยกสิทธิ์ Admin
// ==========================================
function syncAuthUI() {
  const auth = getAuth();
  const authWrap = document.getElementById("auth-btn-wrap");
  const adminNav = document.getElementById("admin-nav-item");
  const adminPanel = document.getElementById("admin-panel");

  if (!auth) {
    authWrap.innerHTML = `<button class="btn btn-cowboy" data-bs-toggle="modal" data-bs-target="#authModal"><i class="bi bi-person-circle me-1"></i>เข้าสู่ระบบ</button>`;
    adminNav.classList.add("d-none");
    adminPanel.classList.add("d-none");
    return;
  }

  authWrap.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <span class="badge ${auth.role === "admin" ? "bg-danger" : "bg-success"}">${escapeHtml(auth.username)} (${auth.role})</span>
      <button class="btn btn-outline-secondary btn-sm" onclick="setAuth(null)">ออกจากระบบ</button>
    </div>`;

  const isAdmin = auth.role === "admin";
  adminNav.classList.toggle("d-none", !isAdmin);
  adminPanel.classList.toggle("d-none", !isAdmin);
}

document.getElementById("btn-register-mode").addEventListener("click", (e) => {
  isRegisterMode = !isRegisterMode;
  e.target.textContent = isRegisterMode ? "มีบัญชีอยู่แล้ว? กลับไปเข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก (Customer)";
  document.querySelector("#login-form button[type=submit]").textContent = isRegisterMode ? "สมัครสมาชิก" : "เข้าสู่ระบบ";
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  const endpoint = isRegisterMode ? "/auth/register" : "/auth/login";
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.message || "ดำเนินการไม่สำเร็จ");

  if (isRegisterMode) {
    alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
    isRegisterMode = false;
    document.getElementById("btn-register-mode").click();
  } else {
    setAuth(data);
    bootstrap.Modal.getInstance(document.getElementById("authModal")).hide();
    e.target.reset();
  }
});

// ==========================================
// 5. ระบบ Admin จัดการสินค้า (Add / Edit / Delete)
// ==========================================
function renderAdminTable(list) {
  const tbody = document.getElementById("admin-product-tbody");
  if (!tbody) return;
  tbody.innerHTML = list.map((p) => `
    <tr>
      <td><img src="${escapeHtml(p.image)}" width="48" height="48" class="rounded object-fit-cover"></td>
      <td class="fw-semibold">${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>฿${p.price}</td>
      <td>${p.stock}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-warning me-1" onclick="openEditProduct('${p._id}')"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p._id}')"><i class="bi bi-trash-fill"></i></button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("btn-open-add-product").addEventListener("click", () => {
  document.getElementById("product-crud-form").reset();
  document.getElementById("pf-id").value = "";
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
  document.getElementById("product-form-title").textContent = "แก้ไขข้อมูลสินค้า";
  new bootstrap.Modal(document.getElementById("productFormModal")).show();
};

document.getElementById("product-crud-form").addEventListener("submit", async (e) => {
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
// 6. ตัวกรองหมวดหมู่ & ค้นหา
// ==========================================
document.querySelectorAll("#category-filters .btn-cat").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#category-filters .btn-cat").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.cat;
    fetchProducts();
  });
});

let searchTimer;
document.getElementById("search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = e.target.value;
    fetchProducts();
  }, 250);
});

// เริ่มต้นทำงาน
syncAuthUI();
renderCart();
fetchProducts();
