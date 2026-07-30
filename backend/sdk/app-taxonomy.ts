// App Store taxonomy — the mobile-app catalog structure, mirroring the retail marketplace TAXONOMY so
// the App Store gets the same sections + subsections + serverless-GPU category tiles + search.
//   Level 1  top app categories (below)
//   Level 2  subsections per category (below)
// Category tiles are generated ONCE each on the serverless GPU (see aiAppCategoryImages), stored in
// CatalogCategory with kind:"app", exactly like the retail category tiles.

import type { TopCategory } from "./taxonomy.ts";

export const APP_TAXONOMY: TopCategory[] = [
  { name: "Games", subs: ["Action", "Adventure", "Arcade", "Board", "Card", "Casino", "Casual", "Educational", "Music", "Puzzle", "Racing", "Role Playing", "Simulation", "Sports", "Strategy", "Trivia", "Word"] },
  { name: "Productivity", subs: ["Notes", "To-Do & Tasks", "Calendar", "Docs & Office", "Email", "Cloud Storage", "Password Managers", "Document Scanners", "Home Screen Widgets"] },
  { name: "Social Networking", subs: ["Messaging", "Communities", "Dating", "Video Chat", "Forums", "Short Video", "Live Streaming"] },
  { name: "Entertainment", subs: ["Streaming Video", "Movies & TV", "Fan Communities", "Anime", "Live TV", "Ticketing"] },
  { name: "Photo & Video", subs: ["Photo Editing", "Camera", "Collage Makers", "Video Editing", "Filters & Effects", "GIF Makers"] },
  { name: "Music & Audio", subs: ["Streaming", "Radio", "Instruments", "DJ & Mixing", "Lyrics", "Podcasts"] },
  { name: "Education", subs: ["Language Learning", "Online Courses", "Kids Learning", "Test Prep", "Reference", "Flashcards"] },
  { name: "Finance", subs: ["Banking", "Budgeting", "Investing", "Crypto", "Payments", "Taxes", "Credit Score"] },
  { name: "Health & Fitness", subs: ["Workouts", "Running & Walking", "Meditation", "Sleep", "Nutrition", "Cycle Tracking", "Yoga"] },
  { name: "Shopping", subs: ["Marketplaces", "Coupons & Deals", "Fashion", "Grocery", "Rewards", "Price Trackers"] },
  { name: "Travel", subs: ["Flights", "Hotels", "Maps & Navigation", "Ride Share", "Travel Guides", "Currency"] },
  { name: "Food & Drink", subs: ["Delivery", "Recipes", "Restaurant Finder", "Reservations", "Grocery Lists"] },
  { name: "News & Magazines", subs: ["General News", "Local News", "Business", "Sports News", "Magazines"] },
  { name: "Business", subs: ["CRM", "Team Chat", "Project Management", "Invoicing", "Analytics", "HR & Payroll"] },
  { name: "Utilities", subs: ["Files", "Scanners", "VPN & Security", "Widgets", "Battery & Cleaner", "QR Scanners"] },
  { name: "Lifestyle", subs: ["Home & Design", "Astrology", "Habits", "Events", "Journaling", "Wellness"] },
  { name: "Books & Reference", subs: ["eBooks", "Audiobooks", "Comics", "Reading Lists", "Dictionaries"] },
  { name: "Weather", subs: ["Forecasts", "Radar", "Severe Alerts", "Widgets"] },
  { name: "Sports", subs: ["Live Scores", "Fantasy Sports", "Streaming", "News", "Stats"] },
  { name: "Kids", subs: ["Ages 5 & Under", "Ages 6–8", "Ages 9–11", "Learning", "Creativity"] },
  { name: "Navigation", subs: ["Maps", "Public Transit", "Offline Maps", "Parking"] },
  { name: "Medical", subs: ["Symptom Checkers", "Telehealth", "Health Records", "Medication Reminders"] },
  { name: "Developer Tools", subs: ["Code Editors", "API Clients", "Terminals", "Git Clients"] },
  { name: "Graphics & Design", subs: ["Design Tools", "Drawing", "3D & AR", "Icon Makers"] },
];

/** All app subsections flattened (level 2). */
export function allAppSubcategories(): string[] {
  return APP_TAXONOMY.flatMap((t) => t.subs);
}
export function appTopCategoryNames(): string[] { return APP_TAXONOMY.map((t) => t.name); }
export function appSubcategoriesOf(name: string): string[] {
  const key = (name || "").toLowerCase();
  return APP_TAXONOMY.find((t) => t.name.toLowerCase() === key)?.subs ?? [];
}
export function appTaxonomyCounts(): { categories: number; subcategories: number } {
  return { categories: APP_TAXONOMY.length, subcategories: allAppSubcategories().length };
}
/** Find which top category a subsection belongs to (for search/breadcrumbs). */
export function appCategoryForSub(sub: string): string | null {
  const key = (sub || "").toLowerCase();
  return APP_TAXONOMY.find((t) => t.subs.some((s) => s.toLowerCase() === key))?.name ?? null;
}
