import { Human, type FaceResult, type GraphModel } from "@vladmandic/human";
import { LOCAL_FACE_CONSENT, localModelRequest, selectLocalMatches, validLocalEmbedding, type LocalFaceScope } from "@/lib/local-face-policy";
import { clearLocalReferences, readLocalReferences, saveLocalReference } from "@/lib/local-face-vault";

type Command = { id: number; action: "list" | "enroll" | "match" | "clear"; scope: LocalFaceScope; file?: Blob; memberId?: number; memberIds?: number[]; consent?: string };
const worker = self as unknown as { onmessage: ((event: MessageEvent<Command>) => void) | null; postMessage: (data: unknown) => void; location: Location; fetch: typeof fetch };
const nativeFetch = worker.fetch.bind(self);
worker.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (request.method !== "GET" || request.body) throw Error("Yüz işçisinde gönderim engellendi.");
  const url = localModelRequest(request.url, worker.location.origin);
  return nativeFetch(url.href, { method: "GET", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "force-cache" });
};
let human: Human | undefined;
let descriptor: GraphModel | undefined;
async function engine() {
  if (!human) {
    const config = { backend: "webgl", async: true, warmup: "none", debug: false, skipAllowed: false, cacheSensitivity: 0, modelBasePath: new URL("/face-models/", worker.location.origin).href,
      filter: { enabled: true, equalization: true },
      face: { enabled: true, detector: { enabled: true, rotation: true, return: true, maxDetected: 30, minConfidence: .6, minSize: 40 },
        mesh: { enabled: true }, attention: { enabled: false }, iris: { enabled: false }, description: { enabled: false },
        emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }, gear: { enabled: false } },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, segmentation: { enabled: false }, gesture: { enabled: false } } as const;
    human = new Human(config);
    try { await human.load(); await human.init(); }
    catch { human = new Human({ ...config, backend: "cpu" }); await human.load(); await human.init(); }
  }
  if (!descriptor) {
    const loaded = await human.tf.loadGraphModel(new URL("/face-models/faceres.json", worker.location.origin).href) as GraphModel;
    const input = human.tf.zeros([1, 224, 224, 3]);
    let output;
    try {
      // Validate/warm only the descriptor graph with a synthetic zero tensor, never a person's image.
      output = loaded.execute(input, "global_pooling/Mean") as { data: () => Promise<Float32Array>; dispose: () => void };
      if (!validLocalEmbedding(Array.from(await output.data()))) throw Error("Yerel yüz modeli doğrulanamadı.");
      descriptor = loaded;
    } catch { loaded.dispose(); throw Error("Yerel yüz modeli bu cihazda çalıştırılamadı. Elle katılımcı ekleyebilirsin."); }
    finally { input.dispose(); output?.dispose(); }
  }
  return human;
}
async function detect(model: Human, canvas: OffscreenCanvas) {
  const result = await model.detect(canvas);
  try {
    for (const face of result.face) {
      if (!face.tensor) continue;
      // Execute only the embedding head. Human's description path also infers age/gender.
      const input = model.tf.tidy(() => model.tf.image.resizeBilinear(face.tensor, [224, 224], false).expandDims(0).mul(255));
      let output;
      try {
        output = descriptor!.execute(input, "global_pooling/Mean") as { data: () => Promise<Float32Array>; dispose: () => void };
        face.embedding = Array.from(await output.data());
      } finally { input.dispose(); output?.dispose(); }
    }
    return { face: result.face.slice() };
  } finally {
    for (const face of result.face) { face.tensor?.dispose(); delete face.tensor; }
    model.result.face = [];
  }
}
const usable = (face: FaceResult, reference = false) => validLocalEmbedding(face.embedding) && face.boxScore >= (reference ? .75 : .6)
  && Math.min(face.box[2], face.box[3]) >= (reference ? 80 : 40);
async function canvasFor(file: Blob) {
  if (!file || file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw Error("JPEG, PNG veya WebP fotoğrafı seç; en fazla 8 MB.");
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") throw Error("Bu tarayıcı yerel yüz işçisini desteklemiyor. Elle katılımcı ekleyebilirsin.");
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 24_000_000 || image.width < 80 || image.height < 80) throw Error("Fotoğraf boyutları yüz eşleştirmeye uygun değil; en fazla 24 megapiksel.");
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
    const context = canvas.getContext("2d"); if (!context) throw Error("Fotoğraf bu cihazda çözülemedi.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas;
  } finally { image.close(); }
}
async function handle(command: Command) {
  const { action, scope } = command;
  if (action === "clear") { await clearLocalReferences(scope, command.memberId); return { members: (await readLocalReferences(scope)).map(ref => ref.memberId) }; }
  if (action === "list") return { members: (await readLocalReferences(scope)).map(ref => ref.memberId) };
  if (action === "enroll" && (command.consent !== LOCAL_FACE_CONSENT || !Number.isSafeInteger(command.memberId) || command.memberId! < 1)) throw Error("Kişinin açık izni olmadan referans eklenemez.");
  if (action !== "enroll" && (action !== "match" || command.consent !== LOCAL_FACE_CONSENT || !Array.isArray(command.memberIds) || command.memberIds.length > 500)) throw Error("Yerel eşleştirme isteği geçersiz.");
  const canvas = await canvasFor(command.file!);
  try {
    const model = await engine();
    const result = await detect(model, canvas);
    if (action === "enroll") {
      if (result.face.length !== 1 || !usable(result.face[0], true)) throw Error("Tek, net ve yeterince büyük bir yüz içeren önden çekilmiş referans seç.");
      const embeddings = [result.face[0].embedding!];
      // Real lighting variations only; do not fabricate poses or lower the rejection threshold.
      const context = canvas.getContext("2d")!, original = context.getImageData(0, 0, canvas.width, canvas.height);
      for (const gamma of [.85, 1.15]) {
        const varied = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
        for (let i = 0; i < varied.data.length; i++) if (i % 4 !== 3) varied.data[i] = Math.round(255 * Math.pow(varied.data[i] / 255, gamma));
        context.putImageData(varied, 0, 0);
        const alternate = await detect(model, canvas);
        if (alternate.face.length === 1 && usable(alternate.face[0], true)) embeddings.push(alternate.face[0].embedding!);
      }
      await saveLocalReference(scope, { memberId: command.memberId!, embeddings, createdAt: Date.now(), consent: LOCAL_FACE_CONSENT });
      return { members: (await readLocalReferences(scope)).map(ref => ref.memberId), variants: embeddings.length };
    }
    if (action !== "match" || !Array.isArray(command.memberIds) || command.memberIds.length > 500) throw Error("Yerel eşleştirme isteği geçersiz.");
    const references = (await readLocalReferences(scope)).filter(ref => command.memberIds!.includes(ref.memberId));
    return { candidates: selectLocalMatches(result.face.filter(face => usable(face)).map(face => face.embedding!), references, (a, b) => model.match.similarity(a, b)),
      faceCount: result.face.length, usableReferenceCount: references.length };
  } finally { canvas.width = canvas.height = 1; }
}
let queue = Promise.resolve();
worker.onmessage = event => {
  const command = event.data;
  queue = queue.then(async () => {
    try { worker.postMessage({ id: command.id, ok: true, result: await handle(command) }); }
    catch (error) { worker.postMessage({ id: command.id, ok: false, error: error instanceof Error ? error.message : "Yerel yüz işlemi tamamlanamadı." }); }
  });
};
