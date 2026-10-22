
import { db } from "./db";
import type { Ingredient } from "./inventoryDb";

// =====================================
// COFFEEPOS - EDIT DATA BAHAN BAKU
// =====================================

export type IngredientUpdate = {
  id: number;
  name: string;
  minStock: number;
  costPerUnit: number;
};

// Mengubah nama, harga, dan stok minimum.
// Stok aktual, satuan, dan riwayat
// perubahan stok tidak diubah.

export function updateIngredient(
  data: IngredientUpdate
): Ingredient {
  const cleanName = data.name.trim();

  if (
    !Number.isSafeInteger(data.id) ||
    data.id <= 0
  ) {
    throw new Error("ID bahan baku tidak valid.");
  }

  if (!cleanName) {
    throw new Error("Nama bahan baku wajib diisi.");
  }

  if (
    !Number.isSafeInteger(data.minStock) ||
    data.minStock < 0
  ) {
    throw new Error(
      "Stok minimum harus berupa angka 0 atau lebih."
    );
  }

  if (
    !Number.isSafeInteger(data.costPerUnit) ||
    data.costPerUnit < 0
  ) {
    throw new Error(
      "Harga per satuan harus berupa angka 0 atau lebih."
    );
  }

  let updatedIngredient: Ingredient | null = null;

  db.withTransactionSync(() => {
    // Pastikan bahan masih tersedia
    const existing = db.getFirstSync<Ingredient>(
      `SELECT
         id, name, unit, stock,
         min_stock, cost_per_unit, is_active
       FROM ingredients
       WHERE id = ? AND is_active = 1`,
      [data.id]
    );

    if (!existing) {
      throw new Error(
        "Bahan baku tidak ditemukan atau sudah tidak aktif."
      );
    }

    // Nama bahan harus unik
    const duplicate = db.getFirstSync<{ id: number }>(
      `SELECT id
       FROM ingredients
       WHERE LOWER(name) = LOWER(?)
         AND id != ?`,
      [cleanName, data.id]
    );

    if (duplicate) {
      throw new Error(
        "Nama bahan baku sudah digunakan."
      );
    }

    const result = db.runSync(
      `UPDATE ingredients
       SET name = ?,
           min_stock = ?,
           cost_per_unit = ?
       WHERE id = ?
         AND is_active = 1`,
      [
        cleanName,
        data.minStock,
        data.costPerUnit,
        data.id,
      ]
    );

    if (result.changes !== 1) {
      throw new Error(
        "Gagal menyimpan perubahan bahan baku."
      );
    }

    updatedIngredient = db.getFirstSync<Ingredient>(
      `SELECT
         id, name, unit, stock,
         min_stock, cost_per_unit, is_active
       FROM ingredients
       WHERE id = ?`,
      [data.id]
    );
  });

  if (!updatedIngredient) {
    throw new Error(
      "Data bahan baku gagal diperbarui."
    );
  }

  return updatedIngredient;
}
