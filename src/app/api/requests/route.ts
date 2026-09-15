// src/app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';
import { analyzeCustomerRequest } from '@/lib/ai/adapter';
import { z } from 'zod';

const AnalyzeRequestSchema = z.object({
  projectId: z.string().uuid(),
  sourceText: z.string().min(1, '고객 요청 메시지를 입력해 주세요.'),
  apiKey: z.string().optional(),
});

export async function POST(req: Request) {
  ensureInitialized();
  try {
    const body = await req.json();
    const parsed = AnalyzeRequestSchema.parse(body);

    const project = globalRepo.getProject(parsed.projectId);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const baseline = globalRepo.getBaselineScope(parsed.projectId);
    if (!baseline) {
      return NextResponse.json({ error: '기준 범위가 확정되지 않았습니다.' }, { status: 400 });
    }

    // 1. Create request record
    const requestRecord = globalRepo.createRequest(project.id, parsed.sourceText);

    // 2. Perform AI analysis (with local fallback and UTF-16 slice verification)
    const analyzedItems = await analyzeCustomerRequest({
      customerMessage: parsed.sourceText,
      baseline,
      apiKey: parsed.apiKey || process.env.OPENAI_API_KEY,
    });

    // 3. Save items to repository
    const createdItems = analyzedItems.map(item => {
      return globalRepo.addRequestItem({
        request_id: requestRecord.id,
        description: item.description,
        ai_classification: item.ai_classification,
        classification: item.classification,
        reason: item.reason,
        evidence: item.evidence,
        user_modified: false,
        reviewed_at: null, // requires user review
      });
    });

    return NextResponse.json({
      request: requestRecord,
      items: createdItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '요청 분석에 실패했습니다.' }, { status: 400 });
  }
}
