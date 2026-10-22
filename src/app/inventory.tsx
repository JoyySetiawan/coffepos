
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getAllProducts,
    type Product,
} from "../database/db";

import {
    UNITS,
    addIngredient,
    adjustIngredientStock,
    getIngredients,
    getRecipeCost,
    getRecipeItems,
    getStockMovements,
    initInventoryDatabase,
    removeRecipeItem,
    saveRecipeItem,
    type Ingredient,
    type IngredientUnit,
    type RecipeItem,
    type StockMovement,
} from "../database/inventoryDb";

import {
    updateIngredient,
} from "../database/ingredientEditDb";

// =====================================
// FORMAT ANGKA
// =====================================

const rupiah = (value: number) =>
  "Rp" + value.toLocaleString("id-ID");

function parseWholeNumber(
  value: string,
  label: string,
  allowZero = false
): number {
  const number = Number(value);

  if (
    value.trim() === "" ||
    !Number.isSafeInteger(number) ||
    (allowZero ? number < 0 : number <= 0)
  ) {
    throw new Error(`${label} tidak valid.`);
  }

  return number;
}

// =====================================
// HALAMAN INVENTORY
// =====================================

export default function InventoryScreen() {
  // DATA SQLITE
  const [ingredients, setIngredients] =
    useState<Ingredient[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [recipeItems, setRecipeItems] =
    useState<RecipeItem[]>([]);

  const [recipeCost, setRecipeCost] = useState(0);

  const [error, setError] = useState("");

  // TAMBAH BAHAN
  const [ingredientName, setIngredientName] =
    useState("");

  const [unit, setUnit] =
    useState<IngredientUnit>("gram");

  const [minStock, setMinStock] = useState("0");
  const [costPerUnit, setCostPerUnit] = useState("0");

  // EDIT BAHAN
  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [editName, setEditName] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editCost, setEditCost] = useState("");

  const [editUnit, setEditUnit] = useState("");
  const [editStock, setEditStock] = useState(0);

  // STOK MASUK / KELUAR
  const [stockIngredientId, setStockIngredientId] =
    useState<number | null>(null);

  const [stockType, setStockType] =
    useState<"in" | "out">("in");

  const [stockQuantity, setStockQuantity] =
    useState("");

  const [stockNote, setStockNote] = useState("");

  // RESEP
  const [selectedProductId, setSelectedProductId] =
    useState<number | null>(null);

  const [selectedIngredientId, setSelectedIngredientId] =
    useState<number | null>(null);

  const [recipeQuantity, setRecipeQuantity] =
    useState("");

  // =====================================
  // LOAD INVENTORY
  // =====================================

  const loadInventory = useCallback(() => {
    try {
      initInventoryDatabase();

      setIngredients(getIngredients());
      setProducts(getAllProducts());
      setMovements(getStockMovements());

      setError("");
    } catch (err) {
      console.error("Inventory error:", err);
      setError("Gagal memuat Inventory.");
    }
  }, []);

  const loadRecipe = useCallback(
    (productId: number) => {
      try {
        setRecipeItems(getRecipeItems(productId));
        setRecipeCost(getRecipeCost(productId));
      } catch (err) {
        console.error("Gagal memuat resep:", err);

        Alert.alert(
          "Error",
          "Gagal memuat resep produk."
        );
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadInventory();

      if (selectedProductId !== null) {
        loadRecipe(selectedProductId);
      }
    }, [loadInventory, loadRecipe, selectedProductId])
  );

  // =====================================
  // TAMBAH BAHAN BAKU
  // =====================================

  function handleAddIngredient() {
    try {
      const minimum = parseWholeNumber(
        minStock,
        "Stok minimum",
        true
      );

      const cost = parseWholeNumber(
        costPerUnit,
        "Harga per satuan",
        true
      );

      addIngredient(
        ingredientName,
        unit,
        minimum,
        cost
      );

      setIngredientName("");
      setUnit("gram");
      setMinStock("0");
      setCostPerUnit("0");

      loadInventory();

      Alert.alert(
        "Berhasil",
        "Bahan baku berhasil ditambahkan."
      );
    } catch (err) {
      Alert.alert(
        "Gagal",
        err instanceof Error
          ? err.message
          : "Gagal menambahkan bahan."
      );
    }
  }

  // =====================================
  // EDIT BAHAN BAKU
  // =====================================

  function startEdit(item: Ingredient) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditMinStock(String(item.min_stock));
    setEditCost(String(item.cost_per_unit));
    setEditUnit(item.unit);
    setEditStock(item.stock);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMinStock("");
    setEditCost("");
    setEditUnit("");
    setEditStock(0);
  }

  function handleSaveEdit() {
    if (editingId === null) {
      return;
    }

    try {
      const minimum = parseWholeNumber(
        editMinStock,
        "Stok minimum",
        true
      );

      const cost = parseWholeNumber(
        editCost,
        "Harga per satuan",
        true
      );

      updateIngredient({
        id: editingId,
        name: editName,
        minStock: minimum,
        costPerUnit: cost,
      });

      cancelEdit();
      loadInventory();

      // Harga resep juga harus dihitung ulang
      if (selectedProductId !== null) {
        loadRecipe(selectedProductId);
      }

      Alert.alert(
        "Berhasil ✅",
        "Data bahan baku berhasil diperbarui."
      );
    } catch (err) {
      Alert.alert(
        "Gagal Menyimpan",
        err instanceof Error
          ? err.message
          : "Data bahan tidak dapat diperbarui."
      );
    }
  }

  // =====================================
  // STOK MASUK / KELUAR
  // =====================================

  function handleStockMovement() {
    if (stockIngredientId === null) {
      Alert.alert(
        "Pilih Bahan",
        "Pilih bahan baku terlebih dahulu."
      );
      return;
    }

    try {
      const quantity = parseWholeNumber(
        stockQuantity,
        "Jumlah stok"
      );

      adjustIngredientStock(
        stockIngredientId,
        stockType,
        quantity,
        stockNote
      );

      setStockQuantity("");
      setStockNote("");

      loadInventory();

      Alert.alert(
        "Berhasil",
        stockType === "in"
          ? "Stok masuk berhasil dicatat."
          : "Stok keluar berhasil dicatat."
      );
    } catch (err) {
      Alert.alert(
        "Gagal",
        err instanceof Error
          ? err.message
          : "Stok gagal diperbarui."
      );
    }
  }

  // =====================================
  // SIMPAN RESEP
  // =====================================

  function handleSaveRecipe() {
    if (
      selectedProductId === null ||
      selectedIngredientId === null
    ) {
      Alert.alert(
        "Pilih Data",
        "Pilih produk dan bahan baku dahulu."
      );
      return;
    }

    try {
      const quantity = parseWholeNumber(
        recipeQuantity,
        "Jumlah bahan per porsi"
      );

      saveRecipeItem(
        selectedProductId,
        selectedIngredientId,
        quantity
      );

      setRecipeQuantity("");
      loadRecipe(selectedProductId);

      Alert.alert(
        "Berhasil",
        "Resep berhasil disimpan."
      );
    } catch (err) {
      Alert.alert(
        "Gagal",
        err instanceof Error
          ? err.message
          : "Gagal menyimpan resep."
      );
    }
  }

  function handleRemoveRecipe(item: RecipeItem) {
    if (selectedProductId === null) {
      return;
    }

    const productId = selectedProductId;

    Alert.alert(
      "Hapus Bahan dari Resep",
      `Hapus ${item.ingredient_name} dari resep?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => {
            try {
              removeRecipeItem(
                productId,
                item.ingredient_id
              );

              loadRecipe(productId);
            } catch (err) {
              Alert.alert(
                "Gagal",
                "Tidak dapat menghapus bahan resep."
              );
            }
          },
        },
      ]
    );
  }

  // =====================================
  // RINGKASAN
  // =====================================

  const selectedProduct = products.find(
    (item) => item.id === selectedProductId
  );

  const lowStockCount = ingredients.filter(
    (item) => item.stock <= item.min_stock
  ).length;

  // =====================================
  // TAMPILAN
  // =====================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <Text style={styles.title}>
        📦 Inventory
      </Text>

      <Text style={styles.subtitle}>
        Kelola bahan, harga, stok, dan resep
      </Text>

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity onPress={loadInventory}>
            <Text style={styles.link}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RINGKASAN */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.muted}>
            Jumlah Bahan
          </Text>
          <Text style={styles.summaryValue}>
            {ingredients.length}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.muted}>
            Stok Menipis
          </Text>
          <Text style={styles.summaryValue}>
            {lowStockCount}
          </Text>
        </View>
      </View>

      {/* TAMBAH BAHAN BAKU */}
      <View style={styles.card}>
        <Text style={styles.heading}>
          ➕ Tambah Bahan Baku
        </Text>

        <Text style={styles.label}>
          Nama Bahan
        </Text>

        <TextInput
          style={styles.input}
          value={ingredientName}
          onChangeText={setIngredientName}
          placeholder="Contoh: Biji Kopi"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>
          Satuan
        </Text>

        <View style={styles.choices}>
          {UNITS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.choice,
                unit === item && styles.choiceActive,
              ]}
              onPress={() => setUnit(item)}
            >
              <Text
                style={[
                  styles.choiceText,
                  unit === item &&
                    styles.choiceTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>
          Stok Minimum
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={minStock}
          onChangeText={setMinStock}
          placeholder="Contoh: 500"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>
          Harga Beli per Satuan (Rp)
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={costPerUnit}
          onChangeText={setCostPerUnit}
          placeholder="Contoh: 200"
          placeholderTextColor="#999999"
        />

        <Text style={styles.helper}>
          Contoh: harga biji kopi Rp200 per gram.
          Stok awal dicatat melalui Stok Masuk.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddIngredient}
        >
          <Text style={styles.primaryText}>
            + Simpan Bahan Baku
          </Text>
        </TouchableOpacity>
      </View>

      {/* DAFTAR BAHAN */}
      <Text style={styles.heading}>
        🫘 Daftar Bahan Baku
      </Text>

      {ingredients.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Belum ada bahan baku.
          </Text>
        </View>
      )}

      {ingredients.map((item) => {
        const low = item.stock <= item.min_stock;

        return (
          <View
            key={item.id}
            style={styles.ingredientCard}
          >
            <View style={styles.spaceBetween}>
              <Text style={styles.itemName}>
                {item.name}
              </Text>

              <Text
                style={[
                  styles.status,
                  low
                    ? styles.lowStatus
                    : styles.safeStatus,
                ]}
              >
                {low ? "Stok Menipis" : "Aman"}
              </Text>
            </View>

            <Text style={styles.stockValue}>
              {item.stock.toLocaleString("id-ID")}{" "}
              {item.unit}
            </Text>

            <Text style={styles.muted}>
              Minimum: {item.min_stock} {item.unit}
            </Text>

            <Text style={styles.muted}>
              Harga: {rupiah(item.cost_per_unit)}
              /{item.unit}
            </Text>

            {/* TOMBOL EDIT BARU */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                if (editingId === item.id) {
                  cancelEdit();
                } else {
                  startEdit(item);
                }
              }}
            >
              <Text style={styles.editButtonText}>
                {editingId === item.id
                  ? "Tutup Edit"
                  : "✏️ Edit Bahan"}
              </Text>
            </TouchableOpacity>

            {/* FORM EDIT DALAM KARTU BAHAN */}
            {editingId === item.id && (
              <View style={styles.editForm}>
                <Text style={styles.editTitle}>
                  Edit Data Bahan
                </Text>

                <Text style={styles.label}>
                  Nama Bahan
                </Text>

                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nama bahan"
                />

                <Text style={styles.label}>
                  Harga Beli per {editUnit} (Rp)
                </Text>

                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={editCost}
                  onChangeText={setEditCost}
                  placeholder="Harga baru"
                />

                <Text style={styles.label}>
                  Stok Minimum ({editUnit})
                </Text>

                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={editMinStock}
                  onChangeText={setEditMinStock}
                  placeholder="Batas stok minimum"
                />

                <View style={styles.readonlyBox}>
                  <Text style={styles.muted}>
                    Stok tersedia tetap:{" "}
                    {editStock.toLocaleString("id-ID")}{" "}
                    {editUnit}
                  </Text>

                  <Text style={styles.muted}>
                    Satuan tidak dapat diubah di sini.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.primaryText}>
                    Simpan Perubahan
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={cancelEdit}
                >
                  <Text style={styles.cancelEditText}>
                    Batal Edit
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* STOK MASUK / KELUAR */}
      <View style={styles.card}>
        <Text style={styles.heading}>
          🔄 Catat Stok Masuk / Keluar
        </Text>

        <Text style={styles.label}>
          Pilih Bahan Baku
        </Text>

        <View style={styles.choices}>
          {ingredients.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.choice,
                stockIngredientId === item.id &&
                  styles.choiceActive,
              ]}
              onPress={() =>
                setStockIngredientId(item.id)
              }
            >
              <Text
                style={[
                  styles.choiceText,
                  stockIngredientId === item.id &&
                    styles.choiceTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>
          Jenis Perubahan
        </Text>

        <View style={styles.choices}>
          {[
            { key: "in", label: "Stok Masuk" },
            { key: "out", label: "Stok Keluar" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.choice,
                stockType === item.key &&
                  styles.choiceActive,
              ]}
              onPress={() =>
                setStockType(
                  item.key as "in" | "out"
                )
              }
            >
              <Text
                style={[
                  styles.choiceText,
                  stockType === item.key &&
                    styles.choiceTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Jumlah</Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={stockQuantity}
          onChangeText={setStockQuantity}
          placeholder="Contoh: 500"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>
          Keterangan
        </Text>

        <TextInput
          style={styles.input}
          value={stockNote}
          onChangeText={setStockNote}
          placeholder="Contoh: Pembelian supplier"
          placeholderTextColor="#999999"
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStockMovement}
        >
          <Text style={styles.primaryText}>
            Simpan Perubahan Stok
          </Text>
        </TouchableOpacity>
      </View>

      {/* RESEP MENU */}
      <View style={styles.card}>
        <Text style={styles.heading}>
          📋 Resep Menu
        </Text>

        <Text style={styles.label}>
          Pilih Produk
        </Text>

        <View style={styles.choices}>
          {products.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={[
                styles.choice,
                selectedProductId === product.id &&
                  styles.choiceActive,
              ]}
              onPress={() => {
                setSelectedProductId(product.id);
                setSelectedIngredientId(null);
                setRecipeQuantity("");
                loadRecipe(product.id);
              }}
            >
              <Text
                style={[
                  styles.choiceText,
                  selectedProductId === product.id &&
                    styles.choiceTextActive,
                ]}
              >
                {product.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedProductId !== null && (
          <>
            <Text style={styles.selectedTitle}>
              Resep: {selectedProduct?.name}
            </Text>

            <Text style={styles.label}>
              Pilih Bahan
            </Text>

            <View style={styles.choices}>
              {ingredients.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.choice,
                    selectedIngredientId === item.id &&
                      styles.choiceActive,
                  ]}
                  onPress={() =>
                    setSelectedIngredientId(item.id)
                  }
                >
                  <Text
                    style={[
                      styles.choiceText,
                      selectedIngredientId === item.id &&
                        styles.choiceTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              Jumlah Bahan untuk 1 Porsi
            </Text>

            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={recipeQuantity}
              onChangeText={setRecipeQuantity}
              placeholder="Contoh: 18"
              placeholderTextColor="#999999"
            />

            <Text style={styles.helper}>
              Contoh: 18 gram kopi atau 150 ml susu.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSaveRecipe}
            >
              <Text style={styles.primaryText}>
                Simpan Bahan Resep
              </Text>
            </TouchableOpacity>

            <View style={styles.recipeBox}>
              <Text style={styles.selectedTitle}>
                Komposisi per Porsi
              </Text>

              {recipeItems.length === 0 && (
                <Text style={styles.muted}>
                  Belum ada bahan pada resep ini.
                </Text>
              )}

              {recipeItems.map((item) => (
                <View
                  key={item.ingredient_id}
                  style={styles.recipeRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {item.ingredient_name}
                    </Text>

                    <Text style={styles.muted}>
                      {item.quantity} {item.unit}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      handleRemoveRecipe(item)
                    }
                  >
                    <Text style={styles.removeText}>
                      Hapus
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.divider} />

              <Text style={styles.costLabel}>
                Estimasi Biaya Bahan per Porsi
              </Text>

              <Text style={styles.costValue}>
                {rupiah(recipeCost)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* RIWAYAT STOK */}
      <Text style={styles.heading}>
        🕘 Riwayat Stok Terbaru
      </Text>

      {movements.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Belum ada perubahan stok.
          </Text>
        </View>
      )}

      {movements.map((movement) => (
        <View
          key={movement.id}
          style={styles.movementCard}
        >
          <View style={styles.spaceBetween}>
            <Text style={styles.itemName}>
              {movement.ingredient_name}
            </Text>

            <Text
              style={{
                color:
                  movement.movement_type === "in"
                    ? "#2F7046"
                    : "#C0392B",
                fontWeight: "bold",
              }}
            >
              {movement.movement_type === "in"
                ? "+"
                : "-"}
              {movement.quantity}
            </Text>
          </View>

          <Text style={styles.muted}>
            {movement.movement_type === "in"
              ? "Stok Masuk"
              : "Stok Keluar"}
            {" · "}
            {movement.created_at} UTC
          </Text>

          {movement.note !== "" && (
            <Text style={styles.muted}>
              {movement.note}
            </Text>
          )}
        </View>
      ))}

      {/* REFRESH */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          loadInventory();

          if (selectedProductId !== null) {
            loadRecipe(selectedProductId);
          }
        }}
      >
        <Text style={styles.refreshText}>
          🔄 Refresh Inventory
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Edit harga dan stok minimum tidak
        mengubah jumlah stok tersedia.
        Stok penjualan tetap dikurangi otomatis
        berdasarkan resep menu.
      </Text>
    </ScrollView>
  );
}

// =====================================
// STYLE INVENTORY
// =====================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0",
  },

  content: {
    padding: 18,
    paddingBottom: 80,
  },

  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#385D4A",
  },

  subtitle: {
    color: "#777777",
    marginTop: 5,
    marginBottom: 20,
  },

  heading: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 14,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
  },

  summaryValue: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#385D4A",
    marginTop: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 18,
    marginBottom: 22,
  },

  label: {
    fontWeight: "600",
    color: "#2B2925",
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    padding: 13,
    marginBottom: 16,
    color: "#2B2925",
    fontSize: 15,
  },

  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 17,
  },

  choice: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
  },

  choiceActive: {
    backgroundColor: "#385D4A",
    borderColor: "#385D4A",
  },

  choiceText: {
    color: "#385D4A",
    fontWeight: "600",
    fontSize: 12,
  },

  choiceTextActive: {
    color: "#FFFFFF",
  },

  helper: {
    fontSize: 12,
    color: "#888888",
    lineHeight: 19,
    marginBottom: 16,
  },

  primaryButton: {
    backgroundColor: "#385D4A",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  ingredientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    padding: 16,
    marginBottom: 12,
  },

  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  itemName: {
    color: "#2B2925",
    fontWeight: "bold",
    fontSize: 14,
    flexShrink: 1,
  },

  stockValue: {
    color: "#385D4A",
    fontWeight: "bold",
    fontSize: 22,
    marginTop: 10,
  },

  muted: {
    fontSize: 12,
    color: "#888888",
    marginTop: 6,
  },

  status: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 11,
    overflow: "hidden",
  },

  lowStatus: {
    backgroundColor: "#FFF0DE",
    color: "#A96312",
  },

  safeStatus: {
    backgroundColor: "#E4F2E7",
    color: "#2F7046",
  },

  // EDIT BAHAN
  editButton: {
    backgroundColor: "#E8EEE9",
    borderRadius: 9,
    padding: 12,
    alignItems: "center",
    marginTop: 15,
  },

  editButtonText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  editForm: {
    backgroundColor: "#F7F5F0",
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
  },

  editTitle: {
    fontSize: 17,
    color: "#385D4A",
    fontWeight: "bold",
    marginBottom: 17,
  },

  readonlyBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ECEEE9",
    marginBottom: 15,
  },

  cancelEditButton: {
    padding: 15,
    alignItems: "center",
  },

  cancelEditText: {
    color: "#777777",
    fontWeight: "600",
  },

  selectedTitle: {
    color: "#385D4A",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 16,
  },

  recipeBox: {
    backgroundColor: "#F7F5F0",
    borderRadius: 12,
    padding: 15,
    marginTop: 18,
  },

  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  removeText: {
    color: "#C0392B",
    fontWeight: "bold",
    marginLeft: 10,
  },

  divider: {
    height: 1,
    backgroundColor: "#DDDDDD",
    marginVertical: 14,
  },

  costLabel: {
    color: "#777777",
    fontSize: 13,
  },

  costValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#385D4A",
    marginTop: 5,
  },

  movementCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },

  refreshButton: {
    borderWidth: 1,
    borderColor: "#385D4A",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 15,
  },

  refreshText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  footer: {
    fontSize: 12,
    color: "#999999",
    lineHeight: 19,
    textAlign: "center",
    marginTop: 18,
  },

  errorBox: {
    backgroundColor: "#FCEAEA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  errorText: {
    color: "#C0392B",
  },

  link: {
    color: "#385D4A",
    fontWeight: "bold",
    marginTop: 10,
  },
});
