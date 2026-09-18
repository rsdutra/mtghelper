import type { CardFilters } from "@/lib/scryfall-filters";

type Op = ":" | "=" | "!=" | "<" | ">" | "<=" | ">=";

type Node =
  | { kind: "and"; parts: Node[] }
  | { kind: "or"; parts: Node[] }
  | { kind: "not"; inner: Node }
  | { kind: "name"; value: string; exact: boolean }
  | { kind: "term"; key: string; op: Op; value: string };

const COLOR_WORDS: Record<string, string> = {
  w: "W",
  white: "W",
  branco: "W",
  u: "U",
  blue: "U",
  azul: "U",
  b: "B",
  black: "B",
  preto: "B",
  r: "R",
  red: "R",
  vermelho: "R",
  g: "G",
  green: "G",
  verde: "G",
};

const GUILDS: Record<string, string[]> = {
  azorius: ["W", "U"],
  dimir: ["U", "B"],
  rakdos: ["B", "R"],
  gruul: ["R", "G"],
  selesnya: ["G", "W"],
  orzhov: ["W", "B"],
  izzet: ["U", "R"],
  golgari: ["B", "G"],
  boros: ["R", "W"],
  simic: ["G", "U"],
  esper: ["W", "U", "B"],
  grixis: ["U", "B", "R"],
  jund: ["B", "R", "G"],
  naya: ["R", "G", "W"],
  bant: ["G", "W", "U"],
  abzan: ["W", "B", "G"],
  jeskai: ["U", "R", "W"],
  sultai: ["B", "G", "U"],
  mardu: ["R", "W", "B"],
  temur: ["G", "U", "R"],
  wubrg: ["W", "U", "B", "R", "G"],
};

const TYPE_PT: Record<string, string> = {
  criatura: "creature",
  criaturas: "creature",
  instantaneo: "instant",
  instantâneo: "instant",
  feitico: "sorcery",
  feitiço: "sorcery",
  encantamento: "enchantment",
  artefato: "artifact",
  terreno: "land",
  planeswalker: "planeswalker",
  batalha: "battle",
  lenda: "legend",
  lendario: "legendary",
  lendária: "legendary",
};

const RARITY_RANK: Record<string, number> = {
  common: 0,
  c: 0,
  uncommon: 1,
  u: 1,
  rare: 2,
  r: 2,
  mythic: 3,
  m: 3,
  special: 4,
  s: 4,
  bonus: 5,
  b: 5,
};

const KEY_ALIASES: Record<string, string> = {
  c: "color",
  color: "color",
  id: "identity",
  identity: "identity",
  t: "type",
  type: "type",
  o: "oracle",
  oracle: "oracle",
  kw: "keyword",
  keyword: "keyword",
  m: "mana",
  mana: "mana",
  mv: "manavalue",
  manavalue: "manavalue",
  cmc: "manavalue",
  f: "format",
  format: "format",
  legal: "format",
  banned: "banned",
  restricted: "restricted",
  r: "rarity",
  rarity: "rarity",
  e: "set",
  s: "set",
  set: "set",
  edition: "set",
  ci: "identity",
  commander: "identity",
  cn: "number",
  number: "number",
  pow: "power",
  power: "power",
  tou: "toughness",
  toughness: "toughness",
  loy: "loyalty",
  loyalty: "loyalty",
  a: "artist",
  artist: "artist",
  year: "year",
  date: "date",
  lang: "lang",
  language: "lang",
  produces: "produces",
  usd: "usd",
  eur: "eur",
  tix: "tix",
  frame: "frame",
  border: "border",
  game: "game",
  is: "is",
  not: "not",
  ft: "flavor",
  flavor: "flavor",
  name: "name",
  q: "name",
  oracleid: "oracleid",
  include: "include",
  unique: "unique",
  order: "order",
  direction: "direction",
  in: "in",
};

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re =
    /[a-zA-Z]+(?:<=|>=|!=|=|:|<|>)"[^"]*"|-(?:"[^"]*"|[^\s()]+)|!(?:"[^"]*"|[^\s()]+)|"[^"]*"|[()]|AND\b|and\b|OR\b|or\b|[^\s()]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) tokens.push(match[0]);
  return tokens;
}

