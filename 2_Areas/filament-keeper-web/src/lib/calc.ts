// DBに保持しない算出値。要件定義書 6章末尾のとおり読み出し時に計算する。

export function pricePerGram(priceYen: number, nominalWeightG: number): number {
  if (nominalWeightG <= 0) return 0;
  return priceYen / nominalWeightG;
}

export function remainingPercent(currentWeightG: number, registeredWeightG: number): number {
  if (registeredWeightG <= 0) return 0;
  return (currentWeightG / registeredWeightG) * 100;
}

export function jobCostYen(usedWeightG: number, priceYen: number, nominalWeightG: number): number {
  return Math.round(usedWeightG * pricePerGram(priceYen, nominalWeightG));
}

export function clampWeight(valueG: number): { value: number; clamped: boolean } {
  if (valueG < 0) return { value: 0, clamped: true };
  return { value: valueG, clamped: false };
}

export function formatYen(yen: number): string {
  return `¥${Math.round(yen).toLocaleString("ja-JP")}`;
}

export function formatGrams(g: number): string {
  return `${Math.round(g).toLocaleString("ja-JP")}g`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
