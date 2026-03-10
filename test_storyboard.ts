import { generateStoryArc } from './geminiService.ts';

async function runTest() {
  try {
    const theme = { id: '1', title: 'Test Theme', category: 'DAILY', description: 'A test theme' };
    const location = { country: 'South Korea', landmark: 'Seoul Tower' };
    const narrationType = '1인 독백';
    const anchorPrompt = 'A beautiful sunset';
    const selectedCharacters = [];

    console.log("Generating story arc...");
    const result = await generateStoryArc(theme, location, narrationType, anchorPrompt, selectedCharacters);
    
    console.log("Story generated successfully.");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

runTest();
