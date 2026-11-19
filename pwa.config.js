// vite-plugin-pwa options. The service worker precaches the built app shell only.
// It must never runtime-cache API traffic (googleapis.com, firebaseio.com, identitytoolkit,
// securetoken): those responses contain patient data and auth tokens, and a service-worker
// cache survives sign-out. Firestore's own offline cache is wiped by secureSignOut instead.
export const FORBIDDEN_CACHE_HOSTS = Object.freeze([
  'googleapis.com',
  'firebaseio.com',
  'firebaseapp.com',
  'cloudfunctions.net',
]);

export const pwaOptions = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'CarePal Daily Care',
    short_name: 'CarePal',
    description: 'Daily care logs for nurses and families',
    theme_color: '#247466',
    background_color: '#f8fafc',
    display: 'standalone',
    start_url: '/',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
    navigateFallback: '/index.html',
    // Firebase Hosting reserved URLs (auth handler, init.json) must reach the network.
    navigateFallbackDenylist: [/^\/__\//],
    // Explicitly empty: no runtime caching of any cross-origin or API request.
    runtimeCaching: [],
    cleanupOutdatedCaches: true,
  },
  devOptions: { enabled: false },
};
