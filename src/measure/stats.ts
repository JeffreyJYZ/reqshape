import type { Stats } from "~/types.ts";

export function mean(values: number[]): number {
	if (values.length === 0) return 0;
	let sum = 0;
	for (const value of values) sum += value;
	return sum / values.length;
}

/** Nearest-rank percentiles: the value at or below which that share of reqs fall. */
export function stats(values: number[]): Stats {
	if (values.length === 0) return { mean: 0, p10: 0, p50: 0, p90: 0, max: 0 };
	const sorted = [...values].sort((a, b) => a - b);
	const at = (p: number): number =>
		sorted[
			Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
		] ?? 0;
	return {
		mean: mean(values),
		p10: at(0.1),
		p50: at(0.5),
		p90: at(0.9),
		max: sorted[sorted.length - 1] ?? 0,
	};
}
