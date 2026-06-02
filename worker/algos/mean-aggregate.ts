// mean-aggregate: per-column means over numeric rows.
//
// AGGREGATE / non-reconstructing: it returns ONLY the column means and the row
// count. An individual input row cannot be recovered from these aggregates
// (n >= 2). This is the kind of algorithm "private but computable" is meant to
// allow — the worker decrypts the dataset, reduces it to aggregates, and the
// raw rows never leave the worker.

export interface MeanAggregateResult {
  columnMeans: number[];
  n: number;
}

export const name = "mean-aggregate";

/** Compute per-column means. `rows` is a matrix of numeric values. */
export function run(rows: number[][]): MeanAggregateResult {
  const n = rows.length;
  if (n === 0) return { columnMeans: [], n: 0 };
  const cols = rows[0].length;
  const sums = new Array<number>(cols).fill(0);
  for (const row of rows) {
    for (let c = 0; c < cols; c++) sums[c] += row[c];
  }
  return { columnMeans: sums.map((s) => s / n), n };
}
