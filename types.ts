
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'image';
  content: string;
  mimeType?: string;
}
