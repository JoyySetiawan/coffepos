
import * as SQLite from "expo-sqlite";

// =====================================
// 1. DATABASE COFFEEPOS
// =====================================

export const db = SQLite.openDatabaseSync("coffepos.db");

export const CATEGORIES = [
  "Coffee",
  "Non-Coffee",
  "Snack",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Product = {
  id: number;
  name: string;
  price: number;
  emoji: string | null;
  is_active: number;
  category: string;
};

// Item yang dikirim dari keranjang kasir
export type CheckoutItem = {
  product_id: number;
  qty: number;
};

// Hasil pembayaran tunai
export type CheckoutResult = {
  order_id: number;
  order_number: string;
  total: number;
  amount_received: number;
  change_amount: number;
};

// Data riwayat pesanan
export type Order = {
  id: number;
  order_number: string;
  subtotal: number;
  total: number;
  payment_method: string;
  amount_received: number;
  change_amount: number;
  status: string;
  created_at: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

// =====================================
// 2. VALIDASI PRODUK
// =====================================

function validateProduct(
  name: string,
  price: number,
  category: string
) {
  if (!name.trim()) {
    throw new Error("Nama produk wajib diisi.");
  }

  if (!Number.isSafeInteger(price) || price <= 0) {
    throw new Error("Harga harus lebih dari Rp0.");
  }

  if (!CATEGORIES.some((item) => item === category)) {
    throw new Error("Kategori tidak valid.");
  }
}

// =====================================
// 3. INISIALISASI DATABASE
// =====================================

export function initDatabase() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      emoji TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL DEFAULT 'Coffee',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrasi database lama
  const columns = db.getAllSync<{ name: string }>(
    "PRAGMA table_info(products)"
  );

  if (!columns.some((c) => c.name === "is_active")) {
    db.execSync(`
      ALTER TABLE products
      ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
    `);
  }

  if (!columns.some((c) => c.name === "category")) {
    db.withTransactionSync(() => {
      db.execSync(`
        ALTER TABLE products
        ADD COLUMN category TEXT NOT NULL DEFAULT 'Coffee';
      `);

      db.runSync(
        `UPDATE products
         SET category = 'Non-Coffee'
         WHERE name IN ('Matcha Latte', 'Chocolate')`
      );

      db.runSync(
        `UPDATE products
         SET category = 'Snack'
         WHERE name = 'Croissant'`
      );
    });
  }

  // Masukkan menu awal hanya jika tabel kosong
  const result = db.getFirstSync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM products"
  );

  if (result?.total === 0) {
    const initialProducts = [
      ["Kopi Susu Aren", 22000, "🥤", "Coffee"],
      ["Iced Americano", 18000, "☕", "Coffee"],
      ["Cafe Latte", 26000, "☕", "Coffee"],
      ["Matcha Latte", 28000, "🍵", "Non-Coffee"],
      ["Chocolate", 24000, "🍫", "Non-Coffee"],
      ["Croissant", 20000, "🥐", "Snack"],
    ] as const;

    db.withTransactionSync(() => {
      for (const [name, price, emoji, category] of initialProducts) {
        db.runSync(
          `INSERT INTO products
           (name, price, emoji, category, is_active)
           VALUES (?, ?, ?, ?, 1)`,
          [name, price, emoji, category]
        );
      }
    });
  }

  // =====================================
  // 4. TABEL TRANSAKSI
  // =====================================

  db.execSync(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
      total INTEGER NOT NULL CHECK (total >= 0),
      payment_method TEXT NOT NULL DEFAULT 'cash',
      amount_received INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      subtotal INTEGER NOT NULL CHECK (subtotal >= 0),

      FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE RESTRICT,

      FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at
      ON orders(created_at);

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);
  `);

  console.log("CoffeePOS database initialized!");
}

// =====================================
// 5. PRODUK
// =====================================

// Produk aktif untuk halaman Kasir
export function getProducts(): Product[] {
  return db.getAllSync<Product>(
    `SELECT
       id, name, price, emoji, is_active, category
     FROM products
     WHERE is_active = 1
     ORDER BY id ASC`
  );
}

// Semua produk untuk Manajemen Produk
export function getAllProducts(): Product[] {
  return db.getAllSync<Product>(
    `SELECT
       id, name, price, emoji, is_active, category
     FROM products
     ORDER BY id DESC`
  );
}

// Tambah produk
export function addProduct(
  name: string,
  price: number,
  emoji: string,
  category: string = "Coffee"
) {
  validateProduct(name, price, category);

  return db.runSync(
    `INSERT INTO products
     (name, price, emoji, category, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [name.trim(), price, emoji.trim() || "☕", category]
  );
}

