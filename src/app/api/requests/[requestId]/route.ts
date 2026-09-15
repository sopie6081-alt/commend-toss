// src/app/api/requests/[requestId]/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  ensureInitialized();
  const { requestId } = await params;
  const requestRecord = globalRepo.requests.get(requestId);

  if (!requestRecord) {
    return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  }

  const items = globalRepo.listRequestItems(requestId);
  const project = globalRepo.getProject(requestRecord.project_id);

  return NextResponse.json({
    request: requestRecord,
    items,
    project,
  });
}
