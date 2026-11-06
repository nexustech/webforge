import type { StoreApi } from "zustand/vanilla";

/**
 * How many listeners follow `store` from now on: what's subscribed and not yet unsubscribed. For
 * tests that a closed dialog follows nothing (R9).
 */
export function followersOf<T>(store: Pick<StoreApi<T>, "subscribe">): () => number {
  let count = 0;
  const subscribe = store.subscribe.bind(store);
  store.subscribe = (listener) => {
    count += 1;
    const unsubscribe = subscribe(listener);
    let done = false;
    return () => {
      if (!done) count -= 1;
      done = true;
      unsubscribe();
    };
  };
  return () => count;
}
