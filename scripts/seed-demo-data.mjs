import { PrismaClient, ReviewStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SOURCE = 'SMOKE_DEMO';
const DEMO_USER_EMAIL = 'demo-teacher@paper.local';

async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: { isActive: true, role: 'teacher', name: 'Demo Teacher' },
    create: {
      email: DEMO_USER_EMAIL,
      name: 'Demo Teacher',
      role: 'teacher',
      isActive: true,
    },
  });
}

async function seed() {
  const user = await ensureDemoUser();
  const paper = await prisma.paper.create({
    data: {
      title: `主链路演示卷-${new Date().toISOString().slice(0, 10)}`,
      sourceExam: DEMO_SOURCE,
      sourceYear: 2026,
      uploadedBy: user.id,
    },
  });

  const questionSpecs = [
    { number: '1', type: '选择题', text: '函数 f(x)=x^2 在 x=1 处导数为多少？', latex: '函数 $f(x)=x^2$ 在 $x=1$ 处导数为多少？', points: ['导数定义', '函数与导数'] },
    { number: '2', type: '填空题', text: '已知等差数列首项 2 公差 3，第 5 项是____。', latex: '已知等差数列首项 $2$，公差 $3$，第 $5$ 项是 $\\\\fillin$。', points: ['数列', '等差数列'] },
    { number: '3', type: '解答题', text: '求解方程 x^2-5x+6=0。', latex: '求解方程 $x^2-5x+6=0$。', points: ['一元二次方程'] },
  ];

  for (const spec of questionSpecs) {
    const created = await prisma.question.create({
      data: {
        paperId: paper.id,
        numberRaw: spec.number,
        numberNormalized: spec.number,
        stemText: spec.text,
        stemLatex: spec.latex,
        questionType: spec.type,
        sourceExam: DEMO_SOURCE,
        sourceYear: 2026,
        reviewStatus: ReviewStatus.reviewed,
      },
    });

    for (const pointName of spec.points) {
      const existing = await prisma.knowledgePoint.findFirst({
        where: { name: pointName, parentId: null },
      });
      const kp =
        existing ||
        (await prisma.knowledgePoint.create({
          data: { name: pointName },
        }));
      await prisma.questionKnowledgePoint.upsert({
        where: {
          questionId_knowledgePointId: {
            questionId: created.id,
            knowledgePointId: kp.id,
          },
        },
        update: {},
        create: { questionId: created.id, knowledgePointId: kp.id },
      });
    }
  }

  console.log(JSON.stringify({ ok: true, source: DEMO_SOURCE, paperId: paper.id, count: questionSpecs.length }));
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
