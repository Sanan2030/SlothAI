export interface WorkerResources {
  available: boolean;
  cores: number;
  memoryGB?: number;
  saveData?: boolean;
}
export interface WorkerBudget { editorWorkers: 1 | 2; speculate: boolean }

/** Bound model copies as well as CPU concurrency; unknown memory stays conservative. */
export function chooseWorkerBudget(resources: WorkerResources): WorkerBudget {
  const { available, cores, memoryGB, saveData } = resources;
  if (!available || saveData || !Number.isFinite(cores) || cores < 4
    || memoryGB !== undefined && (!Number.isFinite(memoryGB) || memoryGB < 4)) {
    return { editorWorkers: 1, speculate: false };
  }
  return { editorWorkers: cores >= 8 && memoryGB !== undefined && memoryGB >= 8 ? 2 : 1, speculate: true };
}

export function browserWorkerBudget(): WorkerBudget {
  if (typeof navigator === 'undefined') return { editorWorkers: 1, speculate: false };
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return chooseWorkerBudget({ available: typeof Worker !== 'undefined', cores: device.hardwareConcurrency,
    memoryGB: device.deviceMemory, saveData: device.connection?.saveData });
}
