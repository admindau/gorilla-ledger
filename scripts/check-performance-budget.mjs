import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static", "chunks");
const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".js"));
const sizes = await Promise.all(files.map(async (file) => ({ file, bytes: (await stat(join(root, file))).size })));
const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
const largest = sizes.sort((a, b) => b.bytes - a.bytes)[0];
const maxTotal = 3_200_000;
const maxChunk = 650_000;

console.log(JSON.stringify({ event: "client_bundle_budget", totalBytes: total, largestChunk: largest }, null, 2));
if (total > maxTotal) throw new Error(`Client chunks total ${total} bytes, over the ${maxTotal}-byte budget.`);
if (largest?.bytes > maxChunk) throw new Error(`${largest.file} is ${largest.bytes} bytes, over the ${maxChunk}-byte chunk budget.`);
