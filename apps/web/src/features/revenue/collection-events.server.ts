interface CollectionEventBus {
  listeners: Set<(payload: string) => void>;
}

const globalEvents = globalThis as typeof globalThis & {
  eyeflowCollectionEvents?: CollectionEventBus;
};

function getEventBus(): CollectionEventBus {
  if (globalEvents.eyeflowCollectionEvents) return globalEvents.eyeflowCollectionEvents;
  const created: CollectionEventBus = { listeners: new Set() };
  globalEvents.eyeflowCollectionEvents = created;
  return created;
}

const eventBus = getEventBus();

export function publishCollectionChanged(): void {
  const payload = JSON.stringify({ changedAt: new Date().toISOString() });
  for (const listener of eventBus.listeners) listener(payload);
}

export function subscribeToCollectionChanges(listener: (payload: string) => void): () => void {
  eventBus.listeners.add(listener);
  return () => eventBus.listeners.delete(listener);
}
