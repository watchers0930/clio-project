export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  memberCount: number;
}

export interface UserItem {
  id: string;
  email: string;
  name: string;
  department_id: string | null;
  departmentName: string;
  role: string;
  is_active: boolean;
}

export const ROLES = [
  { value: 'admin', label: '관리자', color: 'text-red-500' },
  { value: 'manager', label: '매니저', color: 'text-blue-500' },
  { value: 'user', label: '사용자', color: 'text-gray-500' },
] as const;
