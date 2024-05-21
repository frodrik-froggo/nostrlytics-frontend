export type NostrAccountConnection = {
  type: 'input-keys' | 'generated-keys';
  publicKey: string;
  privateKey: string;
};