function parseValue(raw: string) {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function parseExpr(tokens: string[], i: { at: number }): Node {
  const parts = [parseAnd(tokens, i)];
  while (tokens[i.at] && /^(OR|or)$/.test(tokens[i.at])) {
    i.at += 1;
    parts.push(parseAnd(tokens, i));
  }
  return parts.length === 1 ? parts[0] : { kind: "or", parts };
}

function parseAnd(tokens: string[], i: { at: number }): Node {
  const parts: Node[] = [];
  while (tokens[i.at] && tokens[i.at] !== ")" && !/^(OR|or)$/.test(tokens[i.at])) {
    if (/^(AND|and)$/.test(tokens[i.at])) {
      i.at += 1;
      continue;
    }
    parts.push(parseUnary(tokens, i));
  }
  if (!parts.length) return { kind: "name", value: "", exact: false };
  return parts.length === 1 ? parts[0] : { kind: "and", parts };
}

function parseUnary(tokens: string[], i: { at: number }): Node {
  const token = tokens[i.at];
  if (!token) return { kind: "name", value: "", exact: false };
  if (token === "(") {
    i.at += 1;
    const inner = parseExpr(tokens, i);
    if (tokens[i.at] === ")") i.at += 1;
    return inner;
  }
  if (token.startsWith("-") && token.length > 1) {
    tokens[i.at] = token.slice(1);
    return { kind: "not", inner: parseUnary(tokens, i) };
  }
  i.at += 1;
  return parseTerm(token);
}

function parseTerm(token: string): Node {
  if (token.startsWith("!") ) {
    return { kind: "name", value: parseValue(token.slice(1)), exact: true };
  }
  const match = token.match(/^([a-zA-Z]+)(<=|>=|!=|=|:|<|>)(.+)$/);
  if (match) {
    return { kind: "term", key: match[1].toLowerCase(), op: match[2] as Op, value: parseValue(match[3]) };
  }
  return { kind: "name", value: parseValue(token), exact: false };
}

export function parseScryfallQuery(query: string): { ok: true; node: Node | null } | { ok: false; error: string } {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, node: null };
  try {
    const tokens = tokenize(trimmed);
    const i = { at: 0 };
    const node = parseExpr(tokens, i);
    return { ok: true, node };
  } catch {
    return { ok: false, error: "Query Scryfall inválida." };
  }
}

function includesInsensitive(hay: string | null | undefined, needle: string) {
  return (hay ?? "").toLowerCase().includes(needle.toLowerCase());
}

function cmp(left: number, op: Op, right: number) {
  switch (op) {
    case ":":
    case "=":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    default:
      return false;
  }
}

function parseColors(value: string): { colors: string[]; colorless: boolean; multi: boolean } {
  const v = value.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "c" || v === "colorless" || v === "incolor") {
    return { colors: [], colorless: true, multi: false };
  }
  if (v === "m" || v === "multi" || v === "multicolor" || v === "multicolored") {
    return { colors: [], colorless: false, multi: true };
  }
  if (GUILDS[v]) return { colors: GUILDS[v], colorless: false, multi: false };
  const colors: string[] = [];
  let rest = v;
  while (rest.length) {
    let hit = false;
    for (const word of Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length)) {
      if (rest.startsWith(word)) {
        colors.push(COLOR_WORDS[word]);
        rest = rest.slice(word.length);
        hit = true;
        break;
      }
    }
    if (!hit) rest = rest.slice(1);
  }
  return { colors: [...new Set(colors)], colorless: false, multi: false };
}

function colorMatch(cardColors: string[], op: Op, value: string) {
  const parsed = parseColors(value);
  if (parsed.colorless) {
    const empty = cardColors.length === 0;
    return op === "!=" ? !empty : empty;
  }
  if (parsed.multi) {
    const multi = cardColors.length >= 2;
    return op === "!=" ? !multi : multi;
  }
  const have = new Set(cardColors);
  const want = parsed.colors;
  const hasAll = want.every((color) => have.has(color));
  const exact = hasAll && have.size === want.length;
  const subset = [...have].every((color) => want.includes(color));
  switch (op) {
    case ":":
    case ">=":
      return hasAll;
    case "=":
      return exact;
    case "!=":
      return !exact;
    case ">":
      return hasAll && have.size > want.length;
    case "<":
      return subset && have.size < want.length;
    case "<=":
      return subset;
    default:
      return hasAll;
  }
}

