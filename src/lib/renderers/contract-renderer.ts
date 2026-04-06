/**
 * 계약서 HWPX 직접 치환 렌더러
 * AI 토큰 0 — 사용자 입력값을 HWPX XML의 <hp:t> 텍스트에 직접 매핑
 */

import PizZip from 'pizzip';
import { formatAmount, parseDate } from '@/lib/contract-fields';
import type { RenderOutput } from './types';

/** XML 특수문자 이스케이프 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * XML 내에서 oldText를 찾아 newText로 치환 (첫 번째 매칭만).
 * <hp:t> 태그 경계를 넘지 않도록 단순 문자열 검색 사용.
 */
function replaceHpT(xml: string, oldText: string, newText: string): string {
  const idx = xml.indexOf(oldText);
  if (idx === -1) return xml;
  return xml.slice(0, idx) + esc(newText) + xml.slice(idx + oldText.length);
}

export function renderSystemContract(
  templateBuffer: Buffer,
  formData: Record<string, string>,
  title: string,
): RenderOutput {
  const zip = new PizZip(templateBuffer);
  const sectionFile = Object.keys(zip.files).find(n => /Contents\/section\d+\.xml/i.test(n));
  if (!sectionFile) throw new Error('HWPX section XML을 찾을 수 없습니다.');

  let xml = zip.file(sectionFile)!.asText();
  const originalXmlLen = xml.length;
  console.log(`[contract-renderer] sectionFile: ${sectionFile}, xmlLen: ${originalXmlLen}`);

  // ── 1. 계약명 ──
  if (formData.contractName) {
    // "1. 계약명  :" → "1. 계약명  : OO시스템"
    xml = replaceHpT(xml, '1. 계약명  :', `1. 계약명  : ${formData.contractName}`);
  }

  // ── 2. 계약기간 ──
  if (formData.startDate && formData.endDate) {
    const s = parseDate(formData.startDate);
    const e = parseDate(formData.endDate);
    xml = replaceHpT(xml,
      '2. 계약기간 :      년   월   일부터       년   월   일까지',
      `2. 계약기간 : ${s.year}년 ${s.month}월 ${s.day}일부터 ${e.year}년 ${e.month}월 ${e.day}일까지`
    );
  }

  // ── 3. 납기일 (입력폼에서 삭제했지만 값이 있으면 치환) ──
  if (formData.deliveryDate) {
    const d = parseDate(formData.deliveryDate);
    xml = replaceHpT(xml,
      '3. 납 기 일 :       년   월   일 ',
      `3. 납 기 일 : ${d.year}년 ${d.month}월 ${d.day}일 `
    );
  }

  // ── 4. 계약금액 ──
  if (formData.totalAmount) {
    const amt = Number(formData.totalAmount);
    xml = replaceHpT(xml,
      '4. 계약금액 :  금          원정(￦              )',
      `4. 계약금액 : 금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`
    );
  }

  // ── 공급가액 ──
  if (formData.supplyAmount) {
    const amt = Number(formData.supplyAmount);
    xml = replaceHpT(xml,
      '- 공급가액 :  금          원정(￦              )',
      `- 공급가액 : 금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`
    );
  }

  // ── 부가가치세 ──
  if (formData.vatAmount) {
    const amt = Number(formData.vatAmount);
    xml = replaceHpT(xml,
      '- 부가가치세 : 금          원정(￦              )',
      `- 부가가치세 : 금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`
    );
  }

  // ── 중도금 지급회수 ──
  if (formData.progressCount) {
    xml = replaceHpT(xml,
      '(지급회수:     회)',
      `(지급회수: ${formData.progressCount}회)`
    );
  }

  // ── 대금 지급 계산 ──
  const total = Number(formData.totalAmount || 0);
  const advRate = Number(formData.advanceRate || 0);
  const progTotalRate = Number(formData.progressRate || 0); // 중도금 총 비율
  const progCount = Math.max(1, Number(formData.progressCount || 1));
  const finRate = Number(formData.finalRate || 0);
  const advAmt = Math.round(total * advRate / 100);
  const progTotalAmt = Math.round(total * progTotalRate / 100);
  const progPerRate = Math.round(progTotalRate / progCount * 100) / 100; // 회당 비율
  const progPerAmt = Math.round(progTotalAmt / progCount); // 회당 금액
  const finAmt = total - advAmt - progTotalAmt;

  // ── 대금 지급 테이블 — 셀 주입 + 중도금 행 복제 ──
  {
    const firstTbl = xml.indexOf('<hp:tbl');
    const secondTbl = xml.indexOf('<hp:tbl', firstTbl + 1);
    if (secondTbl !== -1) {
      const secondTblEnd = xml.indexOf('</hp:tbl>', secondTbl) + 9;
      let tblXml = xml.slice(secondTbl, secondTblEnd);

      // 행 파싱 헬퍼
      function getRows(s: string) {
        const starts: number[] = [];
        const re = /<hp:tr[\s>]/g;
        let m;
        while ((m = re.exec(s)) !== null) starts.push(m.index);
        return starts;
      }
      function getRowXml(s: string, starts: number[], idx: number) {
        const start = starts[idx];
        const end = idx + 1 < starts.length ? starts[idx + 1] : s.indexOf('</hp:tbl>');
        return { start, end, content: s.slice(start, end) };
      }
      function getCells(rowXml: string) {
        const starts: number[] = [];
        const re = /<hp:tc[\s>]/g;
        let m;
        while ((m = re.exec(rowXml)) !== null) starts.push(m.index);
        return starts;
      }
      function injectCell(rowXml: string, cellStarts: number[], col: number, value: string, mode: 'replace' | 'insert') {
        if (col >= cellStarts.length) return rowXml;
        const tcStart = cellStarts[col];
        const tcEnd = col + 1 < cellStarts.length ? cellStarts[col + 1] : rowXml.length;
        let cellXml = rowXml.slice(tcStart, tcEnd);
        if (mode === 'replace') {
          cellXml = cellXml.replace(/(<hp:t[^>]*>)[^<]*(<\/hp:t>)/, `$1${esc(value)}$2`);
        } else {
          const pEnd = cellXml.lastIndexOf('</hp:p>');
          if (pEnd !== -1) {
            const cm = cellXml.match(/charPrIDRef="(\d+)"/);
            cellXml = cellXml.slice(0, pEnd) + `<hp:run charPrIDRef="${cm?.[1] ?? '6'}"><hp:t>${esc(value)}</hp:t></hp:run>` + cellXml.slice(pEnd);
          }
        }
        return rowXml.slice(0, tcStart) + cellXml + rowXml.slice(tcEnd);
      }

      // 1단계: 중도금 행(row 2) 복제 — progCount 행으로
      if (progCount > 1) {
        let rs = getRows(tblXml);
        const origRow = getRowXml(tblXml, rs, 2);
        const clones: string[] = [];
        for (let i = 0; i < progCount; i++) {
          let clone = origRow.content;
          // "중도금" 텍스트를 "중도금 N차"로 변경
          clone = clone.replace(
            /(<hp:t[^>]*>)(중도금)(<\/hp:t>)/,
            `$1중도금 ${i + 1}차$3`
          );
          // "(지급회수: N회)" 제거 (첫 행에만 있으면 됨)
          if (i > 0) {
            clone = clone.replace(/<hp:t[^>]*>\(지급회수:[^<]*<\/hp:t>/, '');
          } else {
            clone = clone.replace(
              /(<hp:t[^>]*>)\(지급회수:\s*\d*\s*회\)(<\/hp:t>)/,
              `$1(지급회수: ${progCount}회)$2`
            );
          }
          clones.push(clone);
        }
        // 원래 중도금 행을 복제한 행들로 교체
        tblXml = tblXml.slice(0, origRow.start) + clones.join('') + tblXml.slice(origRow.end);
        // rowCnt 업데이트 (원래 5행 → 5 + (progCount - 1))
        const newRowCnt = 5 + (progCount - 1);
        tblXml = tblXml.replace(/rowCnt="\d+"/, `rowCnt="${newRowCnt}"`);
      }

      // 2단계: 값 주입 (행 번호가 변경되었으므로 재파싱)
      // 행 구조: 0=헤더, 1=선급금, 2~(2+progCount-1)=중도금, 그 다음=잔금, 마지막=합계
      let rs = getRows(tblXml);
      const finRow = 2 + progCount;
      const totalRow = finRow + 1;

      // 선급금 (행 1)
      {
        const row = getRowXml(tblXml, rs, 1);
        const cs = getCells(row.content);
        let rx = row.content;
        if (advRate > 0) rx = injectCell(rx, cs, 1, `${advRate}%`, 'replace');
        if (advAmt > 0) { const cs2 = getCells(rx); rx = injectCell(rx, cs2, 2, formatAmount(advAmt), 'insert'); }
        tblXml = tblXml.slice(0, row.start) + rx + tblXml.slice(row.end);
      }

      // 중도금 (행 2 ~ 2+progCount-1) — 역순 처리
      rs = getRows(tblXml);
      for (let i = progCount - 1; i >= 0; i--) {
        const rowIdx = 2 + i;
        if (rowIdx >= rs.length) continue;
        const row = getRowXml(tblXml, rs, rowIdx);
        const cs = getCells(row.content);
        let rx = row.content;
        rx = injectCell(rx, cs, 1, `${progPerRate}%`, 'replace');
        const cs2 = getCells(rx);
        rx = injectCell(rx, cs2, 2, formatAmount(progPerAmt), 'insert');
        tblXml = tblXml.slice(0, row.start) + rx + tblXml.slice(row.end);
      }

      // 잔금
      rs = getRows(tblXml);
      if (finRow < rs.length) {
        const row = getRowXml(tblXml, rs, finRow);
        const cs = getCells(row.content);
        let rx = row.content;
        if (finRate > 0) rx = injectCell(rx, cs, 1, `${finRate}%`, 'replace');
        if (finAmt > 0) { const cs2 = getCells(rx); rx = injectCell(rx, cs2, 2, formatAmount(finAmt), 'insert'); }
        tblXml = tblXml.slice(0, row.start) + rx + tblXml.slice(row.end);
      }

      // 합계
      rs = getRows(tblXml);
      if (totalRow < rs.length && total > 0) {
        const row = getRowXml(tblXml, rs, totalRow);
        const cs = getCells(row.content);
        let rx = row.content;
        rx = injectCell(rx, cs, 2, formatAmount(total), 'insert');
        tblXml = tblXml.slice(0, row.start) + rx + tblXml.slice(row.end);
      }

      xml = xml.slice(0, secondTbl) + tblXml + xml.slice(secondTblEnd);
    }
  }

  // ── 계약 체결일 ──
  if (formData.signDate) {
    const d = parseDate(formData.signDate);
    xml = replaceHpT(xml,
      '년     월     일',
      `${d.year}년 ${d.month}월 ${d.day}일`
    );
  }

  // ── 발주자 정보 (첫 번째 매칭) ──
  if (formData.clientName) {
    xml = replaceHpT(xml, '상호 또는 명칭 :       ', `상호 또는 명칭 : ${formData.clientName} `);
  }
  if (formData.clientPhone) {
    xml = replaceHpT(xml, '전화번호 :', `전화번호 : ${formData.clientPhone}`);
  }
  if (formData.clientAddress) {
    xml = replaceHpT(xml, '주    소 :', `주    소 : ${formData.clientAddress}`);
  }
  if (formData.clientCeo) {
    xml = replaceHpT(xml, '대표자 성명 :                (인)', `대표자 성명 : ${formData.clientCeo} (인)`);
  }

  // ── 공급자 정보 (두 번째 매칭 — 발주자 치환 후 남은 패턴) ──
  if (formData.supplierName) {
    xml = replaceHpT(xml, '상호 또는 명칭 :   ', `상호 또는 명칭 : ${formData.supplierName} `);
  }
  if (formData.supplierPhone) {
    xml = replaceHpT(xml, '전화번호 :', `전화번호 : ${formData.supplierPhone}`);
  }
  if (formData.supplierAddress) {
    xml = replaceHpT(xml, '주    소 :', `주    소 : ${formData.supplierAddress}`);
  }
  if (formData.supplierCeo) {
    xml = replaceHpT(xml, '대표자 성명 :            (인)', `대표자 성명 : ${formData.supplierCeo} (인)`);
  }

  // XML 무결성 체크
  const openTags = (xml.match(/<hp:t[ >]/g) || []).length;
  const closeTags = (xml.match(/<\/hp:t>/g) || []).length;
  console.log(`[contract-renderer] hp:t tags: ${openTags}/${closeTags}`, openTags === closeTags ? 'OK' : 'MISMATCH');

  zip.file(sectionFile, xml);
  const buffer = Buffer.from(zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }));

  return {
    buffer,
    mimeType: 'application/hwp+zip',
    extension: 'hwpx',
    fileName: `${title}.hwpx`,
  };
}
