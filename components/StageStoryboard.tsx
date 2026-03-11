 
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { TravelTheme, Scene } from '../types';

interface Props {
  theme: TravelTheme;
  scenes: Scene[]; 
  storyDetails?: { style: string, reason: string, format?: string } | null;
  onNext: () => void;   onBack: () => void;
}

type ExportType = 'image' | 'narration' | 'sfx';
type ExportLang = 'eng' | 'kor';

const StageStoryboard: React.FC<Props> = ({ theme, scenes, storyDetails, onNext, onBack }) => {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const getExportText = (type: ExportType, lang: ExportLang) => {
    if (!scenes || scenes.length === 0) return "생성된 내용이 없습니다.";

    return scenes.map(s => {
      let content = "";
      if (type === 'image') {
        content = lang === 'eng' ? (s.imagePromptsENG?.join('\n') || "No content") : (s.imagePromptsKOR?.join('\n') || "내용 없음");
      } else if (type === 'narration') {
        content = lang === 'eng' ? (s.narrationENG || "No content") : (s.narrationKOR || "내용 없음");
      } else if (type === 'sfx') {
        content = lang === 'eng' ? (s.sfxENG || "No content") : (s.sfxKOR || "내용 없음");
      }
      
      return `[SCENE ${String(s.number).padStart(2, '0')}: ${s.placeName || 'Unknown'}]\n${content}`;
    }).join('\n\n----------------------------------\n\n');
  };

  const handleCopy = (type: ExportType, lang: ExportLang) => {
    const text = getExportText(type, lang);
    const statusKey = `${type}-${lang}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(statusKey);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const handleDownload = (type: ExportType, lang: ExportLang) => {
    const text = getExportText(type, lang);
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    const timestamp = new Date().toISOString().slice(0, 10);
    element.download = `${type}_${lang}_${theme.title.replace(/\s+/g, '_')}_${timestamp}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadXLSX = () => {
    if (!scenes || scenes.length === 0) return;

    const wb = XLSX.utils.book_new();
    const title = theme.title;
    const format = storyDetails?.format || '1인 독백';
    const isMulti = format.includes('2인');

    // ── Sync 계산 헬퍼 ──────────────────────────────────────
    const calcSync = (s: Scene) => {
      const narDuration = isMulti
        ? Math.floor((s.narrationKOR || '').length / 4)
        : Math.floor((s.narrationKOR || '').length / 5);
      const imageCount = s.imagePromptsENG?.length || 0;
      const imageCover = imageCount * 7;
      const syncGap = narDuration - imageCover;
      return { narDuration, imageCount, imageCover, syncGap };
    };

    const totalDuration = scenes.reduce((acc, s) => acc + calcSync(s).narDuration, 0);
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;

    // ══════════════════════════════════════════════════════
    // Sheet 1: 📋 스토리 요약
    // ══════════════════════════════════════════════════════
    const ws1Data: any[][] = [];
    ws1Data.push([`📺 ${title} — 스토리텔링 대본 요약`]);
    ws1Data.push([]);
    ws1Data.push(['■ 프로젝트 요약']);
    ws1Data.push(['주제', title]);
    ws1Data.push(['총 씬 수', `${scenes.length}개`]);
    ws1Data.push(['예상 러닝타임', `약 ${minutes}분 ${seconds}초`]);
    ws1Data.push(['스토리 구조', '기(4) → 승(6) → 전(6) → 결(4)']);
    ws1Data.push(['나레이션 형식', isMulti ? '2인 대화형 (캐릭터1 ↔ 캐릭터2)' : '1인 3인칭 나레이션']);
    ws1Data.push(['영상 스타일', storyDetails?.style || 'Warm Documentary']);
    ws1Data.push([]);
    ws1Data.push(['■ 전체 스토리 임팩트 요약']);
    const coreEmotion = theme.category || '일상';
    const firstNar = scenes[0]?.narrationKOR || '';
    ws1Data.push([`[${coreEmotion}] — 캐릭터들이 발견한 것은 ${firstNar.slice(0, 30)}... 였다.`]);
    ws1Data.push(['기 (Hook)',    (scenes[0]?.narrationKOR  || '').slice(0, 100)]);
    ws1Data.push(['승 (Build-up)',(scenes[4]?.narrationKOR  || '').slice(0, 100)]);
    ws1Data.push(['전 (Climax)', (scenes[10]?.narrationKOR || '').slice(0, 100)]);
    ws1Data.push(['결 (Outro)',   (scenes[16]?.narrationKOR || '').slice(0, 100)]);
    ws1Data.push([]);
    ws1Data.push(['■ 기승전결 씬별 요약']);
    ws1Data.push(['씬', 'Stage', '장소', '나레이션 요약']);
    scenes.forEach((s, idx) => {
      if (idx === 0)  ws1Data.push(['🎬 기 (Hook) — 시선을 끄는 오프닝']);
      if (idx === 4)  ws1Data.push(['🚶 승 (Build-up) — 여정의 깊이']);
      if (idx === 10) ws1Data.push(['💡 전 (Climax) — 반전과 깨달음']);
      if (idx === 16) ws1Data.push(['🌅 결 (Outro) — 감성 마무리 & CTA']);
      ws1Data.push([s.number, s.stage, s.placeName || '', (s.narrationKOR || '').slice(0, 120) + '...']);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = [{ wch: 18 }, { wch: 52 }, { wch: 20 }, { wch: 20 }];

    // ══════════════════════════════════════════════════════
    // Sheet 2: 📖 전체 스토리텔링 대본 (이야기 서술형)
    // ══════════════════════════════════════════════════════
    const ws2Data: any[][] = [];
    ws2Data.push([`📖 ${title} — 전체 스토리텔링 대본`]);
    const stageHdrs: Record<number, string> = {
      0:  '🎬 기 (Hook) — 시선을 끄는 오프닝',
      4:  '🚶 승 (Build-up) — 여정의 깊이',
      10: '💡 전 (Climax) — 반전과 깨달음',
      16: '🌅 결 (Outro) — 감성 마무리 & CTA',
    };
    scenes.forEach((s, idx) => {
      if (stageHdrs[idx]) ws2Data.push([stageHdrs[idx]]);
      ws2Data.push([`씬 ${s.number}`, s.placeName || '']);
      ws2Data.push(['', s.narrationKOR || '']);
      ws2Data.push([]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 95 }];

    // ══════════════════════════════════════════════════════
    // Sheet 3: 🎬 스토리보드 (Sync 4열 포함)
    // ══════════════════════════════════════════════════════
    const ws3Data: any[][] = [];
    ws3Data.push([`🎬 ${title} — 스토리보드`]);
    ws3Data.push([
      '#', 'Stage', 'Place',
      'Narration\nDuration(sec)', 'Image\nCount', 'Image Cover\n(sec)', 'Sync Gap\n(sec)',
      'Narration (KOR)', 'Narration (ENG)',
      'SFX (KOR)', 'SFX (ENG)',
      'Image Prompts (KOR)', 'Image Prompts (ENG)',
      'Video Prompts (KOR)', 'Video Prompts (ENG)',
    ]);
    scenes.forEach(s => {
      const { narDuration, imageCount, imageCover, syncGap } = calcSync(s);
      ws3Data.push([
        s.number, s.stage, s.placeName || '',
        narDuration, imageCount, imageCover, syncGap,
        s.narrationKOR || '', s.narrationENG || '',
        s.sfxKOR || '', s.sfxENG || '',
        s.imagePromptsKOR?.join(' | ') || '',
        s.imagePromptsENG?.join(' | ') || '',
        s.videoPromptKOR || '', s.videoPromptENG || '',
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
    ws3['!cols'] = [
      { wch: 4 }, { wch: 11 }, { wch: 16 },
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 9 },
      { wch: 40 }, { wch: 40 },
      { wch: 14 }, { wch: 14 },
      { wch: 48 }, { wch: 55 },
      { wch: 32 }, { wch: 32 },
    ];

    // ══════════════════════════════════════════════════════
    // Sheet 4: 📤 Grok 프롬프트 출력 (1컷 1행 + 컷 사이 빈행)
    // ══════════════════════════════════════════════════════
    const ws4Data: any[][] = [];
    ws4Data.push(['📤 Grok Automation 이미지 프롬프트 — 씬별 / 1컷 1행 / 컷 사이 빈행 / Grok 복붙용']);
    ws4Data.push([
      '#', 'Stage', 'Image\nCount', 'Narr\nDur(sec)', 'Image\nCover(sec)', 'Sync\nGap(sec)',
      'Image Prompt (ENG) — 1컷 1행, 컷 사이 빈행 → Grok 복붙용',
    ]);
    scenes.forEach(s => {
      const { narDuration, imageCount, imageCover, syncGap } = calcSync(s);
      const prompts = s.imagePromptsENG || [];
      prompts.forEach((prompt, pi) => {
        ws4Data.push([
          pi === 0 ? s.number    : '',
          pi === 0 ? s.stage     : '',
          pi === 0 ? imageCount  : '',
          pi === 0 ? narDuration : '',
          pi === 0 ? imageCover  : '',
          pi === 0 ? syncGap     : '',
          prompt,
        ]);
        if (pi < prompts.length - 1) {
          ws4Data.push(['', '', '', '', '', '', '']); // 컷 사이 빈행
        }
      });
      ws4Data.push([]); // 씬 사이 빈행
    });
    const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
    ws4['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 8 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 88 }];

    // ── 시트 등록 & 저장 ────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, ws1, '📋 스토리 요약');
    XLSX.utils.book_append_sheet(wb, ws2, '📖 전체 스토리텔링 대본');
    XLSX.utils.book_append_sheet(wb, ws3, '🎬 스토리보드');
    XLSX.utils.book_append_sheet(wb, ws4, '📤 Grok 프롬프트 출력');

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeTitle = (theme.title || '').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_').slice(0, 20) || 'MetaNomad';
    XLSX.writeFile(wb, `${safeTitle}_${timestamp}.xlsx`);
  };

  const openPixabay = (query: string) => {
    const encoded = encodeURIComponent(query || "");
    window.open(`https://pixabay.com/sound-effects/search/${encoded}/`, '_blank');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-8">
        <div className="flex flex-col gap-4">
          <div>
            <button 
              onClick={onBack}
              className="text-stone-500 hover:text-stone-800 flex items-center gap-1 mb-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              이전단계
            </button>
            <h2 className="text-3xl font-bold text-stone-800 ghibli-title">{theme.title}</h2>
            <p className="text-amber-700 font-medium italic">"20개 장면의 시각 프롬프트, 대화, 효과음이 모두 준비되었습니다."</p>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={onNext}
              className="px-8 py-3 bg-stone-900 text-white rounded-xl font-bold shadow-xl hover:bg-stone-800 transition-all flex items-center gap-2 w-fit"
            >
              다음단계
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {storyDetails && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✨</span>
              <h3 className="font-bold text-amber-900 text-lg">AI 자동 선정 영상 스타일: {storyDetails.style}</h3>
            </div>
            <div 
              className="text-sm text-amber-800 leading-relaxed [&_*]:text-sm [&_*]:m-0"
              style={{ fontSize: '14px', lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{ __html: storyDetails.reason }}
            />
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-2xl border border-stone-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase w-20">순서</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase">이미지 프롬프트</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase">비디오 프롬프트</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase">1인독백 & 2인대화</th>
                <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase">환경 효과음</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {scenes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-stone-400">생성된 장면이 없습니다. 다시 시도해주세요.</td>
                </tr>
              ) : scenes.map((scene) => (
                <tr key={scene.number} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-6 py-6 align-top">
                    <span className="text-2xl font-black text-stone-200 italic block mb-1">{String(scene.number).padStart(2, '0')}</span>
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border block w-max uppercase ${
                      scene.stage.includes('기') ? 'border-blue-200 text-blue-600 bg-blue-50' :
                      scene.stage.includes('승') ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                      scene.stage.includes('전') ? 'border-purple-200 text-purple-600 bg-purple-50' :
                      'border-amber-200 text-amber-600 bg-amber-50'
                    }`}>
                      {scene.stage}
                    </span>
                  </td>
                  <td className="px-6 py-6 align-top max-w-xs">
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-stone-800">{scene.placeName}</p>
                      {scene.imagePromptsKOR?.map((prompt, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded inline-block">
                            {idx + 1}. {idx === 0 ? '풀 샷 (Wide)' : idx === 1 ? '클로즈업 (Close-up)' : '디테일 (Detail)'}
                          </p>
                          <p className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded border border-stone-100">{prompt}</p>
                          <p className="text-[10px] text-stone-400 italic break-words leading-tight">{scene.imagePromptsENG?.[idx]}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-6 align-top max-w-sm">
                    <div className="space-y-2 group relative">
                      <p className="text-xs text-stone-700 font-medium leading-relaxed whitespace-pre-wrap break-keep">{scene.videoPromptKOR}</p>
                      <div className="absolute left-0 top-full mt-2 w-full bg-stone-800 text-white text-[10px] p-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl">
                        <p className="font-bold text-amber-400 mb-1">ENG Prompt</p>
                        <p className="break-words">{scene.videoPromptENG}</p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(scene.videoPromptENG || "");
                            alert('복사되었습니다.');
                          }}
                          className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white font-bold transition-colors w-full"
                        >
                          복사하기
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 align-top max-w-sm">
                    <div className="space-y-2">
                      {(() => {
                        const format = storyDetails?.format || '1인 독백';
                        const narDuration = format === '2인 대화' ? Math.floor((scene.narrationKOR || "").length / 4) : Math.floor((scene.narrationKOR || "").length / 5);
                        const imgCount = scene.imagePromptsENG?.length || 0;
                        const imgCover = imgCount * 7;
                        const syncGap = narDuration - imgCover;
                        const isSynced = Math.abs(syncGap) <= 3;
                        return (
                          <div className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-1 rounded inline-block mb-1">
                            🎙 나레이션 {narDuration}초 | 🖼 이미지 {imgCover}초 | {isSynced ? '✅ SYNC' : `⚠ ${Math.abs(syncGap)}초 갭`}
                          </div>
                        );
                      })()}
                      <p className="text-xs text-stone-700 font-medium leading-relaxed whitespace-pre-wrap break-keep">{scene.narrationKOR}</p>
                      <p className="text-[11px] text-stone-400 italic leading-relaxed whitespace-pre-wrap break-keep">{scene.narrationENG}</p>
                    </div>
                  </td>
                  <td className="px-6 py-6 align-top">
                    <div className="space-y-3">
                      <div className="bg-amber-50 p-2 rounded border border-amber-100">
                        <p className="text-xs font-bold text-amber-800">KOR: {scene.sfxKOR}</p>
                        <p className="text-[10px] text-amber-600 italic">ENG: {scene.sfxENG}</p>
                      </div>
                      <button 
                        onClick={() => openPixabay(scene.sfxENG)}
                        className="w-full py-1.5 bg-white border border-stone-200 rounded text-[10px] font-bold text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        Pixabay 검색
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center pt-8 border-t border-stone-200">
          <button 
            onClick={onBack}
            className="px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition-colors"
          >
            이전 단계
          </button>
          <div className="flex gap-4">
            <button 
              onClick={onNext}
              className="px-8 py-3 rounded-xl font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
            >
              다음 단계 (멀티미디어 생성)
            </button>
          </div>
        </div>
      </div>

      {/* Right-side Output Panel */}
      <aside className="lg:w-80 space-y-6">
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
            <h3 className="font-bold text-stone-800">프롬프트 출력 도구</h3>
          </div>

          <button 
            onClick={handleDownloadXLSX}
            className="w-full mb-8 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
            전체 프롬프트 XLSX 다운로드
          </button>

          <div className="space-y-10">
            {/* Section 1: Image Prompts */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1 flex justify-between items-center">
                1. 이미지 생성 프롬프트
                <span className="text-[9px] text-stone-300">Grok Automation</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleCopy('image', 'kor')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'image-kor' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  한글 복사
                </button>
                <button 
                  onClick={() => handleDownload('image', 'kor')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  KOR .txt
                </button>
                <button 
                  onClick={() => handleCopy('image', 'eng')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'image-eng' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  영어 복사
                </button>
                <button 
                  onClick={() => handleDownload('image', 'eng')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  ENG .txt
                </button>
              </div>
            </div>

            {/* Section 2: Narration Prompts */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1 flex justify-between items-center">
                2. 1인독백 & 2인대화 대사
                <span className="text-[9px] text-stone-300">TTS Output</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleCopy('narration', 'kor')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'narration-kor' ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  한글 복사
                </button>
                <button 
                  onClick={() => handleDownload('narration', 'kor')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  KOR .txt
                </button>
                <button 
                  onClick={() => handleCopy('narration', 'eng')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'narration-eng' ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  영어 복사
                </button>
                <button 
                  onClick={() => handleDownload('narration', 'eng')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  ENG .txt
                </button>
              </div>
            </div>

            {/* Section 3: SFX Prompts */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1 flex justify-between items-center">
                3. 환경 효과음 프롬프트
                <span className="text-[9px] text-stone-300">SFX Generator</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleCopy('sfx', 'kor')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'sfx-kor' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  한글 복사
                </button>
                <button 
                  onClick={() => handleDownload('sfx', 'kor')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  KOR .txt
                </button>
                <button 
                  onClick={() => handleCopy('sfx', 'eng')}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${copyStatus === 'sfx-eng' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                >
                  영어 복사
                </button>
                <button 
                  onClick={() => handleDownload('sfx', 'eng')}
                  className="py-2 rounded-lg border border-stone-200 bg-white text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-1"
                >
                  ENG .txt
                </button>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-stone-300 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[10px] leading-relaxed text-stone-400">
                  <strong>EXPORT GUIDE:</strong> 모든 텍스트 파일은 컷 간의 명확한 구분을 위해 1행 공백이 포함된 서식으로 추출됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StageStoryboard;
