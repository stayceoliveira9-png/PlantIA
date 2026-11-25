import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const FEATURED = [
  {
    key: "horta",
    title: "Comece sua horta em casa",
    subtitle: "Guia de hortaliças passo a passo",
    uri: "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHx2ZWdldGFibGUlMjBnYXJkZW4lMjBwbGFudGluZyUyMG1vZGVybnxlbnwwfHx8fDE3OTM3OTIyMDF8MA&ixlib=rb-4.1.0&q=85",
    name: "Horta urbana",
    mode: "horta" as const,
  },
  {
    key: "manjericao",
    title: "Manjericão",
    subtitle: "Aromática perfeita para iniciantes",
    uri: "https://images.unsplash.com/photo-1600231915711-e4b5d6f3aef9?w=1200",
    name: "Manjericão",
    mode: "plant" as const,
  },
  {
    key: "alface",
    title: "Alface",
    subtitle: "Colha em 45 dias",
    uri: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=1200",
    name: "Alface crespa",
    mode: "horta" as const,
  },
];

export default function Guides() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const guidesQ = useQuery({ queryKey: ["guides"], queryFn: api.listGuides });
  const guides = (guidesQ.data as any[]) || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="guides-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Guias</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/guide/new")}
          testID="new-guide-btn"
        >
          <Icon name="plus" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.addBtnText}>Novo guia</Text>
        </Pressable>
      </View>

      <FlatList
        data={guides}
        keyExtractor={(g: any) => g.guide_id}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.lg }}>
            <Text style={styles.sectionTitle}>Em destaque</Text>
            {FEATURED.map((f) => (
              <Pressable
                key={f.key}
                style={styles.featuredCard}
                onPress={() => router.push({ pathname: "/guide/new", params: { prefill: f.name, mode: f.mode } })}
                testID={`featured-${f.key}`}
              >
                <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(26,29,26,0.85)"]} style={StyleSheet.absoluteFill as any} />
                <View style={styles.featuredText}>
                  <Text style={styles.featuredTitle}>{f.title}</Text>
                  <Text style={styles.featuredSub}>{f.subtitle}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Seus guias</Text>
            {guidesQ.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
            {!guidesQ.isLoading && guides.length === 0 ? (
              <Text style={styles.muted}>Nenhum guia ainda. Toque em &quot;Novo guia&quot; para gerar um com IA.</Text>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.guideRow}
            onPress={() =>
              router.push({
                pathname: "/guide/new",
                params: { guide_id: item.guide_id, view: "1" },
              })
            }
            testID={`guide-${item.guide_id}`}
          >
            <Icon name={item.mode === "horta" ? "sprout-outline" : "leaf"} size={24} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>{item.content?.titulo || item.plant_name}</Text>
              <Text style={styles.guideSub} numberOfLines={1}>
                {item.content?.resumo || (item.mode === "horta" ? "Guia de horta" : "Guia de cultivo")}
              </Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        )}
      />
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
  title: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "700" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addBtnText: { color: colors.onBrandPrimary, fontWeight: "600", fontSize: fontSize.base },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  featuredCard: { height: 160, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end", backgroundColor: colors.surfaceTertiary },
  featuredText: { padding: spacing.md, gap: 4 },
  featuredTitle: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "700" },
  featuredSub: { color: "#E5E7EB", fontSize: fontSize.base },
  muted: { color: colors.muted, fontSize: fontSize.base },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    gap: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  guideTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  guideSub: { color: colors.muted, fontSize: fontSize.sm, marginTop: 2 },
});
