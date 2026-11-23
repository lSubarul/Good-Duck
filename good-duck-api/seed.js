require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const productSchema = new mongoose.Schema(
  { name: String, category: String, price: Number, stock: Number, image: String, description: String },
  { timestamps: true }
);
const userSchema = new mongoose.Schema(
  { username: String, passwordHash: String, role: String },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);

const IMG = {
  ice: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",
  scoop: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80",
  sundae: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
  tea: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
  bakery: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80",
};

const sampleProducts = [
  // หมวด 1: ไอศกรีมโฮมเมด (8 รายการ)
  { name: "Cowboy Vanilla Bean", category: "ไอศกรีมโฮมเมด", price: 69, stock: 30, image: IMG.scoop, description: "ไอศกรีมวานิลลาฝักแท้ หอมละมุนสไตล์คาวบอยฟาร์ม" },
  { name: "Good Duck Mango Sorbet", category: "ไอศกรีมโฮมเมด", price: 75, stock: 25, image: IMG.ice, description: "ซอร์เบต์มะม่วงน้ำดอกไม้สีเหลืองสดชื่น เปรี้ยวอมหวาน" },
  { name: "Salted Caramel Rodeo", category: "ไอศกรีมโฮมเมด", price: 79, stock: 20, image: IMG.scoop, description: "คาราเมลเค็มเคี่ยวเอง ผสมครันช์บิสกิตกรุบกรอบ" },
  { name: "Dark Choco Sheriff", category: "ไอศกรีมโฮมเมด", price: 85, stock: 22, image: IMG.ice, description: "ดาร์กช็อกโกแลต 70% เข้มข้นถึงใจ" },
  { name: "Cactus Matcha Gelato", category: "ไอศกรีมโฮมเมด", price: 89, stock: 18, image: IMG.scoop, description: "เจลาโต้มัทฉะอูจิสีเขียวกระบองเพชร หอมชาแท้" },
  { name: "Strawberry Ranch Cream", category: "ไอศกรีมโฮมเมด", price: 75, stock: 24, image: IMG.ice, description: "สตรอว์เบอร์รีสดปั่นรวมกับนมฮอกไกโด" },
  { name: "Cookie & Duck Crumble", category: "ไอศกรีมโฮมเมด", price: 79, stock: 28, image: IMG.scoop, description: "นมสดวานิลลาคลุกคุกกี้ช็อกโกแลตชิ้นโต" },
  { name: "Honeycomb Sunset", category: "ไอศกรีมโฮมเมด", price: 85, stock: 15, image: IMG.ice, description: "ไอศกรีมน้ำผึ้งป่าโรยรังผึ้งกรอบหวานหอม" },

  // หมวด 2: ซันเดย์ & พาร์เฟต์ (6 รายการ)
  { name: "Good Duck Signature Sundae", category: "ซันเดย์ & พาร์เฟต์", price: 139, stock: 15, image: IMG.sundae, description: "ไอศกรีม 2 ลูก วิปครีม ซอสคาราเมล และคุกกี้รูปหมวกคาวบอย" },
  { name: "Desert Oasis Parfait", category: "ซันเดย์ & พาร์เฟต์", price: 149, stock: 14, image: IMG.sundae, description: "พาร์เฟต์มัทฉะเจลลี่ ถั่วแดงกวน และไอศกรีมนมสด" },
  { name: "Choco Lava Cowboy Bowl", category: "ซันเดย์ & พาร์เฟต์", price: 155, stock: 12, image: IMG.sundae, description: "บราวนี่อุ่นๆ ราดช็อกโกแลตร้อน เสิร์ฟคู่ไอศกรีมวานิลลา" },
  { name: "Golden Duck Banana Split", category: "ซันเดย์ & พาร์เฟต์", price: 159, stock: 16, image: IMG.sundae, description: "กล้วยหอมเบิร์นน้ำตาลกับไอศกรีม 3 รสชาติ" },
  { name: "Berry Sheriff Tower", category: "ซันเดย์ & พาร์เฟต์", price: 145, stock: 18, image: IMG.sundae, description: "ซอสเบอร์รีรวมรสเปรี้ยวสดชื่น ตัดกับครีมสดนุ่มๆ" },
  { name: "Affogato Cowboy Shot", category: "ซันเดย์ & พาร์เฟต์", price: 129, stock: 20, image: IMG.coffee, description: "ไอศกรีมวานิลลาราดช็อตเอสเปรสโซ่คั่วกลางหอมกรุ่น" },

  // หมวด 3: กาแฟ & เอสเปรสโซ (6 รายการ)
  { name: "Saloon Iced Americano", category: "กาแฟ & เอสเปรสโซ", price: 75, stock: 40, image: IMG.coffee, description: "อเมริกาโน่เย็นเมล็ดคั่วกลาง-เข้ม โทนถั่วและคาราเมล" },
  { name: "Cowboy Dirty Coffee", category: "กาแฟ & เอสเปรสโซ", price: 105, stock: 25, image: IMG.coffee, description: "นมเย็นจัดท็อปด้วยช็อตริสเทรตโต้เข้มข้น" },
  { name: "Good Duck Caramel Macchiato", category: "กาแฟ & เอสเปรสโซ", price: 95, stock: 30, image: IMG.coffee, description: "ลาเต้นมสดราดซอสคาราเมลโฮมเมด" },
  { name: "Wild West Iced Latte", category: "กาแฟ & เอสเปรสโซ", price: 85, stock: 35, image: IMG.coffee, description: "ลาเต้เย็นนุ่มละมุน ดื่มง่ายได้ทุกวัน" },
  { name: "Orange Canyon Espresso", category: "กาแฟ & เอสเปรสโซ", price: 99, stock: 22, image: IMG.coffee, description: "น้ำส้มคั้นสดผสมช็อตเอสเปรสโซ่ สดชื่นตื่นเต็มตา" },
  { name: "Mocha Saddle Cream", category: "กาแฟ & เอสเปรสโซ", price: 95, stock: 28, image: IMG.coffee, description: "กาแฟผสมโกโก้เข้มข้น ท็อปวิปครีมนุ่ม" },

  // หมวด 4: ชา & เครื่องดื่มเย็น (5 รายการ)
  { name: "Oasis Blue Lemon Soda", category: "ชา & เครื่องดื่มเย็น", price: 79, stock: 35, image: IMG.tea, description: "โซดามะนาวสีฟ้าคลื่นน้ำ ซาบซ่าดับร้อน" },
  { name: "Cactus Uji Matcha Latte", category: "ชา & เครื่องดื่มเย็น", price: 95, stock: 30, image: IMG.tea, description: "มัทฉะแท้ตีมือกับนมสด หวานน้อยกำลังดี" },
  { name: "Thai Tea Cowboy Float", category: "ชา & เครื่องดื่มเย็น", price: 109, stock: 25, image: IMG.tea, description: "ชาไทยเข้มข้นท็อปด้วยไอศกรีมวานิลลา 1 ลูก" },
  { name: "Peach Western Iced Tea", category: "ชา & เครื่องดื่มเย็น", price: 85, stock: 28, image: IMG.tea, description: "ชาดำหอมกลิ่นพีช ใส่เนื้อพีชเคี้ยวเพลิน" },
  { name: "Yellow Duck Yuzu Fizz", category: "ชา & เครื่องดื่มเย็น", price: 95, stock: 26, image: IMG.tea, description: "ยูซุแท้ผสมโซดา หอมสดชื่นสีเหลืองเป็ด" },

  // หมวด 5: เบเกอรี่ & วาฟเฟิล (5 รายการ)
  { name: "Duck Waffle & Ice Cream", category: "เบเกอรี่ & วาฟเฟิล", price: 149, stock: 15, image: IMG.bakery, description: "วาฟเฟิลอบกรอบนอกนุ่มใน เสิร์ฟคู่ไอศกรีมเลือกได้ 1 รส" },
  { name: "Honey Butter Cowboy Toast", category: "เบเกอรี่ & วาฟเฟิล", price: 159, stock: 12, image: IMG.bakery, description: "โทสต์ชุ่มเนยอบกรอบ ราดน้ำผึ้งและไอศกรีมวานิลลา" },
  { name: "Croffle Caramel Crunch", category: "เบเกอรี่ & วาฟเฟิล", price: 89, stock: 20, image: IMG.bakery, description: "ครอฟเฟิลเนยฝรั่งเศสเคลือบน้ำตาลคาราเมลกรอบ" },
  { name: "Cowboy Hat Choco Cookie", category: "เบเกอรี่ & วาฟเฟิล", price: 59, stock: 30, image: IMG.bakery, description: "ซอฟต์คุกกี้ช็อกโกแลตชิพเยิ้มๆ อบใหม่ทุกเช้า" },
  { name: "Lemon Duck Tart", category: "เบเกอรี่ & วาฟเฟิล", price: 95, stock: 16, image: IMG.bakery, description: "ทาร์ตเลมอนรสเปรี้ยวอมหวาน ท็อปเมอแรงก์เบิร์นไฟ" },
];

async function runSeed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Product.deleteMany({});
  await Product.insertMany(sampleProducts);

  // สร้างบัญชี Admin และ Customer ทดสอบ (ข้อมูลสมมติ)
  await User.deleteMany({ username: { $in: ["admin", "duckfan"] } });
  await User.insertMany([
    { username: "admin", passwordHash: await bcrypt.hash("admin1234", 10), role: "admin" },
    { username: "duckfan", passwordHash: await bcrypt.hash("duck1234", 10), role: "customer" },
  ]);

  console.log(`Seeded ${sampleProducts.length} products and 2 test accounts!`);
  process.exit(0);
}

runSeed().catch((err) => {
  console.error(err);
  process.exit(1);
});