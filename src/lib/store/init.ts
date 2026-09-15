// src/lib/store/init.ts
import { globalRepo } from './repository';
import { seedDemoData } from './seed';

let isInitialized = false;

export function ensureInitialized() {
  if (!isInitialized) {
    if (globalRepo.projects.size === 0) {
      seedDemoData(globalRepo);
    }
    isInitialized = true;
  }
}
