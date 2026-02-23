import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_SOURCE = 'SMOKE_DEMO';
const SMOKE_SET_NAME = 'Smoke Compose Set';

async function clean() {
  const papers = await prisma.paper.findMany({
    where: { sourceExam: DEMO_SOURCE },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);

  const questions = await prisma.question.findMany({
    where: { paperId: { in: paperIds } },
    select: { id: true },
  });
  const questionIds = questions.map((q) => q.id);

  if (questionIds.length > 0) {
    await prisma.paperSetItem.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.qualityLog.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.questionKnowledgePoint.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
  }

  if (paperIds.length > 0) {
    await prisma.recognitionLog.deleteMany({ where: { paperId: { in: paperIds } } });
    await prisma.paperFile.deleteMany({ where: { paperId: { in: paperIds } } });
    await prisma.paper.deleteMany({ where: { id: { in: paperIds } } });
  }

  const emptySets = await prisma.paperSet.findMany({
    where: { name: SMOKE_SET_NAME },
    include: { items: true },
  });
  const emptySetIds = emptySets.filter((s) => s.items.length === 0).map((s) => s.id);
  if (emptySetIds.length > 0) {
    await prisma.exportJob.deleteMany({ where: { paperSetId: { in: emptySetIds } } });
    await prisma.paperSet.deleteMany({ where: { id: { in: emptySetIds } } });
  }

  console.log(JSON.stringify({ ok: true, removedPapers: paperIds.length, removedQuestions: questionIds.length }));
}

clean()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
