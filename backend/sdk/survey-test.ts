// survey-test.ts — pure logic for "survey-test-first": an unsure user validates a product/video idea with a
// FREE survey before committing. This file defines the default validation question set and summarizes responses
// into a plain "will it sell?" read. It is a FEEDBACK SIGNAL, never a guaranteed-sales claim — the summary text
// says so, and no code here promises an outcome.

export interface ValidationQuestion { id: string; text: string; type: "scale" | "yes_no" | "currency" | "text"; }

/** Default product/video validation questions. Pure. An LLM can enrich these, but these stand alone. */
export function validationQuestions(subject = "this product"): ValidationQuestion[] {
  return [
    { id: "interest", text: `How interested are you in ${subject}? (1 = not at all, 5 = very)`, type: "scale" },
    { id: "would_buy", text: `Would you buy ${subject}?`, type: "yes_no" },
    { id: "price", text: `What would you expect to pay for ${subject}?`, type: "currency" },
    { id: "comment", text: `What would make you more likely to buy? Any feedback?`, type: "text" },
  ];
}

export interface ValidationSummary {
  responses: number;
  interest_pct: number;      // mean interest on 0..100
  would_buy_pct: number;     // % who said yes
  avg_expected_price: number;
  comments: string[];
  signal: "strong" | "mixed" | "weak" | "insufficient";
  headline: string;
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;

/** Summarize validation responses into a feedback read. Tolerant of answer field names. Pure. */
export function summarizeValidation(responses: Array<Record<string, unknown>>, minResponses = 5): ValidationSummary {
  const rows = (responses || []).map((r) => (r?.answers ?? r) as Record<string, unknown>);
  const n = rows.length;

  let interestSum = 0, interestN = 0, yes = 0, buyN = 0, priceSum = 0, priceN = 0;
  const comments: string[] = [];
  for (const a of rows) {
    const interest = Number(a?.interest);
    if (Number.isFinite(interest)) { interestSum += Math.max(1, Math.min(5, interest)); interestN++; }
    const buy = String(a?.would_buy ?? "").toLowerCase();
    if (buy === "yes" || buy === "no" || a?.would_buy === true || a?.would_buy === false) { buyN++; if (buy === "yes" || a?.would_buy === true) yes++; }
    const price = Number(a?.price ?? a?.expected_price);
    if (Number.isFinite(price) && price > 0) { priceSum += price; priceN++; }
    const c = String(a?.comment ?? a?.feedback ?? "").trim();
    if (c) comments.push(c.slice(0, 300));
  }

  const interest_pct = interestN ? round1(((interestSum / interestN) - 1) / 4 * 100) : 0; // map 1..5 → 0..100
  const would_buy_pct = buyN ? round1((yes / buyN) * 100) : 0;
  const avg_expected_price = priceN ? round1(priceSum / priceN) : 0;

  let signal: ValidationSummary["signal"];
  if (n < Math.max(1, minResponses)) signal = "insufficient";
  else if (would_buy_pct >= 60 && interest_pct >= 60) signal = "strong";
  else if (would_buy_pct >= 35 || interest_pct >= 45) signal = "mixed";
  else signal = "weak";

  const headline = signal === "insufficient"
    ? `Only ${n} response(s) so far — gather at least ${minResponses} for a read.`
    : signal === "strong"
      ? `Encouraging: ${would_buy_pct}% would buy, interest ${interest_pct}/100. (Feedback, not a guarantee.)`
      : signal === "mixed"
        ? `Mixed: ${would_buy_pct}% would buy, interest ${interest_pct}/100 — worth refining. (Feedback, not a guarantee.)`
        : `Weak so far: ${would_buy_pct}% would buy, interest ${interest_pct}/100 — reconsider or rework. (Feedback, not a guarantee.)`;

  return { responses: n, interest_pct, would_buy_pct, avg_expected_price, comments: comments.slice(0, 50), signal, headline };
}
