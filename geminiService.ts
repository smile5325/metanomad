import { GoogleGenAI, Type } from "@google/genai";
import { TravelTheme, Scene, LocationContext, Character } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateTravelThemes = async (categories?: string[], selectedCharacters?: Character[]): Promise<TravelTheme[]> => {
  const categoryPrompt = categories && categories.length > 0 
    ? `반드시 다음 카테고리 중에서만 주제를 생성해줘: ${categories.join(', ')}` 
    : "다양한 카테고리의 주제들로 생성해줘.";

  const characterPrompt = selectedCharacters && selectedCharacters.length > 0
    ? `선택된 캐릭터(${selectedCharacters.map(c => c.name).join(', ')})의 성격과 분위기에 어울리는 주제여야 해.`
    : "";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `반드시 한국어로만 응답해줘. 현실의 일상을 특별한 여행지로 재해석하는 10가지 감성적인 주제를 생성해줘. title과 description 모두 반드시 한국어로 작성해. 'Warm Documentary' 감성이자 시네마틱한 분위기여야 해. ${categoryPrompt} ${characterPrompt}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['NATURE', 'FOOD', 'CULTURE', 'DAILY', 'HIDDEN', 'NIGHT', 'ROAD', 'MARKET', 'CAFE', 'RUIN', 'LOCAL', 'BORDER', 'SPIRITUAL', 'STREET', 'SEASON', 'TRANSPORT', 'VILLAGE', 'FESTIVAL', 'SOLO', 'VIEW'] },
            description: { type: Type.STRING }
          },
          required: ['id', 'title', 'category', 'description']
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Theme parsing failed", e);
    return [];
  }
};

export const analyzeImageForThemes = async (base64Image: string, mimeType: string): Promise<TravelTheme[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      },
      {
        text: "이 이미지에서 영감을 받아, 일상을 특별한 여행지로 재해석하는 4가지 감성적인 여행 주제를 생성해줘. 'Warm Documentary' 감성이자 시네마틱한 분위기여야 해."
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['NATURE', 'FOOD', 'CULTURE', 'DAILY', 'HIDDEN', 'NIGHT', 'ROAD', 'MARKET', 'CAFE', 'RUIN', 'LOCAL', 'BORDER', 'SPIRITUAL', 'STREET', 'SEASON', 'TRANSPORT', 'VILLAGE', 'FESTIVAL', 'SOLO', 'VIEW'] },
            description: { type: Type.STRING }
          },
          required: ['id', 'title', 'category', 'description']
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Image analysis failed", e);
    return [];
  }
};

export const analyzeCharacterImage = async (base64Image: string, mimeType: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      },
      {
        text: `이 캐릭터 이미지를 분석하여, 다른 장면에서도 완벽하게 동일한 캐릭터를 생성할 수 있도록 강력한 '앵커 프롬프트(Anchor Prompt)'를 만들어줘.
단순한 묘사가 아니라, 다음 4가지 요소를 추출하여 하나의 완성된 영어 문단으로 작성해야 해.

1. Core Identity: 성별, 대략적인 나이대, 인종, 전체적인 분위기
2. Fixed Appearance: 헤어 스타일과 색상, 눈동자 색, 특징적인 얼굴 묘사 (예: 흉터, 주근깨)
3. Signature Attire: 입고 있는 옷의 구체적인 재질과 색상, 항상 착용하는 액세서리
4. Art Style: 이 이미지가 가진 화풍 (예: 3D game rendering, Ghibli animation style, photorealistic 등)

위 4가지 요소를 모두 합쳐서, 쉼표로 구분된 명확하고 간결한 하나의 영어 프롬프트 문단만 반환해줘. (예: "A 20-year-old Asian female with a mysterious vibe, short black bob hair, brown eyes, wearing a red leather jacket and a silver necklace, 3D game rendering style")`
      }
    ]
  });

  return response.text?.trim() || "";
};

// DO NOT MODIFY - Core Function
export const generateStoryArc = async (
  theme: TravelTheme | string, 
  location?: LocationContext, 
  narrationType: string = 'RANDOM', 
  anchorPrompt?: string,
  selectedCharacters?: Character[]
): Promise<{selectedStyle: string, styleReason: string, metadata: any, scenes: Scene[]}> => {
  try {
    let modifiedCharacters = selectedCharacters;
    if (selectedCharacters && selectedCharacters.length === 2) {
      const char1Name = selectedCharacters[0].name;
      const char2Name = selectedCharacters[1].name;
      const criticalRule = `\n\nCRITICAL RULE - 2 characters selected:\nEvery scene narration MUST follow this format:\n${char1Name}: "대사 내용"\n${char2Name}: "대사 내용"\n\n- 반드시 두 캐릭터가 번갈아 대화\n- 반드시 상대방 이름을 불러가며 대화\n- 절대 3인칭 관찰자 형식 사용 금지\n- 절대 화자 태그 없이 출력 금지\n- 매 씬마다 위 형식 엄격히 준수`;
      
      modifiedCharacters = [
        { ...selectedCharacters[0], description: selectedCharacters[0].description + criticalRule },
        selectedCharacters[1]
      ];
    }

    const storyStructureRules = `\n\nSTORY STRUCTURE RULES:\nDivide 20 scenes into 4 acts:\n\nACT 1 - Hook (scenes 1~4):\nStart with the most visually striking moment.\nOpen with a philosophical question to create empathy.\nClearly present today's destination and journey purpose.\nMake viewers feel they must watch till the end.\nscene 1 Image Prompt MUST start with:\ncamera viewfinder UI overlay,\nfocus brackets, exposure meter display,\nPOV through lens effect,\n[then continue with scene description]\n\nACT 2 - Journey (scenes 5~10):\nConvey sensory experience: sounds, smells, colors.\nLayer in local history and cultural context naturally.\nShow gradual emotional change of the character.\nInsert 1 IT metaphor naturally:\n(logout / sync / reboot / offline cache / sleep mode)\n\nACT 3 - Twist (scenes 11~16):\nReveal an unexpected discovery or realization.\nShow something different from expectations.\nConnect to MetaNomad philosophy:\n'Every alley is a destination'\nBuild emotional tension or a touching moment.\n\nACT 4 - Resolution (scenes 17~20):\nscenes 17~18: Emotional wrap-up using sunset or night scenery.\nscene 19: Leave a philosophical message as lingering emotion.\nscene 20: CTA only - encourage comments with a question.\nNO preview of next journey.\n\nAlways reflect the selected city and theme characteristics.

RUNNING TIME CONTROL (CRITICAL):
- Target total running time: 15~18 minutes (900~1080 seconds)
- Each scene narration: MAX 200~300 Korean characters (60~80 seconds)
- Do NOT exceed 300 characters per scene narration under any circumstances
- Dialogue scenes (2-person): each character speaks MAX 2 lines per scene
- This limit is ABSOLUTE - shorter narration = better pacing

ANTI-REPETITION RULES (CRITICAL):
- Each scene MUST have a UNIQUE placeName. NO two scenes can share the same location.
- Walking-together shots are allowed MAX ONCE per act (max 4 total across all 20 scenes).
- The phrase or action "두 사람이 걷는다 / walking together / walking side by side" 
  may appear in videoPromptKOR/ENG MAX ONCE per act.
- FORBIDDEN repeated patterns across scenes:
  * Do NOT repeat: "두 사람이 골목을 걷는다" more than once per act
  * Do NOT repeat: wide back-view walking shots in consecutive scenes
  * Do NOT repeat: the same sensory focus (e.g., smell/coffee) in adjacent scenes
  * Do NOT generate multiple scenes with the same background type (e.g., two "narrow alley" scenes back-to-back)
- Each act must cover DIFFERENT location types:
  * Act 1: entrance/architecture/historical artifact/clothing
  * Act 2: cafe/visual art spot/quiet alley/scent/food
  * Act 3: getting lost/hidden everyday life/small discovery/emotional realization/open sky
  * Act 4: rooftop/night alley/gate/farewell
- Scene topics within the same act must NOT overlap in theme or visual content.

STORY TYPE AUTO-DETECTION:

First, analyze the topic title and
automatically detect the story type:

TYPE A - Location Based:
Indicators: country name, city name,
region name, landmark, street name
Examples: Athens, Gyeongju, Plaka,
Hwangnidan-gil, Paris, Tokyo

TYPE B - Event/Emotion Based:
Indicators: atmosphere, time of day,
season, feeling, abstract concept
Examples: dawn market, sunset,
rainy day, festival, hidden cafe

APPLY DIFFERENT STRATEGY PER TYPE:

TYPE A - Location Based Strategy:
- Include 2~3 historical or cultural
  facts about the location naturally
- Mention local hidden spots vs
  famous tourist spots contrast
- Include local people's daily life
- Add sensory details:
  sounds, smells, textures of the place
- Reference specific local food,
  architecture, or traditions

TYPE B - Event/Emotion Based Strategy:
- Focus on universal human emotions
  that all viewers can relate to
- Layer all 5 senses:
  sight, sound, smell, taste, touch
- Build emotional tension gradually
- Connect personal moment to
  universal human experience
- Use poetic metaphors and imagery
- Create intimate atmosphere`;

    let modifiedLocation = location 
      ? { ...location, landmark: location.landmark + storyStructureRules }
      : { country: '일상', landmark: '숨겨진 장소' + storyStructureRules };

    // 1단계: 나레이션·기본정보만 생성
    const baseResult = await generateStoryBase(
      theme, 
      modifiedLocation, 
      narrationType, 
      anchorPrompt, 
      modifiedCharacters
    );

    const format = baseResult.metadata?.format || '1인 독백';
    const scenesWithImages: Scene[] = [];

    // 2단계: 각 Scene마다 JS 계산 후 이미지 별도 호출 (청크 병렬 처리)
    const CHUNK_SIZE = 5;
    for (let i = 0; i < baseResult.scenes.length; i += CHUNK_SIZE) {
      const chunk = baseResult.scenes.slice(i, i + CHUNK_SIZE);
      
      const chunkResults = await Promise.all(
        chunk.map(async (scene) => {
          const textLength = (scene.narrationKOR || '').length;
          // Sync 기준: 한글 1자 ≈ 0.2초(2인대화) / 0.17초(1인), 이미지 1컷 = 8초
          // imageCount = ceil(narrDuration / 8), 범위: 최소 4, 최대 8
          const narrDurationSec = format === '2인 대화'
            ? textLength * 0.20
            : textLength * 0.17;
          const calculatedCount = Math.ceil(narrDurationSec / 8);
          const imageCount = Math.min(8, Math.max(4, calculatedCount));

          const images = await generateImagePrompts(
            scene,
            imageCount,
            baseResult.selectedStyle
          );

          return {
            ...scene,
            imagePromptsKOR: images.imagePromptsKOR || [],
            imagePromptsENG: images.imagePromptsENG || []
          } as Scene;
        })
      );

      scenesWithImages.push(...chunkResults);
    }

    return {
      ...baseResult,
      scenes: scenesWithImages
    };
  } catch (e) {
    console.error("Story Arc generation failed:", e);
    return { 
      selectedStyle: 'Animation', 
      styleReason: '오류로 인한 기본 스타일', 
      metadata: { format: '1인 독백', season: '봄', timeOfDay: '오후', vibes: ['감성적인'], estimatedDuration: 600 },
      scenes: [] 
    };
  }
};

// DO NOT MODIFY - Core Function
export const generateStoryBase = async (
  theme: TravelTheme | string, 
  location?: LocationContext, 
  narrationType: string = 'RANDOM', 
  anchorPrompt?: string,
  selectedCharacters?: Character[]
): Promise<{selectedStyle: string, styleReason: string, metadata: any, scenes: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>[]}> => {
  const context = typeof theme === 'string' ? theme : theme.title;
  const locationPrompt = location 
    ? `국가: ${location.country}, 명소: ${location.landmark} 지역 내의 구체적인 장소들을 배경으로 합니다.` 
    : "일상 속의 숨겨진 장소들을 배경으로 합니다.";

  const characterCount = selectedCharacters?.length || 0;
  console.log('geminiService.ts - 캐릭터 수:', characterCount);
  const isMultiMode = characterCount >= 2;
  const charNames = selectedCharacters?.map(c => c.name).join(', ') || '';
  
  const narrativeMode = isMultiMode 
    ? `${characterCount}인 대화형: 반드시 선택된 모든 캐릭터들(${charNames})이 번갈아 대화하는 형식으로 작성. 예시: ${selectedCharacters![0].name}: "..." ${selectedCharacters![1].name}: "..."`
    : '1인 3인칭 관찰자 나레이션';

  const narrationFormatRule = isMultiMode
    ? `[대화형 구성 규칙]
    - 반드시 선택된 모든 캐릭터들(${charNames})이 서로 대화하는 형식으로 작성하세요.
    - 각 장면의 narrationKOR 필드에서 대사 앞에 반드시 캐릭터 이름을 붙이세요. (예: ${selectedCharacters![0].name}: "...", ${selectedCharacters![1].name}: "...")
    - 캐릭터들이 해당 장소의 분위기나 주제에 대해 서로 의견을 나누는 티키타카가 핵심입니다. 모든 캐릭터가 골고루 대화에 참여하게 하세요.`
    : `[나레이션 구성 규칙]
    - 3인칭 관찰자 시점으로 작성하세요.
    - 캐릭터의 내면보다는 행동과 주변 풍경을 관찰하며 서술하는 따뜻한 다큐멘터리 에세이 톤을 유지하세요.`;

  const char1Prompt = selectedCharacters?.[0]?.imagePrompt?.slice(0, 200) || '';
  const char2Prompt = selectedCharacters?.[1]?.imagePrompt?.slice(0, 200) || '';
  const char1Name = selectedCharacters?.[0]?.name || '';
  const char2Name = selectedCharacters?.[1]?.name || '';

  let characterPrompt = "";
  if (selectedCharacters && selectedCharacters.length > 0) {
    const charList = selectedCharacters.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n    ');
    characterPrompt = `
    [Global Character Context]
    The following characters MUST appear in every generated scene:
    ${charList}
    
    [Character Reference - Do NOT copy verbatim]
    Translate the following to English keywords only.
    Extract max 10 key appearance keywords per character.

    ${char1Name ? `${char1Name}: ${char1Prompt}` : ''}
    ${char2Name ? `${char2Name}: ${char2Prompt}` : ''}

    Rules:
    - Use extracted English keywords in each scene
    - Do NOT repeat full description in every scene
    - Keep Image Prompt ENG under 300 characters
    - Always end with: warm documentary style, cinematic natural lighting, analog film texture, warm vlog tone`;
  }

  const prompt = `
    당신은 세계적인 다큐멘터리 감독이자 감성적인 여행 에세이 작가입니다. 
    선택된 캐릭터 수: ${characterCount}명
    나레이션 타입: ${narrativeMode}
    배경 정보: ${locationPrompt}
    ${characterPrompt}
    ${narrationFormatRule}
    
    먼저, 이 주제와 분위기에 가장 잘 어울리는 영상 스타일을 다음 4가지 중 하나로 자동 선정하세요:
    - Warm Documentary (Live Action Graphic 스타일, 따뜻하고 깊이 있는 다큐멘터리 질감)
    - Animation (지브리 스튜디오 감성의 애니메이션 스타일)
    - Collage (다양한 질감과 사진, 드로잉이 결합된 콜라주 스타일)
    - Isometric Style (3D 아이소메트릭 쿼터뷰 스타일)

    선정 이유를 1~2줄로 작성하세요. (예: "주제가 #RUIN이므로 따뜻한 기록의 가치를 전달하기 위해 Warm Documentary 스타일을 자동 배정했습니다.")

    그리고 선정된 영상 스타일과 나레이션 타입을 완벽히 반영하여 기승전결 구조의 **정확히 20개의 장면 시퀀스**를 생성하세요. 
    이 영상은 유튜브용 15~20분 미니 다큐멘터리 영상입니다. 따라서 영상의 길이는 오직 '나레이션 텍스트의 양'으로 결정됩니다.

    서사 구조 (절대 누락 금지):
    1-4: 기 (Hook) - 시선을 끄는 파격적인 질문이나 상황으로 시작해 시청 이탈 방지
    5-10: 승 (Build-up) - 주제의 매력을 깊이 파고듦. ${isMultiMode ? '두 캐릭터 간의 몰입감 있는 티키타카 대화로 텐션 업' : '3인칭 관찰자 시점의 나레이션으로 깊이 있는 서술'}
    11-15: 전 (Climax) - 통찰력 있는 'Aha!' 모먼트 제공
    16-20: 결 (Outro & CTA) - 늘어지지 않게 결론을 맺고, 글로벌 시청자를 타깃으로 한 구독/좋아요 유도(Call to Action) 자연스럽게 배치
    
    각 장면(1번부터 20번까지)은 반드시 다음 모든 필드를 충실히 채워야 하며, 절대 비워두지 마세요:
    - number: 1~20 순차적 번호
    - stage: '기 (Hook)', '승 (Build-up)', '전 (Climax)', '결 (Outro)' 중 하나
    - placeName: 해당 장면의 구체적이고 감성적인 장소 이름 (한국어)
    - videoPromptKOR: 한국어 영상 지시문. 나레이션의 감정선에 맞춰 캐릭터의 행동과 시선 처리를 구체적으로 명시하세요. 또한 바람에 흔들리는 머리카락, 흘러가는 구름, 반짝이는 윤슬 등 동적인 요소를 반드시 포함하세요.
    - videoPromptENG: 생성형 비디오 AI용 영어 프롬프트. 위 한국어 영상 지시문을 번역 및 최적화하여 작성하세요. "Warm Documentary, Live Action Graphic" 키워드를 적절히 믹스하세요.
    - backgroundKOR: 장면의 분위기와 배경 설명
    - narrationKOR: ${isMultiMode ? '캐릭터 간의 대화 (한국어)' : '나레이션 (한국어)'}. **[매우 중요] 씬당 나레이션 총량은 반드시 공백 포함 200~300자 이내로 작성하세요 (약 60~80초 분량). 대화형은 각 캐릭터가 1~2줄씩만 말하도록 엄격히 제한. 각 씬은 반드시 [씬 번호] 형식으로 구분. ${isMultiMode ? `반드시 선택된 모든 캐릭터들(${charNames})이 서로 대화하는 형식으로 작성하고, 각 대사 앞에 이름을 붙이세요.` : "3인칭 관찰자 시점의 '미니 다큐멘터리 에세이' 스타일로 작성해주세요."}**
    - narrationENG: ${isMultiMode ? 'Dialogue (English)' : 'Narration (English)'}
    - sfxKOR: 장면을 채우는 **'자연의 소리(바람, 물소리 등)와 미니멀한 BGM'**의 조화를 구체적으로 묘사하세요.
    - sfxENG: 효과음 영어 키워드 (Pixabay 검색용)

    JSON 형식으로 반환하세요. 최상위 객체는 다음 속성을 가져야 합니다:
    - selectedStyle: 선정한 영상 스타일 (정확히 "Warm Documentary", "Animation", "Collage", "Isometric Style" 중 하나)
    - styleReason: 선정 이유
    - metadata: 생성된 스토리보드의 메타데이터 객체
      - format: '1인 3인칭 나레이션' 또는 '2인 대화형'
      - season: '봄', '여름', '가을', '겨울' 중 하나
      - timeOfDay: '아침', '오후', '해질녘', '밤' 중 하나
      - vibes: 감성 키워드 배열 (예: ['따뜻한 다큐', '기록', '차분함'])
      - estimatedDuration: 총 예상 러닝타임 (초 단위 정수, 반드시 720~900초 이내. 즉 12~15분 이내로 제한)
    - scenes: 20개의 장면 객체 배열
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          selectedStyle: { type: Type.STRING },
          styleReason: { type: Type.STRING },
          metadata: {
            type: Type.OBJECT,
            properties: {
              format: { type: Type.STRING },
              season: { type: Type.STRING },
              timeOfDay: { type: Type.STRING },
              vibes: { type: Type.ARRAY, items: { type: Type.STRING } },
              estimatedDuration: { type: Type.INTEGER }
            },
            required: ['format', 'season', 'timeOfDay', 'vibes', 'estimatedDuration']
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                stage: { type: Type.STRING },
                placeName: { type: Type.STRING },
                videoPromptKOR: { type: Type.STRING },
                videoPromptENG: { type: Type.STRING },
                backgroundKOR: { type: Type.STRING },
                backgroundENG: { type: Type.STRING },
                narrationKOR: { type: Type.STRING },
                narrationENG: { type: Type.STRING },
                sfxKOR: { type: Type.STRING },
                sfxENG: { type: Type.STRING }
              },
              required: ['number', 'stage', 'placeName', 'videoPromptKOR', 'videoPromptENG', 'narrationKOR', 'narrationENG', 'sfxKOR', 'sfxENG']
            }
          }
        },
        required: ['selectedStyle', 'styleReason', 'metadata', 'scenes']
      }
    }
  });

  try {
    const rawText = response.text || '{}';
    const data = JSON.parse(rawText);
    
    if (!data.scenes || data.scenes.length === 0) throw new Error("Generated content is empty");

    return {
      selectedStyle: data.selectedStyle || 'Warm Documentary',
      styleReason: data.styleReason || '기본 스타일 배정',
      metadata: data.metadata || {
        format: isMultiMode ? `${characterCount}인 대화형` : '1인 3인칭 나레이션',
        season: '봄',
        timeOfDay: '오후',
        vibes: ['따뜻한 다큐'],
        estimatedDuration: 900
      },
      scenes: data.scenes.map((item: any, idx: number) => {
        return {
          ...item,
          videoPromptKOR: item.videoPromptKOR || '',
          videoPromptENG: item.videoPromptENG || '',
          number: item.number || idx + 1,
          stage: item.stage || (idx < 4 ? '기 (Hook)' : idx < 10 ? '승 (Build-up)' : idx < 15 ? '전 (Climax)' : '결 (Outro)')
        };
      })
    };
  } catch (e) {
    console.error("Story Base generation failed:", e);
    return { 
      selectedStyle: 'Animation', 
      styleReason: '오류로 인한 기본 스타일', 
      metadata: { format: '1인 독백', season: '봄', timeOfDay: '오후', vibes: ['감성적인'], estimatedDuration: 600 },
      scenes: [] 
    };
  }
};

