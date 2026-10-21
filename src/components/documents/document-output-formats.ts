import type { TemplateItem as Template } from '@/components/documents/page-types';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';

export type AllowedOutputFormat = 'docx' | 'hwpx' | 'pdf' | 'xlsx' | 'pptx';

export function interpolateFieldDefaultValue(value: string, inputs: Record<string, string>, fields: TemplateFieldDefinition[]) {
  return value.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const normalizedKey = key.trim();
    const inputValue = inputs[normalizedKey]?.trim();
    if (inputValue) return inputValue;
    // 미입력 필드는 예시(placeholder)를 값으로 채우지 않고 비워둔다.
    return '';
  });
}

export function getAllowedOutputFormats(templateFile: Template['templateFile'] | null | undefined, isContract: boolean, templateMode?: string, templateName?: string): AllowedOutputFormat[] {
  if (isContract) return ['hwpx'];
  if (templateName && /재직\s*증명서/.test(templateName)) return ['pdf'];
  if (templateMode === 'html-template') return ['docx', 'pdf'];
  if (!templateFile?.name) return ['docx', 'pdf', 'xlsx', 'pptx'];

  const ext = templateFile.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx' || ext === 'dotx') return ['docx', 'pdf'];
  if (ext === 'hwpx' || ext === 'hwp') return ['hwpx', 'pdf'];
  if (ext === 'xlsx' || ext === 'xls') return ['xlsx'];
  if (ext === 'pptx' || ext === 'ppt') return ['pptx'];
  return ['docx', 'pdf', 'xlsx', 'pptx'];
}
