export interface Committee {
  id?: number;
  name: string;
  contribution: number;
  startDate: string;
  allowHalfShare: boolean;
}

export type ShareType = 'Full' | 'Half';

export interface Member {
  id?: number;
  committeeId: number;
  name: string;
  phone: string;
  shareType: ShareType;
  pairId?: number;
}

export interface Pair {
  id?: number;
  committeeId: number;
  member1Id: number;
  member2Id: number;
  name: string;
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Late';
export type PayerType = 'member' | 'pair';

export interface Payment {
  id?: number;
  committeeId: number;
  payerId: number; // memberId or pairId
  payerType: PayerType;
  month: number; // 0-indexed month of the committee cycle
  status: PaymentStatus;
  paidOn?: string;
}

export interface Draw {
  id?: number;
  committeeId: number;
  month: number; // 0-indexed month of the committee cycle
  winnerId: number; // memberId or pairId
  winnerType: PayerType;
  drawDate: string;
}

export interface AppData {
  committees: Committee[];
  members: Member[];
  pairs: Pair[];
  payments: Payment[];
  draws: Draw[];
}
