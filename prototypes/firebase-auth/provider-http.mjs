const responseLimit = 32768;

export async function readProviderJson(response, { allowError = false } = {}) {
  if ((!response.ok && !allowError) || response.redirected || response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    await response.body?.cancel();
    throw Error("AUTH_PROVIDER_RESPONSE");
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > responseLimit)) {
    await response.body?.cancel();
    throw Error("AUTH_PROVIDER_RESPONSE");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > responseLimit) throw Error("AUTH_PROVIDER_RESPONSE");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
}
