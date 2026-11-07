/** A saved version to republish (4.6b): its id, and its name as Version History shows it. */
export type VersionToRepublish = { readonly id: string; readonly name: string };

/**
 * What passes between Version History and Publish (4.6b): Version History asks for a version to be
 * republished, which Publish answers by asking where; Publish says when a publish has gone live,
 * and Version History lists its versions again, with where each was published.
 */
export type PublishRequests = {
  /** Asks for `version` to be republished; nothing happens while Publish isn't there to answer. */
  republish(version: VersionToRepublish): void;
  /** Answers each request to republish with `handler`, until the returned function is called. */
  onRepublish(handler: (version: VersionToRepublish) => void): () => void;
  /** Says a publish or a republish has gone live. */
  published(): void;
  /** Calls `listener` each time a publish has gone live; returns a function that stops. */
  onPublished(listener: () => void): () => void;
};

/** A {@link PublishRequests}, one per window. */
export function createPublishRequests(): PublishRequests {
  let handler: ((version: VersionToRepublish) => void) | undefined;
  const listeners = new Set<() => void>();
  return {
    republish(version) {
      handler?.(version);
    },
    onRepublish(next) {
      handler = next;
      return () => {
        if (handler === next) handler = undefined;
      };
    },
    published() {
      for (const listener of listeners) listener();
    },
    onPublished(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
