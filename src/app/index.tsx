
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  CATEGORIES,
  getProducts,
  type Product,
} from "../database/db";

import {
  createInventoryCashOrder,
  initInventoryDatabase,
} from "../database/inventoryDb";

type CartItem = Product & {
  qty: number;
};

const rupiah = (value: number) =>
  "Rp" + value.toLocaleString("id-ID");

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState("Semua");

  const [paymentVisible, setPaymentVisible] =
    useState(false);

  const [cashInput, setCashInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Mencegah konfirmasi pembayaran ganda
  const paymentLock = useRef(false);

  // =====================================
  // PRODUK SQLITE
  // =====================================

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(false);

      try {
        initInventoryDatabase();
        setProducts(getProducts());
      } catch (err) {
        console.error("Gagal memuat menu:", err);
        setError(true);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, [])
  );

  const filteredProducts = products.filter(
    (product) =>
      selectedCategory === "Semua" ||
      product.category === selectedCategory
  );

  // =====================================
  // KERANJANG
  // =====================================

  function addToCart(product: Product) {
    if (paymentVisible || paymentLock.current) {
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }

      return [...current, { ...product, qty: 1 }];
    });
  }

  function removeFromCart(id: number) {
    if (paymentVisible || paymentLock.current) {
      return;
    }

    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, qty: item.qty - 1 }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const totalItems = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  // =====================================
  // PEMBAYARAN TUNAI
  // =====================================

  const cashReceived = Number(cashInput || "0");

  const cashValid =
    cashInput.length > 0 &&
    Number.isSafeInteger(cashReceived) &&
    cashReceived >= total;

  const changeAmount = cashValid
    ? cashReceived - total
    : 0;

  function openPayment() {
    if (cart.length === 0) {
      Alert.alert(
        "Keranjang Kosong",
        "Silakan pilih menu terlebih dahulu."
      );
      return;
    }

    if (paymentLock.current) return;

    try {
      const latestProducts = getProducts();

      const latestCart = cart.map((item) => {
        const latest = latestProducts.find(
          (product) => product.id === item.id
        );

        if (!latest) {
          throw new Error(
            `${item.name} sudah tidak tersedia.`
          );
        }

        return {
          ...latest,
          qty: item.qty,
        };
      });

      setCart(latestCart);
      setCashInput("");
      setPaymentVisible(true);
    } catch (err) {
      Alert.alert(
        "Periksa Keranjang",
        err instanceof Error
          ? err.message
          : "Produk tidak tersedia."
      );
    }
  }

  function closePayment() {
    if (paymentLock.current) return;

    setPaymentVisible(false);
    setCashInput("");
  }

  function confirmPayment() {
    if (paymentLock.current) return;

    if (!cashValid || cart.length === 0) {
      Alert.alert(
        "Pembayaran Tidak Valid",
        "Pastikan uang diterima mencukupi."
      );
      return;
    }

    paymentLock.current = true;
    setSaving(true);

    try {
      // Pemeriksaan harga terbaru
      const latestProducts = getProducts();

      let latestTotal = 0;

      for (const item of cart) {
        const current = latestProducts.find(
          (product) => product.id === item.id
        );

        if (!current) {
          throw new Error(
            `${item.name} sudah tidak tersedia.`
          );
        }

        if (current.price !== item.price) {
          // Perbarui keranjang agar kasir melihat
          // harga yang sekarang.
          setCart((oldCart) =>
            oldCart.map((cartItem) => {
              const updated = latestProducts.find(
                (p) => p.id === cartItem.id
              );

              return updated
                ? { ...updated, qty: cartItem.qty }
                : cartItem;
            })
          );

          throw new Error(
            `Harga ${item.name} berubah. ` +
            "Tutup pembayaran lalu periksa total baru."
          );
        }

        const subtotal = current.price * item.qty;

        if (!Number.isSafeInteger(subtotal)) {
          throw new Error("Subtotal tidak valid.");
        }

        latestTotal += subtotal;
      }

      if (
        !Number.isSafeInteger(latestTotal) ||
        latestTotal !== total
      ) {
        throw new Error(
          "Total belanja berubah. Periksa keranjang."
        );
      }

      // =================================
      // CHECKOUT + KURANGI STOK OTOMATIS
      // =================================

      const result = createInventoryCashOrder(
        cart.map((item) => ({
          product_id: item.id,
          qty: item.qty,
        })),
        cashReceived
      );

      // Hanya dijalankan jika SQLite sukses
      setCart([]);
      setCashInput("");
      setPaymentVisible(false);

      try {
        setProducts(getProducts());
      } catch (refreshError) {
        console.warn(
          "Transaksi tersimpan, tetapi refresh menu gagal:",
          refreshError
        );
      }

      Alert.alert(
        "Pembayaran Berhasil ✅",
        `No. Transaksi: ${result.order_number}\n\n` +
        `Total: ${rupiah(result.total)}\n` +
        `Tunai: ${rupiah(result.amount_received)}\n` +
        `Kembalian: ${rupiah(result.change_amount)}\n\n` +
        "Transaksi tersimpan dan stok bahan berkurang otomatis.",
        [{ text: "Selesai" }]
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memproses pembayaran.";

      // Kesalahan bisnis tidak perlu dianggap crash.
      console.log("Checkout ditolak:", message);

      Alert.alert("Pembayaran Belum Diproses", message);
    } finally {
      paymentLock.current = false;
      setSaving(false);
    }
  }

  // =====================================
  // TAMPILAN KASIR
  // =====================================

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          ☕ CoffeePOS
        </Text>

        <Text style={styles.subtitle}>
          Kasir · Outlet Utama
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>
          Pilih Menu
        </Text>

        {/* FILTER KATEGORI */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {["Semua", ...CATEGORIES].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                selectedCategory === item &&
                  styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item &&
                    styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && (
          <Text style={styles.info}>
            Memuat produk...
          </Text>
        )}

        {!loading && error && (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>
              Gagal memuat menu dari SQLite.
            </Text>
          </View>
        )}

        {!loading &&
          !error &&
          products.length === 0 && (
            <Text style={styles.info}>
              Belum ada produk aktif.
            </Text>
          )}

        {!loading &&
          !error &&
          products.length > 0 &&
          filteredProducts.length === 0 && (
            <Text style={styles.info}>
              Tidak ada menu pada kategori ini.
            </Text>
          )}

        {/* PRODUK */}
        <View style={styles.grid}>
          {!loading &&
            !error &&
            filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.product}
                onPress={() => addToCart(product)}
              >
                <Text style={styles.emoji}>
                  {product.emoji ?? "☕"}
                </Text>

                <Text style={styles.productName}>
                  {product.name}
                </Text>

                <Text style={styles.price}>
                  {rupiah(product.price)}
                </Text>

                <Text style={styles.productCategory}>
                  {product.category}
                </Text>

                <Text style={styles.add}>
                  + Tambah
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* KERANJANG */}
        <View style={styles.cartHeader}>
          <Text style={styles.heading}>
            Keranjang
          </Text>

          <Text style={styles.itemCount}>
            {totalItems} item
          </Text>
        </View>

        {cart.length === 0 && (
          <Text style={styles.empty}>
            Belum ada pesanan
          </Text>
        )}

        {cart.map((item) => (
          <View
            key={item.id}
            style={styles.cartItem}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>
                {item.name}
              </Text>

              <Text style={styles.cartPrice}>
                {rupiah(item.price * item.qty)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => removeFromCart(item.id)}
            >
              <Text style={styles.qtyButtonText}>
                −
              </Text>
            </TouchableOpacity>

            <Text style={styles.qty}>
              {item.qty}
            </Text>

            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => addToCart(item)}
            >
              <Text style={styles.qtyButtonText}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* TOTAL */}
        <View style={styles.totalBox}>
          <Text style={styles.heading}>
            Total Pembayaran
          </Text>

          <Text style={styles.total}>
            {rupiah(total)}
          </Text>

          <TouchableOpacity
            style={[
              styles.checkout,
              cart.length === 0 &&
                styles.checkoutDisabled,
            ]}
            disabled={cart.length === 0}
            onPress={openPayment}
          >
            <Text style={styles.checkoutText}>
              💵 Lanjut Pembayaran
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL PEMBAYARAN */}
      <Modal
        visible={paymentVisible}
        transparent
        animationType="slide"
        onRequestClose={closePayment}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              💵 Pembayaran Tunai
            </Text>

            <Text style={styles.modalLabel}>
              Total Tagihan
            </Text>

            <Text style={styles.modalTotal}>
              {rupiah(total)}
            </Text>

            <Text style={styles.modalLabel}>
              Uang Diterima (Rp)
            </Text>

            <TextInput
              style={styles.cashInput}
              placeholder="Contoh: 100000"
              placeholderTextColor="#999999"
              keyboardType="number-pad"
              value={cashInput}
              onChangeText={(text) =>
                setCashInput(
                  text.replace(/[^0-9]/g, "")
                )
              }
              editable={!saving}
            />

            {/* NOMINAL CEPAT */}
            <View style={styles.quickPayments}>
              {[total, 50000, 100000].map(
                (amount, index) => (
                  <TouchableOpacity
                    key={`${index}-${amount}`}
                    style={styles.quickButton}
                    disabled={saving}
                    onPress={() =>
                      setCashInput(String(amount))
                    }
                  >
                    <Text style={styles.quickText}>
                      {index === 0
                        ? "Uang Pas"
                        : rupiah(amount)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View style={styles.changeBox}>
              <Text style={styles.changeLabel}>
                Kembalian
              </Text>

              <Text style={styles.changeValue}>
                {rupiah(changeAmount)}
              </Text>
            </View>

            {cashInput.length > 0 &&
              cashReceived < total && (
                <Text style={styles.warning}>
                  Uang masih kurang{" "}
                  {rupiah(total - cashReceived)}
                </Text>
              )}

            <Text style={styles.inventoryNotice}>
              📦 Pembayaran akan memeriksa resep
              dan mengurangi stok bahan otomatis.
            </Text>

            <TouchableOpacity
              style={[
                styles.payButton,
                (!cashValid || saving) &&
                  styles.checkoutDisabled,
              ]}
              disabled={!cashValid || saving}
              onPress={confirmPayment}
            >
              <Text style={styles.checkoutText}>
                {saving
                  ? "Menyimpan..."
                  : "✓ Konfirmasi Pembayaran"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              disabled={saving}
              onPress={closePayment}
            >
              <Text style={styles.cancelText}>
                Batal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================
// STYLING
// =====================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0",
  },

  header: {
    backgroundColor: "#2B2925",
    padding: 20,
  },

  logo: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  subtitle: {
    color: "#CFC8BF",
    marginTop: 5,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  heading: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 15,
  },

  categoryScroll: {
    marginBottom: 18,
  },

  categoryButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E1E1E1",
  },

  categoryButtonActive: {
    backgroundColor: "#385D4A",
    borderColor: "#385D4A",
  },

  categoryText: {
    color: "#385D4A",
    fontWeight: "600",
    fontSize: 13,
  },

  categoryTextActive: {
    color: "#FFFFFF",
  },

  info: {
    color: "#777777",
    fontSize: 14,
    marginBottom: 15,
  },

  messageBox: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
  },

  errorText: {
    color: "#C0392B",
    fontWeight: "bold",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  product: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 15,
    marginBottom: 14,
  },

  emoji: {
    fontSize: 38,
    textAlign: "center",
    marginBottom: 12,
  },

  productName: {
    fontWeight: "bold",
    color: "#2B2925",
  },

  price: {
    color: "#385D4A",
    marginTop: 6,
  },

  productCategory: {
    color: "#999999",
    fontSize: 11,
    marginTop: 5,
  },

  add: {
    color: "#385D4A",
    fontWeight: "bold",
    marginTop: 12,
  },

  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemCount: {
    color: "#385D4A",
    fontWeight: "bold",
    marginBottom: 15,
  },

  empty: {
    color: "#888888",
    marginBottom: 20,
  },

  cartItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  cartPrice: {
    color: "#777777",
    marginTop: 5,
  },

  qtyButton: {
    backgroundColor: "#E9E8E2",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },

  qtyButtonText: {
    fontSize: 18,
    color: "#2B2925",
    fontWeight: "bold",
  },

  qty: {
    marginHorizontal: 12,
    fontWeight: "bold",
    color: "#2B2925",
  },

  totalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 18,
    marginTop: 12,
  },

  total: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#385D4A",
    marginBottom: 20,
  },

  checkout: {
    backgroundColor: "#385D4A",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },

  checkoutDisabled: {
    opacity: 0.5,
  },

  checkoutText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 20,
  },

  modalLabel: {
    color: "#777777",
    fontSize: 14,
    marginBottom: 7,
  },

  modalTotal: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#385D4A",
    marginBottom: 20,
  },

  cashInput: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    padding: 15,
    fontSize: 20,
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 15,
  },

  quickPayments: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 20,
  },

  quickButton: {
    flex: 1,
    backgroundColor: "#E8EEE9",
    paddingVertical: 12,
    borderRadius: 9,
    alignItems: "center",
  },

  quickText: {
    color: "#385D4A",
    fontWeight: "600",
    fontSize: 11,
  },

  changeBox: {
    backgroundColor: "#F3F7F3",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },

  changeLabel: {
    color: "#777777",
    marginBottom: 5,
  },

  changeValue: {
    fontSize: 26,
    color: "#385D4A",
    fontWeight: "bold",
  },

  warning: {
    color: "#C0392B",
    marginBottom: 15,
  },

  inventoryNotice: {
    color: "#777777",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 15,
  },

  payButton: {
    backgroundColor: "#385D4A",
    padding: 17,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButton: {
    padding: 15,
    alignItems: "center",
  },

  cancelText: {
    color: "#777777",
    fontWeight: "600",
  },
});
