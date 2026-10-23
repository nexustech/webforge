import { useEffect, useRef, useState } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * A store of preferences a panel follows (the Add panel's favourites, the Edit panel's closed
 * groups), in step with the app's both ways: `given` goes into it whenever it changes, and only
 * the panel's own changes go to `onChange`, not what it was given back again. One store for the
 * editor's life, so a change never re-registers the panel (its tab stays).
 */
export function usePreferenceStore<T>(
  given: T,
  onChange: ((next: T) => void) | undefined,
): StoreApi<T> {
  const [store] = useState(() => createStore<T>()(() => given));
  const givenRef = useRef(given);
  useEffect(() => {
    givenRef.current = given;
    if (store.getState() !== given) store.setState(given, true);
  }, [store, given]);
  const save = useRef(onChange);
  useEffect(() => {
    save.current = onChange;
  });
  useEffect(
    () =>
      store.subscribe((next) => {
        if (next !== givenRef.current) save.current?.(next);
      }),
    [store],
  );
  return store;
}
