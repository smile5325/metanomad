
import React, { useState, useRef, useEffect } from 'react';
import { Scene, TravelTheme } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";
import JSZip from 'jszip';

interface Props {
  theme: TravelTheme | null;
  scenes: Scene[];
  onNext: () => void;
  onBack: () => void;
}

const VOICE_PRESETS = {
  male: [
    { id: 'charon', label: '신뢰감있는', icon: '👔' },
    { id: 'fenrir', label: '지적인', icon: '🧠' },
    { id: 'iapetus', label: '따뜻한', icon: '☀️' },
    { id: 'orus', label: '차분한', icon: '☕' },
    { id: 'puck', label: '친근한', icon: '😊' },
    { id: 'umbriel', label: '진지한', icon: '🧐' },
    { id: 'achird', label: '중후한', icon: '🎙️' },
    { id: 'gacrux', label: '명확한', icon: '🗣️' },
    { id: 'schedar', label: '활기찬', icon: '⚡' },
    { id: 'sulafat', label: '부드러운', icon: '☁️' },
    { id: 'vindemiatrix', label: '단호한', icon: '⚖️' }
  ],
  female: [
    { id: 'aoede', label: '우아한', icon: '💃' },
    { id: 'callirrhoe', label: '전문적인', icon: '📋' },
    { id: 'despina', label: '공감하는', icon: '❤️' },
    { id: 'leda', label: '경쾌한', icon: '🎵' },
    { id: 'kore', label: '차분한', icon: '🍵' },
    { id: 'pulcherrima', label: '신뢰감있는', icon: '🤝' },
    { id: 'erinome', label: '다정한', icon: '🌸' },
    { id: 'zubenelgenubi', label: '명확한', icon: '📢' },
    { id: 'enceladus', label: '감성적인', icon: '🎭' },
    { id: 'zephyr', label: '활기찬', icon: '✨' },
    { id: 'laomedeia', label: '부드러운', icon: '☁️' },
    { id: 'rasalgethi', label: '지적인', icon: '🧠' }
  ]
};

