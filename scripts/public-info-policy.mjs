export function assertPublicInfoBindings(bindings) {
  if (!Array.isArray(bindings) || bindings.length !== 2
    || !bindings.some((item) => item.name === "ASSETS" && item.type === "assets")
    || !bindings.some((item) => item.name === "KORU_PUBLIC_INFO_ONLY" && item.type === "plain_text" && item.text === "true")) {
    throw new Error("Refusing a public-info Worker with unknown ownership, secret, storage or service bindings");
  }
}
