// src/app/api/requests/[requestId]/items/[itemId]/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  classification: z.enum(['included', 'additional_candidate', 'needs_clarification']),
  reason: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string; itemId: string }> }
) {
  ensureInitialized();
  const { itemId } = await params;
  try {
    const body = await req.json();
    const parsed = UpdateItemSchema.parse(body);

    const updated = globalRepo.updateRequestItemClassification(
      itemId,
      parsed.classification,
      parsed.reason
    );

    if (!updated) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
