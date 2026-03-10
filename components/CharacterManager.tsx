import React, { useState, useEffect, useRef } from 'react';
import { Character } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectionChange?: (count: number) => void;
}

const CharacterManager: React.FC<Props> = ({ isOpen, onClose, onSelectionChange }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filter, setFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [selectionMode, setSelectionMode] = useState<'Single' | 'Multi'>('Single');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdding, setIsAdding] = useState(false);

  const saveCharacters = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
    localStorage.setItem('character_list', JSON.stringify(newCharacters));
    window.dispatchEvent(new Event('characterSelectionChanged'));
  };

  useEffect(() => {
    const stored = localStorage.getItem('character_list') || localStorage.getItem('characters');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCharacters(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse characters from localStorage", e);
      }
    }

    const storedSelected = localStorage.getItem('selectedCharacterIds');
    if (storedSelected) {
      try {
        const parsed = JSON.parse(storedSelected);
        const validIds = Array.isArray(parsed) ? parsed : [];
        setSelectedIds(validIds);
        if (onSelectionChange) onSelectionChange(validIds.length);
      } catch (e) {
        console.error("Failed to parse selectedCharacterIds", e);
      }
    }
    
    const storedMode = localStorage.getItem('characterSelectionMode');
    if (storedMode === 'Single' || storedMode === 'Multi') {
      setSelectionMode(storedMode);
    }
  }, []);

  const saveSelectedIds = (ids: string[]) => {
    setSelectedIds(ids);
    localStorage.setItem('selectedCharacterIds', JSON.stringify(ids));
    
    const newMode = ids.length >= 2 ? 'Multi' : 'Single';
    setSelectionMode(newMode);
    localStorage.setItem('characterSelectionMode', newMode);
    
    if (onSelectionChange) onSelectionChange(ids.length);
    window.dispatchEvent(new Event('characterSelectionChanged'));
  };

  const handleSelectionModeChange = (mode: 'Single' | 'Multi') => {
    setSelectionMode(mode);
    localStorage.setItem('characterSelectionMode', mode);
    if (mode === 'Single' && selectedIds.length > 1) {
      saveSelectedIds([selectedIds[0]]);
    } else {
      window.dispatchEvent(new Event('characterSelectionChanged'));
    }
  };

  const toggleSelection = (id: string) => {
    if (selectionMode === 'Single') {
      if (selectedIds.includes(id)) {
        saveSelectedIds([]);
      } else {
        saveSelectedIds([id]);
      }
    } else {
      if (selectedIds.includes(id)) {
        saveSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
      } else {
        saveSelectedIds([...selectedIds, id]);
      }
    }
  };



  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const reader = new FileReader();
      reader.onloadend = () => {
        img.onload = () => {
          const max = 200;
          let w = img.width, h = img.height;
          if (w > h && w > max) { h = (h * max) / w; w = max; }
          else if (h > max) { w = (w * max) / h; h = max; }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setImageUrl(compressed);
    }
  };

  const handleAddCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !imageUrl) {
      alert('모든 필드를 입력하고 이미지를 업로드해주세요.');
      return;
    }

    const newCharacter: Character = {
      id: Date.now().toString(),
      name,
      gender,
      description,
      imageUrl,
      createdAt: new Date().toISOString(),
    };

    saveCharacters([newCharacter, ...characters]);
    
    // Reset form
    setName('');
    setGender('Male');
    setDescription('');
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string) => {
    saveCharacters(characters.filter(c => c.id !== id));
    if (selectedIds.includes(id)) {
      saveSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const filteredCharacters = characters.filter(c => filter === 'All' || c.gender === filter);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slideInRight">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
          <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            캐릭터 관리 (페르소나)
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-8">
          {/* Add Character Form Toggle */}
          {!isAdding ? (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full py-3 border-2 border-dashed border-stone-300 text-stone-600 rounded-xl font-bold hover:bg-stone-50 hover:border-stone-400 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              새 캐릭터 등록
            </button>
          ) : (
            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 relative">
              <button 
                onClick={() => setIsAdding(false)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h4 className="text-lg font-bold text-stone-800 mb-4">새 캐릭터 등록</h4>
              <form onSubmit={(e) => { handleAddCharacter(e); setIsAdding(false); }} className="space-y-4">
                
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-bold text-stone-600 mb-1">캐릭터 이미지</label>
                  <div 
                    className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center cursor-pointer hover:bg-stone-100 transition-colors relative overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                    ) : (
                      <div className="py-6">
                        <svg className="w-8 h-8 text-stone-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p className="text-sm text-stone-500 font-medium">클릭하여 이미지 업로드</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-stone-600 mb-1">이름</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 지훈"
                    className="w-full p-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-sm"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-bold text-stone-600 mb-1">성별</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('Male')}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${gender === 'Male' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                    >
                      남성 (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('Female')}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${gender === 'Female' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-white border border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                    >
                      여성 (Female)
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-stone-600 mb-1">외형 묘사 (프롬프트용)</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="예: 30대 한국 남성, 짧은 머리, 등산복 착용"
                    rows={3}
                    className="w-full p-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all resize-none text-sm"
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md"
                >
                  등록 완료
                </button>
              </form>
            </div>
          )}

          {/* Character List */}
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-stone-800">등록된 캐릭터</h4>
                <div className="flex bg-stone-100 p-1 rounded-lg">
                  <button
                    onClick={() => handleSelectionModeChange('Single')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${selectionMode === 'Single' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    1인
                  </button>
                  <button
                    onClick={() => handleSelectionModeChange('Multi')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${selectionMode === 'Multi' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    다중
                  </button>
                </div>
              </div>
              <div className="flex gap-2 bg-stone-100 p-1 rounded-lg self-start">
                {['All', 'Male', 'Female'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === f ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    {f === 'All' ? '전체' : f === 'Male' ? '남성' : '여성'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {filteredCharacters.length === 0 ? (
                <div className="col-span-full py-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-stone-100 text-sm">
                  등록된 캐릭터가 없습니다.
                </div>
              ) : (
                filteredCharacters.map(char => {
                  const isSelected = selectedIds.includes(char.id);
                  return (
                  <div 
                    key={char.id} 
                    onClick={() => toggleSelection(char.id)}
                    className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm relative group cursor-pointer transition-all flex flex-col ${isSelected ? 'border-amber-500 bg-amber-50/30' : 'border-stone-200 hover:border-amber-300'}`}
                  >
                    <div className="absolute top-2 left-2 z-10">
                      {selectionMode === 'Single' ? (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-300 bg-white'}`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-300 bg-white'}`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-200 z-10 shadow-sm"
                      title="삭제"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <div className="aspect-square w-full relative">
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-white truncate text-sm">{char.name}</h5>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${char.gender === 'Male' ? 'bg-blue-500/80 text-white' : 'bg-rose-500/80 text-white'}`}>
                            {char.gender === 'Male' ? '남' : '여'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 flex-1 flex flex-col justify-between gap-2">
                      <p className="text-[11px] text-stone-500 line-clamp-2 leading-tight" title={char.description}>{char.description}</p>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelection(char.id); }}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                          isSelected 
                            ? 'bg-amber-500 text-white shadow-sm' 
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            선택됨
                          </>
                        ) : (
                          '사용하기'
                        )}
                      </button>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterManager;
