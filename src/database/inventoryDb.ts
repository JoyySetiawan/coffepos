
import { db, initDatabase } from "./db";

// ======================================
// TIPE DATA INVENTORY
// ======================================

export const UNITS = ["gram", "ml", "pcs"] as const;
export type IngredientUnit = (typeof UNITS)[number];

export type Ingredient = {
  id: number;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_active: number;
};

export type RecipeItem = {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
};

export type StockMovement = {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  movement_type: string;
  quantity: number;
  note: string;
  created_at: string;
};

// ======================================
// MEMBUAT TABEL INVENTORY
// ======================================

export function initInventoryDatabase() {
  // Pastikan database utama sudah siap
  initDatabase();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
        CHECK (stock >= 0),
      min_stock INTEGER NOT NULL DEFAULT 0
        CHECK (min_stock >= 0),
      cost_per_unit INTEGER NOT NULL DEFAULT 0
        CHECK (cost_per_unit >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL
        CHECK (quantity > 0),

      UNIQUE (product_id, ingredient_id),

      FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

      FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL
        CHECK (movement_type IN ('in', 'out')),
      quantity INTEGER NOT NULL
        CHECK (quantity > 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id)
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_product
      ON recipes(product_id);

    CREATE INDEX IF NOT EXISTS idx_movements_ingredient
      ON stock_movements(ingredient_id);
  `);
}

// ======================================
// MENAMBAHKAN BAHAN BAKU
// ======================================

export function addIngredient(
  name: string,
  unit: IngredientUnit,
  minStock: number,
  costPerUnit: number
) {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Nama bahan wajib diisi.");
  }

  if (!UNITS.includes(unit)) {
    throw new Error("Satuan bahan tidak valid.");
  }

  if (
    !Number.isSafeInteger(minStock) ||
    minStock < 0
  ) {
    throw new Error("Stok minimum tidak valid.");
  }

  if (
    !Number.isSafeInteger(costPerUnit) ||
    costPerUnit < 0
  ) {
    throw new Error("Harga per satuan tidak valid.");
  }

  const existing = db.getFirstSync<{ id: number }>(
    `SELECT id FROM ingredients
     WHERE LOWER(name) = LOWER(?)`,
    [cleanName]
  );

  if (existing) {
    throw new Error("Nama bahan sudah tersedia.");
  }

  return db.runSync(
    `INSERT INTO ingredients
     (name, unit, stock, min_stock, cost_per_unit)
     VALUES (?, ?, 0, ?, ?)`,
    [cleanName, unit, minStock, costPerUnit]
  );
}

// ======================================
// MENGAMBIL DATA BAHAN BAKU
// ======================================

export function getIngredients(): Ingredient[] {
  return db.getAllSync<Ingredient>(
    `SELECT
       id, name, unit, stock, min_stock,
       cost_per_unit, is_active
     FROM ingredients
     WHERE is_active = 1
     ORDER BY name ASC`
  );
}

// ======================================
// STOK MASUK DAN KELUAR
// ======================================

export function adjustIngredientStock(
  ingredientId: number,
  movementType: "in" | "out",
  quantity: number,
  note: string
) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Jumlah perubahan stok harus lebih dari 0."
    );
  }

  if (
    !Number.isSafeInteger(ingredientId) ||
    ingredientId <= 0
  ) {
    throw new Error("ID bahan tidak valid.");
  }

  db.withTransactionSync(() => {
    const ingredient = db.getFirstSync<Ingredient>(
      `SELECT * FROM ingredients
       WHERE id = ? AND is_active = 1`,
      [ingredientId]
    );

    if (!ingredient) {
      throw new Error("Bahan baku tidak ditemukan.");
    }

    const newStock =
      movementType === "in"
        ? ingredient.stock + quantity
        : ingredient.stock - quantity;

    if (
      !Number.isSafeInteger(newStock) ||
      newStock < 0
    ) {
      throw new Error(
        "Stok tidak mencukupi atau jumlah terlalu besar."
      );
    }

    db.runSync(
      `UPDATE ingredients
       SET stock = ?
       WHERE id = ?`,
      [newStock, ingredientId]
    );

    db.runSync(
      `INSERT INTO stock_movements
       (ingredient_id, movement_type, quantity, note)
       VALUES (?, ?, ?, ?)`,
      [
        ingredientId,
        movementType,
        quantity,
        note.trim(),
      ]
    );
  });
}

// ======================================
// RIWAYAT STOK
// ======================================

export function getStockMovements(): StockMovement[] {
  return db.getAllSync<StockMovement>(
    `SELECT
       sm.id,
       sm.ingredient_id,
       i.name AS ingredient_name,
       sm.movement_type,
       sm.quantity,
       sm.note,
       sm.created_at
     FROM stock_movements sm
     JOIN ingredients i
       ON i.id = sm.ingredient_id
     ORDER BY sm.id DESC
     LIMIT 30`
  );
}

// ======================================
// RESEP PRODUK
// ======================================

export function getRecipeItems(
  productId: number
): RecipeItem[] {
  return db.getAllSync<RecipeItem>(
    `SELECT
       r.ingredient_id,
       i.name AS ingredient_name,
       i.unit,
       r.quantity,
       i.cost_per_unit
     FROM recipes r
     JOIN ingredients i
       ON i.id = r.ingredient_id
     WHERE r.product_id = ?
     ORDER BY i.name ASC`,
    [productId]
  );
}

// Tambah atau perbarui kebutuhan bahan
// untuk 1 porsi produk
export function saveRecipeItem(
  productId: number,
  ingredientId: number,
  quantity: number
) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Jumlah bahan per porsi harus lebih dari 0."
    );
  }

  const product = db.getFirstSync<{ id: number }>(
    "SELECT id FROM products WHERE id = ?",
    [productId]
  );

  const ingredient = db.getFirstSync<{ id: number }>(
    `SELECT id FROM ingredients
     WHERE id = ? AND is_active = 1`,
    [ingredientId]
  );

  if (!product || !ingredient) {
    throw new Error("Produk atau bahan tidak ditemukan.");
  }

  return db.runSync(
    `INSERT INTO recipes
     (product_id, ingredient_id, quantity)
     VALUES (?, ?, ?)
     ON CONFLICT(product_id, ingredient_id)
     DO UPDATE SET quantity = excluded.quantity`,
    [productId, ingredientId, quantity]
  );
}

// Hapus satu bahan dari resep
export function removeRecipeItem(
  productId: number,
  ingredientId: number
) {
  return db.runSync(
    `DELETE FROM recipes
     WHERE product_id = ?
       AND ingredient_id = ?`,
    [productId, ingredientId]
  );
}

// Menghitung estimasi biaya bahan per porsi
export function getRecipeCost(
  productId: number
): number {
  const result = db.getFirstSync<{
    total_cost: number;
  }>(
    `SELECT
       COALESCE(
         SUM(r.quantity * i.cost_per_unit),
         0
       ) AS total_cost
     FROM recipes r
     JOIN ingredients i
       ON i.id = r.ingredient_id
     WHERE r.product_id = ?`,
    [productId]
  );

  return result?.total_cost ?? 0;
}
