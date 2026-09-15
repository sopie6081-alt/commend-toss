// src/app/api/proposals/[proposalId]/versions/[versionId]/withdraw/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ proposalId: string; versionId: string }> }
) {
  ensureInitialized();
  const { versionId } = await params;
  try {
    const withdrawn = await globalRepo.withdrawProposal(versionId);
    return NextResponse.json({ success: true, version: withdrawn });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
