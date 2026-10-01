"use client";

import type { Human as HumanInstance } from "@vladmandic/human";
import type { Member } from "@/lib/types";

export type FaceMatchCandidate = {
  memberId: number;
  name: string;
  score: number;
};

export type FaceRecognitionResult = {
  candidates: FaceMatchCandidate[];
  faceCount: number;
  usableReferenceCount: number;
};

const minimumSimilarity = 0.62;
const minimumLead = 0.08;
const referenceEmbeddings = new Map<string, number[]>();
let humanPromise: Promise<HumanInstance> | null = null;

async function getHuman(): Promise<HumanInstance> {
  if (!humanPromise) {
    humanPromise = import("@vladmandic/human").then(async ({ Human }) => {
      const human = new Human({
        backend: "webgl",
        async: true,
        warmup: "none",
        debug: false,
        deallocate: true,
        cacheSensitivity: 0,
        modelBasePath: "/face-models/",
        filter: { enabled: true, equalization: true },
        face: {
          enabled: true,
          detector: {
            enabled: true,
            rotation: true,
            return: false,
            maxDetected: 30,
            minConfidence: 0.35,
          },
          mesh: { enabled: true },
          attention: { enabled: false },
          iris: { enabled: false },
          description: { enabled: true, minConfidence: 0.2 },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
          gear: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
        gesture: { enabled: false },
      });
      await human.load();
      return human;
    }).catch((error) => {
      humanPromise = null;
      throw error;
    });
  }
  return humanPromise;
}

async function imageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function detectEmbeddings(human: HumanInstance, blob: Blob) {
  const { image, release } = await imageFromBlob(blob);
  try {
    const result = await human.detect(image);
    return result.face
      .map((face) => face.embedding)
      .filter((embedding): embedding is number[] => Array.isArray(embedding) && embedding.length > 0);
  } finally {
    release();
  }
}

async function referenceEmbedding(human: HumanInstance, mediaKey: string) {
  const cached = referenceEmbeddings.get(mediaKey);
  if (cached) return cached;

  const response = await fetch(`/api/media/${mediaKey}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) return null;

  const embeddings = await detectEmbeddings(human, await response.blob());
  if (embeddings.length !== 1) return null;
  referenceEmbeddings.set(mediaKey, embeddings[0]);
  return embeddings[0];
}

export async function validateFaceReference(photo: Blob): Promise<number> {
  const human = await getHuman();
  return (await detectEmbeddings(human, photo)).length;
}

export async function recognizeAttendees(
  photo: Blob,
  members: Member[],
): Promise<FaceRecognitionResult> {
  const eligible = members.filter(
    (member) => member.faceRecognitionConsent && member.faceReferenceMediaKey,
  );
  if (!eligible.length) {
    return { candidates: [], faceCount: 0, usableReferenceCount: 0 };
  }

  const human = await getHuman();
  const references: Array<{ member: Member; embedding: number[] }> = [];
  for (const member of eligible) {
    const embedding = await referenceEmbedding(human, member.faceReferenceMediaKey!);
    if (embedding) references.push({ member, embedding });
  }
  if (!references.length) {
    return { candidates: [], faceCount: 0, usableReferenceCount: 0 };
  }

  const faces = await detectEmbeddings(human, photo);
  const recognized = new Map<number, FaceMatchCandidate>();

  for (const face of faces) {
    const matches = references
      .map(({ member, embedding }) => ({
        member,
        score: human.match.similarity(face, embedding),
      }))
      .sort((left, right) => right.score - left.score);
    const best = matches[0];
    const runnerUp = matches[1];
    if (
      !best
      || best.score < minimumSimilarity
      || (runnerUp && best.score - runnerUp.score < minimumLead)
    ) continue;

    const current = recognized.get(best.member.id);
    if (!current || best.score > current.score) {
      recognized.set(best.member.id, {
        memberId: best.member.id,
        name: best.member.name,
        score: best.score,
      });
    }
  }

  return {
    candidates: [...recognized.values()].sort((left, right) => right.score - left.score),
    faceCount: faces.length,
    usableReferenceCount: references.length,
  };
}
