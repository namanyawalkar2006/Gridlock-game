import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

interface ScoreEntry {
  id: string;
  username: string;
  timeMs: number;
  timestamp: number;
  dateStr: string;
  difficulty: string;
  level: number;
}

const DB_FILE = process.env.VERCEL ? '/tmp/database.json' : './database.json';

// Initialize JSON Database
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ leaderboard: [] }), 'utf-8');
}

function readDB(): { leaderboard: ScoreEntry[] } {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { leaderboard: [] };
  }
}

function writeDB(data: { leaderboard: ScoreEntry[] }) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Seeded random number generator
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function getDailySequence(dateStr: string, difficulty: string, level: number): number[] {
  // Convert date string to integer seed (e.g. "2023-10-25" -> 20231025)
  const seedStr = dateStr.replace(/-/g, '');
  let baseLength = difficulty === 'EASY' ? 4 : difficulty === 'HARD' ? 8 : 6;
  let length = Math.min(16, baseLength + (level - 1));

  const diffMultiplier = difficulty === 'EASY' ? 1 : difficulty === 'MEDIUM' ? 2 : 3;
  const seed = parseInt(seedStr, 10) + level * 1000 + diffMultiplier * 100000;
  
  const random = mulberry32(seed);
  
  const sequence: number[] = [];
  while (sequence.length < length) {
    const nextVal = Math.floor(random() * 16);
    if (!sequence.includes(nextVal)) {
      sequence.push(nextVal);
    }
  }
  return sequence;
}

app.post("/api/game/start", (req, res) => {
  const dateStr = new Date().toISOString().split('T')[0];
  res.json({ dateStr });
});

app.post("/api/game/verify", (req, res) => {
  const { dateStr, sequence, difficulty = 'MEDIUM', level = 1 } = req.body;
  
  if (!dateStr || !Array.isArray(sequence)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const expectedSequence = getDailySequence(dateStr, difficulty, level);
  
  let correctCount = 0;
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] === expectedSequence[i]) {
      correctCount++;
    } else {
      break;
    }
  }

  const isComplete = correctCount === expectedSequence.length;
  res.json({ 
    correctCount, 
    isComplete, 
    expectedLength: expectedSequence.length 
  });
});

app.post("/api/game/submit", (req, res) => {
  const { username, timeMs, dateStr, difficulty = 'MEDIUM', level = 1 } = req.body;

  if (!username || typeof timeMs !== 'number' || !dateStr) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const newScore: ScoreEntry = {
    id: crypto.randomUUID(),
    username: username.substring(0, 20),
    timeMs,
    timestamp: Date.now(),
    dateStr,
    difficulty,
    level
  };
  
  const dbData = readDB();
  dbData.leaderboard.push(newScore);
  
  // Sort and keep top 1000 overall to limit file size
  dbData.leaderboard.sort((a, b) => a.timeMs - b.timeMs);
  if (dbData.leaderboard.length > 1000) {
    dbData.leaderboard = dbData.leaderboard.slice(0, 1000);
  }
  
  writeDB(dbData);
  
  const relevantBoard = dbData.leaderboard.filter(s => s.dateStr === dateStr && s.difficulty === difficulty && s.level === level);
  const rank = relevantBoard.findIndex(s => s.id === newScore.id) + 1;
  res.json({ success: true, rank });
});

app.get("/api/game/leaderboard", (req, res) => {
  const { dateStr, difficulty = 'MEDIUM', level = '1' } = req.query;
  if (!dateStr) {
    return res.json({ leaderboard: [] });
  }
  
  const dbData = readDB();
  const dailyBoard = dbData.leaderboard.filter(s => s.dateStr === dateStr && s.difficulty === difficulty && s.level === parseInt(level as string, 10));
  dailyBoard.sort((a, b) => a.timeMs - b.timeMs);
  res.json({ leaderboard: dailyBoard.slice(0, 10) });
});

// Admin Data API
app.use("/api/admin", (req, res, next) => {
  const providedPassword = req.headers['x-admin-password'];
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';
  if (providedPassword !== expectedPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/api/admin/data", (req, res) => {
  const dbData = readDB();
  const sortedData = [...dbData.leaderboard].sort((a, b) => b.timestamp - a.timestamp);
  res.json({ data: sortedData });
});

app.delete("/api/admin/data/:id", (req, res) => {
  const dbData = readDB();
  dbData.leaderboard = dbData.leaderboard.filter(s => s.id !== req.params.id);
  writeDB(dbData);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.VERCEL) return;
  
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
