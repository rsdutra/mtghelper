const USER_AGENT = "MTGHelper/0.1";
const SEARCH_INTERVAL_MS = 600;

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const searchQueue: QueueTask<unknown>[] = [];
let searchBusy = false;
let lastSearchAt = 0;

async function drainSearchQueue() {
  if (searchBusy) return;
  searchBusy = true;
  while (searchQueue.length) {
    const task = searchQueue.shift();
    if (!task) break;
    const wait = Math.max(0, SEARCH_INTERVAL_MS - (Date.now() - lastSearchAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSearchAt = Date.now();
    try {
      task.resolve(await task.run());
    } catch (error) {
      task.reject(error);
    }
  }
  searchBusy = false;
}

function enqueueSearch<T>(run: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    searchQueue.push({
      run: () => run() as Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    void drainSearchQueue();
  });
}

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  lang?: string;
  set: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  type_line?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  artist?: string;
  layout?: string;
  legalities?: Record<string, string>;
  produced_mana?: string[];
  frame?: string;
  border_color?: string;
  games?: string[];
  reprint?: boolean;
  digital?: boolean;
  promo?: boolean;
  reserved?: boolean;
  finishes?: string[];
  prices?: { usd?: string | null; eur?: string | null; tix?: string | null };
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{
    oracle_text?: string;
    type_line?: string;
    colors?: string[];
    mana_cost?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
    flavor_text?: string;
    image_uris?: { small?: string; normal?: string };
  }>;
};

async function scryfallFetch(path: string, init?: RequestInit, limited = true) {
  const run = async () => {
    const response = await fetch(`https://api.scryfall.com${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });

    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new Error("Scryfall limitou o acesso. Aguarde e tente de novo.");
    }
    if (!response.ok) {
      throw new Error(`Scryfall respondeu ${response.status}.`);
    }
    return response.json();
  };

  return limited ? enqueueSearch(run) : run();
}

export async function scryfallAutocomplete(query: string) {
  const data = (await scryfallFetch(
    `/cards/autocomplete?q=${encodeURIComponent(query)}`,
    undefined,
    false,
  )) as { data?: string[] } | null;
  return data?.data ?? [];
}

export async function scryfallSearch(query: string) {
  const data = (await scryfallFetch(
    `/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`,
  )) as { data?: ScryfallCard[] } | null;
  return data?.data ?? [];
}

export async function scryfallNamed(name: string, fuzzy = false) {
  const param = fuzzy ? "fuzzy" : "exact";
  return (await scryfallFetch(
    `/cards/named?${param}=${encodeURIComponent(name)}`,
  )) as ScryfallCard | null;
}

export async function scryfallCollection(names: string[]) {
  if (!names.length) return [] as ScryfallCard[];
  const data = (await scryfallFetch(`/cards/collection`, {
    method: "POST",
    body: JSON.stringify({ identifiers: names.slice(0, 75).map((name) => ({ name })) }),
  })) as { data?: ScryfallCard[] } | null;
  return data?.data ?? [];
}

export async function scryfallCollectionByIds(ids: string[]) {
  if (!ids.length) return [] as ScryfallCard[];
  const data = (await scryfallFetch(`/cards/collection`, {
    method: "POST",
    body: JSON.stringify({ identifiers: ids.slice(0, 75).map((id) => ({ id })) }),
  })) as { data?: ScryfallCard[] } | null;
  return data?.data ?? [];
}

export function imageFromCard(card: ScryfallCard) {
  const face = card.card_faces?.find((item) => item.image_uris?.normal);
  return {
    small: card.image_uris?.small ?? face?.image_uris?.small ?? null,
    normal: card.image_uris?.normal ?? face?.image_uris?.normal ?? null,
  };
}
