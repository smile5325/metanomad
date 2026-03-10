import { generateStoryArc } from './geminiService';

async function runTest() {
  try {
    console.log("Generating story arc...");
    const result = await generateStoryArc("테스트 테마", undefined, "MONOLOGUE");
    
    if (result.scenes && result.scenes.length > 0) {
      const scene = result.scenes[0];
      const narration = scene.narrationKOR;
      const format = result.metadata.format;
      const charCount = narration.length;
      
      let expectedImages = 0;
      if (format === '2인 대화') {
        expectedImages = Math.ceil(charCount / 4 / 7);
      } else {
        expectedImages = Math.ceil(charCount / 5 / 7);
      }
      
      const actualImages = scene.imagePromptsENG.length;
      
      console.log(`\n[검증 컷 정보]`);
      console.log(`- 나레이션 실제 자 수: ${charCount}자`);
      console.log(`- 나레이션 타입: ${format}`);
      if (format === '2인 대화') {
        console.log(`- 기대 이미지 장 수: Math.ceil(${charCount} / 4 / 7) = ${expectedImages}장`);
      } else {
        console.log(`- 기대 이미지 장 수: Math.ceil(${charCount} / 5 / 7) = ${expectedImages}장`);
      }
      console.log(`- 실제 생성된 이미지 프롬프트 장 수: ${actualImages}장`);
      console.log(`- 기대값 = 실제값? ${expectedImages === actualImages ? '✅' : '❌'}`);
      
    } else {
      console.log("No scenes generated.");
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
