// Marketplace ▸ Games subsection.
//
// The app store and game store now live here as a subsection of the retail Marketplace module. The
// page source files physically remain in src/pages/ because the router (pages.config.js) AUTO-REGISTERS
// every file in src/pages/ — moving them out would deregister their routes and change the site. So these
// are re-export ENTRY POINTS: this module is the organized home + public interface for all app-store /
// game-store code, and the rest of the app imports it from here. Functionality, URLs, and layout are
// unchanged.
export { default as Store } from "./Store.jsx";                        // the "App Store" (🛒 Store)
export { default as InAppGameStore } from "./InAppGameStore.jsx";
export { default as InAppStore } from "./InAppStore.jsx";
export { default as VirtualStore } from "./VirtualStore.jsx";
export { default as GameStore } from "./GameStore.jsx";
export { default as GameDetail } from "./GameDetail.jsx";
export { default as GameGuides } from "./GameGuides.jsx";
export { default as GameVotingHub } from "./GameVotingHub.jsx";
export { default as FeaturedGameDashboard } from "./FeaturedGameDashboard.jsx";
