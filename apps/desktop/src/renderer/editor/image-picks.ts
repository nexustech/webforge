/**
 * Requests to open the image picker of an element's image field (F-ED-25: *Edit* on an element
 * whose content is an image). The Edit panel's image field opens it for the selected element, now
 * if the field is shown, or once it is (the panel was on another tab).
 */
export type ImagePickRequests = {
  /** Asks for element `nodeId`'s image picker. */
  request(nodeId: string): void;
  /** Takes the request for element `nodeId`, if there is one: true once, then false. */
  take(nodeId: string | null): boolean;
  /** Calls `listener` on each request; returns a function that stops. */
  subscribe(listener: () => void): () => void;
};

/** A store for {@link ImagePickRequests}, one per editor. */
export function createImagePickRequests(): ImagePickRequests {
  let pending: string | null = null;
  const listeners = new Set<() => void>();
  return {
    request(nodeId) {
      pending = nodeId;
      for (const listener of listeners) listener();
    },
    take(nodeId) {
      if (pending === null || pending !== nodeId) return false;
      pending = null;
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
