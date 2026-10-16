// The single WebView consumes Linking events and validates their destinations.
// Expo Router must not turn a meeting/group link into a missing native route.
export function redirectSystemPath() {
  return "/";
}
