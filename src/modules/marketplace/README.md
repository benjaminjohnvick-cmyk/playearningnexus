# Marketplace (retail) module

Retail is consolidated here. The storefront and its **Games subsection** (the app store + the game
store) now have a single organized home.

```
src/modules/marketplace/
  index.js            ← retail module surface (Marketplace, PhysicalStore, DigitalStore, + games)
  Marketplace.jsx     ← re-export entry
  PhysicalStore.jsx   ← re-export entry
  DigitalStore.jsx    ← re-export entry
  games/              ← the app store + game store, as a subsection of the marketplace
    index.js
    Store.jsx / InAppGameStore.jsx / InAppStore.jsx / VirtualStore.jsx
    GameStore.jsx / GameDetail.jsx / GameGuides.jsx / GameVotingHub.jsx / FeaturedGameDashboard.jsx
```

## Why the page files still live in `src/pages/`

The router (`src/pages.config.js`) is **auto-generated** and **auto-registers every file in
`src/pages/`** as a route. Physically moving the page files out of `src/pages/` would deregister their
routes and change the site — the opposite of "keep the functionality and layout the same." So the files
stay in `src/pages/` for the router, and this module holds **re-export entry points**: it is the
organized home and the import surface for all app-store / game-store code. `App.jsx` loads the store /
game pages **through this module** (e.g. `import('@/modules/marketplace/games/Store')`).

Nothing about the running app changes — same URLs, same pages, same navigation, same layout. This is
purely an internal reorganization so the store + game store live inside the retail marketplace, in a
games subsection.

If the router is later changed to register pages from module folders too, these re-export files can be
swapped for the real page sources with no other edits.
