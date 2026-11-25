import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api, fileUrl } from "@/src/api";
import { cancelPlantReminder, scheduleWateringReminder } from "@/src/notifications";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["plant", id], queryFn: () => api.getPlant(id!), enabled: !!id });
  const p: any = q.data;

  const water = useMutation({
    mutationFn: () => api.waterPlant(id!),
    onSuccess: async (plant: any) => {
      qc.invalidateQueries({ queryKey: ["plants"] });
      qc.invalidateQueries({ queryKey: ["plant", id] });
      await scheduleWateringReminder(plant.plant_id, plant.name, plant.water_amount_ml, new Date(plant.next_water_at));
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      await cancelPlantReminder(id!);
      return api.deletePlant(id!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plants"] });
      router.back();
    },
  });

  if (q.isLoading || !p) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const next = new Date(p.next_water_at);
  const dLeft = Math.ceil((next.getTime() - Date.now()) / 86400000);
  const nextLabel = dLeft <= 0 ? "Regar hoje" : dLeft === 1 ? "Amanhã" : `Em ${dLeft} dias`;

  return (
    <View style={styles.container} testID="plant-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl + insets.bottom }}>
        <View style={styles.heroWrap}>
          {p.photo_path ? (
            <Image source={{ uri: fileUrl(p.photo_path) }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
              <Icon name="sprout" size={64} color={colors.brandPrimary} />
            </View>
          )}
          <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "rgba(26,29,26,0.85)"]} style={StyleSheet.absoluteFill as any} />
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + spacing.sm }]}
            testID="back-btn"
          >
            <Icon name="chevron-left" size={28} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{p.name}</Text>
            {p.species ? <Text style={styles.heroSpecies}>{p.species}</Text> : null}
          </View>
        </View>

        <View style={styles.cardsWrap}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Icon name="water" size={22} color={colors.brandPrimary} />
              <Text style={styles.statValue}>{p.water_amount_ml} ml</Text>
              <Text style={styles.statLabel}>por rega</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="calendar-clock" size={22} color={colors.brandPrimary} />
              <Text style={styles.statValue}>{p.water_interval_days}d</Text>
              <Text style={styles.statLabel}>intervalo</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="alarm" size={22} color={colors.brandPrimary} />
              <Text style={styles.statValue}>{nextLabel}</Text>
              <Text style={styles.statLabel}>próxima</Text>
            </View>
          </View>

          <Pressable
            style={styles.waterBtn}
            onPress={() => water.mutate()}
            disabled={water.isPending}
            testID="water-now-btn"
          >
            {water.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Icon name="water" size={22} color={colors.onBrandPrimary} />
                <Text style={styles.waterText}>Reguei agora</Text>
              </>
            )}
          </Pressable>

          {p.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.cardTitle}>Notas</Text>
              <Text style={styles.cardText}>{p.notes}</Text>
            </View>
          ) : null}

          <View style={styles.notesCard}>
            <Text style={styles.cardTitle}>Lembrete</Text>
            <Text style={styles.cardText}>
              Você receberá uma notificação em {nextLabel.toLowerCase()} para regar com {p.water_amount_ml} ml.
            </Text>
          </View>

          <Pressable style={styles.deleteBtn} onPress={() => del.mutate()} testID="delete-plant-btn">
            <Icon name="trash-can-outline" size={20} color={colors.error} />
            <Text style={styles.deleteText}>Excluir planta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  heroWrap: { height: 320, width: "100%", position: "relative", backgroundColor: colors.surfaceTertiary },
  hero: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute",
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  heroName: { color: "#FFFFFF", fontSize: fontSize.xxxl, fontWeight: "800" },
  heroSpecies: { color: "#E5E7EB", fontSize: fontSize.lg, marginTop: 4 },
  cardsWrap: { padding: spacing.xl, gap: spacing.md },
  statRow: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  statValue: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700", marginTop: 4 },
  statLabel: { color: colors.muted, fontSize: fontSize.sm, marginTop: 2 },
  waterBtn: {
    flexDirection: "row",
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  waterText: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: "700" },
  notesCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700", marginBottom: 6 },
  cardText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  deleteText: { color: colors.error, fontSize: fontSize.base, fontWeight: "600" },
});
