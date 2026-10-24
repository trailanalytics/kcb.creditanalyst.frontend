import { toast } from '@/utils/dialogs'

/**
 * Registers the service worker (public/sw.js) in production builds only: during development it would cache the Vite dev
 * server's modules. When a new version has been installed while the app is open, tell the user to refresh.
 */
export function registerServiceWorker(isProduction = import.meta.env.PROD) {
  if (!isProduction || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              toast.info('A new version is ready. Refresh to update.', 'Update Available')
          })
        })
      })
      .catch((error) => console.warn('Service worker registration failed:', error))
  })
}
