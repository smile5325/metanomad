import { TravelTheme, Scene, LocationContext, Character } from "./types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || '';

async function callClaude(
  model: string,
  system: string,
  userContent: string,
  maxTokens: number = 8192
): Promise<string> {
  // ✏️ Fix 1: API_KEY 미설정 시 fetch 전에 명확한 에러 throw (401 대신 사용자 친화적 메시지)
  if (!API_KEY) {
    throw new Error('API_KEY_MISSING: VITE_CLAUDE_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일에 VITE_CLAUDE_API_KEY=sk-ant-... 를 추가하세요.');
  }

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 120000); // ✏️ 60초 → 120초

  let response: Response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: system + '\n\nIMPORTANT: Output ONLY raw JSON. No markdown, no code blocks, no explanation.',
        messages: [
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(fetchTimeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Claude API 요청 시간 초과 (120초). 네트워크 상태를 확인하고 재시도해주세요.');
    }
    throw err;
  }
  clearTimeout(fetchTimeout);

  if (!response.ok) {
    // ✏️ Fix 8: API 응답 전체 대신 status + error.message만 노출 (API 키·토큰 등 민감 정보 제거)
    const errText = await response.text();
    let safeMsg: string;
    try {
      const errJson = JSON.parse(errText);
      safeMsg = errJson?.error?.message || `HTTP ${response.status}`;
    } catch {
      safeMsg = `HTTP ${response.status}`;
    }
    throw new Error(`Claude API 오류 (${response.status}): ${safeMsg}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callClaudeWithImage(
  model: string,
  system: string,
  base64Image: string,
  mimeType: string,
  textPrompt: string
): Promise<string> {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image },
            },
            { type: 'text', text: textPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    // ✏️ Fix 8 (image): 동일 패턴 적용 — 민감 정보 제거
    const errText = await response.text();
    let safeMsg: string;
    try {
      const errJson = JSON.parse(errText);
      safeMsg = errJson?.error?.message || `HTTP ${response.status}`;
    } catch {
      safeMsg = `HTTP ${response.status}`;
    }
    throw new Error(`Claude API 오류 (${response.status}): ${safeMsg}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

function sanitizeJSON(text: string): string {
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // ✏️ JSON 값 내 제어문자 이스케이프 + 이스케이프 안 된 큰따옴표 처리
  s = s.replace(/"((?:[^"\\]|\\.)*)"/g, (_match, inner) => {
    const fixed = inner
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // ✏️ 이스케이프 안 된 내부 따옴표 → 제거 (대화 형식에서 Name: "대사" → Name: 대사)
      .replace(/(?<!\\)"/g, '');
    return `"${fixed}"`;
  });
  return s;
}