// DO NOT MODIFY - Core Function
export const generateImagePrompts = async (
  scene: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>,
  imageCount: number,
  selectedStyle: string
): Promise<{ imagePromptsKOR: string[], imagePromptsENG: string[] }> => {
  const prompt = `
    당신은 세계적인 시네마틱 스토리보드 작가입니다.
    다음 장면(Scene)의 나레이션과 배경을 바탕으로 비디오 생성용 이미지 프롬프트를 작성해야 합니다.

    [장면 정보]
    - 장소: ${scene.placeName}
    - 분위기/배경: ${scene.backgroundKOR}
    - 나레이션: ${scene.narrationKOR}
    - 영상 지시문(KOR): ${scene.videoPromptKOR}
    - 영상 지시문(ENG - 핵심 스타일 및 캐릭터 정보 포함): ${scene.videoPromptENG}

    이 장면에 대해 반드시 정확히 ${imageCount}개의 이미지 프롬프트를 생성하세요. ${imageCount}개보다 많거나 적으면 절대 안 됩니다. JSON 배열의 길이가 정확히 ${imageCount}여야 합니다.
    
    [컷 구성 원칙 - 최대 ${imageCount}컷, 반드시 다양하게]
    권장 앵글 순서 (중복 금지):
    컷 1: Wide/Establishing shot (장소 전경, 인물 20% 이하)
    컷 2: Medium shot (인물+배경 균형, 40% 이하)
    컷 3: Close-up 또는 Detail shot (인물 표정 or 소품 디테일)
    컷 4: Over-the-shoulder 또는 POV shot
    컷 5: Atmosphere/Mood shot (인물 없이 공간감, 빛, 질감)
    컷 6~8: 위 5가지 유형 중 아직 안 쓴 것 우선 사용
    
    [절대 금지 - 중복 패턴]
    - "두 사람이 나란히 걷는" 뒷모습 wide shot: 이 장면에서 최대 1번만 사용
    - 동일한 앵글(와이드/미들/클로즈업)을 연속 2컷 이상 사용 금지
    - 같은 피사체(예: 두 사람의 얼굴 클로즈업)를 연달아 2컷 이상 생성 금지
    - 모든 컷에 인물을 넣지 말 것 - 분위기컷(공간, 질감, 빛)은 인물 없이

    반드시 "${selectedStyle}" 스타일 키워드를 포함할 것.
    
    각 이미지는 같은 장소·시간대를 유지하면서 앵글과 피사체 거리감을 단계적으로 변화시켜 연속 시퀀스로 구성하세요.
    나레이션의 감성 흐름에 이미지의 시각적 흐름도 대응되어야 합니다.

    COMPOSITION RULES:
    1. Shot type per character proportion:
       - Wide shot / Establishing shot:
         Character occupies max 20% of frame.
         Focus on landscape, architecture,
         streets, and environment.
         Character appears small in distance.

       - Medium shot:
         Character occupies max 40% of frame.
         Background environment clearly visible.

       - Close-up / Detail shot:
         Character or object fills frame.
         No full body required.

    2. Props rules:
       - Camera/equipment props:
         Only include when scene description
         specifically mentions photography
         or camera action.
         Do NOT include camera in every shot.

    3. Background priority:
       Always ensure local landmarks,
       architecture, streets, and atmosphere
       are clearly visible and prominent.
       Character is a visitor in the scene,
       not the main subject.

    [중요 규칙]
    - 생성되는 모든 영어 이미지 프롬프트(imagePromptsENG)는 반드시 '영상 지시문(ENG)'을 기반으로 작성하세요.
    - '영상 지시문(ENG)'에 포함된 캐릭터 외형 키워드와 마지막 스타일 키워드(warm documentary style, cinematic natural lighting, analog film texture, warm vlog tone)를 모든 프롬프트 끝에 동일하게 유지하세요.

    JSON 형식으로 반환하세요. 최상위 객체는 다음 속성을 가져야 합니다:
    - imagePromptsKOR: 한국어 이미지 프롬프트 배열 (정확히 ${imageCount}개)
    - imagePromptsENG: 영어 이미지 프롬프트 배열 (정확히 ${imageCount}개, KOR과 순서/내용 일치)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 8192 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imagePromptsKOR: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            imagePromptsENG: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['imagePromptsKOR', 'imagePromptsENG']
        }
      }
    });

    const rawText = response.text || '{}';
    const data = JSON.parse(rawText);
    
    return {
      imagePromptsKOR: data.imagePromptsKOR || [],
      imagePromptsENG: data.imagePromptsENG || []
    };
  } catch (e) {
    console.error("Image Prompts generation failed:", e);
    return { imagePromptsKOR: [], imagePromptsENG: [] };
  }
};
