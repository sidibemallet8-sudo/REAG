import net from 'node:net';

export function isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(
  preferredPort: number,
  host = '127.0.0.1',
  maxAttempts = 30
): Promise<number> {
  if (!Number.isInteger(preferredPort) || preferredPort < 1024 || preferredPort > 65535) {
    throw new Error(`Port de base invalide : ${preferredPort}`);
  }
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = preferredPort + offset;
    if (candidate > 65535) break;
    const free = await isPortAvailable(candidate, host);
    if (free) return candidate;
  }
  throw new Error(
    `Aucun port libre trouvé à partir de ${preferredPort} sur ${host} (${maxAttempts} tentatives).`
  );
}
