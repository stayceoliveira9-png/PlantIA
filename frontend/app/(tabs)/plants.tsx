import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import Icon from "@react-native-vector-icons/material-design-icons";

import { api, fileUrl } from "@/src/api";
import { scheduleWateringReminder } from "@/src/notifications";
import { colors, fontSize, radius, spacing } from "@/src/theme";

function daysUntil(iso?: string): number {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function PlantsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const plantsQ = useQuery({ queryKey: ["plants"], queryFn: api.listPlants });
  const plants = (plantsQ.data as any[]) || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="plants-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Plantas</Text>
        <Pressable style={styles.addBtn} onPress={() => setAdding(true)} testID="add-plant-btn">
          <Icon name="plus" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
      {plantsQ.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : plants.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="flower-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Nenhuma planta cadastrada</Text>
          <Text style={styles.emptyText}>Toque em + para cadastrar sua primeira planta e receba lembretes de rega.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => setAdding(true)}>
            <Text style={styles.emptyBtnText}>Adicionar planta</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={plants}
          keyExtractor={(p: any) => p.plant_id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md }}
          renderItem={({ item }) => {
            const d = daysUntil(item.next_water_at);
            const label = d <= 0 ? "Regar hoje" : d === 1 ? "Amanhã" : `Em ${d} dias`;
            const urgent = d <= 0;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/plant/${item.plant_id}`)}
                testID={`plant-card-${item.plant_id}`}
              >
                {item.photo_path ? (
                  <Image source={{ uri: fileUrl(item.photo_path) }} style={styles.cardImg} contentFit="cover" />
                ) : (
                  <View style={[styles.cardImg, styles.cardPlaceholder]}>
                    <Icon name="sprout" size={30} color={colors.brandPrimary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.species ? (
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.species}
                    </Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    <Icon name="water" size={14} color={urgent ? colors.warning : colors.brandSecondary} />
                    <Text style={[styles.cardMetaText, urgent && { color: colors.warning, fontWeight: "700" }]}>{label}</Text>
                    <Text style={styles.cardMetaText}> · {item.water_amount_ml} ml</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={22} color={colors.muted} />
              </Pressable>
            );
          }}
        />
      )}
      <AddPlantModal visible={adding} onClose={() => setAdding(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["plants"] })} />
    </View>
  );
}

function AddPlantModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [intervalDays, setIntervalDays] = useState("7");
  const [amount, setAmount] = useState("200");
  const [notes, setNotes] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const insets = useSafeAreaInsets();

  const save = useMutation({
    mutationFn: async () => {
      const plant = await api.createPlant({
        name: name.trim(),
        species: species.trim() || undefined,
        water_interval_days: Math.max(1, parseInt(intervalDays || "7", 10)),
        water_amount_ml: Math.max(10, parseInt(amount || "200", 10)),
        notes: notes.trim() || undefined,
        photo_path: photoPath || undefined,
      });
      await scheduleWateringReminder(
        plant.plant_id,
        plant.name,
        plant.water_amount_ml,
        new Date(plant.next_water_at),
      );
      return plant;
    },
    onSuccess: () => {
      onSaved();
      setName("");
      setSpecies("");
      setIntervalDays("7");
      setAmount("200");
      setNotes("");
      setPhotoPath(null);
      setLocalUri(null);
      onClose();
    },
  });

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      setUploading(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      setLocalUri(manipulated.uri);
      const up = await api.uploadFile(manipulated.uri, "image/jpeg");
      setPhotoPath(up.path);
    } catch (e) {
      console.warn(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={onClose} testID="close-add-plant">
            <Icon name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.modalTitle}>Nova planta</Text>
          <Pressable
            onPress={() => save.mutate()}
            disabled={!name.trim() || save.isPending}
            testID="save-plant-btn"
          >
            <Text style={[styles.saveText, (!name.trim() || save.isPending) && { opacity: 0.4 }]}>Salvar</Text>
          </Pressable>
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Pressable onPress={pickPhoto} style={styles.photoPicker} testID="plant-photo-picker">
            {uploading ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : localUri ? (
              <Image source={{ uri: localUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <>
                <Icon name="camera-plus" size={28} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: fontSize.sm, marginTop: 4 }}>Adicionar foto</Text>
              </>
            )}
          </Pressable>

          <Field label="Nome" value={name} onChange={setName} placeholder="Ex: Cacto da sala" testID="field-name" />
          <Field label="Espécie (opcional)" value={species} onChange={setSpecies} placeholder="Ex: Cacto-bola" testID="field-species" />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Regar a cada (dias)" value={intervalDays} onChange={setIntervalDays} placeholder="7" keyboardType="numeric" testID="field-interval" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Água (ml)" value={amount} onChange={setAmount} placeholder="200" keyboardType="numeric" testID="field-amount" />
            </View>
          </View>
          <Field label="Notas" value={notes} onChange={setNotes} placeholder="Observações..." multiline testID="field-notes" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, testID }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        testID={testID}
        style={[styles.input, multiline && { minHeight: 70, paddingTop: 12 }]}
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: "700" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.md, marginTop: spacing.xxxl },
  emptyTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: fontSize.base, lineHeight: 20 },
  emptyBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  cardImg: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  cardPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: fontSize.sm, marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  cardMetaText: { color: colors.muted, fontSize: fontSize.sm },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  saveText: { color: colors.brandPrimary, fontSize: fontSize.lg, fontWeight: "700" },
  photoPicker: {
    width: "100%",
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: fontSize.sm, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
});
