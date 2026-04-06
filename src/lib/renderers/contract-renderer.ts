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

  // ── 대금 지급 비율 + 금액 계산 ──
  const total = Number(formData.totalAmount || 0);
  const advRate = Number(formData.advanceRate || 0);
  const progRate = Number(formData.progressRate || 0);
  const finRate = Number(formData.finalRate || 0);
  const advAmt = Math.round(total * advRate / 100);
  const progAmt = Math.round(total * progRate / 100);
  const finAmt = total - advAmt - progAmt; // 잔금은 나머지로 정확히

  // 비율 치환 (% 셀 — 순서대로 선급금, 중도금, 잔금)
  if (formData.advanceRate) {
    xml = replaceHpT(xml, '% ', `${formData.advanceRate}% `);
  }
  if (formData.progressRate) {
    xml = replaceHpT(xml, '% ', `${formData.progressRate}% `);
  }
  if (formData.finalRate) {
    xml = replaceHpT(xml, '% ', `${formData.finalRate}% `);
  }

  // 금액 치환 — 테이블 1의 빈 지급금액 셀 (행1~3 열2, 행4 합계 열2)
  // 빈 셀에는 <hp:t> 태그 자체가 없음 → </hp:p> 앞에 <hp:run><hp:t>금액</hp:t></hp:run> 삽입
  if (total > 0) {
    const firstTbl = xml.indexOf('<hp:tbl');
    const secondTbl = xml.indexOf('<hp:tbl', firstTbl + 1);
    if (secondTbl !== -1) {
      const secondTblEnd = xml.indexOf('</hp:tbl>', secondTbl) + 9;
      let tblXml = xml.slice(secondTbl, secondTblEnd);

      // 행/셀 파싱
      const rowRegex = /<hp:tr[\s>]/g;
      const rowStarts: number[] = [];
      let rm;
      while ((rm = rowRegex.exec(tblXml)) !== null) rowStarts.push(rm.index);

      // 행1(선급금)→열2, 행2(중도금)→열2, 행3(잔금)→열2, 행4(합계)→열2
      const amountMap = [
        { row: 1, col: 2, value: advAmt },
        { row: 2, col: 2, value: progAmt },
        { row: 3, col: 2, value: finAmt },
        { row: 4, col: 2, value: total },
      ];

      // 역순으로 처리 (위치 변동 방지)
      for (let ai = amountMap.length - 1; ai >= 0; ai--) {
        const { row, col, value } = amountMap[ai];
        if (value <= 0 || row >= rowStarts.length) continue;

        // 해당 행 범위
        const rowStart = rowStarts[row];
        const rowEnd = row + 1 < rowStarts.length
          ? rowStarts[row + 1]
          : tblXml.indexOf('</hp:tbl>');
        const rowXml = tblXml.slice(rowStart, rowEnd);

        // 해당 열의 <hp:tc> 찾기
        const tcStarts: number[] = [];
        const tcRegex = /<hp:tc[\s>]/g;
        let tcm;
        while ((tcm = tcRegex.exec(rowXml)) !== null) tcStarts.push(tcm.index);
        if (col >= tcStarts.length) continue;

        const tcStart = tcStarts[col];
        const tcEnd = col + 1 < tcStarts.length ? tcStarts[col + 1] : rowXml.length;
        let cellXml = rowXml.slice(tcStart, tcEnd);

        // </hp:p> 앞에 run+text 삽입
        const pEndIdx = cellXml.lastIndexOf('</hp:p>');
        if (pEndIdx !== -1) {
          const charMatch = cellXml.match(/charPrIDRef="(\d+)"/);
          const charId = charMatch ? charMatch[1] : '6';
          const insert = `<hp:run charPrIDRef="${charId}"><hp:t>${esc(formatAmount(value))}</hp:t></hp:run>`;
          cellXml = cellXml.slice(0, pEndIdx) + insert + cellXml.slice(pEndIdx);
        }

        // 행 XML 교체
        const newRowXml = rowXml.slice(0, tcStart) + cellXml + rowXml.slice(tcEnd);
        tblXml = tblXml.slice(0, rowStart) + newRowXml + tblXml.slice(rowEnd);
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
