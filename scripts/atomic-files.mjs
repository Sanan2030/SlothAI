import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { writeFileSync, renameSync, rmSync } from 'node:fs';

/** Publish a complete artifact by renaming a sibling file on the same filesystem. */
export async function atomicWrite(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function atomicWriteSync(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, data, { flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
