
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { initDatabase } from "../database/db";

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#385D4A",
        tabBarInactiveTintColor: "#999999",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          height: 70,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 9,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Kasir",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>🛒</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📊</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Pesanan",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📋</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Produk",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📦</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Laporan",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📈</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>🫘</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
