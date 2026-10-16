import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, BackHandler, KeyboardAvoidingView,
  Platform, Pressable, StatusBar, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { configuredAppUrl } from "./config";
import { cleanupExpiredExports, discardFileTransfer, executeShare } from "./native-share";
import { executeNotification } from "./native-notifications";
import {
  deepLinkUrl, externalUrl, isTrustedUrl, MAX_MESSAGE_CHARS,
  resultScript, validateBridgeRequest, type BridgeResult,
} from "./shell-policy";
import { backScript, bootstrapScript, resumeScript } from "./web-bootstrap";

const initialColors = { background: "#ffffff", surface: "#ffffff", text: "#171717", action: "#171717", dark: false };
type ShellColors = typeof initialColors;
const safeColor = (value: unknown): value is string => typeof value === "string"
  && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);

export function WebShell() {
  const [configuration] = useState(() => {
    try { return { url: configuredAppUrl(), error: "" }; }
    catch (cause) { return { url: "", error: cause instanceof Error ? cause.message : "Uygulama adresi gecersiz." }; }
  });
  const appUrl = configuration.url;
  const [source, setSource] = useState<{ uri: string } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [colors, setColors] = useState<ShellColors>(initialColors);
  const [loading, setLoading] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(configuration.error);
  const web = useRef<WebView>(null);
  const currentUrl = useRef(appUrl + "/");
  const documentVersion = useRef(0);
  const canGoBack = useRef(false);
  const sharing = useRef(false);
  const pendingBack = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const mounted = useRef(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mounted.current = true;
    try { cleanupExpiredExports(); } catch { /* OS cache cleanup remains best effort. */ }
    return () => {
      mounted.current = false;
      try { discardFileTransfer(); } catch { /* Stale cache is cleaned on next launch. */ }
      if (pendingBack.current) clearTimeout(pendingBack.current.timer);
    };
  }, []);

  useEffect(() => {
    if (!appUrl) return;
    let active = true;
    let incoming = false;
    const openLink = (url: string) => {
      const destination = deepLinkUrl(url, appUrl);
      if (!destination || !active) return;
      incoming = true;
      documentVersion.current += 1;
      currentUrl.current = destination;
      setError("");
      setLoading(true);
      setSource({ uri: destination });
      setGeneration((value) => value + 1);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => openLink(url));
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && typeof url === "string") openLink(url);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    void Promise.all([Linking.getInitialURL(), Notifications.getLastNotificationResponseAsync().catch(() => null)]).then(([url, response]) => {
      if (!active || incoming) return;
      const notificationUrl = response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? response.notification.request.content.data?.url : null;
      const destination = (url && deepLinkUrl(url, appUrl))
        || (typeof notificationUrl === "string" && deepLinkUrl(notificationUrl, appUrl)) || appUrl + "/";
      if (response) void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      currentUrl.current = destination;
      setSource({ uri: destination });
    }).catch(() => { if (active && !incoming) setSource({ uri: appUrl + "/" }); });
    return () => { active = false; subscription.remove(); notificationSubscription.remove(); };
  }, [appUrl]);

  useEffect(() => NetInfo.addEventListener((state) => {
    // adb reverse can reach the local server even without public internet.
    const localDevelopment = __DEV__ && appUrl.startsWith("http:");
    setOffline(!localDevelopment && (state.isConnected === false || state.isInternetReachable === false));
  }), [appUrl]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active" && appUrl) {
        web.current?.injectJavaScript(resumeScript(appUrl));
      }
      previous = next;
    });
    return () => subscription.remove();
  }, [appUrl]);

  useEffect(() => {
    if (Platform.OS !== "android" || !appUrl) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!web.current) return false;
      if (pendingBack.current) return true;
      const id = `back-${Date.now()}`;
      const timer = setTimeout(() => {
        pendingBack.current = null;
        // An unresponsive renderer must not silently discard a form or exit.
        if (mounted.current) setError("Sayfa yanit vermiyor. Yeniden deneyin.");
      }, 1500);
      pendingBack.current = { id, timer };
      web.current.injectJavaScript(backScript(id, appUrl, canGoBack.current));
      return true;
    });
    return () => subscription.remove();
  }, [appUrl]);

  function reply(result: BridgeResult, version = documentVersion.current) {
    if (mounted.current && version === documentVersion.current && isTrustedUrl(currentUrl.current, appUrl)) {
      web.current?.injectJavaScript(resultScript(result, appUrl));
    }
  }

  async function onMessage(event: WebViewMessageEvent) {
    const { data, url } = event.nativeEvent;
    if (!isTrustedUrl(url, appUrl) || !isTrustedUrl(currentUrl.current, appUrl)
      || data.length > MAX_MESSAGE_CHARS) return;
    let message: Record<string, unknown> | null = null;
    if (data.length <= 2048) {
      try { message = JSON.parse(data); } catch { return; }
      if (!message || typeof message !== "object" || Array.isArray(message)) return;
    }
    if (message?.type === "shell:theme") {
      if (safeColor(message.background) && safeColor(message.surface) && safeColor(message.text)
        && safeColor(message.action) && typeof message.dark === "boolean") {
        setColors({ background: message.background, surface: message.surface, text: message.text, action: message.action, dark: message.dark });
      }
      return;
    }
    if (message?.type === "shell:back") {
      const pending = pendingBack.current;
      if (pending && message.id === pending.id && typeof message.handled === "boolean") {
        clearTimeout(pending.timer);
        pendingBack.current = null;
        if (!message.handled) BackHandler.exitApp();
      }
      return;
    }
    if (message?.type === "shell:overlay") {
      if (typeof message.open === "boolean") setOverlayOpen(message.open);
      return;
    }
    const validated = validateBridgeRequest(data, url, appUrl);
    if (!validated.ok) {
      if (validated.id) reply({ id: validated.id, ok: false, error: validated.error });
      return;
    }
    const request = validated.request;
    if (request.type === "notifications:status" || request.type === "notifications:request" || request.type === "notifications:show") {
      const version = documentVersion.current;
      try {
        const permission = await executeNotification(request);
        reply({ id: request.id, ok: true, permission }, version);
      } catch { reply({ id: request.id, ok: false, error: "Cihaz bildirimi tamamlanamadı. Bildirim izinlerini kontrol et." }, version); }
      return;
    }
    if (sharing.current) {
      reply({ id: request.id, ok: false, error: "Bir paylasim islemi zaten acik." });
      return;
    }
    sharing.current = true;
    const version = documentVersion.current;
    try {
      await executeShare(request);
      reply({ id: request.id, ok: true }, version);
    } catch {
      reply({ id: request.id, ok: false, error: "Paylasim tamamlanamadi veya iptal edildi." }, version);
    } finally { sharing.current = false; }
  }

  function openExternal(url: string) {
    const allowed = externalUrl(url);
    if (!allowed) return;
    void Linking.openURL(allowed).catch(() => Alert.alert("Baglanti acilamadi", "Bu baglantiyi acabilecek bir uygulama bulunamadi."));
  }

  function retry() {
    if (!appUrl) return;
    documentVersion.current += 1;
    setError("");
    setLoading(true);
    setSource({ uri: isTrustedUrl(currentUrl.current, appUrl) ? currentUrl.current : appUrl + "/" });
    setGeneration((value) => value + 1);
  }

  const blocked = error || (offline ? "Baglanti yok. Internet baglantinizi kontrol edin." : "");
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.root}>
          {source && appUrl ? <WebView
            key={generation}
            ref={web}
            source={source}
            style={[styles.root, { backgroundColor: colors.background }]}
            // Route EVERY scheme through the validator. WebView otherwise sends
            // non-whitelisted schemes straight to Linking before our callback.
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(request) => {
              if (isTrustedUrl(request.url, appUrl)) return true;
              if (request.isTopFrame !== false) openExternal(request.url);
              return false;
            }}
            onOpenWindow={({ nativeEvent }) => {
              if (isTrustedUrl(nativeEvent.targetUrl, appUrl)) {
                currentUrl.current = nativeEvent.targetUrl;
                setSource({ uri: nativeEvent.targetUrl });
                setGeneration((value) => value + 1);
              } else openExternal(nativeEvent.targetUrl);
            }}
            onNavigationStateChange={(state) => {
              if (isTrustedUrl(state.url, appUrl)) currentUrl.current = state.url;
              canGoBack.current = state.canGoBack;
            }}
            onLoadStart={({ nativeEvent }) => {
              try { discardFileTransfer(); } catch { /* Stale cache is cleaned on next launch. */ }
              if (isTrustedUrl(nativeEvent.url, appUrl)) currentUrl.current = nativeEvent.url;
              documentVersion.current += 1;
              setLoading(true);
              setOverlayOpen(false);
              setError("");
            }}
            onLoadEnd={() => {
              setLoading(false);
              web.current?.injectJavaScript(bootstrapScript(appUrl));
            }}
            onError={() => { setLoading(false); setError("Sayfa yuklenemedi. Yeniden deneyin."); }}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.url === currentUrl.current && nativeEvent.statusCode >= 400) {
                setLoading(false);
                setError("Sunucuya ulasilamadi. Yeniden deneyin.");
              }
            }}
            onRenderProcessGone={() => setError("Sayfa kapandi. Yeniden deneyin.")}
            onContentProcessDidTerminate={() => setError("Sayfa kapandi. Yeniden deneyin.")}
            onMessage={(event) => { void onMessage(event); }}
            injectedJavaScript={bootstrapScript(appUrl)}
            javaScriptEnabled
            webviewDebuggingEnabled={__DEV__}
            domStorageEnabled
            incognito={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows
            allowsBackForwardNavigationGestures={!overlayOpen}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
          /> : null}
          {loading && !blocked && <View style={[styles.overlay, { backgroundColor: colors.background }]}><ActivityIndicator accessibilityLabel="Yukleniyor" color={colors.action} /></View>}
          {!!blocked && <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.text }]}>{blocked}</Text>
            {!!appUrl && <Pressable accessibilityRole="button" onPress={retry} disabled={offline} style={[styles.retry, { borderColor: colors.action, opacity: offline ? 0.5 : 1 }]}>
              <Text style={{ color: colors.action }}>Yeniden dene</Text>
            </Pressable>}
          </View>}
        </View>
      </KeyboardAvoidingView>
      <View style={{ height: insets.bottom, backgroundColor: colors.surface }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 },
  error: { maxWidth: 360, textAlign: "center", fontSize: 16, lineHeight: 24 },
  retry: { minHeight: 44, borderWidth: 1, borderRadius: 4, paddingHorizontal: 20, paddingVertical: 12, justifyContent: "center" },
});
