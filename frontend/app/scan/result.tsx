import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api, fileUrl } from "@/src/api";
import { scheduleWateringReminder } from "@/src/notifications";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function ScanResult() {
  const params = useLocalSearchParams<{ mode: string; result: string; photo_path: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const mode = params.mode;
  const photoPath = params.photo_path;
  let result: any = {};
  try {
    result = JSON.parse(params.result || "{}");
  } catch {}

  const [saveName, setSaveName] = useState(result?.nome_popular || "");
  const [saving, setSaving] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const plant = await api.createPlant({
        name: saveName.trim() || "Nova planta",
        species: result?.nome_cientifico,
        water_interval_days: 7,
        water_amount_ml: 200,
        photo_path: photoPath,
      });
      await scheduleWateringReminder(plant.plant_id, plant.name, plant.water_amount_ml, new Date(plant.next_water_at));
      return plant;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plants"] });
      router.replace("/(tabs)/plants");
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="close-result">
            <Icon name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>{mode === "identify" ? "Identificação" : "Diagnóstico"}</Text>
          <View style={{ width: 24 }} />
        </View>

        {photoPath ? (
          <Image source={{ uri: fileUrl(photoPath) }} style={styles.photo} contentFit="cover" />
        ) : null}

        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {mode === "identify" ? (
            <>
              <Text style={styles.plantName} testID="result-name">{result?.nome_popular || "Planta desconhecida"}</Text>
              {result?.nome_cientifico ? <Text style={styles.sciName}>{result.nome_cientifico}</Text> : null}
              {typeof result?.confianca === "number" ? (
                <View style={styles.confBadge}>
                  <Icon name="check-decagram" size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.confText}>Confiança: {Math.round((result.confianca || 0) * 100)}%</Text>
                </View>
              ) : null}
              {result?.descricao ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sobre</Text>
                  <Text style={styles.cardText}>{result.descricao}</Text>
                </View>
              ) : null}
              {Array.isArray(result?.cuidados_rapidos) && result.cuidados_rapidos.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Cuidados rápidos</Text>
                  {result.cuidados_rapidos.map((c: string, i: number) => (
                    <View key={i} style={styles.bulletRow}>
                      <Icon name="leaf" size={16} color={colors.brandPrimary} />
                      <Text style={styles.bulletText}>{c}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.saveRow}>
                <Text style={styles.label}>Salvar como:</Text>
                <TextInput
                  value={saveName}
                  onChangeText={setSaveName}
                  placeholder="Nome da planta"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  testID="save-name-input"
                />
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => save.mutate()}
                  disabled={save.isPending}
                  testID="save-scan-btn"
                >
                  {save.isPending ? (
                    <ActivityIndicator color={colors.onBrandPrimary} />
                  ) : (
                    <>
                      <Icon name="plus" size={18} color={colors.onBrandPrimary} />
                      <Text style={styles.primaryText}>Adicionar às minhas plantas</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.statusBadge, styleForStatus(result?.estado_geral)]}>
                <Icon name={iconForStatus(result?.estado_geral)} size={18} color="#FFFFFF" />
                <Text style={styles.statusText}>{labelForStatus(result?.estado_geral)}</Text>
              </View>
              {result?.diagnostico ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Diagnóstico</Text>
                  <Text style={styles.cardText}>{result.diagnostico}</Text>
                </View>
              ) : null}
              {Array.isArray(result?.problemas) && result.problemas.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Problemas detectados</Text>
                  {result.problemas.map((p: any, i: number) => (
                    <View key={i} style={styles.bulletRow}>
                      <Icon name="alert-circle-outline" size={16} color={colors.warning} />
                      <Text style={styles.bulletText}>
                        <Text style={{ fontWeight: "700" }}>{p.tipo}</Text> — {p.descricao}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {Array.isArray(result?.recomendacoes) && result.recomendacoes.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Recomendações</Text>
                  {result.recomendacoes.map((r: any, i: number) => (
                    <View key={i} style={styles.bulletRow}>
                      <Icon name="check" size={16} color={colors.success} />
                      <Text style={styles.bulletText}>
                        <Text style={{ fontWeight: "700" }}>{r.acao}</Text> — {r.detalhe}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.row2}>
                {result?.agua ? (
                  <View style={[styles.miniCard, { flex: 1 }]}>
                    <Icon name="water" size={20} color={colors.brandPrimary} />
                    <Text style={styles.miniTitle}>Água</Text>
                    <Text style={styles.miniText}>{result.agua}</Text>
                  </View>
                ) : null}
                {result?.adubo ? (
                  <View style={[styles.miniCard, { flex: 1 }]}>
                    <Icon name="flower-tulip" size={20} color={colors.brandPrimary} />
                    <Text style={styles.miniTitle}>Adubo</Text>
                    <Text style={styles.miniText}>{result.adubo}</Text>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function iconForStatus(s?: string) {
  if (s === "saudavel") return "check-circle";
  if (s === "critico") return "alert-circle";
  return "alert";
}
function labelForStatus(s?: string) {
  if (s === "saudavel") return "Saudável";
  if (s === "critico") return "Estado crítico";
  if (s === "atencao") return "Precisa de atenção";
  return "Diagnóstico";
}
function styleForStatus(s?: string) {
  if (s === "saudavel") return { backgroundColor: colors.success };
  if (s === "critico") return { backgroundColor: colors.error };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  headerTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  photo: { width: "100%", height: 240, backgroundColor: colors.surfaceTertiary },
  plantName: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "800" },
  sciName: { color: colors.muted, fontSize: fontSize.base, fontStyle: "italic" },
  confBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  confText: { color: colors.onBrandPrimary, fontWeight: "600" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: 6, borderWidth: 0.5, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  cardText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  bulletText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  saveRow: { gap: spacing.sm, marginTop: spacing.md },
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
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: fontSize.lg },
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  statusText: { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
  row2: { flexDirection: "row", gap: spacing.sm },
  miniCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: 4, borderWidth: 0.5, borderColor: colors.border },
  miniTitle: { color: colors.onSurface, fontWeight: "700", fontSize: fontSize.base, marginTop: 4 },
  miniText: { color: colors.muted, fontSize: fontSize.sm },
});
