
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getOrdersByPeriod,
    getSalesReport,
    getTopProducts,
    initDatabase,
    type Order,
    type SalesReport,
    type TopProduct,
} from "../database/db";

// =====================================
// TIPE DATA DAN FORMAT RUPIAH
// =====================================

type Period = "today" | "week" | "month" | "date";

const rupiah = (value: number) =>
  "Rp" + value.toLocaleString("id-ID");

// Format tanggal lokal YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// =====================================
// VALIDASI TANGGAL
// =====================================

function parseLocalDate(value: string): Date {
  const cleanValue = value.trim();

  // Menerima format 2026-10-20
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    cleanValue
  );

  if (!match) {
    throw new Error(
      "Gunakan format YYYY-MM-DD, contoh 2026-10-20."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const result = new Date(year, month - 1, day);

  // Mencegah tanggal tidak valid seperti 2026-02-30
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    throw new Error("Tanggal tidak valid.");
  }

  return result;
}

// =====================================
// MENENTUKAN PERIODE LAPORAN
// =====================================

function getDateRange(
  period: Period,
  selectedDate: string
) {
  const now = new Date();

  let start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let end: Date;
  let label = "";

  if (period === "today") {
    label = "Hari Ini";

    end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 1
    );
  } else if (period === "week") {
    // Minggu dimulai pada hari Senin
    const offset = (start.getDay() + 6) % 7;

    start.setDate(start.getDate() - offset);

    end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 7
    );

    label = "Minggu Ini";
  } else if (period === "month") {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );

    label = "Bulan Ini";
  } else {
    start = parseLocalDate(selectedDate);

    end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 1
    );

    label = "Tanggal Pilihan";
  }

  return { start, end, label };
}

// =====================================
// NILAI AWAL LAPORAN
// =====================================

const initialReport: SalesReport = {
  totalSales: 0,
  totalOrders: 0,
  totalItems: 0,
  averageOrder: 0,
};

