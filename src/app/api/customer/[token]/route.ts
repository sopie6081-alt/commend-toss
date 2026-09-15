// src/app/api/customer/[token]/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';
import { z } from 'zod';

const DecisionSchema = z.object({
  decision: z.enum(['approved', 'revision_requested']),
  customer_name: z.string().min(1, '성함을 입력해 주세요.').max(100),
  comment: z.string().max(1000).optional(),
  idempotency_key: z.string().min(1).max(128),
});

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  ensureInitialized();
  const { token } = await params;

  const result = globalRepo.getPublicProposalByToken(token);

  // Set strict security headers
  const response = NextResponse.json(result);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  ensureInitialized();
  const { token } = await params;

  try {
    const body = await req.json();
    const parsed = DecisionSchema.parse(body);

    const outcome = await globalRepo.processCustomerDecision({
      rawToken: token,
      decision: parsed.decision,
      customerName: parsed.customer_name,
      comment: parsed.comment,
      idempotencyKey: parsed.idempotency_key,
    });

    return NextResponse.json({
      success: true,
      decision: outcome.decision,
      versionStatus: outcome.versionStatus,
      newScopeRevision: outcome.newScopeRevision,
      isDuplicate: outcome.isDuplicate,
    });
  } catch (err: any) {
    if (err.name === 'TransactionConflictError') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || '처리 중 오류가 발생했습니다.' }, { status: 400 });
  }
}
