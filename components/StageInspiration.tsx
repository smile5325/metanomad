
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TravelTheme, LocationContext, Character } from '../types';
import { analyzeImageForThemes, generateTravelThemes } from '../claudeService';

interface Props {
  themes: TravelTheme[];
  usedThemeTitles: string[];
  characters: Character[];
  onSelect: (theme: TravelTheme | string, location?: LocationContext, narrationType?: string, selectedCharacters?: Character[]) => void;
  onRefresh: (categories?: string[]) => void;
  setThemes: React.Dispatch<React.SetStateAction<TravelTheme[]>>;
  anchorPrompt: string;
  setAnchorPrompt: React.Dispatch<React.SetStateAction<string>>;
}

const CATEGORIES = [
  { id: 'NATURE', label: '자연, 산, 숲, 강, 바다' },
  { id: 'FOOD', label: '현지 음식, 골목 맛집, 시장' },
  { id: 'CULTURE', label: '역사, 예술, 건축, 전통' },
  { id: 'DAILY', label: '현지인 일상, 골목 풍경' },
  { id: 'HIDDEN', label: '숨겨진 장소, 비밀 스팟' },
  { id: 'NIGHT', label: '야경, 심야 거리, 밤 문화' },
  { id: 'ROAD', label: '드라이브, 길 위, 이동 중 풍경' },
  { id: 'MARKET', label: '재래시장, 플리마켓, 노점' },
  { id: 'CAFE', label: '독특한 카페, 감성 공간' },
  { id: 'RUIN', label: '폐허, 옛 건물, 시간이 멈춘 곳' },
  { id: 'LOCAL', label: '로컬 문화, 현지인 추천' },
  { id: 'BORDER', label: '국경, 경계 지역, 이색 지대' },
  { id: 'SPIRITUAL', label: '사원, 성지, 명상 공간' },
  { id: 'STREET', label: '거리 예술, 골목, 벽화' },
  { id: 'SEASON', label: '계절 풍경, 특정 시기에만 보이는 것' },
  { id: 'TRANSPORT', label: '기차, 버스, 배' },
  { id: 'VILLAGE', label: '오지 마을, 소도시, 시골' },
  { id: 'FESTIVAL', label: '축제, 행사, 지역 이벤트' },
  { id: 'SOLO', label: '혼자 여행, 내면 여정' },
  { id: 'VIEW', label: '전망, 루프탑, 절경 포인트' }
];

const COUNTRIES = [
  "대한민국", "일본", "프랑스", "이탈리아", "영국", "미국", "스페인", "독일", "스위스", "오스트리아",
  "베트남", "태국", "대만", "싱가포르", "호주", "뉴질랜드", "캐나다", "그리스", "포르투갈", "체코"
];

const LANDMARKS: Record<string, string[]> = {
  "대한민국": ["서울 익선동", "경주 황리단길", "제주 애월", "부산 영도", "전주 한옥마을"],
  "일본": ["교토 기온거리", "도쿄 시부야 골목", "오사카 나카노시마", "삿포로 오도리", "후쿠오카 야타이"],
  "프랑스": ["파리 몽마르뜨", "니스 구시가지", "리옹 미식거리", "스트라스부르 운하", "보르도 와이너리"],
  "이탈리아": ["로마 트라스테베레", "피렌체 올트라노", "베네치아 부라노", "아말피 해안마을", "밀라노 브레라"],
  "영국": ["런던 쇼디치", "에든버러 로열마일", "옥스퍼드 골목", "브라이튼 해변", "코츠월드 마을"],
  "미국": ["뉴욕 브루클린", "샌프란시스코 미션", "뉴올리언스 프렌치쿼터", "시카고 리버워크", "포틀랜드 예술지구"],
  "스페인": ["바르셀로나 고딕지구", "마드리드 말라사냐", "세비야 산타크루즈", "그라나다 알바이신", "발렌시아 구시가"],
  "독일": ["베를린 크로이츠베르크", "뮌헨 마리엔광장", "함부르크 항구", "하이델베르크 구시가", "로텐부르크"],
  "스위스": ["루체른 구시가", "체르마트 마을", "인터라켄 호수변", "취리히 니더도르프", "베른 장미공원"],
  "오스트리아": ["비엔나 박물관지구", "잘츠부르크 게트라이데", "할슈타트 호수마을", "인스브루크 구시가", "그라츠"],
  "베트남": ["호이안 올드타운", "하노이 올드쿼터", "달랏 골목길", "다낭 한강변", "사이공 북스퀘어"],
  "태국": ["방콕 탈랏노이", "치앙마이 올드시티", "푸켓 타운", "파타야 좀티엔", "아유타야 유적지"],
  "대만": ["타이베이 디화지에", "지우펀 골목", "타이난 안핑", "가오슝 보얼예술구", "단수이 노을거리"],
  "싱가포르": ["티옹바루", "캄퐁글램", "리틀인디아", "카통 구시가", "클락키"],
  "호주": ["시드니 뉴타운", "멜버른 피츠로이", "브리즈번 웨스트엔드", "퍼스 프리맨틀", "애들레이드 힐스"],
  "뉴질랜드": ["퀸스타운 레이크사이드", "웰링턴 쿠바스트리트", "오클랜드 폰손비", "로토루아 마을", "크라이스트처치"],
  "캐나다": ["몬트리올 구시가", "밴쿠버 개스타운", "토론토 디스틸러리", "퀘벡 쁘띠샹플랭", "빅토리아 이너하버"],
  "그리스": ["아테네 플라카", "산토리니 이아마을", "미코노스 타운", "델피 마을", "로도스 중세도시"],
  "포르투갈": ["리스본 알파마", "포르투 리베이라", "신트라 마을", "라구스 해변", "코임브라"],
  "체코": ["프라하 말라스트라나", "체스키크룸로프", "카를로비바리", "쿠트나호라", "브르노 구시가"]
};

