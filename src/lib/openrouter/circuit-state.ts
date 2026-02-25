export interface PersistedCircuitState {
  model: string;
  failures: number;
  openedAt?: number | undefined;
}

export interface CircuitStatePort {
  load(): Promise<PersistedCircuitState[]>;
  save(model: string, state: PersistedCircuitState): Promise<void>;
}
