/**
 * Services the window's areas share (#984, E1): what one area provides, such as Publish's record of
 * the last publish, and others use, without a field on the window's context for each. A service is
 * named by a token, defined in editor/ so that any area can import it, and typed by its value.
 */
export type Service<T> = {
  readonly id: string;
  /** Never set: carries `T`, so `use` returns the value's own type. */
  readonly value?: () => T;
};

/** A service's token: `defineService<StoreApi<number>>("publishedYear")`. */
export function defineService<T>(id: string): Service<T> {
  return { id };
}

/** How an area reaches the services it lists in its `uses` (and those it provides). */
export type ServiceUse = {
  use<T>(service: Service<T>): T;
};

/** A service an area provides: made once, before any area registers. */
export type Provision<Context> = {
  readonly service: Service<unknown>;
  readonly make: (ctx: Context) => unknown;
};

/**
 * Provides `service`, made by `make` from the window's context: its basics, and through `use` the
 * services the providing area uses.
 */
export function provide<T, Context>(
  service: Service<T>,
  make: (ctx: Context) => T,
): Provision<Context> {
  return { service, make };
}

/** What an area says of the services: those it provides and those it uses. */
export type ServiceNeeds<Context> = {
  readonly id: string;
  readonly provides?: readonly Provision<Context>[];
  readonly uses?: readonly Service<unknown>[];
};

/**
 * Checks what `areas` provide and use: every service used has a provider, and none has two. Throws
 * naming the first that doesn't, so the composition root's unit test fails rather than the window.
 */
export function checkServices<Context>(areas: readonly ServiceNeeds<Context>[]): void {
  const providers = new Map<string, string>();
  for (const area of areas) {
    for (const { service } of area.provides ?? []) {
      const other = providers.get(service.id);
      if (other !== undefined) {
        throw new Error(`"${service.id}" is provided by both ${other} and ${area.id}`);
      }
      providers.set(service.id, area.id);
    }
  }
  for (const area of areas) {
    for (const service of area.uses ?? []) {
      if (!providers.has(service.id)) {
        throw new Error(`${area.id} uses "${service.id}", which no area provides`);
      }
    }
  }
}

/**
 * Makes every service `areas` provide, once each, a service another uses first; returns each
 * area's context: `base` and its `use`. Throws when {@link checkServices} does, and on providers
 * that use each other in a cycle.
 */
export function makeServices<Context>(
  areas: readonly ServiceNeeds<Context>[],
  base: Omit<Context, keyof ServiceUse>,
): (area: ServiceNeeds<Context>) => Context {
  checkServices(areas);
  const provisions = new Map<
    string,
    Provision<Context> & { readonly area: ServiceNeeds<Context> }
  >();
  for (const area of areas) {
    for (const provision of area.provides ?? []) {
      provisions.set(provision.service.id, { ...provision, area });
    }
  }
  const made = new Map<string, unknown>();
  const making: string[] = [];
  const serviceValue = (id: string): unknown => {
    if (made.has(id)) return made.get(id);
    const provision = provisions.get(id);
    if (provision === undefined) throw new Error(`No area provides "${id}"`);
    if (making.includes(id)) {
      throw new Error(`Services use each other in a cycle: ${[...making, id].join(" → ")}`);
    }
    making.push(id);
    const value = provision.make(contextOf(provision.area));
    making.pop();
    made.set(id, value);
    return value;
  };
  const contextOf = (area: ServiceNeeds<Context>): Context => {
    const listed = new Set(
      [...(area.uses ?? []), ...(area.provides ?? []).map(({ service }) => service)].map(
        (service) => service.id,
      ),
    );
    const use = <T>(service: Service<T>): T => {
      if (!listed.has(service.id)) {
        throw new Error(`${area.id} uses "${service.id}" without listing it in its uses`);
      }
      return serviceValue(service.id) as T;
    };
    return { ...base, use } as Context;
  };
  for (const id of provisions.keys()) serviceValue(id);
  return contextOf;
}