// =====================================
// HALAMAN LAPORAN
// =====================================

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>("today");

  const [dateInput, setDateInput] = useState(
    formatDate(new Date())
  );

  const [report, setReport] =
    useState<SalesReport>(initialReport);

  const [topProducts, setTopProducts] =
    useState<TopProduct[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);

  const [periodLabel, setPeriodLabel] = useState("");
  const [dateRangeLabel, setDateRangeLabel] =
    useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================
  // MEMUAT DATA LAPORAN
  // =====================================

  const loadReport = useCallback(
    (selectedPeriod: Period, selectedDate: string) => {
      setLoading(true);
      setError("");

      try {
        initDatabase();

        const { start, end, label } = getDateRange(
          selectedPeriod,
          selectedDate
        );

        const salesData = getSalesReport(start, end);
        const ordersData = getOrdersByPeriod(start, end);
        const topData = getTopProducts(start, end);

        setReport(salesData);
        setOrders(ordersData);
        setTopProducts(topData);

        setPeriodLabel(label);

        // Tanggal akhir eksklusif
        const lastDay = new Date(end.getTime() - 1);

        setDateRangeLabel(
          `${formatDate(start)} s.d. ${formatDate(lastDay)}`
        );
      } catch (err) {
        // Jangan menampilkan console.error
        // untuk kesalahan format input pengguna.
        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengambil laporan.";

        setError(message);

        setReport(initialReport);
        setOrders([]);
        setTopProducts([]);

        console.log("Informasi laporan:", message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================
  // REFRESH OTOMATIS
  // =====================================

  // Hari Ini, Mingguan, Bulanan:
  // otomatis dimuat ketika tab dibuka.
  //
  // Pilih Tanggal:
  // hanya dimuat saat tombol Tampilkan
  // Laporan ditekan.

  useFocusEffect(
    useCallback(() => {
      if (period !== "date") {
        loadReport(period, dateInput);
      }
    }, [loadReport, period])
  );

  // =====================================
  // GANTI PERIODE
  // =====================================

  function selectPeriod(value: Period) {
    setError("");

    if (value === "date") {
      // Tampilkan form tanpa mencoba
      // memvalidasi tanggal saat diketik.
      setPeriod(value);
      return;
    }

    setPeriod(value);
  }

  // =====================================
  // TAMPILAN HALAMAN LAPORAN
  // =====================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <Text style={styles.title}>
        📈 Laporan Penjualan
      </Text>

      <Text style={styles.subtitle}>
        Analisis transaksi CoffeePOS
      </Text>

      {/* FILTER PERIODE */}
      <Text style={styles.heading}>
        Pilih Periode
      </Text>

      <View style={styles.filters}>
        {[
          { value: "today", label: "Hari Ini" },
          { value: "week", label: "Mingguan" },
          { value: "month", label: "Bulanan" },
          { value: "date", label: "Pilih Tanggal" },
        ].map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.filterButton,
              period === item.value &&
                styles.filterButtonActive,
            ]}
            onPress={() =>
              selectPeriod(item.value as Period)
            }
          >
            <Text
              style={[
                styles.filterText,
                period === item.value &&
                  styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* INPUT TANGGAL KHUSUS */}
      {period === "date" && (
        <View style={styles.dateCard}>
          <Text style={styles.label}>
            Tanggal Laporan (YYYY-MM-DD)
          </Text>

          <TextInput
            style={styles.input}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="2026-10-20"
            placeholderTextColor="#999999"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
          />

          <Text style={styles.muted}>
            Contoh: 2026-10-20
          </Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              loadReport("date", dateInput)
            }
          >
            <Text style={styles.actionText}>
              Tampilkan Laporan
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PERIODE AKTIF */}
      <View style={styles.periodCard}>
        <Text style={styles.periodTitle}>
          {periodLabel || "Laporan Penjualan"}
        </Text>

        <Text style={styles.muted}>
          {dateRangeLabel || "Pilih periode laporan"}
        </Text>
      </View>

      {/* LOADING */}
      {loading && (
        <Text style={styles.muted}>
          Memuat laporan...
        </Text>
      )}

      {/* ERROR */}
      {error !== "" && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {/* HASIL LAPORAN */}
      {!loading && error === "" && (
        <>
          {/* RINGKASAN PENJUALAN */}
          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={styles.statLabel}>
                Omzet
              </Text>
              <Text
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {rupiah(report.totalSales)}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🧾</Text>
              <Text style={styles.statLabel}>
                Transaksi
              </Text>
              <Text style={styles.statValue}>
                {report.totalOrders}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={styles.statLabel}>
                Rata-rata Order
              </Text>
              <Text
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {rupiah(report.averageOrder)}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>☕</Text>
              <Text style={styles.statLabel}>
                Produk Terjual
              </Text>
              <Text style={styles.statValue}>
                {report.totalItems}
              </Text>
            </View>
          </View>

          {/* PRODUK TERLARIS */}
          <Text style={styles.heading}>
            🏆 Produk Terlaris
          </Text>

          <View style={styles.card}>
            {topProducts.length === 0 && (
              <Text style={styles.muted}>
                Belum ada produk terjual
                pada periode ini.
              </Text>
            )}

            {topProducts.map((item, index) => {
              const maxQty =
                topProducts[0]?.quantity_sold ?? 1;

              const percent =
                maxQty > 0
                  ? (item.quantity_sold / maxQty) * 100
                  : 0;

              return (
                <View
                  key={`${item.product_id}-${item.product_name}`}
                  style={styles.topItem}
                >
                  <View style={styles.topRow}>
                    <Text style={styles.productName}>
                      {index + 1}. {item.product_name}
                    </Text>

                    <Text style={styles.qty}>
                      {item.quantity_sold} terjual
                    </Text>
                  </View>

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${percent}%` },
                      ]}
                    />
                  </View>

                  <Text style={styles.muted}>
                    {rupiah(item.total_sales)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* DAFTAR TRANSAKSI */}
          <Text style={styles.heading}>
            🧾 Transaksi Periode Ini ({orders.length})
          </Text>

          {orders.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>
                Belum ada transaksi pada periode ini.
              </Text>
            </View>
          )}

          {orders.map((order) => (
            <View
              key={order.id}
              style={styles.orderCard}
            >
              <View style={styles.topRow}>
                <Text style={styles.productName}>
                  {order.order_number}
                </Text>

                <Text style={styles.orderTotal}>
                  {rupiah(order.total)}
                </Text>
              </View>

              <Text style={styles.muted}>
                {order.created_at} UTC
              </Text>

              <Text style={styles.muted}>
                Metode: Tunai · Status: Lunas
              </Text>
            </View>
          ))}

          {/* REFRESH LAPORAN */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() =>
              loadReport(period, dateInput)
            }
          >
            <Text style={styles.refreshText}>
              🔄 Refresh Laporan
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Laporan berasal dari SQLite perangkat.
            Omzet belum dikurangi HPP, biaya
            operasional, dan refund.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// =====================================
// STYLE LAPORAN COFFEEPOS
// =====================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0",
  },

  content: {
    padding: 18,
    paddingBottom: 70,
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
    marginTop: 14,
    marginBottom: 13,
  },

  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },

  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#DADADA",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },

  filterButtonActive: {
    backgroundColor: "#385D4A",
    borderColor: "#385D4A",
  },

  filterText: {
    color: "#385D4A",
    fontSize: 12,
    fontWeight: "600",
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  dateCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },

  label: {
    fontWeight: "bold",
    marginBottom: 9,
    color: "#2B2925",
  },

  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    padding: 13,
    fontSize: 16,
    color: "#2B2925",
  },

  muted: {
    color: "#888888",
    fontSize: 12,
    marginTop: 6,
  },

  actionButton: {
    backgroundColor: "#385D4A",
    padding: 14,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 15,
  },

  actionText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  periodCard: {
    backgroundColor: "#E8EEE9",
    borderRadius: 11,
    padding: 15,
    marginBottom: 16,
  },

  periodTitle: {
    fontWeight: "bold",
    color: "#385D4A",
    fontSize: 15,
  },

  errorCard: {
    backgroundColor: "#FCEAEA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  errorText: {
    color: "#C0392B",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statCard: {
    width: "48%",
    minHeight: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },

  statIcon: {
    fontSize: 25,
    marginBottom: 10,
  },

  statLabel: {
    color: "#777777",
    fontSize: 12,
  },

  statValue: {
    color: "#385D4A",
    fontWeight: "bold",
    fontSize: 19,
    marginTop: 9,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 17,
    marginBottom: 15,
  },

  topItem: {
    marginBottom: 17,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  productName: {
    color: "#2B2925",
    fontWeight: "bold",
    fontSize: 13,
    flexShrink: 1,
  },

  qty: {
    color: "#385D4A",
    fontSize: 12,
    fontWeight: "600",
  },

  barTrack: {
    height: 9,
    backgroundColor: "#E8EEE9",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 9,
  },

  barFill: {
    height: "100%",
    backgroundColor: "#385D4A",
    borderRadius: 10,
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 9,
  },

  orderTotal: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  refreshButton: {
    borderWidth: 1,
    borderColor: "#385D4A",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  refreshText: {
    color: "#385D4A",
    fontWeight: "bold",
  },

  footer: {
    color: "#999999",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 22,
  },
});
