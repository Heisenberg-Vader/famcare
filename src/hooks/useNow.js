import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs` (drives "not recorded" and midnight rollover). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
