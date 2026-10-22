
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getOrderItems,
  getOrders,
  initDatabase,
  type Order,
  type OrderItem,
} from "../database/db";

const rupiah = (value: number) =>
  "Rp" + value.toLocaleString("id-ID");

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] =
    useState<number | null>(null);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Memuat semua transaksi dari SQLite
  const loadOrders = useCallback(() => {
    setLoading(true);
    setError("");

    try {
      initDatabase();
      const data = getOrders();

      setOrders(data);
      setSelectedOrderId(null);
      setItems([]);
    } catch (err) {
      console.error("Gagal memuat pesanan:", err);
      setError("Gagal mengambil riwayat pesanan.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh saat tab Pesanan dibuka
  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  // Menampilkan atau menyembunyikan detail
  function toggleDetails(orderId: number) {
    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
      setItems([]);
      return;
    }

    try {
      const data = getOrderItems(orderId);

      setItems(data);
      setSelectedOrderId(orderId);
    } catch (err) {
      console.error("Gagal memuat detail:", err);
      setError("Gagal memuat detail transaksi.");
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* HEADER */}
      <Text style={styles.title}>
        📋 Riwayat Pesanan
      </Text>

      <Text style={styles.subtitle}>
        Transaksi penjualan CoffeePOS
      </Text>

      {/* RINGKASAN */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          Jumlah Transaksi Tersimpan
        </Text>

        <Text style={styles.summaryValue}>
          {orders.length}
        </Text>
      </View>

      {loading && (
        <Text style={styles.info}>
          Memuat transaksi dari SQLite...
        </Text>
      )}

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>

          <TouchableOpacity onPress={loadOrders}>
            <Text style={styles.retryText}>
              Coba Lagi
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && error === "" && orders.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>
            Belum Ada Pesanan
          </Text>
          <Text style={styles.emptyDescription}>
            Transaksi yang berhasil disimpan
            melalui halaman Kasir akan muncul di sini.
          </Text>
        </View>
      )}

      {/* DAFTAR TRANSAKSI */}
      {orders.map((order) => (
        <View
          key={order.id}
          style={styles.orderCard}
        >
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber}>
              {order.order_number}
            </Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {order.status === "paid"
                  ? "Lunas"
                  : order.status}
              </Text>
            </View>
          </View>

          <Text style={styles.orderDate}>
            {order.created_at}
          </Text>

          <View style={styles.divider}/>

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Metode Pembayaran
            </Text>
            <Text style={styles.value}>
              {order.payment_method === "cash"
                ? "💵 Tunai"
                : order.payment_method}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Total Belanja
            </Text>
            <Text style={styles.totalValue}>
              {rupiah(order.total)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Uang Diterima
            </Text>
            <Text style={styles.value}>
              {rupiah(order.amount_received)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Kembalian
            </Text>
            <Text style={styles.value}>
              {rupiah(order.change_amount)}
            </Text>
          </View>

          {/* TOMBOL DETAIL */}
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => toggleDetails(order.id)}
          >
            <Text style={styles.detailButtonText}>
              {selectedOrderId === order.id
                ? "Tutup Detail ▲"
                : "Lihat Detail Produk ▼"}
            </Text>
          </TouchableOpacity>

          {/* DETAIL ITEM TRANSAKSI */}
          {selectedOrderId === order.id && (
            <View style={styles.detailBox}>
              <Text style={styles.detailHeading}>
                Produk yang Dibeli
              </Text>

              {items.map((item) => (
                <View
                  key={item.id}
                  style={styles.itemRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {item.product_name}
                    </Text>

                    <Text style={styles.itemQty}>
                      {item.quantity} ×{" "}
                      {rupiah(item.unit_price)}
                    </Text>
                  </View>

                  <Text style={styles.itemSubtotal}>
                    {rupiah(item.subtotal)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={loadOrders}
      >
        <Text style={styles.refreshText}>
          🔄 Refresh Pesanan
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Riwayat ini berasal dari database lokal
        SQLite pada perangkat. Belum tersinkronisasi
        dengan server cloud.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0",
  },

  content: {
    padding: 18,
    paddingBottom: 60,
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

  summaryCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },

  summaryLabel: {
    color: "#777777",
    fontSize: 14,
  },

  summaryValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#385D4A",
    marginTop: 8,
  },

  info: {
    color: "#777777",
    marginBottom: 15,
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

  retryText: {
    color: "#385D4A",
    fontWeight: "bold",
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2B2925",
  },

  emptyDescription: {
    color: "#777777",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 17,
    marginBottom: 15,
  },

  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  orderNumber: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#2B2925",
  },

  statusBadge: {
    backgroundColor: "#E4F2E7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  statusText: {
    color: "#2F7046",
    fontWeight: "bold",
    fontSize: 12,
  },

  orderDate: {
    color: "#888888",
    fontSize: 12,
    marginTop: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 15,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  label: {
    color: "#777777",
    fontSize: 13,
  },

  value: {
    fontWeight: "600",
    color: "#2B2925",
    fontSize: 13,
  },

  totalValue: {
    fontWeight: "bold",
    color: "#385D4A",
    fontSize: 17,
  },

  detailButton: {
    backgroundColor: "#E8EEE9",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 8,
  },

  detailButtonText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  detailBox: {
    backgroundColor: "#F7F5F0",
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
  },

  detailHeading: {
    fontWeight: "bold",
    color: "#2B2925",
    marginBottom: 15,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  itemName: {
    fontWeight: "600",
    color: "#2B2925",
  },

  itemQty: {
    color: "#777777",
    fontSize: 12,
    marginTop: 4,
  },

  itemSubtotal: {
    fontWeight: "bold",
    color: "#385D4A",
    fontSize: 13,
  },

  refreshButton: {
    borderWidth: 1,
    borderColor: "#385D4A",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },

  refreshText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  note: {
    color: "#999999",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 20,
  },
});
