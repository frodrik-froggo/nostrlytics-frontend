import { bytesToHex } from '@noble/hashes/utils';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

import { NostrAccountConnection } from '../types/nostr-account-connection';

export function connectGeneratedKeys() {
  const privateKey = generateSecretKey();
  if (!privateKey) {
    throw new Error('Failed to generate secret key');
  }
  const publicKey = getPublicKey(privateKey);
  return {
    type: 'generated-keys',
    publicKey,
    privateKey: bytesToHex(privateKey)
  } as NostrAccountConnection;
}
