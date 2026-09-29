/** F-013 — tags de carta numa coluna só: `Nome|#rrggbb` separado por vírgula. */

export type CardTag = { name: string; color: string };

const COLOR = /^#[0-9a-f]{6}$/;

export function parseTags(value: unknown): CardTag[] {
  if (typeof value !== "string" || !value.trim()) return [];
  const tags: CardTag[] = [];
  for (const part of value.split(",")) {
    const splitAt = part.lastIndexOf("|");
    if (splitAt <= 0) continue;
    const name = part.slice(0, splitAt).trim();
    const color = part.slice(splitAt + 1).trim().toLowerCase();
    if (!isTagName(name) || !COLOR.test(color)) continue;
    if (tags.some((tag) => sameTag(tag.name, name))) continue;
    tags.push({ name, color });
  }
  return tags;
}

export function serializeTags(tags: CardTag[]) {
  return tags.map((tag) => `${tag.name}|${tag.color}`).join(",");
}

export function collectTags(groups: CardTag[][]) {
  const tags: CardTag[] = [];
  for (const group of groups) {
    for (const tag of group) {
      if (!tags.some((item) => sameTag(item.name, tag.name))) tags.push(tag);
    }
  }
  return tags;
}

/** Cor da tag sobre o branco do selo, sem deixar o número transparente. */
export function tagTint(color: string, alpha = 0.7) {
  const hex = color.replace("#", "");
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function sameTag(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function isTagName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 32 && !/[,|]/.test(trimmed);
}

/** O nome já usado naquele deck ou coleção mantém a cor original. */
export function sanitizeTagList(input: unknown, known: CardTag[]): CardTag[] | null {
  if (!Array.isArray(input)) return null;
  const next: CardTag[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const name = String((item as CardTag).name ?? "").trim();
    const color = String((item as CardTag).color ?? "").trim().toLowerCase();
    if (!isTagName(name) || !COLOR.test(color)) return null;
    const existing = known.find((tag) => sameTag(tag.name, name));
    const resolved = existing ?? { name, color };
    if (next.some((tag) => sameTag(tag.name, resolved.name))) continue;
    next.push(resolved);
  }
  return next;
}

export function addTag(current: CardTag[], tag: CardTag, known: CardTag[]) {
  const existing = known.find((item) => sameTag(item.name, tag.name));
  const resolved = existing ?? tag;
  if (current.some((item) => sameTag(item.name, resolved.name))) return current;
  return [...current, resolved];
}

export function toggleTag(current: CardTag[], tag: CardTag) {
  if (current.some((item) => sameTag(item.name, tag.name))) {
    return current.filter((item) => !sameTag(item.name, tag.name));
  }
  return [...current, tag];
}
