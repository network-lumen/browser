export interface Gateway {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'inactive' | 'error';
  owner: string;
}
