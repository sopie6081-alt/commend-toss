// src/app/api/proposals/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';
import { validateShareConditions } from '@/lib/domain/proposal-rules';
import { z } from 'zod';

const CreateProposalSchema = z.object({
  projectId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  changes: z.array(z.any()).min(1, '변경 사항을 1개 이상 포함해야 합니다.'),
  excluded_items: z.array(z.string()).default([]),
  fee_mode: z.enum(['amount', 'no_change', 'undecided']),
  additional_amount_minor: z.number().int().nonnegative().default(0),
  schedule_mode: z.enum(['date', 'no_change', 'undecided']),
  proposed_due_date: z.string().nullable().optional(),
  customer_message: z.string().optional(),
});

export async function POST(req: Request) {
  ensureInitialized();
  try {
    const body = await req.json();
    const parsed = CreateProposalSchema.parse(body);

    const project = globalRepo.getProject(parsed.projectId);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const proposal = globalRepo.createProposal(parsed.projectId, parsed.requestId);
    const version = globalRepo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: parsed.projectId,
      version_number: 1,
      base_scope_revision: project.scope_revision,
      changes: parsed.changes,
      excluded_items: parsed.excluded_items,
      fee_mode: parsed.fee_mode,
      additional_amount_minor: parsed.additional_amount_minor,
      schedule_mode: parsed.schedule_mode,
      proposed_due_date: parsed.proposed_due_date,
      customer_message: parsed.customer_message,
    });

    return NextResponse.json({ proposal, version }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
