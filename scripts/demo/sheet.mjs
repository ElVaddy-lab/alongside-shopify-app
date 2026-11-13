// Contact sheet of a recorded scene: frames shown at the given seconds (or one per caption end).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [dir, out, ...times] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8"));
const ts = times.length ? times.map(Number) : m.captions.map((c) => c.end - 0.3);
const files = ts.map((t) => (m.frames.filter((f) => f.t <= t).at(-1) ?? m.frames[0]).file);
const args = [];
files.forEach((f) => args.push("-i", `${dir}/${f}`));
const cols = 2;
const filter = files.map((_, i) => `[${i}:v]scale=800:450[v${i}]`).join(";") +
  ";" + files.map((_, i) => `[v${i}]`).join("") +
  `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * 800}_${Math.floor(i / cols) * 450}`).join("|") + `:fill=black`;
execFileSync("ffmpeg", ["-y", "-v", "error", ...args, "-filter_complex", filter, out]);
console.log(files.join(" "), ts.map((t) => t.toFixed(1)).join(" "));