function statNumber(value: string | null) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function matchIs(card: CardFilters, value: string, negate = false) {
  const v = value.toLowerCase();
  const type = card.type_line.toLowerCase();
  const oracle = card.oracle_text.toLowerCase();
  const checks: Record<string, boolean> = {
    creature: type.includes("creature"),
    instant: type.includes("instant"),
    sorcery: type.includes("sorcery"),
    artifact: type.includes("artifact"),
    enchantment: type.includes("enchantment"),
    land: type.includes("land"),
    planeswalker: type.includes("planeswalker"),
    battle: type.includes("battle"),
    legendary: type.includes("legendary"),
    snow: type.includes("snow"),
    saga: type.includes("saga"),
    vehicle: type.includes("vehicle"),
    aura: type.includes("aura"),
    equipment: type.includes("equipment"),
    historic: type.includes("legendary") || type.includes("artifact") || type.includes("saga"),
    permanent:
      type.includes("creature") ||
      type.includes("artifact") ||
      type.includes("enchantment") ||
      type.includes("land") ||
      type.includes("planeswalker") ||
      type.includes("battle"),
    spell: type.includes("instant") || type.includes("sorcery"),
    commander:
      (type.includes("legendary") && type.includes("creature")) || oracle.includes("can be your commander"),
    vanilla: type.includes("creature") && !oracle.trim(),
    dfc: card.layout.includes("dfc") || card.layout === "transform" || card.layout === "modal_dfc",
    transform: card.layout === "transform",
    split: card.layout === "split",
    flip: card.layout === "flip",
    adventure: card.layout === "adventure",
    meld: card.layout === "meld",
    modal: card.layout === "modal_dfc" || card.layout === "adventure",
    mdfc: card.layout === "modal_dfc",
    companion: oracle.includes("companion —") || oracle.includes("companion -"),
    etched: card.finishes.includes("etched"),
    borderless: (card.border_color ?? "").toLowerCase() === "borderless",
    reprint: card.reprint,
    digital: card.digital,
    promo: card.promo,
    reserved: card.reserved,
    foil: card.finishes.includes("foil"),
    nonfoil: card.finishes.includes("nonfoil"),
    firstprint: !card.reprint,
    hybrid: card.mana_cost.includes("/"),
    phyrexian: /\{[^}]*P[^}]*\}/.test(card.mana_cost),
    colorless: card.colors.length === 0,
    monocolored: card.colors.length === 1,
    multicolored: card.colors.length >= 2,
    funny: false,
  };
  const hit = Boolean(checks[v]);
  return negate ? !hit : hit;
}

