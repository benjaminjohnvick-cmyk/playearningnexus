// tutorial-content.ts — THE SINGLE SOURCE for both the in-app interactive tutorial and the downloadable
// guidebook, so the two can never drift. The in-app coach-marks read `trackSteps(track)`; the PDF guidebook is
// `renderGuidebookMarkdown()`. Pure (no I/O), so it's unit-testable and can be rendered anywhere.
//
// Honesty is baked into the copy: value is delivered, income is never guaranteed; users only ever get Site Cash;
// businesses are paid real money.

export type Track = "non_business" | "business";

export interface Step {
  id: string;
  title: string;
  body: string;
  target?: string;   // UI hint for the coach-mark (a route/element the app highlights)
  tryIt?: string;    // an interactive "try it" prompt
}

export const TUTORIAL: Record<Track, { label: string; intro: string; steps: Step[] }> = {
  non_business: {
    label: "For members (earn & get goods)",
    intro: "How to earn, what Site Cash is, and how to turn it into real goods — the honest version.",
    steps: [
      { id: "welcome", title: "Welcome", body: "This app lets you earn by doing simple things, then spend what you earn on real goods. You earn Site Cash — on-platform credit — and use it in the shop. It's value you build up, never a promise of a paycheck.", target: "/home", tryIt: "Tap around the home screen to see today's activities." },
      { id: "earn", title: "Earn today", body: "Earn by completing surveys and offers, and by chatting in Buddy Chat. Each earning counts toward your daily unlock (about $4/day) that opens extra features like hosting.", target: "/earn", tryIt: "Start one short survey to see how earning works." },
      { id: "sitecash", title: "What Site Cash is", body: "Site Cash is closed-loop store credit — it buys goods in the app and isn't cashed out. A small $1/day usage fee comes only from what you've already earned (never a bill, never a debt). If you haven't earned it, it isn't charged.", target: "/wallet", tryIt: "Open your wallet to see your Site Cash balance." },
      { id: "shop", title: "Shop the AI Social Shop", body: "Browse the shop right inside Buddy Chat. The top-selling items show automatically, and you can filter and search — a lot of that runs on your own device so it's fast.", target: "/shop", tryIt: "Search for something you'd actually want." },
      { id: "host_game", title: "Host a quick game", body: "Once you've hit your daily unlock, you can host a casual game or tournament. Prizes are in Site Cash and everything stays inside the app.", target: "/buddychat", tryIt: "Open the ＋ menu in Buddy Chat and look at 'Host a game'." },
      { id: "test_first", title: "Not sure? Test it first", body: "Thinking of selling something or hosting a video but unsure? Run a free validation survey to get real feedback before you commit. It's a signal to help you decide — not a promise it'll sell.", target: "/buddychat", tryIt: "Look at 'Test it first' in the ＋ menu." },
      { id: "translate", title: "In your language", body: "The app can auto-translate into your language and specific dialect. If a word isn't quite right, you can correct it — and the app remembers, getting better over time.", tryIt: "Set your language in Settings." },
      { id: "getgoods", title: "Get your goods", body: "When you're ready, spend your Site Cash on goods in the shop. That's the whole loop: earn → Site Cash → goods.", target: "/shop", tryIt: "Add something to your cart to see checkout in Site Cash." },
    ],
  },
  business: {
    label: "For businesses (sell & get paid)",
    intro: "How to sell on the platform, run live shopping, and get paid in real money — with the rules stated plainly.",
    steps: [
      { id: "welcome", title: "Welcome, seller", body: "You can list products, run live shopping, and advertise here. Buyers pay in Site Cash; you, as a business, are paid in real money. The platform's cut is a simple selling fee, not a revenue split.", target: "/seller", tryIt: "Open the seller area." },
      { id: "onboard", title: "Set up as a seller", body: "Complete seller onboarding, including KYC and tax (1099) details — these are required before any real-money payout. It's a one-time setup.", target: "/seller/onboarding", tryIt: "Start the seller onboarding checklist." },
      { id: "list", title: "List your products", body: "Add products to the catalog with clear titles, prices, and photos. The AI can help generate listing images.", target: "/seller/products", tryIt: "Draft one product listing." },
      { id: "fee", title: "The selling fee", body: "Selling mirrors Facebook Marketplace: 10% of the buyer-paid total (minimum $0.80) on shipped orders, and no fee on local pickup. Buyers pay Site Cash; you're paid the rest in real money after fulfillment.", tryIt: "Preview a sample order to see the fee and your net." },
      { id: "livestream", title: "Omni-Channel Livestream", body: "Your best sellers can be featured on live shopping channels that mirror the shop's categories, with AI-generated images and short commercials (clearly labeled as AI ads). It ties your catalog, livestream, and social together.", target: "/livestream", tryIt: "Browse the Omni-Channel Livestream category." },
      { id: "test_first", title: "Validate before you list", body: "Unsure a product will land? Run a free validation survey first and read the feedback (interest, would-buy, price). It's guidance, not a guarantee of sales.", target: "/seller/validate", tryIt: "Create a validation survey for an idea." },
      { id: "ads", title: "Advertise & go omni-channel", body: "Promote with PPC, and — only through accounts you've connected and consented to — simulcast a livestream across social with #ad disclosure. If a product isn't converting, an AI-hosted session can give it another push (disclosed as an AI ad).", target: "/seller/ads", tryIt: "Look at the advertising options." },
      { id: "payouts", title: "Get paid in real money", body: "Your proceeds (sale minus the fee) are released to you in real money through the standard payout pipeline after fulfillment. Users only ever receive Site Cash; businesses receive real money. Advertising delivers value — it never guarantees a specific ROI.", target: "/seller/payouts", tryIt: "Review your payout settings." },
    ],
  },
};