const StageInspiration: React.FC<Props> = ({ themes, usedThemeTitles, characters, onSelect, onRefresh, setThemes, anchorPrompt, setAnchorPrompt }) => {
  const [showAll, setShowAll] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDirectInputOpen, setIsDirectInputOpen] = useState(false);
  const [directInputText, setDirectInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedLandmark, setSelectedLandmark] = useState<string>("");
  const [narrationType, setNarrationType] = useState<string>('RANDOM');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const prevThemesRef = useRef<TravelTheme[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectionMode, setSelectionMode] = useState<'Single' | 'Multi'>('Single');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update anchorPrompt when selected characters change
  useEffect(() => {
    if (!selectedCharacterIds || selectedCharacterIds.length === 0) {
      setAnchorPrompt("");
      return;
    }

    const selectedChars = (characters || []).filter(c => selectedCharacterIds.includes(c.id));
    
    if (selectedChars.length === 1) {
      setAnchorPrompt(selectedChars[0].description);
    } else if (selectedChars.length > 1) {
      const descriptions = selectedChars.map(c => c.description);
      const combined = descriptions.join(" and ");
      setAnchorPrompt(`${combined} are standing together`);
    }
  }, [selectedCharacterIds, characters, setAnchorPrompt]);

  useEffect(() => {
    const syncMode = () => {
      try {
        const storedMode = localStorage.getItem('characterSelectionMode');
        const storedSelectedIds = localStorage.getItem('selectedCharacterIds');
        const storedCharacters = localStorage.getItem('character_list');
        
        let parsedIds: string[] = [];
        try {
          if (storedSelectedIds) {
            const parsed = JSON.parse(storedSelectedIds);
            parsedIds = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          parsedIds = [];
        }

        let allCharacters: Character[] = [];
        try {
          if (storedCharacters) {
            const parsed = JSON.parse(storedCharacters);
            // ✏️ Fix 4: 배열 내 null/undefined 항목 제거로 c.id 접근 시 TypeError 방지
            allCharacters = Array.isArray(parsed)
              ? parsed.filter((c: any) => c && typeof c === 'object' && c.id)
              : [];
          }
        } catch (e) {
          allCharacters = [];
        }

        // Bug 3: Restore selected character objects accurately based on both
        const validIds = allCharacters.length > 0
          ? parsedIds.filter(id => allCharacters.some(c => c?.id === id))
          : parsedIds;
          
        setSelectedCharacterIds(validIds);
        
        // Bug 2: Auto-set multi mode if length >= 2
        if (validIds.length >= 2) {
          setSelectionMode('Multi');
        } else if (storedMode === 'Single' || storedMode === 'Multi') {
          setSelectionMode(storedMode as 'Single' | 'Multi');
        }
      } catch (error) {
        console.error("Error accessing localStorage in syncMode:", error);
      }
    };
    
    syncMode();
    window.addEventListener('characterSelectionChanged', syncMode);
    return () => window.removeEventListener('characterSelectionChanged', syncMode);
  }, []);

  const toggleCharacterSelection = (id: string) => {
    try {
      let newIds: string[] = [];
      if (selectionMode === 'Single') {
        newIds = [id];
      } else {
        newIds = selectedCharacterIds.includes(id) 
          ? selectedCharacterIds.filter(charId => charId !== id) 
          : [...selectedCharacterIds, id];
      }
      setSelectedCharacterIds(newIds);
      localStorage.setItem('selectedCharacterIds', JSON.stringify(newIds));
      
      // selectionMode를 자동으로 변경하지 않고 현재 모드 유지
      window.dispatchEvent(new Event('characterSelectionChanged'));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  };

  const getSelectedCharacters = () => {
    return (characters || []).filter(c => selectedCharacterIds.includes(c.id));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const randomizedThemes = useMemo(() => {
    let filtered = themes;
    if (selectedCategories.length > 0) {
      filtered = themes.filter(t => selectedCategories.includes(t.category.toUpperCase()));
    }
    return [...filtered].sort(() => 0.5 - Math.random());
  }, [themes, selectedCategories]);

  const displayedThemes = showAll ? randomizedThemes : randomizedThemes.slice(0, 4);

  const landmarksForCountry = useMemo(() => {
    return selectedCountry ? LANDMARKS[selectedCountry] || [] : [];
  }, [selectedCountry]);

  const handleFilterSubmit = () => {
    if (selectedCountry && selectedLandmark) {
      onSelect(`${selectedCountry} ${selectedLandmark} 여행`, {
        country: selectedCountry,
        landmark: selectedLandmark
      }, narrationType, getSelectedCharacters());
      setIsFilterOpen(false);
    }
  };

  const handleDirectInputSubmit = () => {
    if (directInputText.trim()) {
      onSelect(directInputText, undefined, narrationType, getSelectedCharacters());
      setIsDirectInputOpen(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result?.toString().split(',')[1];
          if (base64) {
            const newThemes = await analyzeImageForThemes(base64, file.type);
            setThemes(newThemes);
            setShowAll(true);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        onSelect(text, undefined, narrationType, getSelectedCharacters());
      }
    } catch (error) {
      console.error("Image upload/analysis failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefresh = async (categories?: string[]) => {
    const cats = categories || (selectedCategories.length > 0 ? selectedCategories : undefined);
    prevThemesRef.current = themes;
    setIsLoading(true);
    setErrorMsg(null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setErrorMsg("응답 시간이 초과되었습니다. 재시도 버튼을 눌러주세요");
    }, 120000);

    try {
      const selectedChars = (characters || []).filter(c => selectedCharacterIds.includes(c.id));
      const data = await generateTravelThemes(cats, selectedChars);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // ✏️ 빈 배열 반환 시 기존 테마 복원 (API 실패/rate limit 감지)
      if (!data || data.length === 0) {
        setThemes(prevThemesRef.current);
        setErrorMsg("테마를 불러오지 못했습니다. 잠시 후 재시도 버튼을 눌러주세요.");
      } else {
        setThemes(data);
      }
    } catch (err: any) {
      console.error("AI 추천 실패:", err);
      setThemes(prevThemesRef.current);
      // ✏️ alert() 제거 → setErrorMsg로 UI에 표시
      const errMsg = err?.message || String(err);
      setErrorMsg(`테마 로드 실패: ${errMsg.slice(0, 120)}`);
    } finally {
      setIsLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const handleCancel = () => {
    setIsLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setThemes(prevThemesRef.current);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-10 animate-fadeIn relative">
      <header className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold text-stone-800 ghibli-title tracking-tight">장소 영감 발굴기</h2>
          <div className="space-y-1">
            <p className="text-stone-600 italic font-medium">"Every street is a destination. Every moment, a journey."</p>
            <p className="text-stone-400 text-sm font-medium">"모든 골목이 여행지다. 모든 순간이 여정이다."</p>
          </div>
        </div>
        


        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto pt-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                selectedCategories.includes(cat.id)
                  ? 'bg-stone-800 text-white border-stone-800 shadow-md'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              <span>#{cat.id}</span>
              <span className={`font-normal text-[10px] ${selectedCategories.includes(cat.id) ? 'text-stone-300' : 'text-stone-400'}`}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <button 
            className="px-6 py-2.5 bg-amber-600 text-white rounded-full font-medium shadow-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
            onClick={() => handleRefresh(selectedCategories.length > 0 ? selectedCategories : undefined)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            AI 추천 새로고침
          </button>
          <button 
            onClick={() => setIsFilterOpen(true)}
            className={`px-6 py-2.5 rounded-full font-medium transition-colors border ${isFilterOpen ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}
          >
            지역 정밀 필터링
          </button>
        </div>

        {/* Character Selection */}
        <div className="mt-8 p-6 bg-stone-50 border border-stone-200 rounded-2xl max-w-4xl mx-auto text-left">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                캐릭터 선택 (페르소나)
              </h3>
              <p className="text-sm text-stone-500 mt-1">
                스토리보드에 등장할 캐릭터를 선택하세요. 상단 메뉴의 '캐릭터 관리'에서 추가할 수 있습니다.
              </p>
            </div>
            <div className="flex bg-stone-200/50 p-1 rounded-xl">
              <button 
                onClick={() => { 
                  try {
                    setSelectionMode('Single'); 
                    setSelectedCharacterIds([]); 
                    localStorage.setItem('characterSelectionMode', 'Single');
                    localStorage.setItem('selectedCharacterIds', JSON.stringify([]));
                    window.dispatchEvent(new Event('characterSelectionChanged'));
                  } catch (e) {}
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${selectionMode === 'Single' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                1인 (Single)
              </button>
              <button 
                onClick={() => { 
                  try {
                    setSelectionMode('Multi'); 
                    setSelectedCharacterIds([]); 
                    localStorage.setItem('characterSelectionMode', 'Multi');
                    localStorage.setItem('selectedCharacterIds', JSON.stringify([]));
                    window.dispatchEvent(new Event('characterSelectionChanged'));
                  } catch (e) {}
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${selectionMode === 'Multi' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                다중 (Multi)
              </button>
            </div>
          </div>

          {(!characters || characters.length === 0) ? (
            <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
              등록된 캐릭터가 없습니다. 상단 메뉴에서 캐릭터를 등록해주세요.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(characters || []).map(char => {
                const isSelected = (selectedCharacterIds || []).includes(char.id);
                return (
                  <div 
                    key={char.id}
                    onClick={() => toggleCharacterSelection(char.id)}
                    className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${isSelected ? 'border-amber-500 shadow-md shadow-amber-500/20 scale-105' : 'border-stone-200 hover:border-amber-300'}`}
                  >
                    <div className="h-24 overflow-hidden relative">
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white text-center">
                      <p className="font-bold text-stone-800 text-sm truncate">{char.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {anchorPrompt && (
            <div className="mt-4 bg-white p-3 rounded-lg border border-stone-200 text-xs text-stone-600">
              <span className="font-bold text-amber-700 block mb-1">생성될 앵커 프롬프트:</span>
              {anchorPrompt}
            </div>
          )}
      </div>
      </header>

      {/* Filter Modal Overlay */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-stone-800">국가 및 명소 선택</h3>
                <button onClick={() => setIsFilterOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-6">


                {/* Country Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-stone-500 uppercase tracking-widest">1. 국가 선택 (20개국)</label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {COUNTRIES.map(country => (
                      <button
                        key={country}
                        onClick={() => { setSelectedCountry(country); setSelectedLandmark(""); }}
                        className={`py-2 px-1 rounded-lg text-xs font-medium border transition-all ${selectedCountry === country ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-amber-300'}`}
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Landmark Selection */}
                <div className={`space-y-3 transition-opacity duration-300 ${selectedCountry ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <label className="text-sm font-bold text-stone-500 uppercase tracking-widest">2. 지역/명소 선택 (5곳)</label>
                  <div className="flex flex-wrap gap-2">
                    {landmarksForCountry.map(landmark => (
                      <button
                        key={landmark}
                        onClick={() => setSelectedLandmark(landmark)}
                        className={`py-2.5 px-4 rounded-xl text-sm font-bold border transition-all ${selectedLandmark === landmark ? 'bg-stone-800 border-stone-800 text-white' : 'bg-stone-50 border-stone-100 text-stone-500 hover:bg-stone-100'}`}
                      >
                        {landmark}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-stone-100 flex gap-3">
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 py-4 text-stone-400 font-bold hover:text-stone-600 transition-colors"
                >
                  취소
                </button>
                <button 
                  disabled={!selectedLandmark}
                  onClick={handleFilterSubmit}
                  className={`flex-[2] py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${selectedLandmark ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}
                >
                  이 장소에서 20개 장면 생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Input Modal */}
      {isDirectInputOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setIsDirectInputOpen(false)}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-stone-800">나만의 영감 입력</h3>
                <button onClick={() => setIsDirectInputOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-stone-500 text-sm">
                당신이 꿈꾸는 여행의 한 장면이나 특별한 주제를 자유롭게 입력해주세요.
              </p>
              <textarea
                value={directInputText}
                onChange={(e) => setDirectInputText(e.target.value)}
                placeholder="예: 비 내리는 런던의 작은 서점에서 오래된 책 냄새를 맡으며 커피 한 잔..."
                className="w-full h-32 p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none text-stone-700"
              />
              <button
                disabled={!directInputText.trim()}
                onClick={handleDirectInputSubmit}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${directInputText.trim() ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}
              >
                이 영감으로 시퀀스 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin mb-4"></div>
          <p className="text-amber-900 font-bold animate-pulse">이미지 분석 중...</p>
        </div>
      )}

      {errorMsg && (
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedThemes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-400">
            <p className="italic mb-4">선택한 카테고리에 해당하는 주제가 없습니다.</p>
            <button 
              onClick={() => handleRefresh(selectedCategories)}
              className="px-6 py-2 bg-amber-100 text-amber-700 rounded-full font-bold hover:bg-amber-200 transition-colors"
            >
              선택한 카테고리로 AI 추천 새로고침
            </button>
          </div>
        ) : displayedThemes.map((theme) => {
          const isUsed = usedThemeTitles.includes(theme.title);
          const categoryLabel = CATEGORIES.find(c => c.id === theme.category.toUpperCase())?.label || '';
          
          return (
            <div 
              key={theme.id}
              onClick={() => !isUsed && onSelect(theme, undefined, narrationType, getSelectedCharacters())}
              className={`group bg-white rounded-2xl border p-6 shadow-sm transition-all duration-300 relative overflow-hidden ${
                isUsed 
                  ? 'border-stone-200 bg-stone-50/50 opacity-60 cursor-not-allowed' 
                  : 'border-stone-200 cursor-pointer hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              {isUsed && (
                <div className="absolute top-0 right-0 bg-stone-200 text-stone-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                  이미 사용한 주제입니다
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isUsed ? 'bg-stone-200 text-stone-500' : 'bg-amber-100 text-amber-700'
                }`}>
                  <span>#{theme.category}</span>
                  {categoryLabel && (
                    <span className="text-[10px] font-medium opacity-75">
                      {categoryLabel}
                    </span>
                  )}
                </span>
                {!isUsed && (
                  <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                    <svg className="w-4 h-4 text-stone-400 group-hover:text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isUsed ? 'text-stone-500 line-through' : 'text-stone-800'}`}>{theme.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{theme.description}</p>
            </div>
          );
        })}
      </div>
        
      {/* Helper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <a 
          href="https://notebooklm.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-indigo-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors group text-center"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          <span className="font-medium">Google NotebookLM<br/>자료 정리하기</span>
        </a>
        <div 
          onClick={() => setIsDirectInputOpen(true)}
          className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-stone-400 hover:border-amber-300 hover:text-amber-600 cursor-pointer transition-colors group text-center"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          <span className="font-medium">나만의 영감<br/>직접 입력하기</span>
        </div>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border-2 border-dashed border-stone-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-stone-700 hover:border-amber-400 hover:text-amber-600 cursor-pointer transition-colors group text-center"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          <span className="font-medium">이미지/기록 업로드하여<br/>추천받기</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,.txt,.csv,.tsv,.pdf,.xlsx,.ods,.html" 
            className="hidden" 
          />
        </div>
      </div>

      {themes.length > 4 && (
        <div className="flex justify-center mt-6">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 text-stone-500 font-medium hover:text-amber-600 transition-colors"
          >
            {showAll ? '접기' : '펼치기'}
            <svg className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      )}

      {/* AI Recommendation Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-20 h-20 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin mb-6"></div>
          <div className="text-center space-y-2 mb-8">
            <p className="text-amber-900 text-xl font-bold animate-pulse">새로운 영감을 찾는 중...</p>
            <p className="text-stone-500 text-sm">깊이 있는 서사를 위해 최대 30초 정도 소요될 수 있습니다.</p>
          </div>
          
          <button 
            onClick={handleCancel}
            className="px-6 py-2 bg-stone-800 text-white rounded-full text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            생성 취소 (강제 중단)
          </button>
        </div>
      )}
    </div>
  );
};

export default StageInspiration;
