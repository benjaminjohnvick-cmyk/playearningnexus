/**
 * useProductViewTracker
 * Tracks products a user views using localStorage (works on mobile, tablet & PC).
 * Persists viewed products so they can be auto-added to the wishlist on next login.
 */

const STORAGE_KEY = 'gg_viewed_products';
const MAX_TRACKED = 50; // cap to avoid bloat

export function trackProductView({ id, name, description = '', imageUrl = '', price = 0, vendorUrl = '', vendorName = '' }) {
  try {
    const existing = getTrackedProducts();
    // Avoid duplicates
    const filtered = existing.filter(p => p.id !== id);
    const updated = [
      { id, name, description, imageUrl, price, vendorUrl, vendorName, viewedAt: Date.now() },
      ...filtered
    ].slice(0, MAX_TRACKED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    // localStorage may be unavailable in some private browsers — fail silently
  }
}

export function getTrackedProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearTrackedProducts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Returns only products viewed since the last sync timestamp.
 * @param {number} sinceTimestamp - epoch ms
 */
export function getNewTrackedProductsSince(sinceTimestamp) {
  return getTrackedProducts().filter(p => p.viewedAt > (sinceTimestamp || 0));
}