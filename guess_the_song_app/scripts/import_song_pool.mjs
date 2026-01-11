import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load env vars from .env.local (simple manual load)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // your sb_publishable_...

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const filePath = path.join(process.cwd(), "src", "data", "english_songs.json");
const raw = fs.readFileSync(filePath, "utf-8");
const songs = JSON.parse(raw);

if (!Array.isArray(songs)) {
  throw new Error("english_songs.json should be an array");
}

const rows = songs.map((s) => {
  if (!s.id || typeof s.id !== "string") {
    throw new Error(`Missing/invalid id on song: ${JSON.stringify(s).slice(0, 200)}...`);
  }
  return { song_id: s.id, language: "english" };
});

// Deduplicate in-memory
const unique = Array.from(new Map(rows.map((r) => [r.song_id, r])).values());

console.log(`Found ${rows.length} rows, ${unique.length} unique song_ids. Uploading...`);

const CHUNK = 500; // Supabase likes chunks
let inserted = 0;

for (let i = 0; i < unique.length; i += CHUNK) {
  const chunk = unique.slice(i, i + CHUNK);

  const { error } = await supabase
    .from("song_pool")
    .upsert(chunk, { onConflict: "song_id" });

  if (error) {
    console.error("Upsert error:", error);
    process.exit(1);
  }

  inserted += chunk.length;
  console.log(`Upserted ${inserted}/${unique.length}`);
}

console.log("✅ Done importing song_pool!");
