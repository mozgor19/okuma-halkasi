import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import { base64ByteLength, type BridgeRequest, type NotificationRequest } from "./shell-policy";

let sequence = 0;
const exportLifetime = 5 * 60 * 1000;
type FileTransfer = { id: string; size: number; written: number; directory: Directory; file: File; mimeType: string; name: string };
let transfer: FileTransfer | null = null;

export function discardFileTransfer() {
  const previous = transfer;
  transfer = null;
  if (previous?.directory.exists) previous.directory.delete();
}

export function cleanupExpiredExports() {
  const root = new Directory(Paths.cache, "okuma-exports");
  if (!root.exists) return;
  for (const entry of root.list()) {
    if (entry.uri === transfer?.directory.uri) continue;
    const created = Number(entry.name.split("-")[0]);
    if (!Number.isFinite(created) || Date.now() - created >= exportLifetime) entry.delete();
  }
}

async function shareFile(file: File, directory: Directory, mimeType: string, name: string) {
  let shared = false;
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType, UTI: mimeType === "application/zip" ? "public.zip-archive" : "com.apple.ical.ics", dialogTitle: name,
    });
    shared = true;
  } finally {
    const remove = () => { if (directory.exists) directory.delete(); };
    // Android resolves when the chooser closes; the receiving app may still open the URI.
    if (shared) setTimeout(() => { try { remove(); } catch { /* Retry stale cleanup on next launch. */ } }, exportLifetime);
    else remove();
  }
}

export async function executeShare(request: Exclude<BridgeRequest, NotificationRequest>): Promise<void> {
  if (request.type === "share") {
    const result = await Share.share({
      title: request.title,
      message: [request.title, request.text, request.url].filter(Boolean).join("\n"),
      url: request.url,
    });
    if (result.action === Share.dismissedAction) throw new Error("Paylasim iptal edildi.");
    return;
  }
  if (request.type === "file:cancel") {
    if (transfer?.id === request.transferId) discardFileTransfer();
    return;
  }
  if (request.type === "file:chunk") {
    const current = transfer;
    const bytes = base64ByteLength(request.base64);
    if (!current || current.id !== request.transferId || current.written !== request.offset
      || bytes === null || current.written + bytes > current.size) throw new Error("Dosya aktarim sirasi gecersiz.");
    try {
      current.file.write(request.base64, { encoding: "base64", append: true });
      current.written += bytes;
      if (current.file.size !== current.written) throw new Error("Dosya parcasi yazilamadi.");
    } catch (error) { discardFileTransfer(); throw error; }
    return;
  }
  if (request.type === "file:finish") {
    const current = transfer;
    if (!current || current.id !== request.transferId || current.written !== current.size) throw new Error("Dosya aktarimi tamamlanmadi.");
    transfer = null;
    await shareFile(current.file, current.directory, current.mimeType, current.name);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error("Bu cihazda dosya paylasimi kullanilamiyor.");
  if (transfer) throw new Error("Baska bir dosya aktarimi suruyor.");
  if (request.type === "file:start" && request.size > Paths.availableDiskSpace - 10 * 1024 * 1024) {
    throw new Error("Dosya icin cihazda yeterli bos alan yok.");
  }
  cleanupExpiredExports();
  const directory = new Directory(Paths.cache, "okuma-exports", `${Date.now()}-${++sequence}`);
  try {
    directory.create({ intermediates: true });
    const file = new File(directory, request.name);
    file.create();
    if (request.type === "file:start") {
      transfer = { id: request.transferId, size: request.size, written: 0, directory, file, mimeType: request.mimeType, name: request.name };
      return;
    }
    file.write(request.base64, { encoding: "base64" });
    if (file.size !== base64ByteLength(request.base64)) throw new Error("Dosya hazirlanamadi.");
    await shareFile(file, directory, request.mimeType, request.name);
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  }
}
