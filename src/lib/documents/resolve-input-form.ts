import { parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { resolveBuiltinTemplateBundle, resolveBuiltinTemplateBundleByName } from '@/lib/templates/builtin';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { isLeaveApplicationTemplateName } from '@/lib/templates/leave-application';
import { isWeeklyReportTemplateName } from '@/lib/templates/weekly-report';
import { isEmploymentCertificateTemplateName } from '@/lib/templates/employment-certificate';
import { isWorklogTemplateName } from '@/lib/templates/worklog';

export type InputFormKind = 'leave' | 'weekly' | 'employment-cert' | 'worklog';
export interface ResolvedInputForm {
  kind: InputFormKind;
  templateName: string;
  fields: TemplateFieldDefinition[];
  ui: { leavePicker: boolean; certAutofill: boolean; weeklyRows: boolean };
}
export type ResolveInputFormResult =
  | { ok: true; form: ResolvedInputForm }
  | { ok: false; reason: 'not-target' | 'ambiguous' | 'no-inputs' | 'parse-error' };

function matchingKinds(name: string): InputFormKind[] {
  const matches: InputFormKind[] = [];
  if (isLeaveApplicationTemplateName(name)) matches.push('leave');
  if (isWeeklyReportTemplateName(name)) matches.push('weekly');
  if (isEmploymentCertificateTemplateName(name)) matches.push('employment-cert');
  if (isWorklogTemplateName(name)) matches.push('worklog');
  return matches;
}

/** Pure and safe to import from either server or client code. */
export function resolveDocumentInputForm(input: {
  title: string;
  templateId?: string | null;
  templateName?: string | null;
  content: string;
}): ResolveInputFormResult {
  const parsed = parseEmbeddedInputs(input.content);
  const byId = resolveBuiltinTemplateBundle(input.templateId);
  if (byId && matchingKinds(byId.name).length === 0) return { ok: false, reason: 'not-target' };
  const names = [input.templateName, parsed.ok ? parsed.inputs.__template_name : null]
    .filter((name): name is string => Boolean(name?.trim()));
  const namedKinds = new Set(names.flatMap(matchingKinds));
  if (namedKinds.size > 1) return { ok: false, reason: 'ambiguous' };
  const titleKinds = matchingKinds(input.title);
  const candidate = byId ?? names.map(resolveBuiltinTemplateBundleByName).find(Boolean) ?? null;
  if (byId && namedKinds.size && !namedKinds.has(matchingKinds(byId.name)[0])) {
    return { ok: false, reason: 'ambiguous' };
  }
  // An explicit custom (or missing/deleted) template ID takes precedence over names.
  // DB names and embedded metadata can collide with builtin names too.
  if (!byId && input.templateId) {
    return { ok: false, reason: titleKinds.length || candidate ? 'ambiguous' : 'not-target' };
  }
  if (!candidate && names.length) {
    return { ok: false, reason: titleKinds.length ? 'ambiguous' : 'not-target' };
  }
  if (!candidate && titleKinds.length > 1) return { ok: false, reason: 'ambiguous' };
  const resolved = candidate ?? resolveBuiltinTemplateBundleByName(input.title);
  const kinds = resolved ? matchingKinds(resolved.name) : [];
  if (!resolved || kinds.length !== 1) {
    return { ok: false, reason: parsed.ok && !resolved ? 'ambiguous' : 'not-target' };
  }
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason === 'no-comment' ? 'no-inputs'
      : parsed.reason === 'proposal' ? 'not-target' : 'parse-error' };
  }
  const kind = kinds[0];
  return { ok: true, form: {
    kind,
    templateName: resolved.name,
    fields: resolved.bundle.fields,
    ui: { leavePicker: kind === 'leave', certAutofill: kind === 'employment-cert', weeklyRows: kind === 'weekly' },
  } };
}
