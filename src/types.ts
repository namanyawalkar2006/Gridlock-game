export interface ScoreEntry {
  id: string;
  username: string;
  timeMs: number;
  timestamp: number;
  dateStr: string;
  difficulty: Difficulty;
  level: number;
}

export type GameState = 'START' | 'PLAYING' | 'PROCESSING' | 'GAME_OVER' | 'LEADERBOARD';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface VerifyResponse {
  correctCount: number;
  isComplete: boolean;
  expectedLength: number;
}
