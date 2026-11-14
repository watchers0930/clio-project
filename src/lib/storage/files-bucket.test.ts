import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departmentFolder, isAllowedStoragePath, isOwnedStoragePath, safeFileNameSegment } from '@/lib/storage/files-bucket';

const USER = '8ca93f49-8e25-4eb6-93a4-3ada1593623d';
const OTHER = '1b2c3d4e-0000-4000-8000-000000000000';

test('storage path guard: accepts the production path pattern of each kind', () => {
  assert.equal(isAllowedStoragePath(`uploads/${USER}/a1b2.pdf`, 'file'), true);
  assert.equal(isAllowedStoragePath('uploads/general/a1b2.docx', 'file'), true);
  assert.equal(isAllowedStoragePath('uploads/templates/a1b2.hwpx', 'file'), true);
  assert.equal(isAllowedStoragePath(`attachments/${USER}/1731_ab12cd34.png`, 'file'), true);
  assert.equal(isAllowedStoragePath(`generated/${USER}/a1b2.pdf`, 'document'), true);
  assert.equal(isAllowedStoragePath(`signatures/${USER}/signature.png`, 'signature'), true);
});

test('storage path guard: rejects other kinds\' prefixes (company seal/logo, signatures via file rows)', () => {
  assert.equal(isAllowedStoragePath('settings/company-seal.png', 'file'), false);
  assert.equal(isAllowedStoragePath('settings/company-logo.png', 'document'), false);
  assert.equal(isAllowedStoragePath(`signatures/${OTHER}/signature.png`, 'file'), false);
  assert.equal(isAllowedStoragePath(`generated/${USER}/a.pdf`, 'file'), false);
  assert.equal(isAllowedStoragePath(`uploads/general/a.pdf`, 'document'), false);
  assert.equal(isAllowedStoragePath(`contract-risk/${USER}/x.docx`, 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/', 'file'), false);
  assert.equal(isAllowedStoragePath('uploadsX/a.pdf', 'file'), false);
});

test('storage path guard: rejects traversal, absolute paths, backslashes, encodings and control chars', () => {
  assert.equal(isAllowedStoragePath('uploads/../settings/company-seal.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general/..', 'file'), false);
  assert.equal(isAllowedStoragePath('/uploads/general/a.pdf', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads\\..\\settings\\x.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/%2e%2e/settings/x.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/%2E%2E%2Fsettings/x.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general%2fx.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general%5Cx.png', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general/a\u0000.pdf', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general/a\n.pdf', 'file'), false);
  assert.equal(isAllowedStoragePath('uploads/general/a\u007f.pdf', 'file'), false);
});

test('storage path guard: rejects empty and non-string values', () => {
  assert.equal(isAllowedStoragePath('', 'file'), false);
  assert.equal(isAllowedStoragePath(null, 'file'), false);
  assert.equal(isAllowedStoragePath(undefined, 'document'), false);
  assert.equal(isAllowedStoragePath(42, 'signature'), false);
  assert.equal(isAllowedStoragePath(['uploads/general/a.pdf'], 'file'), false);
});

test('storage path guard: signature owner check only allows the owner\'s folder', () => {
  assert.equal(isAllowedStoragePath(`signatures/${USER}/signature.png`, 'signature', { userId: USER }), true);
  assert.equal(isAllowedStoragePath(`signatures/${OTHER}/signature.png`, 'signature', { userId: USER }), false);
  assert.equal(isAllowedStoragePath(`signatures/${USER}x/signature.png`, 'signature', { userId: USER }), false);
  assert.equal(isAllowedStoragePath(`signatures/${USER}/`, 'signature', { userId: USER }), false);
  assert.equal(isAllowedStoragePath(`signatures/${USER}/../${OTHER}/signature.png`, 'signature', { userId: USER }), false);
  assert.equal(isAllowedStoragePath('signatures//signature.png', 'signature', { userId: '' }), false);
});

test('department folder: uuid or general only (path injection → null → 400)', () => {
  assert.equal(departmentFolder(USER), USER);
  assert.equal(departmentFolder(undefined), 'general');
  assert.equal(departmentFolder(null), 'general');
  assert.equal(departmentFolder(''), 'general');
  assert.equal(departmentFolder('../settings'), null);
  assert.equal(departmentFolder(`${USER}/../../settings`), null);
  assert.equal(departmentFolder('general'), null);
  assert.equal(departmentFolder(123), null);
});

test('owned path: only inside the server-chosen owner folder', () => {
  const prefix = `autofill-temp/${USER}/`;
  assert.equal(isOwnedStoragePath(`${prefix}123-a.docx`, prefix), true);
  assert.equal(isOwnedStoragePath(prefix, prefix), false);
  assert.equal(isOwnedStoragePath('autofill-temp/other/x.docx', prefix), false);
  assert.equal(isOwnedStoragePath(`${prefix}../../signatures/x.png`, prefix), false);
  assert.equal(isOwnedStoragePath(`${prefix}%2e%2e/x`, prefix), false);
  assert.equal(isOwnedStoragePath(null, prefix), false);
});

test('safe file name segment: strips separators and parent refs', () => {
  assert.equal(safeFileNameSegment('계약서.docx'), '계약서.docx');
  assert.equal(safeFileNameSegment('../../x.docx'), '____x.docx');
  assert.equal(safeFileNameSegment('a\\b/c.docx'), 'a_b_c.docx');
  assert.ok(!safeFileNameSegment('../a/../b').includes('/'));
  assert.ok(!safeFileNameSegment('../a/../b').includes('..'));
});
