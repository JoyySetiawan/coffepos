
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import {
  getOrders,
  getSalesSummary,
  initDatabase,
  type Order,
} from "../database/db";

const rupiah = (value: number) =>
  "Rp" + value.toLocaleString("id-ID");

export default function DashboardScreen() {
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] =
    useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mengambil data penjualan dari SQLite
  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError("");

    try {
      initDatabase();

      const summary = getSalesSummary();
      const orders = getOrders();

      setTotalSales(summary.totalSales);
      setTotalOrders(summary.totalOrders);

      // Lima transaksi lunas terbaru
      setRecentOrders(
        orders
          .filter((order) => order.status === "paid")
          .slice(0, 5)
      );
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Gagal memuat data penjualan.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh otomatis ketika Dashboard dibuka
  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const averageOrder =
    totalOrders > 0
      ? Math.round(totalSales / totalOrders)
      : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* HEADER */}
      <Text style={styles.title}>
        📊 Dashboard
      </Text>

      <Text style={styles.subtitle}>
        Ringkasan Penjualan CoffeePOS
      </Text>

      <View style={styles.periodBox}>
        <Text style={styles.periodText}>
          📅 Seluruh Transaksi Tersimpan
        </Text>
      </View>

      {loading && (
        <Text style={styles.info}>
          Memuat laporan dari SQLite...
        </Text>
      )}

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            onPress={loadDashboard}
          >
            <Text style={styles.retryText}>
              Coba Lagi
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && error === "" && (
        <>
          {/* KARTU RINGKASAN */}
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.cardIcon}>💰</Text>
              <Text style={styles.cardLabel}>
                Total Penjualan
              </Text>
              <Text
                style={styles.cardValue}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {rupiah(totalSales)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardIcon}>🧾</Text>
              <Text style={styles.cardLabel}>
                Total Transaksi
              </Text>
              <Text style={styles.cardValue}>
                {totalOrders}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardIcon}>📈</Text>
              <Text style={styles.cardLabel}>
                Rata-rata Transaksi
              </Text>
              <Text
                style={styles.cardValue}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {rupiah(averageOrder)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardIcon}>💵</Text>
              <Text style={styles.cardLabel}>
                Metode Pembayaran
              </Text>
              <Text style={styles.methodValue}>
                Tunai
              </Text>
            </View>
          </View>

          {/* TRANSAKSI TERBARU */}
          <Text style={styles.sectionTitle}>
            🧾 Transaksi Terbaru
          </Text>

          {recentOrders.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>
                📋
              </Text>
              <Text style={styles.emptyTitle}>
                Belum Ada Transaksi
              </Text>
              <Text style={styles.emptyDescription}>
                Transaksi yang berhasil dibayar
                akan muncul di sini.
              </Text>
            </View>
          )}

          {recentOrders.map((order) => (
            <View
              key={order.id}
              style={styles.orderCard}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>
                  {order.order_number}
                </Text>

                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>
                    Lunas
                  </Text>
                </View>
              </View>

              <Text style={styles.orderDate}>
                {order.created_at}
              </Text>

              <View style={styles.orderFooter}>
                <Text style={styles.paymentMethod}>
                  💵 Tunai
                </Text>

                <Text style={styles.orderTotal}>
                  {rupiah(order.total)}
                </Text>
              </View>
            </View>
          ))}

          {/* REFRESH */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadDashboard}
          >
            <Text style={styles.refreshText}>
              🔄 Refresh Dashboard
            </Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Data dihitung dari transaksi berstatus
            lunas yang tersimpan di SQLite tablet.
            Belum termasuk pengembalian dana,
            HPP, maupun biaya operasional.
          </Text>
        </>
      )}
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
    fontSize: 26,
    fontWeight: "bold",
    color: "#385D4A",
  },

  subtitle: {
    fontSize: 14,
    color: "#777777",
    marginTop: 5,
    marginBottom: 18,
  },

  periodBox: {
    backgroundColor: "#E8EEE9",
    padding: 13,
    borderRadius: 10,
    marginBottom: 18,
  },

  periodText: {
    color: "#385D4A",
    fontWeight: "600",
    fontSize: 13,
  },

  info: {
    color: "#777777",
    marginBottom: 15,
  },

  errorBox: {
    backgroundColor: "#FCEAEA",
    padding: 15,
    borderRadius: 10,
  },

  errorText: {
    color: "#C0392B",
    marginBottom: 10,
  },

  retryText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 15,
    width: "48%",
    marginBottom: 14,
    minHeight: 135,
  },

  cardIcon: {
    fontSize: 25,
    marginBottom: 10,
  },

  cardLabel: {
    fontSize: 12,
    color: "#777777",
    marginBottom: 8,
  },

  cardValue: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#385D4A",
  },

  methodValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#385D4A",
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#2B2925",
    marginTop: 12,
    marginBottom: 15,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 25,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },

  emptyTitle: {
    fontWeight: "bold",
    fontSize: 17,
    color: "#2B2925",
  },

  emptyDescription: {
    color: "#777777",
    textAlign: "center",
    marginTop: 8,
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    padding: 16,
    marginBottom: 10,
  },

  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  orderNumber: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2B2925",
  },

  paidBadge: {
    backgroundColor: "#E4F2E7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  paidText: {
    color: "#2F7046",
    fontWeight: "bold",
    fontSize: 12,
  },

  orderDate: {
    color: "#888888",
    fontSize: 12,
    marginTop: 6,
  },

  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  paymentMethod: {
    color: "#777777",
  },

  orderTotal: {
    fontWeight: "bold",
    color: "#385D4A",
  },

  refreshButton: {
    borderWidth: 1,
    borderColor: "#385D4A",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },

  refreshText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  note: {
    color: "#999999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
});
