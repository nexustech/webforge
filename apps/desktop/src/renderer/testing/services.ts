import type { Service, ServiceUse } from "../editor/services.js";

/** A service and the value a test gives it. */
export type ServiceForTest = readonly [Service<unknown>, unknown];

/**
 * The window's services as a test gives them (#984), for an area registered alone: each token with
 * its value. Using one the test didn't give throws, naming it.
 */
export function servicesForTest(...entries: readonly ServiceForTest[]): ServiceUse {
  const values = new Map(entries.map(([service, value]) => [service.id, value]));
  return {
    use<T>(service: Service<T>): T {
      if (!values.has(service.id)) throw new Error(`The test gives no "${service.id}"`);
      return values.get(service.id) as T;
    },
  };
}
