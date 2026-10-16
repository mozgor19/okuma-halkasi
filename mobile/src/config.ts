import Constants from "expo-constants";
import { resolveAppUrl } from "./shell-policy";

export function configuredAppUrl(): string {
  return resolveAppUrl(process.env.EXPO_PUBLIC_APP_URL || Constants.expoConfig?.extra?.appUrl, __DEV__);
}
