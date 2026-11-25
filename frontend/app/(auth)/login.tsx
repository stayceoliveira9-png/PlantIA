import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";

import { useAuth } from "@/src/auth";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]} testID="login-screen">
      <View style={styles.heroWrap}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1525498128493-380d1990a112?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwaG91c2VwbGFudCUyMG1vbnN0ZXJhJTIwaXNvbGF0ZWR8ZW58MHx8fHwxNzkzNzkyMjAxfDA&ixlib=rb-4.1.0&q=85",
          }}
          style={styles.hero}
          contentFit="cover"
          transition={300}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.brand}>PlantIA</Text>
        <Text style={styles.title}>Identifique, cuide e cultive com inteligência.</Text>
        <Text style={styles.subtitle}>
          Diagnóstico por foto, lembretes de rega e guias passo a passo para suas plantas e horta.
        </Text>
      </View>
      <Pressable testID="google-signin-button" onPress={signIn} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}>
        <Icon name="google" size={20} color={colors.onBrandPrimary} />
        <Text style={styles.googleText}>Entrar com Google</Text>
      </Pressable>
      <Text style={styles.foot}>Ao continuar você concorda com os termos de uso.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  heroWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginVertical: spacing.xl,
    backgroundColor: colors.surfaceTertiary,
  },
  hero: { width: "100%", height: "100%" },
  body: { gap: spacing.sm, marginBottom: spacing.xl },
  brand: { color: colors.brandPrimary, fontSize: fontSize.xxxl, fontWeight: "700", letterSpacing: -0.5 },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: "600", lineHeight: 28 },
  subtitle: { color: colors.muted, fontSize: fontSize.lg, lineHeight: 22 },
  googleBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  googleText: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: "600" },
  foot: { textAlign: "center", color: colors.muted, fontSize: fontSize.sm, marginTop: spacing.md },
});
