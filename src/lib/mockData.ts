import type { MockMediaItem, MockSource, MockTag } from "./types";

const TAG_NAMES = ["", "Subject A", "LoRA candidate", "Bad hands", "Keeper"];
const STATES = ["unreviewed", "keep", "reject", "maybe"] as const;
const COLORS = [210, 275, 38, 168, 12, 330, 95, 250, 200, 20];

export const mockSources: MockSource[] = [
  { id: "all", name: "All media", color: "#8a8f9b", count: 1712 },
  { id: "renders", name: "Renders / ComfyUI", color: "#f2b84b", count: 684 },
  { id: "phone", name: "Phone Backup", color: "#73a7ff", count: 412 },
  { id: "camera", name: "Camera Dump", color: "#c77dff", count: 328 },
];

export const mockTags: MockTag[] = [
  { id: "lora", name: "LoRA candidate", color: "#f2b84b", hotkey: "2", count: 91 },
  { id: "subject-a", name: "Subject A", color: "#4fd1c5", hotkey: "1", count: 46 },
  { id: "bad-hands", name: "Bad hands", color: "#e5705b", hotkey: "3", count: 32 },
  { id: "keeper", name: "Keeper", color: "#7ddc83", hotkey: "4", count: 214 },
];

export function createMockMediaItems(count = 28): MockMediaItem[] {
  return Array.from({ length: count }, (_, index) => {
    const isVideo = index % 3 === 0;
    const tag = TAG_NAMES[index % TAG_NAMES.length] ?? "";
    const state = STATES[index % STATES.length] ?? "unreviewed";

    return {
      id: String(index),
      name: `${isVideo ? "clip" : "img"}_${2480 + index}.${isVideo ? "mp4" : "png"}`,
      ext: isVideo ? "MP4" : "PNG",
      kind: isVideo ? "video" : "image",
      dim: ["2048×2048", "1080×1350", "3840×2160", "1920×1080"][index % 4] ?? "1920×1080",
      sizeLabel: `${(2 + index * 0.7).toFixed(1)} MB`,
      sizeBytes: Math.round((2 + index * 0.7) * 1024 * 1024),
      state,
      tag,
      tags: tag ? [tag] : [],
      sourceName: mockSources[(index % 3) + 1]?.name ?? "All media",
      sourceId: mockSources[(index % 3) + 1]?.id ?? "all",
      filePath: "",
      selected: false,
      hue: COLORS[index % COLORS.length] ?? 210,
    };
  });
}

export function gradientForHue(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${(hue + 48) % 360} 40% 15%))`;
}
