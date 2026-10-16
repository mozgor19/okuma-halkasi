import { useEffect, useState } from "react";
import { configuredAppUrl } from "./config";

export function WebShell() {
  const [configuration] = useState(() => {
    try { return { url: configuredAppUrl(), error: "" }; }
    catch (cause) { return { url: "", error: cause instanceof Error ? cause.message : "Uygulama adresi gecersiz." }; }
  });
  useEffect(() => {
    if (configuration.url) window.location.replace(configuration.url);
  }, [configuration.url]);
  return configuration.error ? <p role="alert">{configuration.error}</p> : null;
}
