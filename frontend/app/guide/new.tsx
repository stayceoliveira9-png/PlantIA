import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

type Mode = "plant" | "horta";

export default function GuideNew() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ prefill?: string; mode?: string; guide_id?: string; view?: string }>();

  const [name, setName] = useState((params.prefill as string) || "");
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || "plant");
  const [content, setContent] = useState<any | null>(null);

  const existingQ = useQuery({
    queryKey: ["guides"],
    queryFn: api.listGuides,
    enabled: !!params.guide_id,
  });
  const existingGuide: any =
    params.guide_id && existingQ.data ? (existingQ.data as any[]).find((g: any) => g.guide_id === params.guide_id) : null;

  const activeContent = content || existingGuide?.content;
  const activeTitle = name || existingGuide?.plant_name;

  const gen = useMutation({
    mutationFn: () => api.generateGuide(name.trim(), mode),
    onSuccess: (g: any) => {
      setContent(g.content);
      qc.invalidateQueries({ queryKey: ["guides"] });
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="close-guide">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{existingGuide ? "Guia" : "Novo guia"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}>
        {!existingGuide ? (
          <>
            <Text style={styles.label}>O que você quer plantar?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Tomate cereja"
              placeholderTextColor={colors.muted}
              style={styles.input}
              testID="guide-name-input"
            />

            <View style={styles.segment}>
              <Pressable
                onPress={() => setMode("plant")}
                style={[styles.segmentBtn, mode === "plant" && styles.segmentActive]}
                testID="guide-mode-plant"
              >
                <Text style={[styles.segmentText, mode === "plant" && styles.segmentTextActive]}>Planta</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("horta")}
                style={[styles.segmentBtn, mode === "horta" && styles.segmentActive]}
                testID="guide-mode-horta"
              >
                <Text style={[styles.segmentText, mode === "horta" && styles.segmentTextActive]}>Horta</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.primaryBtn, (!name.trim() || gen.isPending) && { opacity: 0.6 }]}
              disabled={!name.trim() || gen.isPending}
              onPress={() => gen.mutate()}
              testID="generate-btn"
            >
              {gen.isPending ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <Icon name="auto-fix" size={20} color={colors.onBrandPrimary} />
                  <Text style={styles.primaryText}>Gerar guia com IA</Text>
                </>
              )}
            </Pressable>
          </>
        ) : null}

        {activeContent ? (
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {activeContent.titulo ? <Text style={styles.heroTitle}>{activeContent.titulo}</Text> : <Text style={styles.heroTitle}>{activeTitle}</Text>}
            {activeContent.resumo ? <Text style={styles.resumo}>{activeContent.resumo}</Text> : null}

            {Array.isArray(activeContent.materiais) && activeContent.materiais.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>O que você precisa</Text>
                {activeContent.materiais.map((m: string, i: number) => (
                  <View key={i} style={styles.bulletRow}>
                    <Icon name="check-circle" size={16} color={colors.brandPrimary} />
                    <Text style={styles.bulletText}>{m}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {Array.isArray(activeContent.passos) && activeContent.passos.length ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.cardTitle}>Passo a passo</Text>
                {activeContent.passos.map((p: any, i: number) => (
                  <View key={i} style={styles.stepCard}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{p.titulo}</Text>
                      <Text style={styles.stepText}>{p.descricao}</Text>
                      {p.dica ? (
                        <View style={styles.tipBox}>
                          <Icon name="lightbulb-on-outline" size={14} color={colors.warning} />
                          <Text style={styles.tipText}>{p.dica}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.row2}>
              {activeContent.rega ? (
                <View style={[styles.miniCard, { flex: 1 }]}>
                  <Icon name="water" size={20} color={colors.brandPrimary} />
                  <Text style={styles.miniTitle}>Rega</Text>
                  <Text style={styles.miniText}>{activeContent.rega}</Text>
                </View>
              ) : null}
              {activeContent.adubo ? (
                <View style={[styles.miniCard, { flex: 1 }]}>
                  <Icon name="flower-tulip" size={20} color={colors.brandPrimary} />
                  <Text style={styles.miniTitle}>Adubo</Text>
                  <Text style={styles.miniText}>{activeContent.adubo}</Text>
                </View>
              ) : null}
            </View>

            {activeContent.luz ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Luz</Text>
                <Text style={styles.cardText}>{activeContent.luz}</Text>
              </View>
            ) : null}
            {activeContent.colheita ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Colheita</Text>
                <Text style={styles.cardText}>{activeContent.colheita}</Text>
              </View>
            ) : null}

            {Array.isArray(activeContent.dicas_extras) && activeContent.dicas_extras.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dicas extras</Text>
                {activeContent.dicas_extras.map((d: string, i: number) => (
                  <View key={i} style={styles.bulletRow}>
                    <Icon name="star-four-points" size={16} color={colors.warning} />
                    <Text style={styles.bulletText}>{d}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  label: { color: colors.muted, fontSize: fontSize.sm, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: fontSize.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurface, fontWeight: "600", fontSize: fontSize.base },
  segmentTextActive: { color: colors.onBrandPrimary },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: fontSize.lg },
  heroTitle: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "800" },
  resumo: { color: colors.muted, fontSize: fontSize.base, lineHeight: 20 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: 6, borderWidth: 0.5, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.xs },
  cardText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  bulletText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  stepCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  stepNum: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.onBrandPrimary, fontWeight: "700" },
  stepTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  stepText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20, marginTop: 2 },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.brandTertiary,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  tipText: { color: colors.onBrandTertiary, fontSize: fontSize.sm, flex: 1 },
  row2: { flexDirection: "row", gap: spacing.sm },
  miniCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: 4, borderWidth: 0.5, borderColor: colors.border },
  miniTitle: { color: colors.onSurface, fontWeight: "700", fontSize: fontSize.base, marginTop: 4 },
  miniText: { color: colors.muted, fontSize: fontSize.sm },
});