function matchTerm(card: CardFilters, key: string, op: Op, value: string): boolean {
  const mapped = KEY_ALIASES[key] ?? key;
  switch (mapped) {
    case "name": {
      const names = `${card.name} ${card.name_pt ?? ""}`;
      return op === "!=" ? !includesInsensitive(names, value) : includesInsensitive(names, value);
    }
    case "color":
      return colorMatch(card.colors, op, value);
    case "identity":
      return colorMatch(card.color_identity, op, value);
    case "type": {
      const wanted = TYPE_PT[value.toLowerCase()] ?? value;
      const hit = includesInsensitive(card.type_line, wanted);
      return op === "!=" ? !hit : hit;
    }
    case "oracle": {
      const text = card.oracle_text.replaceAll("~", card.name);
      const hit = includesInsensitive(text, value);
      return op === "!=" ? !hit : hit;
    }
    case "flavor": {
      const hit = includesInsensitive(card.flavor_text, value);
      return op === "!=" ? !hit : hit;
    }
    case "keyword": {
      const hit = card.keywords.some((kw) => kw.toLowerCase() === value.toLowerCase()) || includesInsensitive(card.oracle_text, value);
      return op === "!=" ? !hit : hit;
    }
    case "mana":
      return includesInsensitive(card.mana_cost.replace(/[{}]/g, ""), value.replace(/[{}]/g, ""));
    case "manavalue": {
      if (value === "even") return card.cmc % 2 === 0;
      if (value === "odd") return card.cmc % 2 === 1;
      return cmp(card.cmc, op, Number(value));
    }
    case "power": {
      const n = statNumber(card.power);
      return n == null ? false : cmp(n, op, Number(value));
    }
    case "toughness": {
      const n = statNumber(card.toughness);
      return n == null ? false : cmp(n, op, Number(value));
    }
    case "loyalty": {
      const n = statNumber(card.loyalty);
      return n == null ? false : cmp(n, op, Number(value));
    }
    case "rarity": {
      const left = RARITY_RANK[card.rarity] ?? -1;
      const right = RARITY_RANK[value.toLowerCase()] ?? -1;
      if (op === ":" || op === "=") return card.rarity.startsWith(value.toLowerCase()) || left === right;
      return cmp(left, op, right);
    }
    case "set":
      return card.set.toLowerCase() === value.toLowerCase() || includesInsensitive(card.set_name, value);
    case "in": {
      const v = value.toLowerCase();
      if (card.games.some((game) => game.toLowerCase() === v)) return true;
      return card.set.toLowerCase() === v;
    }
    case "oracleid":
      return (card.oracle_id ?? "").toLowerCase() === value.toLowerCase();
    case "include":
    case "unique":
    case "order":
    case "direction":
      return true;
    case "number":
      return (card.collector_number ?? "").toLowerCase() === value.toLowerCase();
    case "format":
      return (card.legalities[value.toLowerCase()] ?? "") === "legal";
    case "banned":
      return (card.legalities[value.toLowerCase()] ?? "") === "banned";
    case "restricted":
      return (card.legalities[value.toLowerCase()] ?? "") === "restricted";
    case "artist":
      return includesInsensitive(card.artist, value);
    case "year": {
      const year = Number((card.released_at ?? "").slice(0, 4));
      return Number.isFinite(year) ? cmp(year, op === ":" ? "=" : op, Number(value)) : false;
    }
    case "date":
      return cmp(Number((card.released_at ?? "").replaceAll("-", "") || 0), op === ":" ? "=" : op, Number(value.replaceAll("-", "")));
    case "lang":
      return value === "any" ? true : card.lang.toLowerCase() === value.toLowerCase();
    case "produces":
      return colorMatch(card.produced_mana, op, value.toUpperCase());
    case "usd":
      return card.usd != null && cmp(card.usd, op === ":" ? "=" : op, Number(value));
    case "eur":
      return card.eur != null && cmp(card.eur, op === ":" ? "=" : op, Number(value));
    case "tix":
      return card.tix != null && cmp(card.tix, op === ":" ? "=" : op, Number(value));
    case "frame":
      return includesInsensitive(card.frame, value);
    case "border":
      return includesInsensitive(card.border_color, value);
    case "game":
      return card.games.some((game) => game.toLowerCase() === value.toLowerCase());
    case "is":
      return matchIs(card, value);
    case "not":
      return matchIs(card, value, true);
    default:
      return includesInsensitive(`${card.name} ${card.type_line} ${card.oracle_text}`, value);
  }
}

function evalNode(card: CardFilters, node: Node): boolean {
  switch (node.kind) {
    case "and":
      return node.parts.every((part) => evalNode(card, part));
    case "or":
      return node.parts.some((part) => evalNode(card, part));
    case "not":
      return !evalNode(card, node.inner);
    case "name":
      if (!node.value) return true;
      if (node.exact) {
        return card.name.toLowerCase() === node.value.toLowerCase() || (card.name_pt ?? "").toLowerCase() === node.value.toLowerCase();
      }
      return includesInsensitive(card.name, node.value) || includesInsensitive(card.name_pt, node.value);
    case "term":
      return matchTerm(card, node.key, node.op, node.value);
    default:
      return true;
  }
}

export function matchScryfallQuery(card: CardFilters, query: string): boolean {
  const parsed = parseScryfallQuery(query);
  if (!parsed.ok || !parsed.node) return parsed.ok;
  return evalNode(card, parsed.node);
}
