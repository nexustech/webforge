/**
 * `load`, run once and its result shared, until it fails: a failed load is forgotten, so the
 * next call tries again instead of failing the same way for the rest of the process (R15). The
 * codecs and the build worker's resources are loaded like this.
 */
export function onceUntilFailure<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