function safeParseJSON<T>(text: string, fallback: T): T {
  const cleaned = sanitizeJSON(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const jsonStart = cleaned.search(/[\[{]/);
    if (jsonStart !== -1) {
      try {
        return JSON.parse(cleaned.slice(jsonStart));
      } catch (innerErr) {
        // ✏️ Fix 9: 2차 파싱 실패도 로깅 (디버그 추적용)
        console.warn('safeParseJSON 2차 파싱 실패:', String(innerErr), cleaned.slice(jsonStart, jsonStart + 80));
      }
    }
    console.error('JSON parse failed:', String(e), cleaned.slice(0, 300));
    return fallback;
  }
}

// ✏️ generateTravelThemes — haiku (빠른 테마 생성)
export const generateTravelThemes = async (
  categories?: string[],
  selectedCharacters?: Character[]
): Promise<TravelTheme[]> => {
  const categoryPrompt = categories && categories.length > 0
    ? `반드시 다음 카테고리 중에서만 주제를 생성해줘: ${categories.join(', ')}`
    : "다양한 카테고리의 주제들로 생성해줘.";

  const characterPrompt = selectedCharacters && selectedCharacters.length > 0
    ? `선택된 캐릭터(${selectedCharacters.map(c => c.name).join(', ')})의 성격과 분위기에 어울리는 주제여야 해.`
    : "";

  const validCategories = ['NATURE','FOOD','CULTURE','DAILY','HIDDEN','NIGHT','ROAD','MARKET','CAFE','RUIN','LOCAL','BORDER','SPIRITUAL','STREET','SEASON','TRANSPORT','VILLAGE','FESTIVAL','SOLO','VIEW'];

  const system = `당신은 감성적인 여행 다큐멘터리 주제 생성 전문가입니다. 반드시 한국어로만 응답하고, 반드시 유효한 JSON만 출력하세요.`;

  const userContent = `현실의 일상을 특별한 여행지로 재해석하는 10가지 감성적인 주제를 생성해줘.
'Warm Documentary' 감성이자 시네마틱한 분위기여야 해.
${categoryPrompt} ${characterPrompt}

반드시 아래 JSON 객체 형식으로만 반환해줘 (다른 텍스트 없이):
{
  "themes": [
    {
      "id": "고유ID (예: theme_1)",
      "title": "주제 제목 (한국어)",
      "category": "${validCategories.join(' | ')} 중 하나",
      "description": "주제 설명 (한국어, 2~3문장)"
    },
    ...총 10개
  ]
}`;

  // ✏️ Fix 10: JSON 파싱 + 데이터 접근 전체를 try-catch로 감싸 런타임 에러 방지
  const raw = await callClaude('claude-haiku-4-5-20251001', system, userContent, 4096);
  try {
    const data = safeParseJSON<{ themes: TravelTheme[] }>(raw, { themes: [] });
    if (!Array.isArray(data?.themes)) {
      console.warn('generateTravelThemes: themes 배열 아님 —', typeof data?.themes);
      return [];
    }
    return data.themes;
  } catch (e) {
    console.error('generateTravelThemes 데이터 처리 실패:', e);
    return [];
  }
};

// ✏️ analyzeImageForThemes — haiku + vision
export const analyzeImageForThemes = async (
  base64Image: string,
  mimeType: string
): Promise<TravelTheme[]> => {
  const validCategories = ['NATURE','FOOD','CULTURE','DAILY','HIDDEN','NIGHT','ROAD','MARKET','CAFE','RUIN','LOCAL','BORDER','SPIRITUAL','STREET','SEASON','TRANSPORT','VILLAGE','FESTIVAL','SOLO','VIEW'];

  const system = `당신은 이미지에서 여행 다큐멘터리 주제를 도출하는 전문가입니다. 반드시 유효한 JSON만 출력하세요.`;

  const textPrompt = `이 이미지에서 영감을 받아, 일상을 특별한 여행지로 재해석하는 4가지 감성적인 여행 주제를 생성해줘.
'Warm Documentary' 감성이자 시네마틱한 분위기여야 해. 반드시 한국어로 작성해.

반드시 아래 JSON 객체 형식으로만 반환해줘:
{
  "themes": [
    {
      "id": "img_theme_1",
      "title": "주제 제목 (한국어)",
      "category": "${validCategories.join(' | ')} 중 하나",
      "description": "주제 설명 (한국어)"
    },
    ...총 4개
  ]
}`;

  try {
    const raw = await callClaudeWithImage('claude-haiku-4-5-20251001', system, base64Image, mimeType, textPrompt);
    const jsonStart = raw.search(/[\[{]/);
    const jsonStr = jsonStart !== -1 ? raw.slice(jsonStart) : raw;
    const data = safeParseJSON<{ themes: TravelTheme[] }>(jsonStr, { themes: [] });
    return Array.isArray(data.themes) ? data.themes : [];
  } catch (e) {
    console.error('analyzeImageForThemes failed:', e);
    return [];
  }
};

// ✏️ analyzeCharacterImage — sonnet + vision
export const analyzeCharacterImage = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  const system = `You are a professional character design analyst. Output only the anchor prompt text, no other content.`;

  const textPrompt = `Analyze this character image and create a strong "Anchor Prompt" that can perfectly reproduce the same character in other scenes.

Extract these 4 elements and combine into one concise English paragraph:
1. Core Identity: gender, approximate age, ethnicity, overall vibe
2. Fixed Appearance: hair style and color, eye color, distinctive facial features
3. Signature Attire: specific materials and colors of clothing, accessories always worn
4. Art Style: the art style of this image (e.g., 3D game rendering, Ghibli animation, photorealistic)

Return ONLY one comma-separated English prompt paragraph. Example: "A 20-year-old Asian female with a mysterious vibe, short black bob hair, brown eyes, wearing a red leather jacket and a silver necklace, 3D game rendering style"`;

  try {
    const result = await callClaudeWithImage('claude-sonnet-4-6', system, base64Image, mimeType, textPrompt);
    return result.trim();
  } catch (e) {
    console.error('analyzeCharacterImage failed:', e);
    return '';
  }
};

// ✏️ generateStoryBase — sonnet (기승전결 10씬 구조만, 나레이션 제외)
// 나레이션은 generateNarration에서 씬별 별도 생성
export const generateStoryBase = async (
  theme: TravelTheme | string,
  location?: LocationContext,
  narrationType: string = 'RANDOM',
  anchorPrompt?: string,
  selectedCharacters?: Character[]
): Promise<{ selectedStyle: string; styleReason: string; metadata: any; scenes: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>[] }> => {
  const context = typeof theme === 'string' ? theme : theme.title;
  const locationPrompt = location
    ? `국가: ${location.country}, 명소: ${location.landmark} 지역 내의 구체적인 장소들을 배경으로 합니다.`
    : "일상 속의 숨겨진 장소들을 배경으로 합니다.";

  const characterCount = selectedCharacters?.length || 0;
  const isMultiMode = characterCount >= 2;
  const charNames = selectedCharacters?.map(c => c.name).join(', ') || '';

  const narrativeMode = isMultiMode
    ? `${characterCount}인 대화형: 반드시 선택된 모든 캐릭터들(${charNames})이 번갈아 대화하는 형식`
    : '1인 3인칭 관찰자 나레이션';

  // ✏️ 캐릭터 정보는 videoPromptENG 일관성을 위해 유지
  let characterPrompt = '';
  if (selectedCharacters && selectedCharacters.length > 0) {
    const charList = selectedCharacters.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n');
    const char1Prompt = selectedCharacters?.[0]?.imagePrompt?.slice(0, 200) || '';
    const char2Prompt = selectedCharacters?.[1]?.imagePrompt?.slice(0, 200) || '';
    characterPrompt = `
[캐릭터 정보 - 모든 씬에 반드시 등장]
${charList}

[외형 키워드 (ENG)]
${selectedCharacters[0]?.name}: ${char1Prompt}
${selectedCharacters[1]?.name ? `${selectedCharacters[1].name}: ${char2Prompt}` : ''}
- 외형 키워드를 각 씬 videoPromptENG에 포함하되, 전체 설명 반복 금지
- 항상 마지막에: warm documentary style, cinematic natural lighting, analog film texture, warm vlog tone`;
  }

  const storyStructureRules = `
[기승전결 10씬 구조 - 절대 준수] ✏️ 14→10씬 (응답 속도 최적화)
기 (Hook) 2씬: 가장 시각적으로 강렬한 순간으로 시작. 철학적 질문으로 공감 유도. 씬1 videoPromptENG는 반드시 "camera viewfinder UI overlay, focus brackets, exposure meter display, POV through lens effect,"로 시작.
승 (Build-up) 3씬: 감각적 경험 전달 (소리, 냄새, 색). 지역 역사·문화 자연스럽게 삽입. IT 은유 1개 자연스럽게 삽입 (logout/sync/reboot/offline cache/sleep mode).
전 (Climax) 3씬: 예상 못한 발견이나 깨달음. 감정적 긴장 또는 감동적 순간. MetaNomad 철학 연결: '모든 골목이 목적지'.
결 (Outro) 2씬: 씬9: 석양이나 밤 풍경으로 감정적 마무리. 씬10: CTA만 — 댓글 유도 질문. 다음 여정 예고 없음.

[반복 금지 규칙]
- 각 씬 placeName 고유 (중복 금지)
- '두 사람이 걷는' 뒷모습 shot: 막당 최대 1회
- 연속 씬에 동일 앵글/배경 유형 금지
- 인접 씬에 동일 감각(냄새/커피 등) 반복 금지`;

  // ✏️ 나레이션(narrationKOR/ENG)은 JSON 출력에서 제외 — 별도 generateNarration에서 생성
  const prompt = `당신은 세계적인 다큐멘터리 감독이자 감성적인 여행 에세이 작가입니다.

주제: ${context}
${locationPrompt}
나레이션 방식: ${narrativeMode}
${characterPrompt}
${storyStructureRules}

먼저 이 주제와 분위기에 가장 잘 어울리는 영상 스타일을 자동 선정하세요:
- Warm Documentary (따뜻하고 깊이 있는 다큐멘터리)
- Animation (지브리 감성)
- Collage (콜라주 스타일)
- Isometric Style (3D 아이소메트릭)

[출력 길이 제한 - 반드시 준수]
- backgroundKOR: 씬 배경 묘사 50자 이내
- videoPromptKOR: 최대 60자
- videoPromptENG: 최대 100 chars
- sfxKOR: 최대 20자
- sfxENG: 최대 5 keywords

[금지 표현]
- 장황한 문장 금지 — 간결하고 임팩트 있게

반드시 아래 JSON 형식으로만 반환해줘:
{
  "selectedStyle": "Warm Documentary | Animation | Collage | Isometric Style 중 하나",
  "styleReason": "선정 이유 1줄",
  "metadata": {
    "format": "1인 3인칭 나레이션 | 2인 대화형",
    "season": "봄 | 여름 | 가을 | 겨울",
    "timeOfDay": "아침 | 오후 | 해질녘 | 밤",
    "vibes": ["키워드1", "키워드2", "키워드3"],
    "estimatedDuration": 1350
  },
  "scenes": [
    {
      "number": 1,
      "stage": "기 (Hook) | 승 (Build-up) | 전 (Climax) | 결 (Outro)",
      "placeName": "장소명",
      "backgroundKOR": "배경 묘사 50자 이내",
      "videoPromptKOR": "영상 지시문 60자 이내",
      "videoPromptENG": "video prompt under 100 chars",
      "sfxKOR": "효과음 20자 이내",
      "sfxENG": "sfx keywords"
    }
  ]
}`;

  try {
    // ✏️ 나레이션 제외로 토큰 부담 감소 → 8192로 충분
    const raw = await callClaude('claude-sonnet-4-6', '당신은 JSON만 출력하는 다큐멘터리 스토리보드 작가입니다. 마크다운 없이 순수 JSON만 출력하세요.', prompt, 8192);
    const data = safeParseJSON<any>(raw, null);

    // ✏️ Fix 11: raw 응답 내용 에러 메시지 제외 → 로그에만 기록 (민감 정보 분리)
    if (!data || !data.scenes || data.scenes.length === 0) {
      console.error('generateStoryBase 씬 없음 — raw 앞부분:', raw.slice(0, 100));
      throw new Error('씬 구조 생성 실패: 응답이 비어있습니다.');
    }

    return {
      selectedStyle: data.selectedStyle || 'Warm Documentary',
      styleReason: data.styleReason || '기본 스타일',
      metadata: data.metadata || {
        format: isMultiMode ? '2인 대화형' : '1인 3인칭 나레이션',
        season: '봄',
        timeOfDay: '오후',
        vibes: ['따뜻한 다큐'],
        estimatedDuration: 720,
      },
      scenes: data.scenes.map((item: any, idx: number) => ({
        ...item,
        backgroundKOR: item.backgroundKOR || '',
        backgroundENG: item.backgroundENG || '',
        videoPromptKOR: item.videoPromptKOR || '',
        videoPromptENG: item.videoPromptENG || '',
        // ✏️ 나레이션은 빈값으로 초기화 — generateNarration에서 채워짐
        narrationKOR: '',
        narrationENG: '',
        number: item.number || idx + 1,
        stage: item.stage || (idx < 3 ? '기 (Hook)' : idx < 7 ? '승 (Build-up)' : idx < 11 ? '전 (Climax)' : '결 (Outro)'),
      })),
    };
  } catch (e) {
    console.error('generateStoryBase failed:', e);
    return {
      selectedStyle: 'Warm Documentary',
      styleReason: '오류로 인한 기본 스타일',
      metadata: { format: '1인 3인칭 나레이션', season: '봄', timeOfDay: '오후', vibes: ['감성적인'], estimatedDuration: 720 },
      scenes: [],
    };
  }
};

// ✏️ generateNarration — 씬별 나레이션 단독 생성 (NEW)
// 이전 씬 컨텍스트를 받아 표현 중복 방지 + 감정 흐름 일관성 유지
export const generateNarration = async (
  scene: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>,
  isMultiMode: boolean,
  selectedCharacters: Character[],
  previousNarrations: { number: number; stage: string; narrationKOR: string }[]
): Promise<{ narrationKOR: string; narrationENG: string }> => {

  const charNames = selectedCharacters.map(c => c.name).join(', ');
  const char1Name = selectedCharacters[0]?.name || '화자1';
  const char2Name = selectedCharacters[1]?.name || '화자2';

  // ✏️ 이전 씬 컨텍스트: 모든 이전 씬의 나레이션 앞 80자 요약 전달
  const prevContext = previousNarrations.length > 0
    ? previousNarrations
        .map(p => `씬${p.number}(${p.stage}): "${p.narrationKOR.slice(0, 80)}..."`)
        .join('\n')
    : '(첫 번째 씬 — 강렬한 훅으로 시작)';

  const narrationRule = isMultiMode
    ? `2인 대화형 구성 규칙:
- ${char1Name}과 ${char2Name}이 번갈아 대화하는 형식
- ✏️ 형식: ${char1Name}: 대사 / ${char2Name}: 대사  ← 큰따옴표 절대 사용 금지 (JSON 파싱 오류 방지)
- 각 대사 50~80자, 5~7회 교대
- 목표 글자수: 반드시 530~580자 (실측 6.6자/초 × 80~88초 분량)`
    : `1인 3인칭 관찰자 나레이션 구성 규칙:
- 따뜻한 다큐멘터리 에세이 톤
- 5~7문장으로 구성
- 목표 글자수: 반드시 560~620자 (실측 6.6자/초 × 85~94초 분량)`;

  // ✏️ 씬10(Outro CTA)는 짧은 질문형으로 예외 처리 (14→10씬)
  const isCtaScene = scene.number === 10 || scene.stage?.includes('결');
  const narrationRuleFinal = isCtaScene && scene.number === 10
    ? `씬10 CTA 규칙:
- 댓글 유도 질문 형식 (시청자에게 직접 질문)
- 목표 글자수: 80~120자 (짧고 강렬하게)
- 예시: "여러분은 어떤 골목에서 멈춰본 적 있나요?"`
    : narrationRule;

  const characterInfo = isMultiMode && selectedCharacters.length >= 2
    ? `\n[캐릭터 정보]\n${selectedCharacters.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')}`
    : '';

  const prompt = `당신은 감성적인 여행 다큐멘터리 나레이션 전문 작가입니다.
지금 작성할 씬은 10씬 기승전결 구조의 씬 ${scene.number}번입니다.

[이번 씬 정보]
스테이지: ${scene.stage}
장소: ${scene.placeName || ''}
배경: ${scene.backgroundKOR || scene.videoPromptKOR || ''}
영상 지시문: ${scene.videoPromptKOR || ''}
${characterInfo}

[나레이션 방식 — 반드시 준수]
${narrationRuleFinal}

[이전 씬 흐름 — 반드시 읽고 표현 중복 방지]
${prevContext}

[절대 금지]
- 이전 씬에서 사용한 표현/문장 구조 그대로 반복 금지
- "정말/너무/매우/굉장히" 연속 사용 금지
- 마크다운, 타임라인([00:00]) 표기 금지
- 목표 글자수 미달 금지 — 반드시 충족할 것

[출력 — JSON만]
{
  "narrationKOR": "...",
  "narrationENG": "..."
}`;

  // ✏️ 실측 기반 목표 수정: 실제 TTS 속도 6.6자/초 → 90초 기준 594자 필요
  const targetMin = isCtaScene && scene.number === 10 ? 80 : (isMultiMode ? 530 : 560);
  // ✏️ 완전 실패 방지용: 미달이더라도 가장 긴 결과 보관
  let bestAttempt = { narrationKOR: '', narrationENG: '' };

  // ✏️ 생성 후 글자수 검증 → 미달 시 최대 2회 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const retryNote = attempt > 0
        ? `\n\n[재시도 ${attempt}회차] narrationKOR가 ${targetMin}자 미만이었습니다. 반드시 ${targetMin}자 이상으로 빠짐없이 작성하세요. 글자 수를 먼저 세고 부족하면 보강하세요.`
        : '';

      const raw = await callClaude(
        'claude-sonnet-4-6',
        '당신은 JSON만 출력하는 나레이션 작가입니다. 마크다운 없이 순수 JSON만 출력하세요.',
        prompt + retryNote,
        3000  // ✏️ 2000 → 3000: KOR 480자 + ENG 250단어 여유 확보
      );

      const data = safeParseJSON<{ narrationKOR: string; narrationENG: string }>(raw, {
        narrationKOR: '',
        narrationENG: '',
      });

      // ✏️ Fix 12: data 타입 검증 — 객체가 아닌 경우 retry 트리거
      if (!data || typeof data !== 'object') {
        throw new Error(`나레이션 JSON 구조 오류: ${typeof data}`);
      }

      const kor = typeof data.narrationKOR === 'string' ? data.narrationKOR : '';
      const eng = typeof data.narrationENG === 'string' ? data.narrationENG : '';

      // ✏️ Fix 2: JSON 파싱 실패(kor 빈값) + API 응답은 있을 때 → 빈 씬 생성 방지
      // safeParseJSON이 fallback을 반환했다는 뜻이므로 retry 트리거
      if (kor.length === 0 && raw.trim().length > 10) {
        throw new Error('JSON 파싱 실패 — 나레이션 응답 파싱 불가');
      }

      // ✏️ 항상 가장 긴 결과를 bestAttempt에 보관 (빈값 방지)
      if (kor.length > bestAttempt.narrationKOR.length) {
        bestAttempt = { narrationKOR: kor, narrationENG: eng };
      }

      // ✏️ 목표 글자수 충족 시 즉시 반환
      if (kor.length >= targetMin) {
        console.log(`씬${scene.number} 나레이션 완료 — ${kor.length}자 (목표 ${targetMin}자)`);
        return { narrationKOR: kor, narrationENG: eng };
      }

      console.warn(`씬${scene.number} 나레이션 ${kor.length}자 — 목표 ${targetMin}자 미달. 재시도 ${attempt + 1}/2`);

      // ✏️ 레이트리밋 방지: 재시도 전 대기 증가
      if (attempt < 2) await new Promise(r => setTimeout(r, 4000));

    } catch (e) {
      console.error(`generateNarration 씬${scene.number} attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
    }
  }

  // ✏️ 3회 모두 목표 미달이더라도 빈값 대신 가장 긴 결과 반환 (빈 씬 방지)
  if (bestAttempt.narrationKOR.length > 0) {
    console.warn(`씬${scene.number}: 목표 미달이지만 최선 결과 사용 — ${bestAttempt.narrationKOR.length}자`);
    return bestAttempt;
  }

  console.error(`씬${scene.number} 나레이션 완전 실패 — 빈값 반환`);
  return { narrationKOR: '', narrationENG: '' };
};

// ✏️ generateImagePrompts — sonnet
export const generateImagePrompts = async (
  scene: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>,
  imageCount: number,
  selectedStyle: string
): Promise<{ imagePromptsKOR: string[]; imagePromptsENG: string[] }> => {
  const prompt = `당신은 시네마틱 스토리보드 작가입니다.
다음 장면 정보를 바탕으로 비디오 생성용 이미지 프롬프트 정확히 ${imageCount}개를 작성하세요.

[장면 정보]
장소: ${scene.placeName}
배경: ${scene.backgroundKOR}
나레이션: ${scene.narrationKOR}
영상 지시문(KOR): ${scene.videoPromptKOR}
영상 지시문(ENG): ${scene.videoPromptENG}

[컷 구성 - ${imageCount}컷 정확히, 중복 금지]
컷1: Wide/Establishing shot (인물 20% 이하)
컷2: Medium shot (인물+배경 균형)
컷3: Close-up 또는 Detail shot
컷4: Over-the-shoulder 또는 POV shot
컷5: Atmosphere/Mood shot (인물 없이)
컷6~: 위 유형 중 미사용 순서로

[절대 금지]
- 동일 앵글 연속 2컷 이상
- "두 사람이 나란히 걷는" 뒷모습 wide shot 이 장면에서 최대 1회
- 모든 컷에 인물 삽입 금지 (분위기컷은 인물 없이)

영상 지시문(ENG)의 캐릭터 외형 키워드와 스타일 키워드를 모든 ENG 프롬프트 끝에 유지.
스타일: "${selectedStyle}"

반드시 아래 JSON 형식으로만 반환해줘:
{
  "imagePromptsKOR": ["컷1 한국어 프롬프트", ... 정확히 ${imageCount}개],
  "imagePromptsENG": ["컷1 영어 프롬프트", ... 정확히 ${imageCount}개]
}`;

  try {
    const raw = await callClaude('claude-sonnet-4-6', 'JSON만 출력하세요. 마크다운 없이.', prompt, 4096);
    const data = safeParseJSON<any>(raw, null);

    const kor: string[] = Array.isArray(data?.imagePromptsKOR) ? data.imagePromptsKOR : [];
    const eng: string[] = Array.isArray(data?.imagePromptsENG) ? data.imagePromptsENG : [];

    // ✏️ KOR/ENG 배열 길이 불일치 수정 — 짧은 쪽에 맞춤
    const minCount = Math.min(kor.length, eng.length);
    if (kor.length !== eng.length) {
      console.warn(`generateImagePrompts KOR(${kor.length}) ≠ ENG(${eng.length}) — ${minCount}개로 통일`);
    }

    return {
      imagePromptsKOR: kor.slice(0, minCount),
      imagePromptsENG: eng.slice(0, minCount),
    };
  } catch (e) {
    console.error('generateImagePrompts failed:', e);
    return { imagePromptsKOR: [], imagePromptsENG: [] };
  }
};

// ✏️ generateStoryArc — 오케스트레이션 (구조 개선)
// 변경된 3단계 흐름:
//   1. generateStoryBase   → 10씬 구조만 생성 (나레이션 제외) ✏️ 14→10씬
//   2. generateNarration   → 씬별 순차 생성 + 이전 씬 컨텍스트 전달 (일관성 보장)
//   3. generateImagePrompts → 컷 수 계산 후 이미지 프롬프트 생성
export const generateStoryArc = async (
  theme: TravelTheme | string,
  location?: LocationContext,
  narrationType: string = 'RANDOM',
  anchorPrompt?: string,
  selectedCharacters?: Character[],
  onProgress?: (message: string) => void  // ✏️ 실시간 진행 상황 콜백
): Promise<{ selectedStyle: string; styleReason: string; metadata: any; scenes: Scene[] }> => {
  try {
    let modifiedCharacters = selectedCharacters;
    if (selectedCharacters && selectedCharacters.length === 2) {
      const char1Name = selectedCharacters[0].name;
      const char2Name = selectedCharacters[1].name;
      const criticalRule = `\n\nCRITICAL RULE: 모든 씬 narrationKOR에서 반드시 ${char1Name}: "대사" ${char2Name}: "대사" 형식 준수. 3인칭 관찰자 형식 절대 금지.`;
      modifiedCharacters = [
        { ...selectedCharacters[0], description: selectedCharacters[0].description + criticalRule },
        selectedCharacters[1],
      ];
    }

    const modifiedLocation = location
      ? location
      : { country: '일상', landmark: '숨겨진 장소' };

    // ── STEP 1: 씬 구조 생성 (나레이션 제외) ────────────────
    onProgress?.('📋 씬 구조 설계 중... (1/3단계)');
    const baseResult = await generateStoryBase(
      theme,
      modifiedLocation,
      narrationType,
      anchorPrompt,
      modifiedCharacters
    );

    // ✏️ 씬 구조 생성 실패 시 명시적 에러 (빈 씬으로 진행 방지 → handleThemeSelect의 catch로 전달)
    if (!baseResult.scenes || baseResult.scenes.length === 0) {
      throw new Error('씬 구조 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    const format = baseResult.metadata?.format || '1인 3인칭 나레이션';
    const isMultiMode = format.includes('2인');

    // ── STEP 2: 씬별 순차 나레이션 생성 (이전 씬 컨텍스트 누적) ──
    // 순차 실행으로 이전 씬 내용을 다음 씬 생성에 반영 → 일관성 보장
    const scenesWithNarration: Omit<Scene, 'imagePromptsENG' | 'imagePromptsKOR'>[] = [];
    const totalScenes = baseResult.scenes.length;

    for (const scene of baseResult.scenes) {
      // ✏️ 실시간 진행 표시
      onProgress?.(`✍️ 나레이션 생성 중... 씬 ${scenesWithNarration.length + 1}/${totalScenes} (2/3단계)`);

      // 지금까지 생성된 씬들의 나레이션을 컨텍스트로 전달
      const previousNarrations = scenesWithNarration.map(s => ({
        number: s.number,
        stage: s.stage,
        narrationKOR: s.narrationKOR,
      }));

      const narration = await generateNarration(
        scene,
        isMultiMode,
        modifiedCharacters || [],
        previousNarrations
      );

      // ✏️ Fix 13: 빈 나레이션 반환 시 onProgress로 UI에 알림 (조용히 넘기지 않음)
      if (!narration.narrationKOR) {
        console.error(`씬${scene.number} 나레이션 완전 실패 — Rate Limit 가능성`);
        onProgress?.(`⚠️ 씬 ${scene.number} 나레이션 실패 (Rate Limit) — 빈 씬으로 진행`);
      }

      scenesWithNarration.push({
        ...scene,
        narrationKOR: narration.narrationKOR,
        narrationENG: narration.narrationENG,
      });

      console.log(`씬${scene.number} 나레이션 완료 — ${narration.narrationKOR.length}자`);

      // ✏️ 나레이션 간 2초 대기 (API 호출 자체가 5~10초이므로 추가 대기 최소화)
      if (scenesWithNarration.length < totalScenes) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // ── STEP 3: 이미지 프롬프트 생성 (나레이션 길이 기반 컷 수 계산) ──
    // ✏️ 나레이션 10회 호출 직후 레이트리밋 방지 — 10초 대기 (14씬 20초→10씬 10초)
    onProgress?.(`⏳ API 안정화 대기 중... (3/3단계 준비)`);
    await new Promise(r => setTimeout(r, 10000));

    onProgress?.(`🎬 이미지 프롬프트 생성 중... (3/3단계)`);
    const scenesWithImages: Scene[] = [];

    const generateWithRetry = async (scene: any, imageCount: number, style: string, maxRetries = 3) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await generateImagePrompts(scene, imageCount, style);
          if (result.imagePromptsENG.length > 0) return result;
        } catch (e) {
          console.error(`씬${scene.number} 이미지 retry ${attempt + 1}:`, e);
        }
        if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 6000 * (attempt + 1)));
      }
      return { imagePromptsKOR: [], imagePromptsENG: [] };
    };

    // ✏️ CHUNK_SIZE 1 — 순차 처리로 레이트리밋 완전 방지 (동시 호출 제거)
    for (let i = 0; i < scenesWithNarration.length; i++) {
      const scene = scenesWithNarration[i];
      onProgress?.(`🎬 이미지 프롬프트 생성 중... 씬 ${i + 1}/${scenesWithNarration.length} (3/3단계)`);

      // ✏️ 실제 나레이션 글자수 기반으로 컷 수 계산 (정확한 Sync)
      const textLength = (scene.narrationKOR || '').length;

      // ✏️ Task3: 빈 나레이션 씬 감지 → videoPrompt 기반 최소 3컷으로 폴백
      if (textLength === 0) {
        console.warn(`씬${scene.number} 나레이션 없음 — videoPrompt 기반 3컷 폴백`);
        scenesWithImages.push({
          ...scene,
          imagePromptsKOR: [scene.videoPromptKOR || '장면 배경 묘사'],
          imagePromptsENG: [scene.videoPromptENG || 'scene background'],
        } as Scene);
        if (i < scenesWithNarration.length - 1) await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      // ✏️ 실측 TTS 속도 6.6자/초 기반으로 이미지 컷 수 계산 (이전: 5자/초 가정)
      const narrDurationSec = textLength / 6.6;
      const calculatedCount = Math.max(1, Math.round(narrDurationSec / 10));
      const imageCount = Math.min(15, Math.max(3, calculatedCount));

      const images = await generateWithRetry(scene, imageCount, baseResult.selectedStyle);

      scenesWithImages.push({
        ...scene,
        imagePromptsKOR: images.imagePromptsKOR || [],
        imagePromptsENG: images.imagePromptsENG || [],
      } as Scene);

      // ✏️ 씬 사이 5초 대기 (레이트리밋 방지)
      if (i < scenesWithNarration.length - 1) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    return { ...baseResult, scenes: scenesWithImages };

  } catch (e) {
    // ✏️ Fix 14: 에러 유형 구분 — API 키/인증 오류는 re-throw (App.tsx catch가 UI 처리)
    const err = e instanceof Error ? e : new Error(String(e));
    // ✏️ 에러 메시지와 일치하도록 수정 ('씬 구조 생성에 실패했습니다' 포함)
    const isFatal = err.message.includes('API_KEY_MISSING')
      || err.message.includes('401')
      || err.message.includes('씬 구조 생성')   // '씬 구조 생성에 실패했습니다' 포함
      || err.message.includes('씬 데이터가 비어');
    if (isFatal) {
      console.error('generateStoryArc 치명적 에러 — re-throw:', err.message);
      throw err;
    }
    console.error('generateStoryArc 부분 실패 (복구 가능):', err.message);
    return {
      selectedStyle: 'Warm Documentary',
      styleReason: '오류로 인한 기본 스타일',
      metadata: { format: '1인 3인칭 나레이션', season: '봄', timeOfDay: '오후', vibes: ['감성적인'], estimatedDuration: 720 },
      scenes: [],
    };
  }
};
