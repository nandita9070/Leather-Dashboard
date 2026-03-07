export type TaskType = 'Sample Dispatch' | 'General Task' | 'Discussion Point';
export type TaskStatus = 'Pending' | 'Completed';

export interface Merchant {
  id: number;
  name: string;
  email: string;
}

export interface Buyer {
  id: number;
  name: string;
  region: string;
  merchant_id: number;
  merchant_name?: string;
}

export interface ActionItem {
  id: number;
  type: TaskType;
  description: string;
  due_date: string | null;
  merchant_id: number;
  merchant_name?: string;
  buyer_id: number;
  buyer_name?: string;
  status: TaskStatus;
  created_at: string;
}
