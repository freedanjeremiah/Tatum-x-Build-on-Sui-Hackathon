// logistic-regression: a small, dependency-free binary logistic regression
// trained by batch gradient descent. The LAST column of each row is the label
// (0/1); the preceding columns are features.
//
// RESULTS ONLY: it returns the learned coefficients (intercept + one weight per
// feature) plus training metrics (iterations, final accuracy, loss). It NEVER
// returns the input rows or any per-record value. The model is an aggregate of
// the data — coefficients cannot reconstruct an individual training row.

export interface LogisticRegressionParams {
  /** Learning rate (default 0.5). */
  learningRate?: number;
  /** Max gradient-descent iterations (default 500). */
  iterations?: number;
}

export interface LogisticRegressionResult {
  /** [intercept, w_0, w_1, ...] — length = features + 1. */
  coefficients: number[];
  iterations: number;
  accuracy: number;
  logLoss: number;
}

export const name = "logistic-regression";

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export function run(
  rows: number[][],
  params: LogisticRegressionParams = {}
): LogisticRegressionResult {
  const lr = params.learningRate ?? 0.5;
  const maxIter = params.iterations ?? 500;

  const n = rows.length;
  if (n === 0) {
    return { coefficients: [0], iterations: 0, accuracy: 0, logLoss: 0 };
  }
  const nFeatures = rows[0].length - 1; // last column is the label
  const features = rows.map((r) => r.slice(0, nFeatures));
  const labels = rows.map((r) => r[nFeatures]);

  // weights[0] = intercept (bias), weights[1..] = per-feature weights.
  const weights = new Array<number>(nFeatures + 1).fill(0);

  let iter = 0;
  for (; iter < maxIter; iter++) {
    const grad = new Array<number>(nFeatures + 1).fill(0);
    for (let i = 0; i < n; i++) {
      let z = weights[0];
      for (let f = 0; f < nFeatures; f++) z += weights[f + 1] * features[i][f];
      const err = sigmoid(z) - labels[i];
      grad[0] += err;
      for (let f = 0; f < nFeatures; f++) grad[f + 1] += err * features[i][f];
    }
    for (let w = 0; w < weights.length; w++) weights[w] -= (lr * grad[w]) / n;
  }

  // Final metrics over the training set (aggregate only).
  let correct = 0;
  let loss = 0;
  const eps = 1e-12;
  for (let i = 0; i < n; i++) {
    let z = weights[0];
    for (let f = 0; f < nFeatures; f++) z += weights[f + 1] * features[i][f];
    const p = sigmoid(z);
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === labels[i]) correct++;
    loss += -(
      labels[i] * Math.log(p + eps) +
      (1 - labels[i]) * Math.log(1 - p + eps)
    );
  }

  return {
    coefficients: weights.map((w) => Number(w.toFixed(6))),
    iterations: iter,
    accuracy: Number((correct / n).toFixed(4)),
    logLoss: Number((loss / n).toFixed(6)),
  };
}
