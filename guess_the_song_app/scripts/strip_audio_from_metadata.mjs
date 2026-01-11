import fs from "fs";

const inFile = "src/data/tamil_songs.json";
const outFile = "src/data/tamil_songs_no_audio.json";

const songs = JSON.parse(fs.readFileSync(inFile, "utf8"));

const cleaned = songs.map(({ audio, ...rest }) => rest);

fs.writeFileSync(outFile, JSON.stringify(cleaned, null, 2));
console.log(`Wrote ${cleaned.length} songs to ${outFile}`);
