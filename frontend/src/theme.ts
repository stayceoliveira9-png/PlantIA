// Design tokens for PlantIA. Light theme only.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#F8F9F8",
  onSurface: "#1A1D1A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1A1D1A",
  surfaceTertiary: "#EAECEA",
  onSurfaceTertiary: "#2E4F2E",
  surfaceInverse: "#2E4F2E",
  onSurfaceInverse: "#FFFFFF",
  muted: "#7A857A",

  // Brand
  brand: "#2E4F2E",
  onBrand: "#FFFFFF",
  brandPrimary: "#2E4F2E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#4A734A",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E8EFE8",
  onBrandTertiary: "#2E4F2E",

  // Status
  success: "#458B47",
  onSuccess: "#FFFFFF",
  warning: "#D4A352",
  onWarning: "#FFFFFF",
  error: "#D9534F",
  onError: "#FFFFFF",
  info: "#6B8E6B",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E1E5E1",
  borderStrong: "#B8C4B8",
  divider: "#EAECEA",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;