// Edit produk
export function updateProduct(
  id: number,
  name: string,
  price: number,
  emoji: string,
  category?: string
) {
  const old = db.getFirstSync<{ category: string }>(
    "SELECT category FROM products WHERE id = ?",
    [id]
  );

  if (!old) {
    throw new Error("Produk tidak ditemukan.");
  }

  const selectedCategory = category ?? old.category;

  validateProduct(name, price, selectedCategory);

  const result = db.runSync(
    `UPDATE products
     SET name = ?,
         price = ?,
         emoji = ?,
         category = ?
     WHERE id = ?`,
    [
      name.trim(),
      price,
      emoji.trim() || "☕",
      selectedCategory,
      id,
    ]
  );

  return result;
}

// Aktifkan / nonaktifkan produk
export function setProductActive(
  id: number,
  active: boolean
) {
  const result = db.runSync(
    `UPDATE products
     SET is_active = ?
     WHERE id = ?`,
    [active ? 1 : 0, id]
  );

  if (result.changes === 0) {
    throw new Error("Produk tidak ditemukan.");
  }

  return result;
}

// =====================================
// 6. SIMPAN TRANSAKSI TUNAI
// =====================================

export function createCashOrder(
  items: CheckoutItem[],
  amountReceived: number
): CheckoutResult {
  // Validasi sebelum menyimpan
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Keranjang masih kosong.");
  }

  if (
    !Number.isSafeInteger(amountReceived) ||
    amountReceived < 0
  ) {
    throw new Error("Jumlah uang diterima tidak valid.");
  }

  // Menggabungkan produk dengan ID yang sama
  const quantities = new Map<number, number>();

  for (const item of items) {
    if (
      !Number.isSafeInteger(item.product_id) ||
      item.product_id <= 0 ||
      !Number.isSafeInteger(item.qty) ||
      item.qty <= 0
    ) {
      throw new Error("Item transaksi tidak valid.");
    }

    const current = quantities.get(item.product_id) ?? 0;
    const next = current + item.qty;

    if (!Number.isSafeInteger(next)) {
      throw new Error("Jumlah item terlalu besar.");
    }

    quantities.set(item.product_id, next);
  }

  let savedOrder: CheckoutResult | null = null;

  // Semua langkah penyimpanan dibuat atomik.
  // Jika gagal, transaksi database dibatalkan.
  db.withTransactionSync(() => {
    const orderLines: {
      product: Product;
      qty: number;
      subtotal: number;
    }[] = [];

    let total = 0;

    for (const [productId, qty] of quantities) {
      // Harga dan status diambil ulang dari SQLite
      const product = db.getFirstSync<Product>(
        `SELECT
           id, name, price, emoji, is_active, category
         FROM products
         WHERE id = ? AND is_active = 1`,
        [productId]
      );

      if (!product) {
        throw new Error(
          `Produk ID ${productId} tidak tersedia.`
        );
      }

      if (
        !Number.isSafeInteger(product.price) ||
        product.price <= 0
      ) {
        throw new Error("Harga produk tidak valid.");
      }

      const subtotal = product.price * qty;

      if (!Number.isSafeInteger(subtotal)) {
        throw new Error("Subtotal melebihi batas.");
      }

      total += subtotal;

      if (!Number.isSafeInteger(total)) {
        throw new Error("Total transaksi terlalu besar.");
      }

      orderLines.push({ product, qty, subtotal });
    }

    if (amountReceived < total) {
      throw new Error(
        "Uang diterima kurang dari total pembayaran."
      );
    }

    const changeAmount = amountReceived - total;

    const orderResult = db.runSync(
      `INSERT INTO orders
       (
         subtotal,
         total,
         payment_method,
         amount_received,
         change_amount,
         status
       )
       VALUES (?, ?, 'cash', ?, ?, 'paid')`,
      [total, total, amountReceived, changeAmount]
    );

    const orderId = Number(orderResult.lastInsertRowId);

    // Nomor berurutan untuk database lokal
    const orderNumber =
      "TRX-" + String(orderId).padStart(6, "0");

    db.runSync(
      "UPDATE orders SET order_number = ? WHERE id = ?",
      [orderNumber, orderId]
    );

    for (const line of orderLines) {
      db.runSync(
        `INSERT INTO order_items
         (
           order_id,
           product_id,
           product_name,
           quantity,
           unit_price,
           subtotal
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          line.product.id,
          line.product.name,
          line.qty,
          line.product.price,
          line.subtotal,
        ]
      );
    }

    savedOrder = {
      order_id: orderId,
      order_number: orderNumber,
      total,
      amount_received: amountReceived,
      change_amount: changeAmount,
    };
  });

  if (!savedOrder) {
    throw new Error("Transaksi gagal disimpan.");
  }

  return savedOrder;
}

// =====================================
// 7. RIWAYAT TRANSAKSI
// =====================================

export function getOrders(): Order[] {
  return db.getAllSync<Order>(
    `SELECT
       id,
       order_number,
       subtotal,
       total,
       payment_method,
       amount_received,
       change_amount,
       status,
       created_at
     FROM orders
     ORDER BY id DESC`
  );
}

// Detail satu transaksi
export function getOrderItems(orderId: number): OrderItem[] {
  return db.getAllSync<OrderItem>(
    `SELECT
       id,
       order_id,
       product_id,
       product_name,
       quantity,
       unit_price,
       subtotal
     FROM order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );
}

// =====================================
// 8. RINGKASAN DASHBOARD
// =====================================

export function getSalesSummary() {
  const result = db.getFirstSync<{
    total_sales: number;
    total_orders: number;
  }>(
    `SELECT
       COALESCE(SUM(total), 0) AS total_sales,
       COUNT(*) AS total_orders
     FROM orders
     WHERE status = 'paid'`
  );

  return {
    totalSales: result?.total_sales ?? 0,
    totalOrders: result?.total_orders ?? 0,
  };
}

//
// =====================================
// 9. LAPORAN PENJUALAN PER PERIODE
// =====================================
//

// Menggunakan rentang waktu UTC untuk membaca
// timestamp SQLite, tetapi periode ditentukan
// berdasarkan tanggal lokal perangkat.

export type SalesReport = {
  totalSales: number;
  totalOrders: number;
  totalItems: number;
  averageOrder: number;
};

export type TopProduct = {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  total_sales: number;
};

// Mengubah batas tanggal lokal ke format UTC SQLite
function toSQLiteUTC(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Laporan berdasarkan batas awal (inklusif)
// dan batas akhir (eksklusif)
export function getSalesReport(
  startDate: Date,
  endDate: Date
): SalesReport {
  if (
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime()) ||
    startDate >= endDate
  ) {
    throw new Error("Rentang laporan tidak valid.");
  }

  const start = toSQLiteUTC(startDate);
  const end = toSQLiteUTC(endDate);

  const result = db.getFirstSync<{
    total_sales: number;
    total_orders: number;
  }>(
    `SELECT
       COALESCE(SUM(total), 0) AS total_sales,
       COUNT(*) AS total_orders
     FROM orders
     WHERE status = 'paid'
       AND created_at >= ?
       AND created_at < ?`,
    [start, end]
  );

  const itemResult = db.getFirstSync<{
    total_items: number;
  }>(
    `SELECT
       COALESCE(SUM(oi.quantity), 0) AS total_items
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'paid'
       AND o.created_at >= ?
       AND o.created_at < ?`,
    [start, end]
  );

  const totalSales = result?.total_sales ?? 0;
  const totalOrders = result?.total_orders ?? 0;
  const totalItems = itemResult?.total_items ?? 0;

  return {
    totalSales,
    totalOrders,
    totalItems,
    averageOrder:
      totalOrders > 0
        ? Math.round(totalSales / totalOrders)
        : 0,
  };
}

// Mengambil transaksi sesuai periode
export function getOrdersByPeriod(
  startDate: Date,
  endDate: Date
): Order[] {
  return db.getAllSync<Order>(
    `SELECT
       id,
       order_number,
       subtotal,
       total,
       payment_method,
       amount_received,
       change_amount,
       status,
       created_at
     FROM orders
     WHERE status = 'paid'
       AND created_at >= ?
       AND created_at < ?
     ORDER BY id DESC`,
    [toSQLiteUTC(startDate), toSQLiteUTC(endDate)]
  );
}

// Mengambil 5 produk terlaris
export function getTopProducts(
  startDate: Date,
  endDate: Date
): TopProduct[] {
  return db.getAllSync<TopProduct>(
    `SELECT
       oi.product_id,
       oi.product_name,
       SUM(oi.quantity) AS quantity_sold,
       SUM(oi.subtotal) AS total_sales
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'paid'
       AND o.created_at >= ?
       AND o.created_at < ?
     GROUP BY oi.product_id, oi.product_name
     ORDER BY quantity_sold DESC, total_sales DESC
     LIMIT 5`,
    [toSQLiteUTC(startDate), toSQLiteUTC(endDate)]
  );
}
