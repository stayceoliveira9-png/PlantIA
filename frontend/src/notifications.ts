import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

export async function scheduleWateringReminder(
  plantId: string,
  plantName: string,
  waterAmountMl: number,
  nextDate: Date,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  // Cancel previous reminder for this plant
  await cancelPlantReminder(plantId);
  const seconds = Math.max(5, Math.floor((nextDate.getTime() - Date.now()) / 1000));
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Hora de regar ${plantName} 💧`,
      body: `Dê cerca de ${waterAmountMl} ml de água.`,
      data: { plantId },
    },
    trigger: { seconds, repeats: false } as any,
  });
  return id;
}

export async function cancelPlantReminder(plantId: string) {
  if (Platform.OS === "web") return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if ((n.content.data as any)?.plantId === plantId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
