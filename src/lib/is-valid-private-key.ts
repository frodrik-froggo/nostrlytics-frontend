import * as secp from '@noble/secp256k1';
import { nip19 } from 'nostr-tools';

export function isValidPrivateKey(privateKey: string | null | undefined): privateKey is string {
  if (!privateKey) {
    return false;
  }
  privateKey = privateKey.trim();
  const isValidHexKey = secp.utils.isValidPrivateKey(privateKey);
  const isValidBech32Key =
    privateKey.startsWith('nsec') &&
    secp.utils.isValidPrivateKey(nip19.decode(privateKey).data as string);
  return isValidHexKey || isValidBech32Key;
}
