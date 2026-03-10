import { generateStoryArc } from './geminiService.ts';

async function runTest() {
  console.log("Starting generation...");
  const startTime = Date.now();
  
  try {
    const result = await generateStoryArc("도쿄 야경", undefined, "MONOLOGUE");
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`[기본 확인]`);
    console.log(`- 스토리보드 생성이 에러 없이 완료됐는가? ✅`);
    console.log(`- 총 생성 시간: 약 ${duration.toFixed(1)}초\n`);
    
    const format = result.metadata?.format || '1인 독백';
    
    console.log(`[검증 — 컷 2개 선택]`);
    for (let i = 0; i < Math.min(2, result.scenes.length); i++) {
      const scene = result.scenes[i];
      const textLength = (scene.narrationKOR || '').length;
      const expectedCount = format === '2인 대화' 
        ? Math.max(3, Math.ceil(textLength / 4 / 7))
        : Math.max(3, Math.ceil(textLength / 5 / 7));
      const actualCount = scene.imagePromptsENG?.length || 0;
      
      console.log(`컷 ${i === 0 ? 'A' : 'B'}:`);
      console.log(`- 나레이션 실제 자 수: ${textLength}자`);
      console.log(`- 나레이션 타입: ${format}`);
      console.log(`- 기대 이미지 장 수: ${expectedCount}장`);
      console.log(`- 실제 생성된 이미지 프롬프트 장 수: ${actualCount}장`);
      console.log(`- 일치? ${expectedCount === actualCount ? '✅' : '❌'}\n`);
    }
  } catch (e) {
    console.error("Generation failed:", e);
    console.log(`[기본 확인]`);
    console.log(`- 스토리보드 생성이 에러 없이 완료됐는가? ❌`);
  }
}

runTest();
