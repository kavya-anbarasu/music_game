export const CLIP_SECONDS = [1, 3, 5, 10, 20, 30] as const;
export type ClipSeconds = (typeof CLIP_SECONDS)[number];

