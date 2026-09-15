// src/app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { DEMO_OWNER_ID } from '@/lib/store/seed';
import { ensureInitialized } from '@/lib/store/init';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, '프로젝트명을 입력해 주세요.'),
  customer_name: z.string().min(1, '고객명을 입력해 주세요.'),
  currency: z.enum(['KRW', 'USD', 'EUR', 'JPY']).default('KRW'),
  tax_treatment: z.enum(['inclusive', 'exclusive', 'unspecified']).default('inclusive'),
  source_text: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  initial_amount: z.number().nonnegative().optional(),
  initial_deadline: z.string().optional(),
});

export async function GET() {
  ensureInitialized();
  const projects = globalRepo.listProjects(DEMO_OWNER_ID);

  const projectsWithStats = projects.map(p => {
    // Collect proposals
    const versions = Array.from(globalRepo.proposalVersions.values()).filter(v => v.project_id === p.id);
    const pendingCount = versions.filter(v => v.status === 'pending').length;
    const decisions = versions
      .map(v => globalRepo.customerDecisions.get(v.id))
      .filter(Boolean)
      .sort((a, b) => new Date(b!.decided_at).getTime() - new Date(a!.decided_at).getTime());

    const recentDecision = decisions.length > 0 ? decisions[0] : null;

    return {
      ...p,
      pending_proposals_count: pendingCount,
      recent_decision: recentDecision,
    };
  });

  return NextResponse.json({ projects: projectsWithStats });
}

export async function POST(req: Request) {
  ensureInitialized();
  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.parse(body);

    const project = globalRepo.createProject({
      owner_id: DEMO_OWNER_ID,
      name: parsed.name,
      customer_name: parsed.customer_name,
      currency: parsed.currency,
      tax_treatment: parsed.tax_treatment,
      status: 'active',
    });

    const deliverablesList = (parsed.deliverables && parsed.deliverables.length > 0)
      ? parsed.deliverables.map((d, i) => ({ id: `del-${i + 1}`, title: d }))
      : [
          { id: 'del-1', title: '메인 웹사이트 디자인 및 개발' },
        ];

    globalRepo.setBaselineScope(
      project.id,
      parsed.source_text || `[최초 합의서]\n프로젝트: ${parsed.name}\n고객: ${parsed.customer_name}`,
      {
        deliverables: deliverablesList,
        inclusions: ['PC 및 모바일 반응형 웹 구현'],
        exclusions: ['목록 외 신규 기능은 별도 협의'],
        initial_deadline: parsed.initial_deadline || null,
        initial_amount_minor: parsed.initial_amount || 0,
      }
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '잘못된 입력값입니다.' }, { status: 400 });
  }
}
