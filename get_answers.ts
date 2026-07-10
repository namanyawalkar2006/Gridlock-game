const dateStr = "2026-07-10";
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function getDailySequence(dateStr: string, difficulty: string, level: number): number[] {
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

console.log("EASY Level 1:", getDailySequence(dateStr, "EASY", 1));
console.log("MEDIUM Level 1:", getDailySequence(dateStr, "MEDIUM", 1));
console.log("HARD Level 1:", getDailySequence(dateStr, "HARD", 1));
console.log("MEDIUM Level 2:", getDailySequence(dateStr, "MEDIUM", 2));
