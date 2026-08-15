// contest-rules.ts — the canonical Official Rules for the weekly prize competition, assembled from
// live settings + the jurisdiction engine so the posted rules can never drift from how the code
// actually runs. This is the surface that makes the prize pool a compliant promotion:
//   • Winners are determined by SKILL / verified merit (no chance) — see processWeeklyJackpot — so the
//     "consideration" prong doesn't turn it into an illegal lottery.
//   • A genuine NO-PURCHASE-NECESSARY (AMOE) entry with equal odds/eligibility is offered anyway
//     (sweepstakesFreeEntry) as belt-and-suspenders.
//   • 18+ only, jurisdiction-gated, and prizes at/above a state's registration threshold are held for
//     registration/bonding review (prizeNeedsRegistration).
// NOT legal advice — have counsel approve the final Official Rules text and confirm state registrations.
import { snapNumber, snapString } from "./settings.ts";
import { ruleFor } from "./jurisdiction.ts";

export interface OfficialRules {
  sponsor: string;
  sponsor_address: string;
  eligibility: string;
  entry_methods: string[];
  winner_determination: string;
  prize: string;
  odds: string;
  registration_note: string;
  void_where_prohibited: string;
  governing_law: string;
  amoe_endpoint: string;
  min_age: number;
  reg_threshold_usd: number;
  sections: { heading: string; body: string }[];
}

export function officialRules(jurisdiction?: string | null): OfficialRules {
  const site = snapString("SITE_NAME", "the platform");
  const address = snapString("BUSINESS_MAILING_ADDRESS", "");
  const pool = snapNumber("WEEKLY_JACKPOT_POOL", 500);
  const rule = ruleFor(jurisdiction);
  const minAge = rule.min_age || snapNumber("MIN_AGE", 18);
  const regThreshold = rule.prize_registration_threshold ?? snapNumber("SWEEPSTAKES_REG_THRESHOLD", 5000);

  const eligibility =
    `Open only to legal residents of eligible jurisdictions who are ${minAge} years of age or older at the time of entry. ` +
    `Void where prohibited or restricted by law. Employees of ${site} and their immediate families are not eligible.`;
  const entry_methods = [
    "Merit entry: participate on the platform (e.g. drive verified, revenue-generating referrals); entries reflect your verified contribution.",
    "FREE entry (No Purchase Necessary): request one free entry per period via the AMOE endpoint below. A free entry has the SAME eligibility and the SAME chance to win as any other entry.",
  ];
  const winner_determination =
    "Winners are determined by SKILL / verified merit (ranked by performance and verified contribution), not by chance. " +
    "Ties are broken by earliest qualifying activity. Because outcomes turn on skill and verified activity — and a free entry " +
    "method is offered — the competition is not a lottery.";
  const prize =
    `Each weekly period awards a prize pool of approximately $${pool.toLocaleString()} in on-platform value, ` +
    `allocated among qualifying participants as described in these rules. Prizes have no cash-surrender value except where required by law.`;
  const registration_note =
    `Where a prize awarded to a resident of a given state meets or exceeds that state's sweepstakes registration threshold ` +
    `(e.g. $${regThreshold.toLocaleString()} in FL/NY), the award is held pending the required registration and/or surety bond before it is released.`;

  const sections = [
    { heading: "Sponsor", body: `${site}${address ? `, ${address}` : ""}.` },
    { heading: "Eligibility", body: eligibility },
    { heading: "How to Enter", body: entry_methods.join(" ") },
    { heading: "No Purchase Necessary", body: "No purchase or payment is necessary to enter or win. A purchase or payment will not increase your chances of winning. See the FREE entry method above." },
    { heading: "Winner Determination", body: winner_determination },
    { heading: "Prizes", body: prize },
    { heading: "State Registration", body: registration_note },
    { heading: "Void Where Prohibited", body: "This competition is void in any jurisdiction where it is prohibited or restricted by law, and is subject to all applicable federal, state, and local laws and regulations." },
    { heading: "Governing Law", body: `These Official Rules are governed by the laws of the United States and the state in which ${site} is organized, without regard to conflict-of-laws principles.` },
    { heading: "Winner List / Rules Requests", body: address ? `For a copy of these Official Rules or the winners list, write to: ${address}.` : "For a copy of these Official Rules or the winners list, contact platform support." },
  ];

  return {
    sponsor: site,
    sponsor_address: address,
    eligibility,
    entry_methods,
    winner_determination,
    prize,
    odds: "Because winners are determined by skill/verified merit rather than chance, fixed odds are not applicable; each eligible entry (including the free entry) is judged on the same basis.",
    registration_note,
    void_where_prohibited: "Void where prohibited by law.",
    governing_law: `United States; the state in which ${site} is organized.`,
    amoe_endpoint: "/functions/sweepstakesFreeEntry",
    min_age: minAge,
    reg_threshold_usd: regThreshold,
    sections,
  };
}

/** One-line disclosure to attach at every entry point / on the contest UI, next to the entry control. */
export function contestDisclosure(jurisdiction?: string | null): string {
  const r = officialRules(jurisdiction);
  return `No purchase necessary. Open to eligible residents ${r.min_age}+. Winners determined by skill/verified merit, not chance. Void where prohibited. See Official Rules.`;
}
