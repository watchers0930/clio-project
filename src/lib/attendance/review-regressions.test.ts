import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedMutationOrigins, mutationOrigin } from '@/lib/http/mutation-origins';
import { leaveFilters } from '@/lib/leave/leave-validation';
import { buildTemplateRenderData } from '@/lib/renderers/template-render-data';
import { buildTemplatePreviewData } from '@/lib/templates/template-preview';
import { createLeaveApplicationTemplateBundle } from '@/lib/templates/leave-application';

test('trusted deployment origins support previews and custom domains without accepting arbitrary hosts', () => {
  const env = {
    NODE_ENV: 'production', VERCEL_ENV: 'preview', VERCEL_URL: 'branch-abc.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'clio.example.com',
    CSRF_ALLOWED_ORIGINS: ' https://extra.example.com/ ,null,https://bad.example.com/path,https://u:p@bad.example.com',
  };
  const origins = allowedMutationOrigins(env);
  for (const value of ['https://branch-abc.vercel.app', 'https://clio.example.com', 'https://extra.example.com'])
    assert.ok(origins.has(value));
  for (const value of ['null', 'http://localhost:3000', 'https://evil.vercel.app', 'https://bad.example.com'])
    assert.equal(origins.has(value), false);
  assert.equal(allowedMutationOrigins({ ...env, VERCEL_ENV: 'production' }).has('https://branch-abc.vercel.app'), false);
  assert.ok(allowedMutationOrigins({ NODE_ENV: 'development' }).has('http://localhost:3000'));
  assert.equal(mutationOrigin(new Headers({ Origin: 'null', Referer: 'https://clio.example.com/page' })), null);
  assert.equal(mutationOrigin(new Headers({ Origin: 'https://clio.example.com/path' })), null);
  assert.equal(mutationOrigin(new Headers({ Referer: 'https://clio.example.com/page?q=1' })), 'https://clio.example.com');
  assert.equal(mutationOrigin(new Headers({ Host: 'clio.example.com' })), null);
});

test('leave scopes reject invalid, conflicting and duplicate filters', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  for (const query of ['scope=', 'scope=admin', 'scope=all&scope=self', 'userId=', 'userId=bad', `scope=self&userId=${id}`, 'status=draft&status=pending'])
    assert.throws(() => leaveFilters(new URLSearchParams(query)));
  assert.equal(leaveFilters(new URLSearchParams('scope=all')).scope, 'all');
  assert.equal(leaveFilters(new URLSearchParams({ userId: id })).userId, id);
});

test('leave rendering preserves SQL balance including zero, negative and noncomputable snapshots', () => {
  const templateBundle = createLeaveApplicationTemplateBundle();
  for (const remaining of ['0', '12.5', '-1', '계산 불가']) {
    const data = buildTemplateRenderData({
      markdown: '', title: '휴가원', templateBundle,
      documentInputs: { hire_date: '2020-01-01', used_leave_days: '999', remaining_leave_days: remaining },
    });
    assert.equal(data.replacements.remaining_leave_days, remaining);
  }
  const withoutBalance = buildTemplateRenderData({
    markdown: '', title: '휴가원', templateBundle,
    documentInputs: { hire_date: '2020-01-01' },
  });
  assert.equal(withoutBalance.replacements.remaining_leave_days, '서버 확인 필요');
  assert.equal(buildTemplatePreviewData(templateBundle, '휴가원').remaining_leave_days, '서버 확인 필요');
});
