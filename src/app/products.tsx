
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
    addProduct,
    CATEGORIES,
    getAllProducts,
    initDatabase,
    setProductActive,
    updateProduct,
    type Category,
    type Product,
} from "../database/db";

const rupiah = (n: number) =>
  "Rp" + n.toLocaleString("id-ID");

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [emoji, setEmoji] = useState("☕");
  const [category, setCategory] = useState<Category>("Coffee");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadProducts = useCallback(() => {
    try {
      initDatabase();
      setProducts(getAllProducts());
      setError("");
    } catch (err) {
      console.error(err);
      setError("Gagal memuat produk.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  function resetForm() {
    setName("");
    setPrice("");
    setEmoji("☕");
    setCategory("Coffee");
    setEditingId(null);
  }

  function handleSave() {
    const numericPrice = Number(price);

    if (
      !name.trim() ||
      !price.trim() ||
      !Number.isSafeInteger(numericPrice) ||
      numericPrice <= 0
    ) {
      Alert.alert(
        "Validasi",
        "Masukkan nama dan harga produk yang benar."
      );
      return;
    }

    try {
      if (editingId !== null) {
        updateProduct(
          editingId,
          name,
          numericPrice,
          emoji,
          category
        );
      } else {
        addProduct(name, numericPrice, emoji, category);
      }

      const message =
        editingId !== null
          ? "Produk berhasil diperbarui."
          : "Produk berhasil ditambahkan.";

      resetForm();
      loadProducts();
      Alert.alert("Berhasil", message);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error
          ? err.message
          : "Gagal menyimpan produk."
      );
    }
  }

  function handleEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setEmoji(product.emoji ?? "☕");

    setCategory(
      CATEGORIES.includes(product.category as Category)
        ? (product.category as Category)
        : "Coffee"
    );
  }

  function handleToggle(product: Product) {
    const nextActive = product.is_active !== 1;

    Alert.alert(
      nextActive ? "Aktifkan Produk" : "Nonaktifkan Produk",
      `Yakin ingin mengubah status ${product.name}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya",
          onPress: () => {
            try {
              setProductActive(product.id, nextActive);
              loadProducts();
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Gagal mengubah status.");
            }
          },
        },
      ]
    );
  }

  const activeCount = products.filter(
    (p) => p.is_active === 1
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        📦 Manajemen Produk
      </Text>
      <Text style={styles.muted}>
        Kelola menu, kategori, harga dan status produk
      </Text>

      <View style={styles.summary}>
        <View>
          <Text style={styles.muted}>Total Produk</Text>
          <Text style={styles.number}>{products.length}</Text>
        </View>
        <View>
          <Text style={styles.muted}>Produk Aktif</Text>
          <Text style={styles.number}>{activeCount}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          {editingId === null
            ? "➕ Tambah Produk"
            : "✏️ Edit Produk"}
        </Text>

        <Text style={styles.label}>Nama Produk</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Contoh: Vanilla Latte"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Harga (Rp)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          placeholder="Contoh: 28000"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Emoji Produk</Text>
        <TextInput
          style={styles.input}
          value={emoji}
          onChangeText={setEmoji}
          placeholder="☕"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Kategori Menu</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                category === item && styles.categorySelected,
              ]}
              onPress={() => setCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveText}>
            {editingId === null
              ? "+ Tambah Produk"
              : "Simpan Perubahan"}
          </Text>
        </TouchableOpacity>

        {editingId !== null && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={resetForm}
          >
            <Text style={styles.muted}>Batal Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.heading}>
        Daftar Produk ({products.length})
      </Text>

      {error !== "" && (
        <Text style={styles.error}>{error}</Text>
      )}

      {products.map((product) => {
        const active = product.is_active === 1;

        return (
          <View key={product.id} style={styles.card}>
            <View style={styles.productRow}>
              <Text style={styles.emoji}>
                {product.emoji ?? "☕"}
              </Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>
                  {product.name}
                </Text>
                <Text style={styles.price}>
                  {rupiah(product.price)}
                </Text>
                <Text style={styles.muted}>
                  {product.category}
                </Text>
              </View>

              <Text
                style={{
                  color: active ? "#385D4A" : "#999999",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              >
                {active ? "Aktif" : "Nonaktif"}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEdit(product)}
              >
                <Text style={styles.actionText}>✏️ Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleToggle(product)}
              >
                <Text style={styles.actionText}>
                  {active ? "Nonaktifkan" : "Aktifkan"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#385D4A",
  },
  muted: {
    fontSize: 13,
    color: "#777777",
    marginTop: 5,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  number: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#385D4A",
    marginTop: 6,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 18,
    marginBottom: 15,
  },
  heading: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 16,
  },
  label: {
    fontWeight: "600",
    color: "#2B2925",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    padding: 13,
    marginBottom: 16,
    color: "#2B2925",
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  categoryButton: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },
  categorySelected: {
    backgroundColor: "#385D4A",
    borderColor: "#385D4A",
  },
  categoryText: {
    fontSize: 13,
    color: "#555555",
  },
  categoryTextSelected: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#385D4A",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  cancelButton: {
    alignItems: "center",
    padding: 15,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 30,
  },
  productName: {
    fontWeight: "bold",
    color: "#2B2925",
    fontSize: 15,
  },
  price: {
    color: "#385D4A",
    marginTop: 5,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  actionButton: {
    flex: 1,
    borderRadius: 9,
    padding: 12,
    backgroundColor: "#E8EEE9",
    alignItems: "center",
  },
  actionText: {
    color: "#385D4A",
    fontWeight: "bold",
    fontSize: 13,
  },
  error: {
    color: "#C0392B",
    marginBottom: 12,
  },
});
