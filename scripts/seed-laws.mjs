/**
 * 법령 시드 스크립트 — npx tsx scripts/seed-laws.mjs
 * law_chunks 테이블에 25개 법령 조문 + 임베딩 삽입
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// .env.local 파싱
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '').replace(/\\n$/, '')];
    })
);

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const LAW_SEED_DATA = [
  // ── 대금 지급 (payment) ──────────────────────────────────────────────────
  { law_name: '하도급법', article_no: '제13조', clause_no: '①항', content: '원사업자는 수급사업자에게 제조 등의 위탁을 한 경우에는 목적물 등의 수령일부터 60일 이내의 가능한 짧은 기한으로 정한 지급기일까지 하도급대금을 지급하여야 한다.', category: 'payment' },
  { law_name: '하도급법', article_no: '제13조', clause_no: '②항', content: '원사업자가 발주자로부터 준공금 또는 기성금을 받은 경우에는 하도급대금의 지급기일 전이라도 그 받은 날부터 15일 이내에 수급사업자에게 하도급대금을 지급하여야 한다.', category: 'payment' },
  { law_name: '하도급법', article_no: '제13조', clause_no: '8항', content: '원사업자가 제1항 또는 제2항에 따른 지급기일까지 하도급대금을 지급하지 아니한 경우에는 그 지급기일의 다음 날부터 지급하는 날까지의 기간에 대하여 연 100분의 40 이내에서 「은행법」에 따른 은행의 연체이자율 등을 고려하여 공정거래위원회가 정하여 고시하는 이율에 따른 이자를 지급하여야 한다.', category: 'payment' },
  { law_name: '민법', article_no: '제387조', clause_no: '①항', content: '채무의 이행기가 도래하면 채권자는 그 이행을 청구할 수 있고, 채무자는 지체 없이 이행하여야 한다. 기한이 없는 채무는 채권자가 이행을 청구한 때부터 지체책임이 있다.', category: 'payment' },
  { law_name: '민법', article_no: '제390조', clause_no: null, content: '채무자가 채무의 내용에 좇은 이행을 하지 아니한 때에는 채권자는 손해배상을 청구할 수 있다. 그러나 채무자의 고의나 과실 없이 이행할 수 없게 된 때에는 그러하지 아니하다.', category: 'payment' },
  { law_name: '상법', article_no: '제54조', clause_no: null, content: '상행위로 인한 채무의 법정이율은 연 6분으로 한다.', category: 'payment' },

  // ── 손해배상·위약금 (penalty) ────────────────────────────────────────────
  { law_name: '민법', article_no: '제393조', clause_no: '①항', content: '채무불이행으로 인한 손해배상은 통상의 손해를 그 한도로 한다.', category: 'penalty' },
  { law_name: '민법', article_no: '제393조', clause_no: '②항', content: '특별한 사정으로 인한 손해는 채무자가 그 사정을 알았거나 알 수 있었을 때에 한하여 배상의 책임이 있다.', category: 'penalty' },
  { law_name: '민법', article_no: '제398조', clause_no: '①항', content: '당사자는 채무불이행에 관한 손해배상액을 예정할 수 있다.', category: 'penalty' },
  { law_name: '민법', article_no: '제398조', clause_no: '②항', content: '손해배상의 예정액이 부당히 과다한 경우에는 법원은 적당히 감액할 수 있다.', category: 'penalty' },
  { law_name: '민법', article_no: '제396조', clause_no: null, content: '채무불이행에 관하여 채권자에게 과실이 있는 때에는 법원은 손해배상의 책임 및 그 금액을 정함에 이를 참작하여야 한다.', category: 'penalty' },
  { law_name: '하도급법', article_no: '제35조', clause_no: '①항', content: '원사업자가 이 법을 위반하여 수급사업자에게 손해를 입힌 경우에는 그 손해의 3배를 넘지 아니하는 범위에서 배상책임을 진다.', category: 'penalty' },

  // ── 계약 해지·해제 (termination) ────────────────────────────────────────
  { law_name: '민법', article_no: '제543조', clause_no: '①항', content: '계약 또는 법률의 규정에 의하여 당사자의 일방이 해제권을 가지는 때에는 그 해제는 상대방에 대한 의사표시로 한다.', category: 'termination' },
  { law_name: '민법', article_no: '제544조', clause_no: null, content: '당사자 일방이 그 채무를 이행하지 아니하는 때에는 상대방은 상당한 기간을 정하여 그 이행을 최고하고 그 기간 내에 이행하지 아니한 때에는 계약을 해제할 수 있다. 그러나 채무자가 미리 이행하지 아니할 의사를 표시한 경우에는 최고를 요하지 아니한다.', category: 'termination' },
  { law_name: '민법', article_no: '제545조', clause_no: '①항', content: '계약의 성질 또는 당사자의 의사표시에 의하여 일정한 시일 또는 일정한 기간 내에 이행하지 아니하면 계약의 목적을 달성할 수 없을 경우에 당사자 일방이 그 시기에 이행하지 아니한 때에는 상대방은 전조의 최고를 하지 아니하고 계약을 해제할 수 있다.', category: 'termination' },
  { law_name: '민법', article_no: '제548조', clause_no: '①항', content: '당사자 일방이 계약을 해제한 때에는 각 당사자는 그 상대방에 대하여 원상회복의 의무가 있다. 그러나 제3자의 권리를 해하지 못한다.', category: 'termination' },
  { law_name: '민법', article_no: '제551조', clause_no: null, content: '계약의 해지 또는 해제는 손해배상의 청구에 영향을 미치지 아니한다.', category: 'termination' },

  // ── 개인정보 보호 (privacy) ──────────────────────────────────────────────
  { law_name: '개인정보보호법', article_no: '제26조', clause_no: '①항', content: '개인정보처리자가 제3자에게 개인정보의 처리 업무를 위탁하는 경우에는 위탁하는 업무의 내용과 수탁자를 정보주체가 언제든지 쉽게 확인할 수 있도록 공개하여야 한다.', category: 'privacy' },
  { law_name: '개인정보보호법', article_no: '제26조', clause_no: '②항', content: '위탁자는 업무 위탁으로 인하여 정보주체의 개인정보가 분실·도난·유출·위조·변조 또는 훼손되지 아니하도록 수탁자를 교육하고, 처리 현황 점검 등 수탁자가 개인정보를 안전하게 처리하는지를 감독하여야 한다.', category: 'privacy' },
  { law_name: '개인정보보호법', article_no: '제39조', clause_no: '①항', content: '정보주체는 개인정보처리자가 이 법을 위반한 행위로 손해를 입으면 개인정보처리자에게 손해배상을 청구할 수 있다. 이 경우 그 개인정보처리자는 고의 또는 과실이 없음을 입증하지 아니하면 책임을 면할 수 없다.', category: 'privacy' },
  { law_name: '개인정보보호법', article_no: '제29조', clause_no: null, content: '개인정보처리자는 개인정보가 분실·도난·유출·위조·변조 또는 훼손되지 아니하도록 내부 관리계획 수립, 접속기록 보관 등 대통령령으로 정하는 바에 따라 안전성 확보에 필요한 기술적·관리적 및 물리적 조치를 하여야 한다.', category: 'privacy' },

  // ── 지식재산권·납품·검수 (general) ─────────────────────────────────────
  { law_name: '저작권법', article_no: '제9조', clause_no: null, content: '법인·단체 그 밖의 사용자(이하 "법인 등"이라 한다)의 기획 하에 법인 등의 업무에 종사하는 자가 업무상 작성하는 저작물로서 법인 등이 저작자로 결정되는 경우에는 그 저작물의 저작자는 법인 등이 된다.', category: 'general' },
  { law_name: '상법', article_no: '제47조', clause_no: null, content: '상인이 그 영업에 관하여 타인을 위하여 행위를 한 경우에는 이에 대하여 상당한 보수를 청구할 수 있다.', category: 'general' },
  { law_name: '하도급법', article_no: '제8조', clause_no: '①항', content: '원사업자는 수급사업자에게 제조 등을 위탁할 때 위탁의 내용, 하도급대금, 납기 등을 적은 서면을 수급사업자에게 주어야 한다.', category: 'general' },
  { law_name: '하도급법', article_no: '제9조', clause_no: '①항', content: '원사업자는 수급사업자로부터 납품을 받으면 수령일을 적은 수령증을 즉시 발급하여야 하며, 목적물 등을 수령한 날부터 10일 이내에 검사의 결과를 수급사업자에게 통보하여야 한다.', category: 'general' },
  { law_name: '민법', article_no: '제580조', clause_no: '①항', content: '매매의 목적물에 하자가 있는 때에는 제575조 제1항의 규정을 준용한다. 그러나 매수인이 하자 있는 것을 알았거나 과실로 인하여 이를 알지 못한 때에는 그러하지 아니하다.', category: 'general' },
];

async function generateEmbedding(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

async function main() {
  console.log(`총 ${LAW_SEED_DATA.length}개 법령 조문 삽입 시작...`);

  // 기존 데이터 삭제
  await supabase.from('law_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('기존 데이터 초기화 완료');

  let inserted = 0;
  let failed = 0;

  for (const chunk of LAW_SEED_DATA) {
    try {
      process.stdout.write(`  ${chunk.law_name} ${chunk.article_no}${chunk.clause_no ? ' ' + chunk.clause_no : ''} ... `);
      const embedding = await generateEmbedding(chunk.content);
      const { error } = await supabase.from('law_chunks').insert({
        law_name: chunk.law_name,
        article_no: chunk.article_no,
        clause_no: chunk.clause_no ?? null,
        content: chunk.content,
        category: chunk.category,
        embedding: JSON.stringify(embedding),
      });
      if (error) {
        console.log(`실패 — ${error.message}`);
        failed++;
      } else {
        console.log('완료');
        inserted++;
      }
    } catch (err) {
      console.log(`오류 — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n완료: ${inserted}개 삽입, ${failed}개 실패`);
}

main().catch(console.error);
