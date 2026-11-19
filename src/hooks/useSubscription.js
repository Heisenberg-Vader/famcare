import { useEffect, useRef, useState } from 'react';

/**
 * Runs `subscribe(onData, onError)` (which returns an unsubscribe function) whenever `key`
 * changes. Returns { data, error, loading, meta }. A null key subscribes to nothing.
 */
export function useSubscription(subscribe, key) {
  const subscribeRef = useRef(subscribe);
  useEffect(() => {
    subscribeRef.current = subscribe;
  });
  const [state, setState] = useState({ key: null, data: undefined, error: null, meta: null });

  useEffect(() => {
    if (key == null) return undefined;
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeRef.current(
        (data, meta = null) => active && setState({ key, data, error: null, meta }),
        (error) => active && setState({ key, data: undefined, error, meta: null }),
      );
    } catch (error) {
      queueMicrotask(() => active && setState({ key, data: undefined, error, meta: null }));
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [key]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    meta: current ? state.meta : null,
    loading: key != null && (!current || (state.data === undefined && !state.error)),
  };
}
