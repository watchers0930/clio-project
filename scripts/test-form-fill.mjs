import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

function normalizeComparableText(value) {
  return String(value ?? '').replace(/[\s\u3000()]/g, '').toLowerCase();
}

function includesNormalized(text, pattern) {
  return normalizeComparableText(text).includes(normalizeComparableText(pattern));
}

function findBlocks(xml, tagName) {
  const blocks = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf(openTag, pos);
    if (start === -1) break;
    let depth = 1;
    let scan = start + openTag.length;
    while (depth > 0 && scan < xml.length) {
      const nextOpen = xml.indexOf(openTag, scan);
      const nextClose = xml.indexOf(closeTag, scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = nextOpen + openTag.length;
      } else {
        depth--;
        scan = nextClose + closeTag.length;
      }
    }
    blocks.push({ content: xml.slice(start, scan), start, end: scan });
    pos = scan;
  }
  return blocks;
}

function extractDocxCellText(cellXml) {
  const texts = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = regex.exec(cellXml)) !== null) texts.push(match[1]);
  return texts.join('').trim();
}

function extractDocxGridSpan(cellXml) {
  const match = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function isDocxVMergeContinuation(cellXml) {
  if (!/<w:vMerge/.test(cellXml)) return false;
  return !/<w:vMerge\s+w:val="restart"/.test(cellXml);
}

function extractDocxTableStructure(templateBuffer) {
  const zip = new PizZip(templateBuffer);
  const docXml = zip.file('word/document.xml')?.asText() ?? '';
  const tables = findBlocks(docXml, 'w:tbl');
  const result = { tables: [], emptyCells: [], hasEmptyCells: false };

  tables.forEach((tbl, tableIndex) => {
    const rows = findBlocks(tbl.content, 'w:tr');
    const parsedRows = [];
    let headers = [];

    rows.forEach((tr, rowIndex) => {
      const cells = findBlocks(tr.content, 'w:tc');
      const row = [];
      cells.forEach((tc, colIndex) => {
        if (isDocxVMergeContinuation(tc.content)) return;
        const text = extractDocxCellText(tc.content);
        const isEmpty = text.replace(/[\d.]/g, '').trim() === '';
        row.push({
          fieldId: `field_${tableIndex}_${rowIndex}_${colIndex}`,
          tableIndex,
          rowIndex,
          colIndex,
          isEmpty,
          text,
          contextLabel: '',
          gridSpan: extractDocxGridSpan(tc.content),
        });
      });
      if (rowIndex === 0) headers = row.map((cell) => cell.text);
      parsedRows.push(row);
    });

    for (let r = 0; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        const leftNeighbor = c > 0 ? parsedRows[r][c - 1] : null;
        cell.contextLabel = leftNeighbor && !leftNeighbor.isEmpty && leftNeighbor.text
          ? leftNeighbor.text
          : (r > 0 ? (headers[c] ?? '') : '');
        if (cell.isEmpty) result.emptyCells.push(cell);
      }
    }

    result.tables.push({ tableIndex, headers, rows: parsedRows });
  });

  result.hasEmptyCells = result.emptyCells.length > 0;
  return result;
}

function extractHwpxCellText(cellXml) {
  const texts = [];
  const regex = /<(?:hp:)?t[^>]*>([^<]*)<\/(?:hp:)?t>/g;
  let match;
  while ((match = regex.exec(cellXml)) !== null) texts.push(match[1]);
  return texts.join('').trim();
}

