// Builds the overview video from recorded scenes and title cards:
// each clip gets a caption band under the picture, then all clips are joined.
//   SP=<work dir> node scripts/demo/assemble.mjs <out.mp4>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SP = process.env.SP;
const OUT = path.resolve(process.argv[2] ?? "case/alongside-demo.mp4");
const BAND = "0x15171a";
const FADE = 0.35;

const PLAN = [
  { card: "intro", seconds: 8 },
  { scene: "storefront" },
  { card: "how", seconds: 11 },
  { scene: "admin-tour" },
  { scene: "admin-create" },
  { scene: "admin-off" },
  { scene: "editor" },
  { scene: "dawn" },
  { card: "quality", seconds: 12 },
  { card: "outro", seconds: 8 },
];

const ff = (args, cwd) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { cwd, stdio: "inherit" });
const fades = (d) => `fade=t=in:st=0:d=${FADE},fade=t=out:st=${(d - FADE).toFixed(2)}:d=${FADE}`;
const encode = ["-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30"];

const assTime = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const ass = (captions) => `[Script Info]
ScriptType: v4.00+
PlayResX: 1600
PlayResY: 1000
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Band,Segoe UI,31,&H00F2F0EB,&H00F2F0EB,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,60,60,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${captions.map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Band,,0,0,0,,${c.text.replace(/\n/g, "\\N")}`).join("\n")}
`;

const clips = [];
for (const [i, item] of PLAN.entries()) {
  const out = path.join(SP, `clip-${String(i).padStart(2, "0")}.mp4`);
  if (item.card) {
    const d = item.seconds;
    ff(["-loop", "1", "-t", String(d), "-i", path.join(SP, "cards", `${item.card}.png`),
      "-vf", `scale=1600:900,pad=1600:1000:0:0:color=${BAND},format=yuv420p,${fades(d)}`, ...encode, out]);
  } else {
    const dir = path.join(SP, `scene-${item.scene}`);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const lines = [];
    m.frames.forEach((f, k) => {
      const next = m.frames[k + 1]?.t ?? m.end;
      lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(3)}`);
    });
    lines.push(`file '${m.frames.at(-1).file}'`);
    fs.writeFileSync(path.join(dir, "frames.txt"), lines.join("\n"));
    // Captions are shifted by the first frame's time (the clip starts there).
    const t0 = m.frames[0].t;
    fs.writeFileSync(path.join(dir, "captions.ass"), ass(m.captions.map((c) => ({ ...c, start: c.start - t0, end: c.end - t0 }))));
    const d = m.end - t0;
    ff(["-f", "concat", "-safe", "0", "-i", "frames.txt",
      "-vf", `fps=30,scale=1600:900:flags=lanczos,pad=1600:1000:0:0:color=${BAND},subtitles=captions.ass,format=yuv420p,${fades(d)}`,
      "-t", d.toFixed(2), ...encode, out], dir);
  }
  clips.push(out);
  console.log("clip", i, item.card ?? item.scene);
}
fs.writeFileSync(path.join(SP, "clips.txt"), clips.map((c) => `file '${c.split(path.sep).join("/")}'`).join("\n"));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
ff(["-f", "concat", "-safe", "0", "-i", path.join(SP, "clips.txt"), "-c", "copy", "-movflags", "+faststart", OUT]);
console.log("video:", OUT);
