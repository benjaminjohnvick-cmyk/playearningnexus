// cosmetics.ts — the closed-loop virtual-goods economy. Users spend non-cashable Site Cash (current_balance,
// USD store credit) on cosmetic items (avatar frames, profile themes, badge flair, nameplates, profile
// effects). Purely on-platform: no real-money purchase, no cash value, non-tradeable, not a loot box — so it
// stays inside the closed-loop / non-money-transmission model. Economically it's a Site-Cash SINK that recaptures
// outstanding store-credit liability as margin (recorded as `breakage` revenue) and speeds the flywheel.
import { snapBool } from "./settings.ts";

export const cosmeticsEnabled = () => snapBool("COSMETICS_ENABLED", true);

export type CosmeticType = "avatar_frame" | "profile_theme" | "badge_flair" | "nameplate" | "profile_effect";
export interface CosmeticDef {
  key: string; name: string; type: CosmeticType; price_usd: number; rarity: "common" | "rare" | "epic" | "legendary";
  image_url?: string; description?: string;
}

// A starter catalog so the store isn't empty before an admin curates it (adminCosmeticUpsert overrides/extends).
export const DEFAULT_COSMETICS: CosmeticDef[] = [
  { key: "frame_bronze", name: "Bronze Frame", type: "avatar_frame", price_usd: 2, rarity: "common", description: "A clean bronze ring around your avatar." },
  { key: "frame_gold", name: "Gold Frame", type: "avatar_frame", price_usd: 6, rarity: "rare", description: "A polished gold avatar frame." },
  { key: "frame_neon", name: "Neon Pulse Frame", type: "avatar_frame", price_usd: 12, rarity: "epic", description: "An animated neon glow." },
  { key: "theme_midnight", name: "Midnight Theme", type: "profile_theme", price_usd: 4, rarity: "common", description: "A dark, focused profile look." },
  { key: "theme_aurora", name: "Aurora Theme", type: "profile_theme", price_usd: 10, rarity: "epic", description: "Soft aurora gradients on your profile." },
  { key: "flair_streak", name: "Streak Master Flair", type: "badge_flair", price_usd: 3, rarity: "rare", description: "A flame flair by your name." },
  { key: "flair_top1", name: "Top-Referrer Flair", type: "badge_flair", price_usd: 8, rarity: "epic", description: "Show off your referral rank." },
  { key: "nameplate_wave", name: "Wave Nameplate", type: "nameplate", price_usd: 5, rarity: "rare", description: "A rippling nameplate background." },
  { key: "nameplate_royal", name: "Royal Nameplate", type: "nameplate", price_usd: 14, rarity: "legendary", description: "A regal, animated nameplate." },
  { key: "effect_confetti", name: "Confetti Entrance", type: "profile_effect", price_usd: 7, rarity: "epic", description: "Confetti bursts when others view your profile." },
];

export function defaultByKey(key: string): CosmeticDef | undefined {
  return DEFAULT_COSMETICS.find((c) => c.key === key);
}

/** Normalize a stored CosmeticItem row OR a default def into the catalog shape the API returns. */
// deno-lint-ignore no-explicit-any
export function normalizeCosmetic(row: any): CosmeticDef & { active: boolean } {
  return {
    key: String(row.key ?? row.id ?? ""),
    name: String(row.name ?? "Cosmetic"),
    type: (row.type ?? "avatar_frame") as CosmeticType,
    price_usd: Math.max(0, Number(row.price_usd) || 0),
    rarity: (row.rarity ?? "common"),
    image_url: row.image_url ?? undefined,
    description: row.description ?? undefined,
    active: row.active !== false,
  };
}
