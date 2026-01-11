import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load env vars (use export ... before running, or add dotenv/config)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = "audio";
const LANG = "english";

// Your metadata file: array of objects with { id, audio: { "1": "...", ... } }
const metadataPath = path.join(process.cwd(), "src", "data", "english_songs.json");
const songs = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

const DURATIONS = ["1", "3", "5", "10", "20", "30"];

function normalizeOldPath(p) {
  // expects something like "english/clips/<folder>/clip_10s.mp3"
  return p.replace(/^\/+/, "").replace(/^audio\//, ""); // just in case
}

async function moveOne(oldPath, newPath) {
  // Copy
  const { error: copyErr } = await supabase.storage
    .from(BUCKET)
    .copy(oldPath, newPath);

  if (copyErr) return { ok: false, step: "copy", error: copyErr };

  // Delete old
  const { error: delErr } = await supabase.storage
    .from(BUCKET)
    .remove([oldPath]);

  if (delErr) return { ok: false, step: "delete", error: delErr };

  return { ok: true };
}

(async () => {
  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const songId = song.id;
    if (!songId) continue;

    for (const d of DURATIONS) {
      const oldRel = song.audio?.[d];
      if (!oldRel) {
        skipped++;
        continue;
      }

      const oldPath = normalizeOldPath(oldRel);
      // Your existing layout seems: "english/clips/<something>/clip_10s.mp3"
      // New layout:
      const newPath = `${LANG}/${songId}/clip_${d}s.mp3`;

      // If you want a dry-run first, comment out the moveOne call and just log.
      const res = await moveOne(oldPath, newPath);

      if (res.ok) {
        moved++;
        process.stdout.write(`✅ ${oldPath} -> ${newPath}\n`);
      } else {
        failed++;
        process.stdout.write(`❌ ${res.step} failed: ${oldPath} -> ${newPath}\n`);
        process.stdout.write(`   ${JSON.stringify(res.error)}\n`);
      }
    }
  }

  console.log("\nSummary:");
  console.log({ moved, skipped, failed });
})();
