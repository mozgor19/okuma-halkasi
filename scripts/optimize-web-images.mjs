import { createRequire } from "node:module";
import { statSync } from "node:fs";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const source = "public/reading-room.png";
const target = "public/reading-room.webp";
await sharp(source).webp({ quality: 82, effort: 6 }).toFile(target);
console.log(JSON.stringify({ sourceBytes: statSync(source).size, optimizedBytes: statSync(target).size }));