function extractHwpxColSpan(cellXml) {
  const match = cellXml.match(/colSpan="(\d+)"/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function extractHwpxTableStructure(templateBuffer) {
  const zip = new PizZip(templateBuffer);
  const sectionFile = Object.keys(zip.files).find((name) => /^Contents\/section\d+\.xml$/i.test(name));
  if (!sectionFile) return null;
  const sectionXml = zip.file(sectionFile)?.asText() ?? '';
  if (!sectionXml) return null;

  const tblTag = sectionXml.includes('<hp:tbl') ? 'hp:tbl' : 'tbl';
  const trTag = sectionXml.includes('<hp:tr') ? 'hp:tr' : 'tr';
  const tcTag = sectionXml.includes('<hp:tc') ? 'hp:tc' : 'tc';
  const tables = findBlocks(sectionXml, tblTag);
  const result = { tables: [], emptyCells: [], hasEmptyCells: false };

  tables.forEach((tbl, tableIndex) => {
    const rows = findBlocks(tbl.content, trTag);
    const parsedRows = [];
    let headers = [];

    rows.forEach((tr, rowIndex) => {
      const cells = findBlocks(tr.content, tcTag);
      const row = cells.map((tc, colIndex) => {
        const text = extractHwpxCellText(tc.content);
        return {
          fieldId: `field_${tableIndex}_${rowIndex}_${colIndex}`,
          tableIndex,
          rowIndex,
          colIndex,
          isEmpty: text.replace(/[\d.]/g, '').trim() === '',
          text,
          contextLabel: '',
          gridSpan: extractHwpxColSpan(tc.content),
        };
      });
      if (rowIndex === 0) headers = row.map((cell) => cell.text);
      parsedRows.push(row);
    });

    for (let r = 0; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        const leftNeighbor = c > 0 ? parsedRows[r][c - 1] : null;
        cell.contextLabel = leftNeighbor && !leftNeighbor.isEmpty && leftNeighbor.text
          ? leftNeighbor.text
          : (r > 0 ? (headers[c] ?? '') : '');
        if (cell.isEmpty) result.emptyCells.push(cell);
      }
    }

    result.tables.push({ tableIndex, headers, rows: parsedRows });
  });

  result.hasEmptyCells = result.emptyCells.length > 0;
  return result;
}

function extractMeta(instructions, key) {
  const match = instructions.match(new RegExp(`${key}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() ?? '';
}

function extractMetaByKeys(instructions, keys) {
  for (const key of keys) {
    const value = extractMeta(instructions, key);
    if (value) return value;
  }
  return '';
}

function extractSection(instructions, sectionName) {
  const match = instructions.match(new RegExp(`(?:${sectionName})[ \\t]*:[ \\t]*([\\s\\S]*?)(?=\\n[^\\n:]+[ \\t]*:|$)`));
  return (match?.[1] ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*]?\s*/, '').trim())
    .filter(Boolean);
}

function findFieldByLabel(structure, label) {
  for (const table of structure.tables) {
    for (const row of table.rows) {
      for (let c = 0; c < row.length; c++) {
        if (includesNormalized(row[c].text, label)) {
          if (c + 1 < row.length && row[c + 1].isEmpty) return row[c + 1].fieldId;
        }
      }
    }
  }
  return null;
}

function findFieldByLabels(structure, labels) {
  for (const label of labels) {
    const fieldId = findFieldByLabel(structure, label);
    if (fieldId) return fieldId;
  }
  return null;
}

function findBodyCells(structure, headerText) {
  const fieldIds = [];
  for (const table of structure.tables) {
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      for (let c = 0; c < row.length; c++) {
        if (includesNormalized(row[c].text, headerText)) {
          for (let br = r + 1; br < table.rows.length; br++) {
            const bodyCell = table.rows[br][c];
            if (bodyCell?.isEmpty) fieldIds.push(bodyCell.fieldId);
          }
          return fieldIds;
        }
      }
    }
  }
  return fieldIds;
}

function findBodyCellsByHeaders(structure, headerTexts) {
  for (const headerText of headerTexts) {
    const ids = findBodyCells(structure, headerText);
    if (ids.length > 0) return ids;
  }
  return [];
}

function mapFormDataDirect(structure, instructions) {
  const result = {};
  const metaMappings = [
    { keys: ['보고번호'], labels: ['보고번호'] },
    { keys: ['작성일자', '작성일', '회의 일자', '회의일자', '회의 일시', '회의일시'], labels: ['작성일자', '작성일', '회의 일자', '회의일시'] },
    { keys: ['작성자', '작성자명', '담당'], labels: ['작성자', '작성자명', '작성', '담당'] },
    { keys: ['부서명', '부서', '보고처', '보고처(부서)', '작성자 소속', '작성자소속'], labels: ['부서', '보고처', '보고처(부서)', '작성자 소속', '작성자소속'] },
    { keys: ['제목', '보고서명', '보고서', '일일 업무 보고', '일일 업무 보고서', '일일업무보고', '일일업무보고서'], labels: ['제목', '보고서명', '보고서', '일일 업무 보고', '일일 업무 보고서', '일일업무보고', '일일업무보고서'] },
    { keys: ['회의 시간', '회의시간'], labels: ['회의 시간', '회의시간'] },
    { keys: ['장소'], labels: ['장소'] },
    { keys: ['참석자'], labels: ['참석자'] },
  ];

  for (const mapping of metaMappings) {
    const value = extractMetaByKeys(instructions, mapping.keys);
    const fieldId = findFieldByLabels(structure, mapping.labels);
    if (value && fieldId) result[fieldId] = value;
  }

  const todayItems = extractSection(instructions, '금일\\s*업무');
  const tomorrowItems = extractSection(instructions, '명일\\s*업무');
  const bigoItems = extractSection(instructions, '비고');
  const meetingContentItems = extractSection(instructions, '회의\\s*내용(?:\\s*\\(요약\\))?|보고\\s*내용과\\s*의견');
  const meetingResultItems = extractSection(instructions, '회의\\s*결과|문제점');
  const sourceItems = extractSection(instructions, '정보\\s*\\(자료\\)\\s*출처|정보\\s*출처');

  const todayCells = findBodyCellsByHeaders(structure, ['금일 업무 내용', '금일업무내용']);
  const tomorrowCells = findBodyCellsByHeaders(structure, ['명일 업무 내용', '명일업무내용']);
  const meetingContentCells = findBodyCellsByHeaders(structure, ['회의 내용 (요약)', '회의 내용', '보고 내용과 의견', '보고내용과의견']);
  const meetingResultCells = findBodyCellsByHeaders(structure, ['회의 결과', '문제점']);
  const sourceCells = findBodyCellsByHeaders(structure, ['정보(자료) 출처', '정보 출처', '정보출처']);

  for (let i = 0; i < Math.min(todayItems.length, todayCells.length); i++) result[todayCells[i]] = todayItems[i];
  for (let i = 0; i < Math.min(tomorrowItems.length, tomorrowCells.length); i++) result[tomorrowCells[i]] = tomorrowItems[i];
  for (let i = 0; i < Math.min(meetingContentItems.length, meetingContentCells.length); i++) result[meetingContentCells[i]] = meetingContentItems[i];
  for (let i = 0; i < Math.min(meetingResultItems.length, meetingResultCells.length); i++) result[meetingResultCells[i]] = meetingResultItems[i];
  for (let i = 0; i < Math.min(sourceItems.length, sourceCells.length); i++) result[sourceCells[i]] = sourceItems[i];

  if (bigoItems.length > 0) {
    for (const table of structure.tables) {
      for (const row of table.rows) {
        for (let c = 0; c < row.length; c++) {
          if (includesNormalized(row[c].text, '비고') && c + 1 < row.length && row[c + 1].isEmpty) {
            result[row[c + 1].fieldId] = bigoItems.join(', ');
          }
        }
      }
    }
  }

  return result;
}

function applyFormDataRuntimeOverrides(formData, cells, meta) {
  let reportOwnerFilled = false;

  for (const cell of cells) {
    const label = cell.contextLabel;

    if (/작성자\s*명|^작성자$|^작성$|^담당$/.test(label)) formData[cell.fieldId] = meta.userName;
    if (/작성자\s*직급/.test(label)) formData[cell.fieldId] = meta.userPosition;
    if (/작성자\s*소속/.test(label)) formData[cell.fieldId] = meta.userDept;
    if (/회의\s*(일시|일자)/.test(label)) formData[cell.fieldId] = meta.todayStr;
    if (/^(소속|성명|연락처|서명)$/.test(label)) formData[cell.fieldId] = '';
    if (/보고처/.test(label)) formData[cell.fieldId] = meta.userDept;
    if (/보고서명|^보고서$/.test(label)) formData[cell.fieldId] = meta.templateName;

    if (/보고서\s*\(/.test(label)) {
      if (cell.rowIndex === 1 && cell.colIndex === 0 && !reportOwnerFilled) {
        formData[cell.fieldId] = meta.userName;
        reportOwnerFilled = true;
      } else {
        formData[cell.fieldId] = '';
      }
    }
  }

  return formData;
}

function trimSingleColumnStructure(structure) {
  const firstPerTable = new Map();
  for (const cell of structure.emptyCells) {
    const prev = firstPerTable.get(cell.tableIndex);
    if (prev === undefined || cell.rowIndex < prev) firstPerTable.set(cell.tableIndex, cell.rowIndex);
  }
  return {
    ...structure,
    emptyCells: structure.emptyCells.filter((cell) => {
      const colCount = structure.tables[cell.tableIndex]?.rows[0]?.length ?? 1;
      return colCount > 1 || cell.rowIndex === firstPerTable.get(cell.tableIndex);
    }),
  };
}

const fixtures = [
  {
    name: '업무일지 DOCX',
    path: '/Users/watchers/Desktop/clio-project/data/업무일지양식/77.docx',
    type: 'docx',
    instructions: `보고번호: 20260424-01
작성일자: 2026-04-24
작성자: 김테스터
부서명: 전략기획팀
제목: 일일 업무 보고서
금일 업무:
- 신규 문서허브 IA 점검
- 보고서 HTML 렌더 경로 검증
명일 업무:
- 빈 셀 매핑 누락 항목 보정
- 회의록 양식 테스트
비고:
- 긴급 이슈 없음`,
  },
  {
    name: '회의록 DOCX',
    path: '/Users/watchers/Desktop/clio-project/data/회의록.docx',
    type: 'docx',
    instructions: `작성자명: 김테스터
작성자 소속: 전략기획팀
회의 일시: 2026-04-24
회의 시간: 14:00-15:00
장소: 본사 7층 회의실
참석자: 김테스터, 박리더, 이디자이너
회의 내용:
- 문서허브 중심 IA 개편 현황 공유
- 보고서 HTML 템플릿 적용 범위 점검
회의 결과:
- 빈 셀 direct mapping alias 확대 적용
- 샘플 양식 기준 테스트 수행`,
  },
  {
    name: '보고서 HWPX',
    path: '/Users/watchers/Desktop/clio-project/data/보고서.hwpx',
    type: 'hwpx',
    instructions: `보고처: 전략기획팀
보고서명: 문서 운영 플랫폼 개선 보고서
회의 일자: 2026-04-24
장소: 본사 7층 회의실
참석자: 김테스터, 박리더
정보(자료) 출처:
- 내부 사용자 인터뷰
- 문서 생성 로그 분석
보고 내용과 의견:
- 보고서 HTML 템플릿을 실제 출력 경로에 연결했습니다.
- 빈 셀 direct mapping 범위를 실제 양식 기준으로 확장했습니다.
문제점:
- 양식별 라벨 편차가 커서 alias 유지 관리가 필요합니다.`,
  },
];

for (const fixture of fixtures) {
  const buffer = fs.readFileSync(fixture.path);
  const rawStructure = fixture.type === 'docx'
    ? extractDocxTableStructure(buffer)
    : extractHwpxTableStructure(buffer);
  const structure = rawStructure?.tables ? rawStructure : rawStructure?.structure;

  if (!structure) {
    console.log(`\n[${fixture.name}] 구조 추출 실패`);
    continue;
  }

  const trimmed = trimSingleColumnStructure(structure);
  const mapped = mapFormDataDirect(trimmed, fixture.instructions);
  applyFormDataRuntimeOverrides(mapped, trimmed.emptyCells, {
    userName: '김테스터',
    userPosition: '매니저',
    userDept: '전략기획팀',
    todayStr: '2026-04-24',
    templateName: '문서 운영 플랫폼 개선 보고서',
  });
  const filledEntries = Object.entries(mapped).filter(([, value]) => String(value).trim() !== '');
  const emptyTargets = trimmed.emptyCells.filter((cell) => !mapped[cell.fieldId]);

  console.log(`\n=== ${fixture.name} ===`);
  console.log(`파일: ${path.basename(fixture.path)}`);
  console.log(`빈 셀 수(trimmed): ${trimmed.emptyCells.length}`);
  console.log(`직접 매핑 수: ${filledEntries.length}`);
  console.log('채워진 셀:');
  for (const [fieldId, value] of filledEntries) {
    const cell = trimmed.emptyCells.find((item) => item.fieldId === fieldId);
    console.log(`- ${fieldId} | 라벨=${cell?.contextLabel || '(없음)'} | 값=${String(value).replace(/\n/g, ' / ')}`);
  }
  console.log('미매핑 상위 12개:');
  for (const cell of emptyTargets.slice(0, 12)) {
    console.log(`- ${cell.fieldId} | table=${cell.tableIndex} row=${cell.rowIndex} col=${cell.colIndex} | 라벨=${cell.contextLabel || '(없음)'}`);
  }
}
