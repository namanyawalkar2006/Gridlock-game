const dateStr = "2026-07-10";
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function getDailySequence(dateStr: string, length: number = 6): number[] {
  const seedStr = dateStr.replace(/-/g, '');
  const seed = parseInt(seedStr, 10);
  const random = mulberry32(seed);
  
  const sequence: number[] = [];
  for (let i = 0; i < length; i++) {
    sequence.push(Math.floor(random() * 16));
  }
  return sequence;
}

console.log(getDailySequence("2026-07-10"));
console.log(getDailySequence(new Date().toISOString().split('T')[0]));
