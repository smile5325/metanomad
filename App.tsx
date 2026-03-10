
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WorkflowStage, TravelTheme, Scene, LocationContext, StoryboardHistory, Character } from './types';
import { generateTravelThemes, generateStoryArc } from './geminiService';
import StageInspiration from './components/StageInspiration';
import StageStoryboard from './components/StageStoryboard';
import StageMultimedia from './components/StageMultimedia';
import StageFinalization from './components/StageFinalization';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [stage, setStage] = useState<WorkflowStage>(WorkflowStage.INSPIRATION);
  const [themes, setThemes] = useState<TravelTheme[]>([]);
  const [usedThemeTitles, setUsedThemeTitles] = useState<string[]>([]);
  const [storyboardHistory, setStoryboardHistory] = useState<StoryboardHistory[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<TravelTheme | string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyDetails, setStoryDetails] = useState<{style: string, reason: string, format?: string} | null>(null);
  const [anchorPrompt, setAnchorPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const storedTitles = sessionStorage.getItem('usedThemeTitles');
    if (storedTitles) {
      try {
        const parsed = JSON.parse(storedTitles);
        setUsedThemeTitles(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse usedThemeTitles from sessionStorage", e);
      }
    }
    
    const storedHistory = sessionStorage.getItem('storyboardHistory');
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        setStoryboardHistory(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse storyboardHistory from sessionStorage", e);
      }
    }

    // Load characters from localStorage
    const storedChars = localStorage.getItem('character_list') || localStorage.getItem('characters');
    if (storedChars) {
      try {
        const parsed = JSON.parse(storedChars);
        setCharacters(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse characters from localStorage", e);
      }
    }
  }, []);

  const fetchThemes = useCallback(async (categories?: string[]) => {
    setLoading(true);
    try {
      const data = await generateTravelThemes(categories);
      setThemes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleThemeSelect = async (theme: TravelTheme | string, location?: LocationContext, narrationType: string = 'RANDOM', selectedCharacters: Character[] = []) => {
    const title = typeof theme === 'string' ? theme.substring(0, 50) : theme.title;
    
    setUsedThemeTitles(prev => {
      if (prev.includes(title)) return prev;
      const updated = [...prev, title];
      sessionStorage.setItem('usedThemeTitles', JSON.stringify(updated));
      return updated;
    });

    setSelectedTheme(theme);
    setLoading(true);
    try {
      console.log('App.tsx - 전달받은 캐릭터 수:', selectedCharacters.length);
      const storyData = await generateStoryArc(theme, location, narrationType, anchorPrompt, selectedCharacters);
      setScenes(storyData.scenes);
      setStoryDetails({ style: storyData.selectedStyle, reason: storyData.styleReason, format: storyData.metadata?.format || '1인 독백' });
      
      // Save history
      const newHistory: StoryboardHistory = {
        id: Date.now().toString(),
        themeTitle: title,
        category: typeof theme === 'string' ? 'CUSTOM' : theme.category,
        format: storyData.metadata?.format || '1인 독백',
        country: location?.country || 'Unknown',
        landmark: location?.landmark || 'Unknown',
        season: storyData.metadata?.season || '봄',
        timeOfDay: storyData.metadata?.timeOfDay || '오후',
        vibes: storyData.metadata?.vibes || ['감성적인'],
        estimatedDuration: storyData.metadata?.estimatedDuration || 600,
        createdAt: new Date().toISOString()
      };
      
      setStoryboardHistory(prev => {
        const updated = [newHistory, ...prev];
        sessionStorage.setItem('storyboardHistory', JSON.stringify(updated));
        return updated;
      });
      
      setStage(WorkflowStage.STORYBOARD);
    } catch (error: any) {
      console.error("Story generation failed or was cancelled:", error);
      if (error?.message?.includes("Requested entity was not found")) {
        alert("API 키가 유효하지 않거나 할당량이 초과되었습니다. 상단의 'API 키 연결' 버튼을 통해 유료 프로젝트의 키를 다시 선택해주세요.");
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        }
      } else {
        alert("생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLoading = () => {
    setLoading(false);
    // Note: Gemini API doesn't support native AbortSignal in all methods yet, 
    // but we force the UI state to reset for user responsiveness.
    console.log("User requested to cancel generation.");
  };

  const resetProcess = () => {
    setStage(WorkflowStage.INSPIRATION);
    setSelectedTheme(null);
    setScenes([]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentStage={stage} onLogoClick={resetProcess} onStageClick={setStage} />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl relative">
        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
            <div className="w-20 h-20 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin mb-6"></div>
            <div className="text-center space-y-2 mb-8">
              <p className="text-amber-900 text-xl font-bold animate-pulse">따뜻한 기록, 다큐멘터리 시퀀스 구성 중...</p>
              <p className="text-stone-500 text-sm">깊이 있는 서사를 위해 최대 30초 정도 소요될 수 있습니다.</p>
            </div>
            
            <button 
              onClick={handleCancelLoading}
              className="px-6 py-2 bg-stone-800 text-white rounded-full text-sm font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              생성 취소 (강제 중단)
            </button>
          </div>
        )}

        {stage === WorkflowStage.INSPIRATION && (
          <StageInspiration 
            themes={themes} 
            usedThemeTitles={usedThemeTitles}
            characters={characters}
            onSelect={handleThemeSelect} 
            onRefresh={fetchThemes} 
            setThemes={setThemes}
            anchorPrompt={anchorPrompt}
            setAnchorPrompt={setAnchorPrompt}
          />
        )}

        {stage === WorkflowStage.STORYBOARD && (
          selectedTheme ? (
            <StageStoryboard 
              theme={typeof selectedTheme === 'string' ? { id: 'custom', title: selectedTheme, category: 'DAILY', description: '' } : selectedTheme} 
              scenes={scenes} 
              storyDetails={storyDetails}
              onNext={() => setStage(WorkflowStage.MULTIMEDIA)}
              onBack={() => setStage(WorkflowStage.INSPIRATION)}
            />
          ) : (
            <div className="text-center py-20 text-stone-500">
              <p className="text-xl font-bold mb-4">선택된 주제가 없습니다.</p>
              <button onClick={() => setStage(WorkflowStage.INSPIRATION)} className="px-6 py-2 bg-amber-600 text-white rounded-full font-bold hover:bg-amber-700 transition-colors">영감 발견으로 돌아가기</button>
            </div>
          )
        )}

        {stage === WorkflowStage.MULTIMEDIA && (
          <StageMultimedia 
            theme={typeof selectedTheme === 'string' ? { id: 'custom', title: selectedTheme, category: 'DAILY', description: '' } : selectedTheme}
            scenes={scenes} 
            onNext={() => setStage(WorkflowStage.FINALIZATION)}
            onBack={() => setStage(WorkflowStage.STORYBOARD)}
          />
        )}

        {stage === WorkflowStage.FINALIZATION && (
          <StageFinalization 
            scenes={scenes}
            themes={themes}
            usedThemeTitles={usedThemeTitles}
            storyboardHistory={storyboardHistory}
            onBack={() => setStage(WorkflowStage.MULTIMEDIA)}
            onHome={resetProcess}
          />
        )}
      </main>

      <footer className="bg-stone-100 border-t border-stone-200 py-6 text-center text-stone-500 text-sm">
        © 2024 MetaNomad - Vibe Coding Framework v1.0
      </footer>
    </div>
  );
};

export default App;
