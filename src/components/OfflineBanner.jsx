import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      You are offline. Entries are saved on this device and will sync when you reconnect.
    </div>
  );
}
