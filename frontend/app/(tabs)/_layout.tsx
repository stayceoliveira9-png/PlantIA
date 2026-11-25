import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { colors, fontSize } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Icon name="home-variant" size={size} color={color} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="identify"
        options={{
          title: "Identificar",
          tabBarIcon: ({ color, size }) => <Icon name="camera-iris" size={size} color={color} />,
          tabBarButtonTestID: "tab-identify",
        }}
      />
      <Tabs.Screen
        name="plants"
        options={{
          title: "Plantas",
          tabBarIcon: ({ color, size }) => <Icon name="sprout" size={size} color={color} />,
          tabBarButtonTestID: "tab-plants",
        }}
      />
      <Tabs.Screen
        name="guides"
        options={{
          title: "Guias",
          tabBarIcon: ({ color, size }) => <Icon name="book-open-variant" size={size} color={color} />,
          tabBarButtonTestID: "tab-guides",
        }}
      />
    </Tabs>
  );
}