const StageMultimedia: React.FC<Props> = ({ theme, scenes, onNext, onBack }) => {
  const [activeTab, setActiveTab] = useState<'tts' | 'sfx'>('tts');
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({});
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  const [speaker1, setSpeaker1] = useState({ gender: 'female', voiceId: 'aoede', label: '우아한' });
  const [speaker2, setSpeaker2] = useState({ gender: 'male', voiceId: 'charon', label: '신뢰감있는' });

  const [editingSpeaker, setEditingSpeaker] = useState<1 | 2>(1);
  
  const cancelBatchRequest = useRef(false);

  useEffect(() => {
    const syncSpeakers = () => {
      try {
        const storedChars = sessionStorage.getItem('character_list') || sessionStorage.getItem('characters');
        const storedSelectedIds = sessionStorage.getItem('selectedCharacterIds');
        
        if (storedChars && storedSelectedIds) {
          const allChars = JSON.parse(storedChars);
          const selectedIds = JSON.parse(storedSelectedIds);
          const validAllChars = Array.isArray(allChars) ? allChars : [];
          const validSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
          const selectedCharacters = validAllChars.filter((c: any) => validSelectedIds.includes(c.id));
          
          if (selectedCharacters.length > 0) {
            const char1 = selectedCharacters[0];
            const gender1 = char1.gender.toLowerCase() as 'male' | 'female';
            const preset1 = VOICE_PRESETS[gender1][0];
            
            setSpeaker1({ gender: gender1, voiceId: preset1.id, label: preset1.label });
            
            const mode = sessionStorage.getItem('characterSelectionMode');
            if (mode === 'Multi' || selectedCharacters.length > 1) {
              const gender2 = gender1 === 'male' ? 'female' : 'male';
              const preset2 = VOICE_PRESETS[gender2][0];
              setSpeaker2({ gender: gender2, voiceId: preset2.id, label: preset2.label });
            }
          }
        }
      } catch (e) {
        console.error("Failed to sync speakers from character selection", e);
      }
    };

    syncSpeakers();
    window.addEventListener('characterSelectionChanged', syncSpeakers);
    return () => window.removeEventListener('characterSelectionChanged', syncSpeakers);
  }, []);

  // Note: Gemini TTS returns raw PCM. 
  // We'll package it with a WAV header for compatibility but name it .mp3 as requested.
  const createWavHeader = (dataLength: number, sampleRate: number = 24000) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    return buffer;
  };

  const generateAudioBlob = async (text: string, sceneNum: number): Promise<Blob | null> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      const lines = text.split('\n');
      const speakers = new Set<string>();
      lines.forEach(line => {
        const match = line.match(/^([^:]+):/);
        if (match) speakers.add(match[1].trim());
      });

      const getVoiceIdForSpeaker = (name: string) => {
        try {
          const chars = JSON.parse(
            sessionStorage.getItem('character_list') || '[]'
          )
          const selectedIds = JSON.parse(
            sessionStorage.getItem('selectedCharacterIds') || '[]'
          )
          const selected = chars.filter(
            (c: any) => selectedIds.includes(c.id)
          )
          const match = selected.find(
            (c: any) => name.toUpperCase()
              .startsWith(c.name.toUpperCase())
          )
          if (match) {
            return match.gender.toLowerCase() === 'female'
              ? 'aoede' : 'charon'
          }
        } catch(e) {}
        return speaker1.voiceId
      }

      let speechConfig: any = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: speaker1.voiceId },
        },
      };

      if (speakers.size === 1) {
        const speakerName = Array.from(speakers)[0];
        speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName = getVoiceIdForSpeaker(speakerName);
      } else if (speakers.size === 2) {
        const speakerList = Array.from(speakers);
        speechConfig = {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speakerList[0],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: getVoiceIdForSpeaker(speakerList[0]) } }
              },
              {
                speaker: speakerList[1],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: getVoiceIdForSpeaker(speakerList[1]) } }
              }
            ]
          }
        };
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig,
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Audio data not found");

      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const wavHeader = createWavHeader(len, 24000);
      return new Blob([wavHeader, bytes], { type: 'audio/mpeg' });
    } catch (error) {
      console.error("TTS Generation failed:", error);
      return null;
    }
  };

  const generateAudio = async (text: string, filename: string, sceneNum: number) => {
    try {
      setLoadingItems(prev => ({ ...prev, [sceneNum]: true }));
      const audioBlob = await generateAudioBlob(text, sceneNum);
      if (!audioBlob) {
        alert(`${sceneNum}번 장면 음성 생성 중 오류가 발생했습니다.`);
        return;
      }
      const url = URL.createObjectURL(audioBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoadingItems(prev => ({ ...prev, [sceneNum]: false }));
    }
  };

  const openPixabay = (query: string) => {
    const encoded = encodeURIComponent(query);
    window.open(`https://pixabay.com/sound-effects/search/${encoded}/`, '_blank');
  };

  const handleDownloadAudio = async (type: 'narration' | 'sfx', sceneNum: number) => {
    const scene = scenes.find(s => s.number === sceneNum);
    if (!scene) return;

    if (type === 'narration') {
      await generateAudio(scene.narrationKOR, `Scene_${sceneNum}_Narration`, sceneNum);
    } else {
      openPixabay(scene.sfxENG);
    }
  };

  const handleDownloadSFXCSV = () => {
    if (!scenes || scenes.length === 0) return;

    const headers = ["Number", "Place Name", "SFX (KOR)", "SFX (ENG)"];
    const rows = scenes.map(s => [
      s.number,
      s.placeName || "",
      s.sfxKOR || "",
      s.sfxENG || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const element = document.createElement("a");
    const file = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    const timestamp = new Date().toISOString().slice(0, 10);
    element.download = `sfx_guide_${timestamp}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleBatchDownloadZip = async () => {
    if (scenes.length === 0) {
      alert("생성된 장면 데이터가 없습니다.");
      return;
    }

    setIsBatchLoading(true);
    setBatchProgress({ current: 0, total: scenes.length });
    cancelBatchRequest.current = false;
    
    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;

    const retryGenerateAudio = async (
      narration: string, 
      sceneNum: number, 
      maxRetries = 3
    ) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const blob = await generateAudioBlob(
            narration, sceneNum
          )
          if (blob) return blob
        } catch(e: any) {
          if (e?.status === 429 && i < maxRetries - 1) {
            await new Promise(r => 
              setTimeout(r, 5000)
            )
          } else throw e
        }
      }
      return null
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (cancelBatchRequest.current) {
        console.log("Batch download cancelled by user.");
        break;
      }
      
      setBatchProgress({ current: i + 1, total: scenes.length });
      console.log(`씬 ${scene.number} 처리 중...`);
      setLoadingItems(prev => ({ ...prev, [scene.number]: true }));
      
      try {
        const audioBlob = await retryGenerateAudio(scene.narrationKOR, scene.number);
        
        if (audioBlob) {
          zip.file(`Scene_${scene.number}_Narration.mp3`, audioBlob);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Scene ${scene.number} TTS Generation failed:`, error);
        failCount++;
      } finally {
        setLoadingItems(prev => ({ ...prev, [scene.number]: false }));
        console.log(`씬 ${scene.number} 완료`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    if (Object.keys(zip.files).length > 0) {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      
      const rawTitle = theme?.title || '';
      const cleanTitle = rawTitle
        .replace(/[^a-zA-Z0-9가-힣]/g, '')
        .slice(0, 20);
      
      const zipFileName = cleanTitle ? `${cleanTitle}_tts.zip` : 'MetaNomad_tts.zip';
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    setIsBatchLoading(false);
    if (!cancelBatchRequest.current) {
      alert(`${scenes.length}개 중 ${successCount}개 성공, ${failCount}개 실패`);
    } else {
      alert("일괄 추출 작업이 중단되었습니다.");
    }
  };

  const handleCancelBatch = () => {
    cancelBatchRequest.current = true;
  };

  const handleVoiceSelect = (voiceId: string, label: string, gender: string) => {
    if (editingSpeaker === 1) {
      setSpeaker1(prev => ({ ...prev, voiceId, label, gender }));
    } else {
      setSpeaker2(prev => ({ ...prev, voiceId, label, gender }));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
      {/* Main Content Area */}
      <div className="flex-1 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <button 
              onClick={onBack}
              className="text-stone-500 hover:text-stone-800 flex items-center gap-1 mb-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              이전단계
            </button>
            <h2 className="text-3xl font-bold text-stone-800 ghibli-title">멀티미디어 변환 및 준비</h2>
            <p className="text-stone-600">1인독백 & 2인대화 AI 음성 생성 및 효과음 에셋을 구성합니다.</p>
          </div>
          <button 
            onClick={() => { if (!isBatchLoading) onNext(); }}
            className={`px-8 py-3 rounded-xl font-bold shadow-xl transition-all flex items-center gap-2 ${isBatchLoading ? 'bg-stone-400 text-stone-200 cursor-not-allowed shadow-none' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
          >
            다음단계
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7-7 7" /></svg>
          </button>
        </header>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-stone-200">
            <button 
              onClick={() => setActiveTab('tts')}
              className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-colors ${activeTab === 'tts' ? 'text-amber-600 bg-amber-50/50 border-b-2 border-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
            >
              TTS / 독백 & 대화 변환 (MP3)
            </button>
            <button 
              onClick={() => setActiveTab('sfx')}
              className={`flex-1 py-4 text-sm font-bold tracking-wider uppercase transition-colors ${activeTab === 'sfx' ? 'text-amber-600 bg-amber-50/50 border-b-2 border-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
            >
              SFX / Pixabay 효과음
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'tts' ? (
              <div className="space-y-6">
                {/* Voice Selection UI */}
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setEditingSpeaker(1)}
                      className={`flex-1 p-3 rounded-xl border text-left transition-all bg-white shadow-md ${editingSpeaker === 1 ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-300 hover:border-amber-400'}`}
                    >
                      <div className="text-xs font-bold text-stone-400 mb-1">화자 1 (Speaker 1)</div>
                      <div className="font-bold text-stone-800">{speaker1.label}</div>
                      <div className="text-[10px] text-stone-500 mt-1 uppercase">{speaker1.gender}</div>
                    </button>
                    <button 
                      onClick={() => setEditingSpeaker(2)}
                      className={`flex-1 p-3 rounded-xl border text-left transition-all bg-white shadow-md ${editingSpeaker === 2 ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-300 hover:border-amber-400'}`}
                    >
                      <div className="text-xs font-bold text-stone-400 mb-1">화자 2 (Speaker 2)</div>
                      <div className="font-bold text-stone-800">{speaker2.label}</div>
                      <div className="text-[10px] text-stone-500 mt-1 uppercase">{speaker2.gender}</div>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-64 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest sticky top-0 bg-stone-50 py-1">Male Voices</label>
                      <div className="flex flex-wrap gap-2">
                        {VOICE_PRESETS.male.map(p => {
                          const isSelected = editingSpeaker === 1 
                            ? speaker1.gender === 'male' && speaker1.label === p.label
                            : speaker2.gender === 'male' && speaker2.label === p.label;
                          return (
                            <button
                              key={p.label}
                              onClick={() => handleVoiceSelect(p.id, p.label, 'male')}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isSelected ? 'bg-stone-800 border-stone-800 text-white shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-amber-400'}`}
                            >
                              {p.icon} {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest sticky top-0 bg-stone-50 py-1">Female Voices</label>
                      <div className="flex flex-wrap gap-2">
                        {VOICE_PRESETS.female.map(p => {
                          const isSelected = editingSpeaker === 1 
                            ? speaker1.gender === 'female' && speaker1.label === p.label
                            : speaker2.gender === 'female' && speaker2.label === p.label;
                          return (
                            <button
                              key={p.label}
                              onClick={() => handleVoiceSelect(p.id, p.label, 'female')}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isSelected ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-amber-400'}`}
                            >
                              {p.icon} {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {scenes.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-stone-400 italic">스토리보드에서 장면을 먼저 생성해주세요.</div>
                  ) : scenes.map((s) => (
                    <div key={s.number} className="p-4 border border-stone-100 rounded-xl flex items-center justify-between hover:border-amber-200 transition-colors bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-stone-300 font-bold">{s.number}</span>
                        <div className="max-w-[220px]">
                          <p className="text-[11px] font-bold text-stone-800 line-clamp-2 whitespace-pre-line">{s.narrationKOR}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          disabled={loadingItems[s.number]}
                          onClick={() => handleDownloadAudio('narration', s.number)}
                          className={`p-2 rounded-full transition-all ${loadingItems[s.number] ? 'text-stone-300 cursor-not-allowed' : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'}`}
                          title="MP3 생성 및 다운로드"
                        >
                          {loadingItems[s.number] ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 flex flex-col items-center gap-4">
                  <button 
                    disabled={isBatchLoading || scenes.length === 0}
                    onClick={handleBatchDownloadZip}
                    className={`px-10 py-4 text-white rounded-2xl font-black shadow-lg transition-all flex items-center gap-3 ${isBatchLoading || scenes.length === 0 ? 'bg-stone-400 cursor-not-allowed shadow-none' : 'bg-amber-600 shadow-amber-200 hover:bg-amber-700 hover:-translate-y-1'}`}
                  >
                    {isBatchLoading && <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {isBatchLoading ? `생성 중... (${batchProgress.current}/${batchProgress.total})` : '전체 나레이션 MP3 일괄 추출 (ZIP 다운로드)'}
                  </button>
                  
                  {isBatchLoading && (
                    <button 
                      onClick={handleCancelBatch}
                      className="text-stone-500 hover:text-rose-600 text-sm font-bold transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      일괄 추출 중단하기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-800">장면별 환경 효과음 (Pixabay 연동)</h4>
                      <p className="text-xs text-emerald-600">각 장면의 키워드로 최적의 음향 에셋을 검색합니다.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {scenes.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-stone-400 italic">스토리보드에서 장면을 먼저 생성해주세요.</div>
                  ) : scenes.map((s) => (
                    <div key={s.number} className="group p-4 bg-stone-50 rounded-xl border border-stone-100 text-center space-y-3 hover:border-emerald-300 transition-colors">
                      <span className="text-[10px] font-black text-stone-300">SCENE {s.number}</span>
                      <div className="h-10 overflow-hidden text-center">
                        <p className="text-[10px] font-bold text-stone-700 leading-tight">{s.sfxKOR}</p>
                        <p className="text-[9px] text-stone-400 italic leading-tight">{s.sfxENG}</p>
                      </div>
                      <div className="flex gap-1 justify-center">
                        <button 
                          onClick={() => openPixabay(s.sfxENG)}
                          className="px-2 py-1 bg-stone-800 text-white rounded text-[9px] font-bold hover:bg-black transition-colors"
                        >
                          Pixabay 검색
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 flex justify-center">
                  <button 
                    onClick={handleDownloadSFXCSV}
                    className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all"
                  >
                    효과음 MP3 번들 가이드 다운로드
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Control Panel */}
      <aside className="lg:w-80 space-y-6">
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm sticky top-24 space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 bg-rose-600 rounded-full"></div>
            <h3 className="font-bold text-stone-800">워크플로우 관리</h3>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              작업 중 랙이 걸리거나 생성이 너무 오래 걸릴 경우 아래 버튼으로 현재 진행 중인 모든 AI 작업을 안전하게 중단할 수 있습니다.
            </p>
            
            <button 
              onClick={handleCancelBatch}
              disabled={!isBatchLoading}
              className={`w-full py-4 rounded-2xl font-black text-sm transition-all border-2 ${isBatchLoading ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-md animate-pulse' : 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed'}`}
            >
              일괄 추출 중단 (취소)
            </button>
            
            <div className="pt-4 border-t border-stone-100 space-y-3">
               <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">System Status</h4>
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isBatchLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className="text-[10px] font-bold text-stone-600 uppercase">{isBatchLoading ? 'Processing Batch' : 'System Ready'}</span>
               </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StageMultimedia; 


