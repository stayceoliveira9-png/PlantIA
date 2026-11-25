import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api, fileUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, fontSize, radius, spacing } from "@/src/theme";

function daysUntil(iso?: string): number {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const plantsQ = useQuery({ queryKey: ["plants"], queryFn: api.listPlants });

  const plants = (plantsQ.data as any[]) || [];
  const upcoming = [...plants].sort((a, b) =>
    new Date(a.next_water_at).getTime() - new Date(b.next_water_at).getTime(),
  );
  const todayCount = upcoming.filter((p) => daysUntil(p.next_water_at) <= 0).length;

  const quickWater = async (id: string) => {
    await api.waterPlant(id);
    qc.invalidateQueries({ queryKey: ["plants"] });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="home-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Olá, {user?.name?.split(" ")[0] || "Jardineiro"} 🌿</Text>
          <Text style={styles.sub}>
            {todayCount > 0 ? `${todayCount} planta(s) precisam de água hoje` : "Tudo regado por hoje"}
          </Text>
        </View>
        <Pressable onPress={signOut} testID="signout-btn" style={styles.iconBtn}>
          <Icon name="logout" size={20} color={colors.onSurface} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl }} showsVerticalScrollIndicator={false}>
        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionCard} onPress={() => router.push("/(tabs)/identify")} testID="action-identify">
            <Icon name="camera-iris" size={28} color={colors.brandPrimary} />
            <Text style={styles.actionTitle}>Identificar</Text>
            <Text style={styles.actionSub}>Planta por foto</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => router.push("/(tabs)/guides")} testID="action-guide">
            <Icon name="book-open-variant" size={28} color={colors.brandPrimary} />
            <Text style={styles.actionTitle}>Guia</Text>
            <Text style={styles.actionSub}>Como plantar</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Próximas regas</Text>
        {plantsQ.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : upcoming.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="flower-tulip-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>Nenhuma planta cadastrada ainda.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/(tabs)/plants")}>
              <Text style={styles.emptyBtnText}>Adicionar planta</Text>
            </Pressable>
          </View>
        ) : (
          upcoming.slice(0, 6).map((p) => {
            const d = daysUntil(p.next_water_at);
            const label = d <= 0 ? "Hoje" : d === 1 ? "Amanhã" : `Em ${d} dias`;
            return (
              <Pressable
                key={p.plant_id}
                style={styles.plantRow}
                onPress={() => router.push(`/plant/${p.plant_id}`)}
                testID={`home-plant-${p.plant_id}`}
              >
                {p.photo_path ? (
                  <Image source={{ uri: fileUrl(p.photo_path) }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Icon name="sprout" size={22} color={colors.brandPrimary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.plantName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.plantMeta}>
                    {label} · {p.water_amount_ml} ml
                  </Text>
                </View>
                <Pressable
                  style={styles.waterBtn}
                  onPress={() => quickWater(p.plant_id)}
                  testID={`quick-water-${p.plant_id}`}
                >
                  <Icon name="water" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hello: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: fontSize.base, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  actionTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginTop: spacing.sm },
  actionSub: { color: colors.muted, fontSize: fontSize.sm },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.md },
  empty: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  emptyText: { color: colors.muted, fontSize: fontSize.base, textAlign: "center" },
  emptyBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10, marginTop: spacing.sm },
  emptyBtnText: { color: colors.onBrandPrimary, fontWeight: "600" },
  plantRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  thumb: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  plantName: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  plantMeta: { color: colors.muted, fontSize: fontSize.sm, marginTop: 2 },
  waterBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
