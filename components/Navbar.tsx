
import React, { useState, useEffect } from 'react';
import { WorkflowStage } from '../types';
import CharacterManager from './CharacterManager';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface NavbarProps {
  currentStage: WorkflowStage;
  onLogoClick: () => void;
  onStageClick: (stage: WorkflowStage) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentStage, onLogoClick, onStageClick }) => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
  const [selectedCharacterCount, setSelectedCharacterCount] = useState(0);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };
  const stages = [
    { id: WorkflowStage.INSPIRATION, label: '영감 발견' },
    { id: WorkflowStage.STORYBOARD, label: '스토리보드' },
    { id: WorkflowStage.MULTIMEDIA, label: '멀티미디어' },
    { id: WorkflowStage.FINALIZATION, label: '최종 완성' }
  ];

  return (
    <nav className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={onLogoClick}
        >
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:rotate-12 transition-transform">
            M
          </div>
          <span className="ghibli-title text-xl font-bold text-stone-800 tracking-tight">MetaNomad</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-8">
            {stages.map((s, idx) => (
              <div key={s.id} className="flex items-center">
                <button 
                  onClick={() => onStageClick(s.id)}
                  className={`text-sm font-medium hover:text-amber-600 transition-colors ${currentStage === s.id ? 'text-amber-600' : 'text-stone-400'}`}
                >
                  {idx + 1}. {s.label}
                </button>
                {idx < stages.length - 1 && (
                  <div className="w-4 h-px bg-stone-200 mx-4"></div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCharacterManagerOpen(true)}
              className="relative px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all bg-stone-100 text-stone-600 hover:bg-stone-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              캐릭터 관리
              {selectedCharacterCount > 0 && (
                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                  ON
                </span>
              )}
            </button>
            <button
              onClick={handleOpenKey}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                hasKey 
                  ? 'bg-stone-100 text-stone-600 hover:bg-stone-200' 
                  : 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              {hasKey ? 'API 키 연결됨' : 'API 키 연결 필요'}
            </button>
          </div>
        </div>
      </div>
      
      <CharacterManager 
        isOpen={isCharacterManagerOpen} 
        onClose={() => setIsCharacterManagerOpen(false)} 
        onSelectionChange={setSelectedCharacterCount}
      />
    </nav>
  );
};

export default Navbar;
