import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

type Mode = "identify" | "diagnose";

export default function Identify() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("identify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndScan(source: "camera" | "gallery") {
    setError(null);
    let result;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Permissão de câmera negada");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"] as any,
        quality: 0.8,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Permissão de galeria negada");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.8,
      });
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      setLoading(true);
      // compress/resize
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      const uri = manipulated.uri;
      const resp = mode === "identify" ? await api.scanIdentify(uri, "image/jpeg") : await api.scanDiagnose(uri, "image/jpeg");
      router.push({
        pathname: "/scan/result",
        params: {
          mode,
          result: JSON.stringify(resp.result),
          photo_path: resp.photo_path,
        },
      });
    } catch (e: any) {
      setError(e?.message || "Erro ao processar a foto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="identify-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Scanner de Plantas</Text>
        <Text style={styles.subtitle}>Use IA para identificar ou diagnosticar uma planta pela foto.</Text>
      </View>

      <View style={styles.segment}>
        <Pressable
          onPress={() => setMode("identify")}
          style={[styles.segmentBtn, mode === "identify" && styles.segmentActive]}
          testID="mode-identify"
        >
          <Icon name="leaf" size={18} color={mode === "identify" ? colors.onBrandPrimary : colors.onSurface} />
          <Text style={[styles.segmentText, mode === "identify" && styles.segmentTextActive]}>Identificar</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("diagnose")}
          style={[styles.segmentBtn, mode === "diagnose" && styles.segmentActive]}
          testID="mode-diagnose"
        >
          <Icon name="stethoscope" size={18} color={mode === "diagnose" ? colors.onBrandPrimary : colors.onSurface} />
          <Text style={[styles.segmentText, mode === "diagnose" && styles.segmentTextActive]}>Diagnóstico</Text>
        </Pressable>
      </View>

      <View style={styles.hint}>
        <Icon name="information-outline" size={18} color={colors.brandPrimary} />
        <Text style={styles.hintText}>
          {mode === "identify"
            ? "Tire uma foto nítida da planta para descobrir qual é."
            : "Foque nas folhas para ver o que a planta precisa (água, adubo, luz...)."}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      <View style={[styles.ctas, { marginBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          onPress={() => pickAndScan("gallery")}
          style={styles.secondaryBtn}
          disabled={loading}
          testID="gallery-btn"
        >
          <Icon name="image-multiple-outline" size={22} color={colors.brandPrimary} />
          <Text style={styles.secondaryText}>Galeria</Text>
        </Pressable>
        <Pressable
          onPress={() => pickAndScan("camera")}
          style={styles.primaryBtn}
          disabled={loading}
          testID="camera-btn"
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="camera" size={22} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>Tirar foto</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  header: { paddingVertical: spacing.lg, gap: 6 },
  title: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: fontSize.base, lineHeight: 20 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurface, fontWeight: "600", fontSize: fontSize.base },
  segmentTextActive: { color: colors.onBrandPrimary },
  hint: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    alignItems: "flex-start",
  },
  hintText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.base, lineHeight: 20 },
  errorBox: { backgroundColor: "#FDECEC", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  errorText: { color: colors.error, fontSize: fontSize.base },
  ctas: { flexDirection: "row", gap: spacing.md },
  primaryBtn: {
    flex: 2,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: fontSize.lg },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.brandPrimary, fontWeight: "700", fontSize: fontSize.lg },
});
