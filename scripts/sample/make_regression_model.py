"""Generate a small, genuine linear-regression model (pure Python, no deps).

Fits y = 3*x1 - 2*x2 + 5 (+ noise) by ordinary least squares via the normal
equations, then serializes the trained model to a compact, portable JSON file
(~1 KB). Deterministic — no RNG seed surprises across runs.
"""

import json
import math
import os

# --- deterministic synthetic data -------------------------------------------
# Linear congruential generator so we depend on nothing.
_state = 1234567


def rnd():
    global _state
    _state = (1103515245 * _state + 12345) % (2**31)
    return _state / (2**31)  # [0,1)


TRUE = {"x1": 3.0, "x2": -2.0, "intercept": 5.0}
N = 200
X, Y = [], []
for _ in range(N):
    x1 = rnd() * 10.0
    x2 = rnd() * 10.0
    noise = (rnd() - 0.5) * 0.4
    y = TRUE["x1"] * x1 + TRUE["x2"] * x2 + TRUE["intercept"] + noise
    X.append([1.0, x1, x2])  # design matrix row (bias + 2 features)
    Y.append(y)

# --- OLS via normal equations: beta = (XtX)^-1 Xt y -------------------------
def matmul_t(A):  # XtX (3x3)
    return [[sum(A[r][i] * A[r][j] for r in range(len(A))) for j in range(3)] for i in range(3)]


def matvec_t(A, y):  # Xt y (3,)
    return [sum(A[r][i] * y[r] for r in range(len(A))) for i in range(3)]


def inv3(m):
    a, b, c = m[0]
    d, e, f = m[1]
    g, h, i = m[2]
    A = e * i - f * h
    B = -(d * i - f * g)
    C = d * h - e * g
    det = a * A + b * B + c * C
    if abs(det) < 1e-12:
        raise ValueError("singular matrix")
    return [
        [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
        [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
        [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
    ]


XtX = matmul_t(X)
Xty = matvec_t(X, Y)
inv = inv3(XtX)
beta = [sum(inv[i][k] * Xty[k] for k in range(3)) for i in range(3)]  # [b0, b1, b2]

# --- metrics ----------------------------------------------------------------
mean_y = sum(Y) / N
ss_tot = sum((y - mean_y) ** 2 for y in Y)
ss_res = 0.0
for row, y in zip(X, Y):
    pred = beta[0] + beta[1] * row[1] + beta[2] * row[2]
    ss_res += (y - pred) ** 2
r2 = 1.0 - ss_res / ss_tot
rmse = math.sqrt(ss_res / N)

model = {
    "schema": "openvault.linear_regression.v1",
    "task": "regression",
    "algorithm": "ordinary_least_squares",
    "features": ["x1", "x2"],
    "intercept": round(beta[0], 6),
    "coefficients": {"x1": round(beta[1], 6), "x2": round(beta[2], 6)},
    "metrics": {"r2": round(r2, 6), "rmse": round(rmse, 6), "n_samples": N},
    "predict": "y = intercept + coefficients.x1*x1 + coefficients.x2*x2",
}

out = os.path.join(os.path.dirname(__file__), "regression-model.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(model, fh, indent=2)

size = os.path.getsize(out)
print(f"wrote {out} ({size} bytes)")
print(f"  intercept={model['intercept']} coef={model['coefficients']}")
print(f"  r2={model['metrics']['r2']} rmse={model['metrics']['rmse']}")
