require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors()); // อนุญาตให้ GitHub Pages เรียก API ได้
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "goodduck_cowboy_secret_2026";

// ==========================================
// 1. เชื่อมต่อ MongoDB Atlas
// ==========================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB Atlas (Good Duck DB)"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ==========================================
// 2. กำหนด Schema และ Model (3 Collections)
// ==========================================
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 20 },
    image: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    note: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: String,
        price: Number,
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    totalPrice: { type: Number, required: true, min: 0 },
    status: { type: String, default: "received" },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

// ==========================================
// 3. Middleware ตรวจสอบสิทธิ์ (Auth & Admin)
// ==========================================
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" });
  }
  next();
}

// ==========================================
// 4. Routes: Authentication (สมัคร / ล็อกอิน)
// ==========================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });

    const passwordHash = await bcrypt.hash(password, 10);
    // สมัครหน้าเว็บได้เฉพาะบทบาท customer เท่านั้น เพื่อความปลอดภัย
    const user = await User.create({ username, passwordHash, role: "customer" });
    res.status(201).json({ message: "สมัครสมาชิกสำเร็จ", username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 5. Routes: Products (ลูกค้าดูได้ / Admin จัดการได้)
// ==========================================
// ดึงรายการสินค้าทั้งหมด + ค้นหา (q) + กรองหมวดหมู่ (category)
app.get("/api/products", async (req, res) => {
  try {
    const { q, category } = req.query;
    const filter = {};
    if (category && category !== "ทั้งหมด") filter.category = category;
    if (q) filter.name = { $regex: q, $options: "i" };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ดูรายละเอียดสินค้าทีละชิ้น
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "ไม่พบสินค้านี้" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "รหัสสินค้าไม่ถูกต้อง" });
  }
});

// Admin: เพิ่มสินค้าใหม่
app.post("/api/products", requireAuth, requireAdmin, async (req, res) => {
  try {
    const created = await Product.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: แก้ไขข้อมูล / อัปเดตราคา / สต็อก
app.put("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "ไม่พบสินค้า" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: ลบสินค้า
app.delete("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "ไม่พบสินค้า" });
    res.json({ message: "ลบสินค้าเรียบร้อยแล้ว", id: deleted._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ==========================================
// 6. Routes: Orders (ลูกค้าสั่งซื้อ / Admin ดูออเดอร์)
// ==========================================
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, customerPhone, note, items } = req.body;
    if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "ข้อมูลคำสั่งซื้อไม่ครบถ้วน" });
    }

    // คำนวณราคารวมจากฐานข้อมูลจริง + ตัดสต็อก
    let totalPrice = 0;
    const verifiedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `ไม่พบสินค้า ${item.productId}` });
      if (product.stock < item.qty) {
        return res.status(400).json({ message: `สินค้า "${product.name}" คงเหลือไม่พอ` });
      }
      product.stock -= item.qty;
      await product.save();

      totalPrice += product.price * item.qty;
      verifiedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        qty: item.qty,
      });
    }

    const order = await Order.create({
      customerName,
      customerPhone,
      note,
      items: verifiedItems,
      totalPrice,
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/", (req, res) => res.json({ status: "Good Duck API is running!" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));