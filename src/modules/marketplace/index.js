// Marketplace (retail) module.
//
// The retail storefront and its Games subsection (app store + game store) are consolidated here as a
// single module. Page source files remain in src/pages/ (the router auto-registers that folder — see
// games/index.js), so this module is the organized home + import surface for all of it; behavior, URLs,
// and layout are unchanged.
export { default as Marketplace } from "./Marketplace.jsx";
export { default as PhysicalStore } from "./PhysicalStore.jsx";
export { default as DigitalStore } from "./DigitalStore.jsx";

// Games subsection (app store + game store).
export * as games from "./games/index.js";
