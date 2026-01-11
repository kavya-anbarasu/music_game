export function audioPublicUrl(objectPath: string) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const clean = objectPath.replace(/^\/+/, "");
    const encoded = clean.split("/").map(encodeURIComponent).join("/");
    return `${base}/storage/v1/object/public/audio/${encoded}`;
  }
  
  export function clipObjectPath(lang: "english" | "tamil", songId: string, seconds: 1|3|5|10|20|30) {
    return `${lang}/${songId}/clip_${seconds}s.mp3`;
  }
  