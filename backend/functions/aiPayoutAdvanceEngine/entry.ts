import { __handler } from "../../sdk/runtime.ts";

// RETIRED. This engine used to (a) offer regular users an "instant cash advance" against future
// earnings — the same credit family as the retired Goods Advance — and (b) make platform-authored
// earning-velocity *predictions*, which the earnings_projections posture (OFF, FTC earnings-claims
// risk) does not allow. Both are out of the current compliant model:
//   • No credit/advance products originate (closed-loop; Save-to-Get is the no-debt replacement).
//   • The platform makes no forward earnings claims; the user-driven earnings_whatif calculator (built
//     only from the user's OWN history and labeled "not a prediction") is the compliant alternative.
// Kept as a disabled stub so nothing 404s; it neither predicts earnings nor creates any Payout.
export default __handler(async () => {
  return Response.json({
    ok: true,
    retired: true,
    qualifies_for_advance: false,
    message:
      "The payout advance has been retired. Cash advances against future earnings are no longer offered. " +
      "Use Save-to-Get to set aside your own earnings toward an item (no debt, nothing owed), and the " +
      "What-If calculator to explore your own earning history.",
    replacements: ["/SaveToGet", "/EarningsWhatIf"],
  });
});
