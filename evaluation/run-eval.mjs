import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDeterministicLocalAnalysis } from '../src/lib/ai/adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEvaluation() {
  const dataPath = path.join(__dirname, 'eval-ai-dataset.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`=== AI 모델 품질 및 근거 연결 평가 시작 (총 ${dataset.length}건) ===\n`);

  let passed = 0;

  for (const item of dataset) {
    const baselineMock = {
      id: 'mock-base',
      project_id: 'mock-proj',
      source_text: item.baseline_text,
      structured_scope: { deliverables: [], inclusions: [], exclusions: [] },
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const results = runDeterministicLocalAnalysis(item.customer_message, baselineMock);
    const matched = results.find(r => r.classification === item.expected_classification);

    console.log(`[사례: ${item.id}] ${item.description}`);
    console.log(`- 고객 원문: "${item.customer_message}"`);
    console.log(`- 기대 분류: ${item.expected_classification}`);
    console.log(`- 분석 결과: ${matched ? matched.classification : results[0]?.classification || '없음'}`);

    if (matched && matched.evidence.length > 0) {
      const ev = matched.evidence[0];
      const sliceMatch = item.customer_message.slice(ev.start, ev.end) === ev.quote;
      console.log(`- 근거 인용: "${ev.quote}" (UTF-16 인덱스 슬라이스 검증: ${sliceMatch ? '성공' : '실패'})`);
      if (sliceMatch) passed++;
    } else {
      console.log(`- 근거 인용: 실패 또는 확인 필요`);
    }
    console.log('----------------------------------------------------');
  }

  console.log(`\n평가 결과: ${passed} / ${dataset.length} 케이스 성공 (${Math.round((passed / dataset.length) * 100)}%)\n`);
}

runEvaluation().catch(console.error);
