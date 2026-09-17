export function createWatchdog(idleMs: number, totalMs: number, expire: () => void) {
  let idle: ReturnType<typeof setTimeout>;
  const total = setTimeout(expire, totalMs);
  function touch() { clearTimeout(idle); idle = setTimeout(expire, idleMs); }
  touch();
  return { touch, clear() { clearTimeout(idle); clearTimeout(total); } };
}
