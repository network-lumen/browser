export interface Block {
  height: number;
  time: string;
  txs: number;
  validator: string;
  validatorAvatar?: string;
}
