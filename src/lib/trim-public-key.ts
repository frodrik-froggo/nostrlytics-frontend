export function trimPublicKey(publicKey: string, length: number = 12): string {
  const startLength = Math.ceil(length / 2);
  const endLength = length - startLength;
  const firstPart = publicKey.slice(0, startLength);
  const lastPart = publicKey.slice(-endLength);
  return firstPart + '...' + lastPart;
}
