// Recovery when on-demand code can't load. Every deploy replaces the hashed chunk files, so
// a tab opened before the deploy asks for files that no longer exist. The fix is to pick up
// the new service worker (if any) and reload onto the new build.

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chrome
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite CSS preload
  /Loading (CSS )?chunk .* failed/i,
];

/** True for errors thrown when a lazily loaded chunk (JS or CSS) fails to download. */
export function isChunkLoadError(err) {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const message = String(err.message ?? err);
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

/** Resolves on the next service-worker controller change, or after timeoutMs. */
function controllerChange(sw, timeoutMs) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      sw.removeEventListener('controllerchange', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    sw.addEventListener('controllerchange', done);
  });
}

/**
 * Checks for a new service worker and, if one is installing, waits (up to timeoutMs) for it
 * to take over before reloading; otherwise the old worker would serve the old index.html
 * and the same missing chunk again. Never rejects.
 */
export async function reloadApp({ timeoutMs = 4000, location = window.location } = {}) {
  try {
    const sw = navigator.serviceWorker;
    const reg = await sw?.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.installing || reg.waiting) await controllerChange(sw, timeoutMs);
    }
  } catch {
    // Offline or no service worker: a plain reload is still the best we can do.
  }
  location.reload();
}
