export interface User { id: number; username: string; }
export interface Skill { id: number; title: string; }
export interface Experience { 
  id: number; 
  title: string; 
  description: string; 
  location?: string; 
  position?: string; 
  duration?: string;
  DemonstratedSkills?: any[]; // Legacy/Frontend only
  SkillDemonstrations?: any[]; // Matches Backend Alias
}
export interface JobTag { id: number; title: string; }

export interface MatchPayload {
  experienceId: number | string;
  matchExplanation: string;
}

export interface RequirementPayload {
  description: string;
  skillIds: string[]; // IDs
  matches: MatchPayload[];
}

export interface JobPayload {
  id?: number;
  title: string;
  company: string;
  description: string;
  jobTagIds: string[];
  requirements: RequirementPayload[];
}