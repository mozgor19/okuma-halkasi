import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { NativeNotificationPermission, NotificationRequest } from "./shell-policy";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function channel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reading-circle", { name: "Buluşmalar", importance: Notifications.AndroidImportance.DEFAULT });
  }
}

export async function executeNotification(request: NotificationRequest): Promise<NativeNotificationPermission> {
  if (request.type === "notifications:request") await channel();
  const permission = request.type === "notifications:request"
    ? await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } })
    : await Notifications.getPermissionsAsync();
  const status = permission.status === "granted" ? "granted" : permission.canAskAgain ? "default" : "denied";
  if (request.type === "notifications:show") {
    if (status !== "granted") throw new Error("Bildirim izni gerekli.");
    await channel();
    await Notifications.scheduleNotificationAsync({
      identifier: request.key,
      content: { title: request.title, body: request.body, data: { url: request.url }, sound: false },
      trigger: Platform.OS === "android" ? { channelId: "reading-circle" } : null,
    });
  }
  return status;
}
