/** A factory function that creates an instance of type T. */
type Factory<T> = () => T;

/** Simple dependency injection container with singleton and transient support. */
class DIContainer {
  private static instances = new Map<string, unknown>();
  private static factories = new Map<string, Factory<unknown>>();
  private static resolving = new Set<string>();

  /** Registers a transient factory for the given token. */
  static register<T>(token: string, factory: Factory<T>): void {
    this.factories.set(token, factory as Factory<unknown>);
  }

  /** Registers a singleton factory. The factory is called once and the result is cached. */
  static registerSingleton<T>(token: string, factory: Factory<T>): void {
    this.factories.set(token, () => {
      if (!this.instances.has(token)) {
        this.instances.set(token, factory());
      }
      return this.instances.get(token) as T;
    });
  }

  /** Resolves an instance for the given token. Throws if not registered or circular. */
  static resolve<T>(token: string): T {
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${token}`);
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Dependency not registered: ${token}`);
    }

    this.resolving.add(token);
    try {
      return factory() as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /** Checks whether a factory is registered for the given token. */
  static isRegistered(token: string): boolean {
    return this.factories.has(token);
  }

  /** Clears all registered factories and cached singleton instances. */
  static clear(): void {
    this.instances.clear();
    this.factories.clear();
    this.resolving.clear();
  }
}

export { DIContainer };
