/**
 * 계약서 HWPX 직접 치환 렌더러
 * AI 토큰 0 — 사용자 입력값을 HWPX XML 빈칸에 직접 매핑
 */

import PizZip from 'pizzip';
import { formatAmount, parseDate } from '@/lib/contract-fields';
import type { RenderOutput } from './types';

interface ContractFormData {
  [key: string]: string;
}

/**
 * 시스템구축계약서 HWPX 직접 치환
 */
export function renderSystemContract(
  templateBuffer: Buffer,
  formData: ContractFormData,
  title: string,
): RenderOutput {
  const zip = new PizZip(templateBuffer);
  const sectionFile = Object.keys(zip.files).find(n => /Contents\/section\d+\.xml/i.test(n));
  if (!sectionFile) throw new Error('HWPX section XML을 찾을 수 없습니다.');

  let xml = zip.file(sectionFile)!.asText();

  // ── 헬퍼 ──
  const safeReplace = (pattern: string | RegExp, replacement: string) => {
    const escaped = replacement.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (typeof pattern === 'string') {
      xml = xml.split(pattern).join(escaped);
    } else {
      xml = xml.replace(pattern, escaped);
    }
  };

  // hp:t 태그 안의 텍스트를 찾아 치환하는 함수
  const replaceInHpT = (searchText: string, newText: string) => {
    const escaped = newText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // hp:t 태그 내부에서 검색 텍스트를 찾아 치환
    const regex = new RegExp(
      `(<hp:t[^>]*>)([^<]*${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*)(<\\/hp:t>)`,
      'g'
    );
    xml = xml.replace(regex, (match, open, content, close) => {
      return open + content.replace(searchText, newText) + close;
    });
  };

  // ── 1. 계약명 ──
  if (formData.contractName) {
    replaceInHpT('1. 계약명  :', `1. 계약명  : ${formData.contractName}`);
  }

  // ── 2. 계약기간 ──
  if (formData.startDate && formData.endDate) {
    const s = parseDate(formData.startDate);
    const e = parseDate(formData.endDate);
    // 본문의 "      년   월   일부터       년   월   일까지" 패턴 치환
    xml = xml.replace(
      /(<hp:t[^>]*>)(2\. 계약기간 :)(\s+년\s+월\s+일부터\s+년\s+월\s+일까지)(<\/hp:t>)/,
      `$1$2 ${s.year}년 ${s.month}월 ${s.day}일부터 ${e.year}년 ${e.month}월 ${e.day}일까지$4`
    );
  }

  // ── 3. 납기일 ──
  if (formData.deliveryDate) {
    const d = parseDate(formData.deliveryDate);
    xml = xml.replace(
      /(<hp:t[^>]*>)(3\. 납 기 일 :)(\s+년\s+월\s+일\s*)(<\/hp:t>)/,
      `$1$2 ${d.year}년 ${d.month}월 ${d.day}일 $4`
    );
  }

  // ── 4. 계약금액 ──
  if (formData.totalAmount) {
    const amt = Number(formData.totalAmount);
    const formatted = `금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`;
    xml = xml.replace(
      /(<hp:t[^>]*>)(4\. 계약금액 :  금)(\s+원정\(￦\s+\))(<\/hp:t>)/,
      `$1 4. 계약금액 : ${formatted}$4`
    );
  }

  // ── 공급가액 ──
  if (formData.supplyAmount) {
    const amt = Number(formData.supplyAmount);
    const formatted = `금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`;
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*- 공급가액 :  금)(\s+원정\(￦\s+\))(<\/hp:t>)/,
      `$1   - 공급가액 : ${formatted}$4`
    );
  }

  // ── 부가가치세 ──
  if (formData.vatAmount) {
    const amt = Number(formData.vatAmount);
    const formatted = `금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`;
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*- 부가가치세 : 금)(\s+원정\(￦\s+\))(<\/hp:t>)/,
      `$1   - 부가가치세 : ${formatted}$4`
    );
  }

  // ── 중도금 지급회수 ──
  if (formData.progressCount) {
    xml = xml.replace(
      /\(지급회수:\s+회\)/g,
      `(지급회수: ${formData.progressCount}회)`
    );
  }

  // ── 계약이행보증금 ──
  if (formData.performanceBond) {
    const amt = Number(formData.performanceBond);
    xml = xml.replace(
      /(<hp:t[^>]*>)(5\. 계약이행보증금\* :)(\s+원정)(<\/hp:t>)/,
      `$1 5. 계약이행보증금* : ${formatAmount(amt)}원정$4`
    );
  }

  // ── 하자보수보증금 ──
  if (formData.warrantyBond) {
    const amt = Number(formData.warrantyBond);
    const formatted = `금 ${formatAmount(amt)}원정(￦${formatAmount(amt)})`;
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*- 하자보수보증금 : 금)(\s+원정\(￦\s+\))(<\/hp:t>)/,
      `$1   - 하자보수보증금 : ${formatted}$4`
    );
  }

  // ── 하자담보책임기간 ──
  if (formData.warrantyPeriod) {
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*- 하자담보책임기간 :)(\s*)(<\/hp:t>)/,
      `$1   - 하자담보책임기간 : ${formData.warrantyPeriod}$4`
    );
  }

  // ── 계약 체결일 ──
  if (formData.signDate) {
    const d = parseDate(formData.signDate);
    xml = xml.replace(
      /(<hp:t[^>]*>)(년\s+월\s+일)(<\/hp:t>)/,
      `$1${d.year}년 ${d.month}월 ${d.day}일$3`
    );
  }

  // ── 발주자 정보 (테이블 2, 행 1, 첫 번째 셀) ──
  if (formData.clientName) {
    xml = xml.replace(
      /(상호 또는 명칭 :)\s{3,}/,
      `$1 ${formData.clientName} `
    );
  }
  if (formData.clientPhone) {
    // 발주자 전화번호 (첫 번째 매칭)
    xml = xml.replace(
      /(전화번호 :)/,
      `$1 ${formData.clientPhone}`
    );
  }
  if (formData.clientAddress) {
    xml = xml.replace(
      /(주    소 :)/,
      `$1 ${formData.clientAddress}`
    );
  }
  if (formData.clientCeo) {
    xml = xml.replace(
      /(대표자 성명 :)\s+(\(인\))/,
      `$1 ${formData.clientCeo} $2`
    );
  }

  // ── 공급자 정보 (테이블 2, 행 1, 두 번째 셀) ──
  // 공급자는 두 번째 매칭이므로, 발주자 치환 후 남은 패턴
  if (formData.supplierName) {
    xml = xml.replace(
      /(상호 또는 명칭 :)\s{2,}/,
      `$1 ${formData.supplierName} `
    );
  }
  if (formData.supplierPhone) {
    xml = xml.replace(
      /(전화번호 :)(?!\s*\S)/,
      `$1 ${formData.supplierPhone}`
    );
  }
  if (formData.supplierAddress) {
    xml = xml.replace(
      /(주    소 :)(?!\s*\S)/,
      `$1 ${formData.supplierAddress}`
    );
  }
  if (formData.supplierCeo) {
    xml = xml.replace(
      /(대표자 성명 :)\s+((\(인\)))/,
      `$1 ${formData.supplierCeo} $2`
    );
  }

  // ── 대금 지급 테이블 (선급금/중도금/잔금 비율) ──
  // 테이블 셀의 % 값은 hp:t 태그 안에 있음
  if (formData.advanceRate) {
    // 선급금 행의 % 셀
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*%\s*)(<\/hp:t>)/,
      `$1${formData.advanceRate}%$3`
    );
  }
  if (formData.progressRate) {
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*%\s*)(<\/hp:t>)/,
      `$1${formData.progressRate}%$3`
    );
  }
  if (formData.finalRate) {
    xml = xml.replace(
      /(<hp:t[^>]*>)(\s*%\s*)(<\/hp:t>)/,
      `$1${formData.finalRate}%$3`
    );
  }

  // ── 대금 지급 금액 계산 ──
  if (formData.totalAmount) {
    const total = Number(formData.totalAmount);
    const advRate = Number(formData.advanceRate || 0) / 100;
    const progRate = Number(formData.progressRate || 0) / 100;
    const finalRate = Number(formData.finalRate || 0) / 100;

    const amounts = [
      Math.round(total * advRate),
      Math.round(total * progRate),
      Math.round(total * finalRate),
    ];

    // 빈 금액 셀에 차례로 채움 (테이블 1의 빈 셀)
    for (const amt of amounts) {
      if (amt > 0) {
        xml = xml.replace(
          /(<hp:t[^>]*>)(\s*)(<\/hp:t>)/,
          `$1${formatAmount(amt)}$3`
        );
      }
    }
  }

  zip.file(sectionFile, xml);
  const buffer = Buffer.from(zip.generate({ type: 'nodebuffer' }));

  return {
    buffer,
    mimeType: 'application/hwp+zip',
    extension: 'hwpx',
    fileName: `${title}.hwpx`,
  };
}
