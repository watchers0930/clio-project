export interface Channel {
  id: string;
  name: string;
  type: 'department' | 'dm' | 'group';
  unread: number;
  lastMessage?: string;
  avatar?: string;
}

export interface SharedFileInfo {
  id: string;
  name: string;
  type: string | null;
  size: number;
}

export interface SharedDocumentInfo {
  id: string;
  title: string;
  status: string;
}

export interface Msg {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  time: string;
  isOwn: boolean;
  attachment?: { name: string; size: string };
  sharedFile?: SharedFileInfo | null;
  document?: SharedDocumentInfo | null;
}

export interface DeptTree {
  id: string;
  name: string;
  members: { id: string; name: string; email: string }[];
}

export interface MyFile {
  id: string;
  name: string;
  type: string;
  size: string;
}
