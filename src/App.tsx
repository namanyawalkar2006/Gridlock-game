import { useState, useEffect, useRef } from 'react';
import { GameState, VerifyResponse, ScoreEntry, Difficulty } from './types';
import { Loader2, Share2, Trophy, ArrowRight, XCircle, Settings, Database } from 'lucide-react';
import { motion } from 'motion/react';
import AdminDashboard from './AdminDashboard';
import { audio } from './audio';

const API_BASE = '/api/game';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [dateStr, setDateStr] = useState<string>('');
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Settings State
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [level, setLevel] = useState<number>(1);
  
  // Game Play State
  const [sequence, setSequence] = useState<number[]>([]);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [finalTimeMs, setFinalTimeMs] = useState<number>(0);
  const [expectedLength, setExpectedLength] = useState<number>(6);
  
  // Leaderboard / Submission State
  const [username, setUsername] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [pendingScore, setPendingScore] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fetch today's date string from server
    fetch(`${API_BASE}/start`, { method: 'POST' })
      .then(res => res.json())
      .then(data => setDateStr(data.dateStr))
      .catch(console.error);

    const saved = localStorage.getItem('gridlock_pending_score');
    if (saved) {
      setPendingScore(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, startTime]);

  const startGame = (targetLevel?: number) => {
    audio.init();
    const currentLevel = targetLevel || level;
    setSequence([]);
    setErrorIndex(null);
    setMistakes(new Set());
    setStartTime(Date.now());
    setElapsedMs(0);
    setExpectedLength(Math.min(16, (difficulty === 'EASY' ? 4 : difficulty === 'MEDIUM' ? 6 : 8) + (currentLevel - 1)));
    setGameState('PLAYING');
  };

  const handleBlockClick = async (index: number) => {
    if (gameState !== 'PLAYING' || errorIndex !== null) return;
    if (sequence.includes(index)) return; // Already clicked in current sequence

    const newSequence = [...sequence, index];
    setSequence(newSequence);

    try {
      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateStr, sequence: newSequence, difficulty, level })
      });
      const data: VerifyResponse = await res.json();
      
      setExpectedLength(data.expectedLength);

      if (data.correctCount === newSequence.length) {
        // Correct so far!
        if (data.isComplete) {
          audio.playComplete();
          const time = Date.now() - startTime;
          setFinalTimeMs(time);
          setGameState('GAME_OVER');
        } else {
          audio.playSuccess(newSequence.length);
        }
      } else {
        // Wrong click!
        audio.playError();
        setErrorIndex(index);
        setMistakes(prev => new Set(prev).add(index));
        // Reset sequence after a short delay
        setTimeout(() => {
          setSequence([]);
          setErrorIndex(null);
        }, 500);
      }
    } catch (err) {
      console.error("Verification failed", err);
      audio.playError();
      setErrorIndex(index);
      setMistakes(prev => new Set(prev).add(index));
      // Fallback reset
      setTimeout(() => {
        setSequence([]);
        setErrorIndex(null);
      }, 500);
    }
  };

  const submitScore = async () => {
    if (!username.trim()) return;
    setGameState('PROCESSING');
    
    const payload = { username, timeMs: finalTimeMs, dateStr, difficulty, level };
    
    try {
      const res = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setRank(data.rank);
      
      await fetchLeaderboard();
      setGameState('LEADERBOARD');
    } catch (err) {
      console.error(err);
      localStorage.setItem('gridlock_pending_score', JSON.stringify(payload));
      setPendingScore(payload);
      setGameState('START');
    }
  };

  const submitPendingScore = async () => {
    if (!pendingScore) return;
    try {
      const res = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingScore)
      });
      const data = await res.json();
      localStorage.removeItem('gridlock_pending_score');
      setPendingScore(null);
      // Let's just show an alert and reload the leaderboard if dates match
      alert("Offline score submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Still offline. Please try again later.");
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/leaderboard?dateStr=${dateStr}&difficulty=${difficulty}&level=${level}`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  };

  const generateShareText = async () => {
    let grid = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const i = r * 4 + c;
        if (sequence.includes(i)) {
          grid += "🟩";
        } else if (mistakes.has(i)) {
          grid += "🟥";
        } else {
          grid += "⬛";
        }
      }
      grid += "\n";
    }
    
    const timeSec = (finalTimeMs / 1000).toFixed(2);
    const text = `GridLock Daily Showdown\nDifficulty: ${difficulty} | Level ${level}\n⏱️ ${timeSec}s\n\n${grid}\nCan you beat my time?`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GridLock Score',
          text: text,
        });
        return;
      } catch (err) {
        console.error("Error sharing", err);
      }
    }
    
    navigator.clipboard.writeText(text).then(() => {
      alert("Score copied to clipboard!");
    }).catch(() => {
      alert("Failed to copy. Here is your text:\n" + text);
    });
  };

  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + "s";
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Animated Layers */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 z-0 pointer-events-none"></div>
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>
      
      {/* Header Utilities */}
      <div className="absolute top-4 right-4 z-20">
        {!showAdmin && (
          <button 
            onClick={() => setShowAdmin(true)}
            className="p-2 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 rounded-full text-slate-400 hover:text-emerald-400 transition-colors backdrop-blur-sm"
            title="Database Dashboard"
          >
            <Database size={20} />
          </button>
        )}
      </div>

      <div className="w-full max-w-md mx-auto flex flex-col gap-6 z-10 relative">
        
        {showAdmin ? (
          <div className="flex justify-center -mx-4 sm:mx-0 min-w-[320px] sm:min-w-[600px] lg:min-w-[800px]">
             <AdminDashboard onClose={() => setShowAdmin(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center space-y-2 mt-8">
              <motion.h1 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              >
                GRIDLOCK
              </motion.h1>
              <p className="text-slate-400 text-sm tracking-widest uppercase font-medium">
                Daily Subreddit Showdown
              </p>
            </div>

            {/* Pending Score Banner */}
            {pendingScore && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-900/40 border border-amber-500/50 p-4 rounded-xl flex items-center justify-between"
              >
                <div>
                  <h3 className="text-amber-400 font-bold text-sm">Offline Score Saved</h3>
                  <p className="text-amber-200/70 text-xs mt-1">
                    You have an unsubmitted score of {formatTime(pendingScore.timeMs)}.
                  </p>
                </div>
                <button
                  onClick={submitPendingScore}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm rounded-lg transition-colors"
                >
                  Retry Submit
                </button>
              </motion.div>
            )}

            {/* --- START SCREEN --- */}
            {gameState === 'START' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/60 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 flex flex-col items-center gap-6 shadow-2xl"
              >
                <div className="space-y-4 text-center">
                  <p className="text-slate-300 font-medium">
                    Find the hidden path. <br/>
                    Click a block to build your sequence.
                  </p>

                  <div className="flex justify-center gap-2 mt-4 p-1 bg-slate-950/50 rounded-xl border border-slate-800">
                    {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                          difficulty === d 
                            ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400 mt-2">
                    <span className="w-3 h-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] rounded-sm"></span> Correct
                    <span className="w-3 h-3 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] rounded-sm ml-4"></span> Wrong
                  </div>
                </div>
                
                <button 
                  onClick={() => { setLevel(1); startGame(1); }}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] active:scale-95 flex items-center justify-center gap-2"
                >
                  START HACKING <ArrowRight size={18} />
                </button>

                {/* How to play visual */}
                <div className="w-full mt-2 pt-6 border-t border-slate-800/50 space-y-4">
                  <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider text-center">How to Play</h3>
                  <div className="grid grid-cols-4 gap-2 p-3 bg-slate-950/80 rounded-2xl w-3/4 mx-auto aspect-square shadow-inner border border-slate-800">
                    {Array.from({ length: 16 }).map((_, i) => {
                      const isCorrectTarget = [5, 9, 10].includes(i);
                      const isWrongTarget = i === 6;

                      return (
                        <motion.div
                          key={i}
                          className="rounded-lg bg-slate-800 border-b-2 border-slate-700"
                          animate={
                            isCorrectTarget
                              ? {
                                  backgroundColor: ["#1e293b", "#10b981", "#10b981", "#1e293b"],
                                  borderColor: ["#334155", "#34d399", "#34d399", "#334155"],
                                  y: [0, 2, 2, 0],
                                  borderBottomWidth: ["2px", "0px", "0px", "2px"],
                                  boxShadow: ["0 0 0px rgba(16,185,129,0)", "0 0 15px rgba(16,185,129,0.5)", "0 0 15px rgba(16,185,129,0.5)", "0 0 0px rgba(16,185,129,0)"]
                                }
                              : isWrongTarget 
                              ? {
                                  backgroundColor: ["#1e293b", "#ef4444", "#ef4444", "#1e293b"],
                                  borderColor: ["#334155", "#f87171", "#f87171", "#334155"],
                                  y: [0, 2, 2, 0],
                                  borderBottomWidth: ["2px", "0px", "0px", "2px"],
                                  boxShadow: ["0 0 0px rgba(239,68,68,0)", "0 0 15px rgba(239,68,68,0.5)", "0 0 15px rgba(239,68,68,0.5)", "0 0 0px rgba(239,68,68,0)"]
                                }
                              : {}
                          }
                          transition={
                            (isCorrectTarget || isWrongTarget)
                              ? {
                                  duration: 2.5,
                                  repeat: Infinity,
                                  repeatDelay: 0.5,
                                  times: [0, 0.1, 0.4, 0.5],
                                  delay: i === 5 ? 0 : i === 9 ? 0.5 : i === 10 ? 1.0 : i === 6 ? 1.5 : 0
                                }
                              : {}
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- PLAYING SCREEN --- */}
            {gameState === 'PLAYING' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="flex justify-between w-full px-4 items-end">
                  <div className="text-slate-300 font-mono text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    {formatTime(elapsedMs)}
                  </div>
                  <div className="text-emerald-400 font-mono text-sm tracking-widest flex flex-col items-end">
                    <span className="font-bold">LVL: {level}</span>
                    <span>SEQ: {sequence.length}/{expectedLength}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 p-4 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700/50 shadow-2xl w-full aspect-square">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const isCorrect = sequence.includes(i);
                    const isError = errorIndex === i;
                    
                    let btnClass = "bg-slate-800 hover:bg-slate-700 border-slate-700";
                    if (isCorrect) btnClass = "bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)]";
                    if (isError) btnClass = "bg-red-500 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]";

                    return (
                      <button
                        key={i}
                        onClick={() => handleBlockClick(i)}
                        className={`rounded-2xl border-b-4 transition-all duration-100 active:border-b-0 active:translate-y-1 ${btnClass}`}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* --- GAME OVER SCREEN --- */}
            {(gameState === 'GAME_OVER' || gameState === 'PROCESSING') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900/80 backdrop-blur-lg p-8 rounded-3xl border border-emerald-500/30 flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400"></div>
                <div className="text-emerald-400 mb-2 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                  <Trophy size={56} className="mx-auto" />
                </div>
                
                <div className="text-center">
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-1">SYSTEM BREACHED</h2>
                  <p className="text-slate-300 font-medium">Level {level} Time: <span className="text-emerald-400 font-mono text-xl">{formatTime(finalTimeMs)}</span></p>
                </div>

                <div className="w-full space-y-4 mt-4 relative z-10">
                  <input
                    type="text"
                    placeholder="Enter Hacker Name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={gameState === 'PROCESSING'}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    maxLength={20}
                  />
                  
                  <button 
                    onClick={submitScore}
                    disabled={!username.trim() || gameState === 'PROCESSING'}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 flex items-center justify-center gap-2"
                  >
                    {gameState === 'PROCESSING' ? (
                      <><Loader2 className="animate-spin" size={20} /> UPLOADING...</>
                    ) : (
                      'SUBMIT TO MAINFRAME'
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* --- LEADERBOARD SCREEN --- */}
            {gameState === 'LEADERBOARD' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/80 backdrop-blur-lg rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col max-h-[70vh] w-full"
              >
                <div className="p-6 bg-slate-800/40 border-b border-slate-700/50 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                    <Trophy size={20} className="text-amber-400"/> Lvl {level} RANKINGS
                  </h2>
                  {rank && (
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                      Your Rank: #{rank}
                    </span>
                  )}
                </div>
                
                <div className="overflow-y-auto p-4 space-y-2 flex-grow">
                  {leaderboard.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">No scores yet today.</div>
                  ) : (
                    leaderboard.map((entry, idx) => (
                      <div key={entry.id} className={`flex justify-between items-center p-3 rounded-xl transition-colors ${entry.username === username && entry.timeMs === finalTimeMs ? 'bg-emerald-900/40 border border-emerald-500/40 shadow-inner' : 'bg-slate-950/60 border border-transparent hover:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-sm ${idx < 3 ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)] font-bold' : 'text-slate-500'}`}>
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="font-medium text-slate-200">u/{entry.username}</span>
                        </div>
                        <span className="font-mono text-emerald-400">{formatTime(entry.timeMs)}</span>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="p-5 bg-slate-800/40 border-t border-slate-700/50 space-y-3">
                  <button 
                    onClick={generateShareText}
                    className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-600"
                  >
                    <Share2 size={18} /> SHARE RESULT
                  </button>

                  <button 
                    onClick={() => { setLevel(level + 1); startGame(level + 1); }}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2"
                  >
                    NEXT LEVEL ({level + 1}) <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}

      </div>

      {/* Footer Signature */}
      <div className="absolute bottom-4 text-center w-full z-10 pointer-events-none">
        <p className="text-slate-500 text-xs tracking-widest font-mono uppercase opacity-50">
          Made with ❤️ By Naman
        </p>
      </div>
    </div>
  );
}
