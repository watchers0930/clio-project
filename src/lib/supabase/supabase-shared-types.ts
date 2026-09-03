export type UserRole = 'admin' | 'manager' | 'user';
export type FileStatus = 'uploading' | 'processing' | 'completed' | 'indexed' | 'error';
export type TemplateScope = 'department' | 'company';
export type TemplateType = TemplateScope;
export type DocumentStatus = 'draft' | 'completed';
export type ChannelType = 'department' | 'direct' | 'group';
// 선택 가능한 유형은 일반/회의 2개. deadline~other 는 과거 데이터 표시용으로만 유지.
export type EventType = 'general' | 'meeting' | 'deadline' | 'personal' | 'company' | 'cancelled' | 'other';
export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'active' | 'completed';
export type MemoColor = 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
export type QualityCategory = 'spelling' | 'format' | 'logic' | 'missing';
export type QualitySeverity = 'error' | 'warning' | 'suggestion';
