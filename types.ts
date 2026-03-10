
export enum WorkflowStage {
  INSPIRATION = 'INSPIRATION',
  STORYBOARD = 'STORYBOARD',
  MULTIMEDIA = 'MULTIMEDIA',
  FINALIZATION = 'FINALIZATION'
}

export interface TravelTheme {
  id: string;
  title: string;
  category: string;
  description: string;
}

export interface LocationContext {
  country: string;
  landmark: string;
}

export interface Scene {
  number: number;
  stage: string;
  imagePromptsKOR: string[];
  imagePromptsENG: string[];
  backgroundKOR: string;
  backgroundENG: string;
  narrationKOR: string;
  narrationENG: string;
  sfxKOR: string;
  sfxENG: string;
  placeName?: string;
  videoPromptKOR: string;
  videoPromptENG: string;
}

export interface StoryboardHistory {
  id: string;
  themeTitle: string;
  category: string;
  format: string;
  country: string;
  landmark: string;
  season: string;
  timeOfDay: string;
  vibes: string[];
  estimatedDuration: number;
  createdAt: string;
}

export interface Character {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  description: string;
  imagePrompt?: string;
  imageUrl: string;
  createdAt: string;
}

export interface AppState {
  currentStage: WorkflowStage;
  selectedTheme: TravelTheme | null;
  themes: TravelTheme[];
  scenes: Scene[];
  isGenerating: boolean;
}