export const QUICKSTART: Record<Track, string[]> = {
  non_business: ["Complete one survey to start earning.", "Hit ~$4 today to unlock hosting.", "Spend Site Cash on goods in the shop."],
  business: ["Finish seller onboarding (KYC/tax).", "List a product.", "Optionally validate it with a free survey.", "Sell — 10%/$0.80 fee on shipped, free local; you're paid real money."],
};

export const FAQ: Array<{ q: string; a: string }> = [
  { q: "Can I cash out Site Cash?", a: "No — Site Cash is closed-loop store credit you spend on goods in the app. Businesses (not members) are paid in real money for sales." },
  { q: "Is the $1/day fee a bill?", a: "No. It comes only from what you've already earned that day, and never creates a debt. No earnings, no fee." },
  { q: "Will I earn a set amount?", a: "No amount is promised. You earn by completing activities; the app shows value, not guaranteed income." },
  { q: "What does the platform charge sellers?", a: "A Facebook-Marketplace-style fee: 10% (minimum $0.80) on shipped orders, free on local pickup." },
  { q: "Are AI hosts/commercials real people?", a: "No. They're clearly labeled as AI-generated ads (#ad) and never impersonate a real person or promise results." },
  { q: "What languages are supported?", a: "Essentially all — the app translates into your language and specific dialect, and learns corrections over time." },
];

export const RULES = "Plain rules: Site Cash is store credit (not cash) for members; businesses are paid real money; money and identity are handled securely on our servers; AI ads are disclosed; value is delivered but income and ROI are never guaranteed.";

/** Steps for one track (the in-app coach-marks). Pure. */
export function trackSteps(track: Track): Step[] {
  return (TUTORIAL[track]?.steps ?? []).map((s) => ({ ...s }));
}

/** Render the full guidebook (both tracks + quick-starts + FAQ + rules) as Markdown from this single source.
 *  Both the PDF guidebook and any in-app "read the guide" view use this, so they never drift. Pure. */
export function renderGuidebookMarkdown(): string {
  const L: string[] = [];
  L.push("# Get Goods Gratis — User Guidebook", "");
  L.push("*An end-to-end guide for members and businesses. Honest by design: Site Cash is store credit for members, businesses are paid real money, and no income or ROI is ever guaranteed.*", "");
  for (const track of ["non_business", "business"] as Track[]) {
    const t = TUTORIAL[track];
    L.push(`## ${t.label}`, "", t.intro, "");
    const quick = QUICKSTART[track].map((s, i) => (i + 1) + ") " + s).join("  ");
    L.push("**Quick start:** " + quick, "");
    for (const s of t.steps) {
      L.push(`### ${s.title}`, "", s.body, "");
      if (s.tryIt) L.push(`*Try it:* ${s.tryIt}`, "");
    }
  }
  L.push("## FAQ", "");
  for (const f of FAQ) L.push(`**${f.q}**`, "", f.a, "");
  L.push("## The rules, plainly", "", RULES, "");
  return L.join("\n");
}
