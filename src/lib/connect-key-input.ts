import { hexToBytes } from '@noble/hashes/utils';
import { getPublicKey, nip19 } from 'nostr-tools';

import { NostrAccountConnection } from '../types/nostr-account-connection';
import { isValidPrivateKey } from './is-valid-private-key';

export function connectKeyInput() {
  let privateKeyInput = window.prompt('Enter your private nostr private key');
  if (!isValidPrivateKey(privateKeyInput)) {
    throw new Error('Invalid private key');
  }
  privateKeyInput = privateKeyInput.trim();
  const privateKeyHex = privateKeyInput.startsWith('nsec')
    ? (nip19.decode(privateKeyInput).data as string)
    : privateKeyInput;

  const publicKey = getPublicKey(hexToBytes(privateKeyHex));

  return {
    type: 'input-keys',
    publicKey,
    privateKey: privateKeyHex
  } as NostrAccountConnection;
}
