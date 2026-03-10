
import React, { useState, useMemo } from 'react';
import { Scene, TravelTheme, StoryboardHistory } from '../types';

interface Props {
  scenes: Scene[];
  themes: TravelTheme[];
  usedThemeTitles: string[];
  storyboardHistory?: StoryboardHistory[];
  onBack: () => void;
  onHome: () => void;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

const ALL_CATEGORIES = ['NATURE', 'FOOD', 'CULTURE', 'DAILY', 'HIDDEN', 'NIGHT', 'ROAD', 'MARKET', 'CAFE', 'RUIN', 'LOCAL', 'BORDER', 'SPIRITUAL', 'STREET', 'SEASON', 'TRANSPORT', 'VILLAGE', 'FESTIVAL', 'SOLO', 'VIEW'];

const EXTERNAL_LINKS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Claude', url: 'https://claude.ai/' },
  { name: 'Grok', url: 'https://grok.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'AI Studio', url: 'https://aistudio.google.com/' },
  { name: 'Google FX', url: 'https://labs.google/fx/ko' },
  { name: 'CapCut', url: 'https://www.capcut.com/' },
  { name: 'Canva', url: 'https://www.canva.com/' },
  { name: 'ElevenLabs', url: 'https://elevenlabs.io/' },
  { name: 'Typecast', url: 'https://app.typecast.ai/ko' },
  { name: 'Suno', url: 'https://suno.com/' },
  { name: 'UniConverter', url: 'https://uniconverter.wondershare.kr/' }
];

const StageFinalization: React.FC<Props> = ({ scenes, themes, usedThemeTitles, storyboardHistory = [], onBack, onHome }) => {
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  let displayThemeTitles = usedThemeTitles;
  try {
    const storedData = localStorage.getItem('usedThemeTitles') || sessionStorage.getItem('usedThemeTitles');
    if (storedData) {
      displayThemeTitles = JSON.parse(storedData);
    }
  } catch (e) {
    console.error("Failed to parse usedThemeTitles", e);
  }

  const analysisData = useMemo(() => {
    if (!storyboardHistory || storyboardHistory.length === 0) return null;

    const categories: Record<string, number> = {};
    const formats: Record<string, number> = {};
    const countries: Record<string, number> = {};
    const landmarks: Record<string, number> = {};
    const seasons: Record<string, number> = {};
    const timesOfDay: Record<string, number> = {};
    const vibes: Record<string, number> = {};
    let totalDuration = 0;

    storyboardHistory.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + 1;
      formats[item.format] = (formats[item.format] || 0) + 1;
      
      if (item.country && item.country !== 'Unknown') {
        countries[item.country] = (countries[item.country] || 0) + 1;
      }
      if (item.landmark && item.landmark !== 'Unknown') {
        landmarks[item.landmark] = (landmarks[item.landmark] || 0) + 1;
      }
      
      seasons[item.season] = (seasons[item.season] || 0) + 1;
      timesOfDay[item.timeOfDay] = (timesOfDay[item.timeOfDay] || 0) + 1;
      
      if (item.vibes && Array.isArray(item.vibes)) {
        item.vibes.forEach(vibe => {
          vibes[vibe] = (vibes[vibe] || 0) + 1;
        });
      }
      
      totalDuration += item.estimatedDuration || 0;
    });

    const sortObj = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
      totalCount: storyboardHistory.length,
      categories: sortObj(categories),
      formats: sortObj(formats),
      countries: sortObj(countries),
      landmarks: sortObj(landmarks),
      seasons: sortObj(seasons),
      timesOfDay: sortObj(timesOfDay),
      vibes: sortObj(vibes),
      totalDuration
    };
  }, [storyboardHistory]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}분 ${s}초`;
  };

  const handleAnalyze = () => {
    if (!storyboardHistory || storyboardHistory.length === 0) {
      alert("분석할 컨텐츠가 없습니다. 먼저 스토리보드를 생성해주세요.");
      return;
    }
    setIsAnalysisModalOpen(true);
  };

  return (
    <div className="space-y-10 animate-fadeIn max-w-4xl mx-auto">
      <header className="text-center space-y-4">
        <h2 className="text-4xl font-black text-stone-800 ghibli-title">최종 결과물 핸들러</h2>
        <p className="text-stone-500">모든 준비가 끝났습니다. 외부 AI 툴과 편집기를 활용해 마법을 부릴 시간입니다.</p>
      </header>

      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="px-6 py-2 bg-stone-200 text-stone-700 rounded-xl font-bold hover:bg-stone-300 transition-all">
          이전단계
        </button>
        <button onClick={onHome} className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all">
          처음단계(영감발견)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Used Themes List */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <h3 className="text-2xl font-bold text-stone-800">생성 완료된 주제 목록</h3>
          <p className="text-stone-500 text-sm">중복 생성을 방지하기 위해 지금까지 작업한 주제들을 기록합니다.</p>
          <ul className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {displayThemeTitles.length === 0 ? (
              <li className="text-stone-400 text-sm italic">아직 생성된 주제가 없습니다.</li>
            ) : (
              displayThemeTitles.map(title => stripHtml(title)).map((title, idx) => (
                <li key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm font-medium text-stone-700">
                  <span className="text-amber-600 mr-2">✓</span>
                  {title}
                </li>
              ))
            )}
          </ul>
          <button 
            onClick={handleAnalyze}
            className="w-full py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            컨텐츠 분석
          </button>
        </div>

        {/* External Links */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <h3 className="text-2xl font-bold text-stone-800">외부 AI 및 편집 툴</h3>
          <p className="text-stone-500 text-sm">아래의 툴들을 활용하여 에셋을 생성하고 영상을 편집하세요.</p>
          <div className="grid grid-cols-2 gap-3">
            {EXTERNAL_LINKS.map(link => (
              <a 
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 bg-stone-50 border border-stone-200 rounded-lg text-sm font-bold text-stone-600 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all text-center"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Analysis Modal */}
      {isAnalysisModalOpen && analysisData && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                콘텐츠 기획 대시보드
              </h3>
              <button 
                onClick={() => setIsAnalysisModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
              {/* [총 생성 횟수] */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">[총 생성 횟수]</h4>
                <p className="text-2xl font-black text-stone-800">전체 주제 생성 수: <span className="text-amber-600">{analysisData.totalCount}</span>개</p>
              </div>

              {/* [포맷별 비율] */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">[포맷별 비율]</h4>
                <div className="flex flex-wrap gap-4 items-center">
                  {analysisData.formats.map(([format, count], idx) => (
                    <React.Fragment key={format}>
                      <span className="text-lg font-bold text-stone-700">
                        {format}: <span className="text-blue-600">{count}회</span>
                      </span>
                      {idx < analysisData.formats.length - 1 && (
                        <span className="text-stone-300">/</span>
                      )}
                    </React.Fragment>
                  ))}
                  {analysisData.formats.length === 0 && (
                    <span className="text-sm text-stone-400">포맷 데이터가 없습니다.</span>
                  )}
                </div>
              </div>

              {/* [태그별 사용 횟수] */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">[태그별 사용 횟수]</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisData.categories.map(([cat, count]) => (
                    <span key={cat} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium border border-stone-200">
                      #{cat} <span className="ml-1 text-stone-400">{count}회</span>
                    </span>
                  ))}
                  {analysisData.categories.length === 0 && (
                    <span className="text-sm text-stone-400">사용된 태그가 없습니다.</span>
                  )}
                </div>
              </div>

              {/* [아직 안 쓴 태그 추천] */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">[아직 안 쓴 태그 추천]</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.filter(cat => !analysisData.categories.find(([c]) => c === cat)).map(cat => (
                    <span key={cat} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium border border-amber-200 border-dashed">
                      #{cat}
                    </span>
                  ))}
                  {ALL_CATEGORIES.filter(cat => !analysisData.categories.find(([c]) => c === cat)).length === 0 && (
                    <span className="text-sm text-stone-400">모든 태그를 사용해보셨습니다!</span>
                  )}
                </div>
              </div>

              {/* [인기 장소] */}
              {analysisData.countries.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">[인기 장소]</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisData.countries.map(([country, count]) => (
                      <span key={country} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
                        {country} <span className="ml-1 text-emerald-500">{count}회</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-stone-100 bg-stone-50 text-center">
              <button 
                onClick={() => setIsAnalysisModalOpen(false)}
                className="px-8 py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StageFinalization;
