import { useEffect, useRef, useState } from 'react';

/**
 * Runs `load()` (returning a promise) whenever `key` changes; a null key does nothing.
 * Returns { data, error, loading }. Results for an outdated key are ignored.
 */
export function useAsync(load, key) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [state, setState] = useState({ key: null, data: undefined, error: null });

  useEffect(() => {
    if (key == null) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => loadRef.current())
      .then(
        (data) => active && setState({ key, data, error: null }),
        (error) => active && setState({ key, data: undefined, error }),
      );
    return () => {
      active = false;
    };
  }, [key]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: key != null && !current,
  };
}
