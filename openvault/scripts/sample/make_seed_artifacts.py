"""Generate 10 valid datasets (CSV) + 10 genuinely-fitted models (JSON).

Pure Python, no third-party deps, deterministic. Each artifact is a real,
self-contained file: datasets are well-formed tabular CSV; models carry real
parameters fit by OLS / gradient descent / best-split on synthetic-but-coherent
data. Writes everything under scripts/sample/seed/ plus a seed-manifest.json the
TypeScript seed script consumes to register each via the right tier.
"""

import csv
import io
import json
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "seed")
os.makedirs(OUT, exist_ok=True)

# --- deterministic RNG (LCG) ------------------------------------------------
_s = 987654321


def rnd():
    global _s
    _s = (1103515245 * _s + 12345) % (2**31)
    return _s / (2**31)


def gauss():
    return (sum(rnd() for _ in range(6)) - 3.0)  # ~N(0,1)


# --- linear algebra (pure python) -------------------------------------------
def gj_inverse(m):
    n = len(m)
    a = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(m)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(a[r][col]))
        if abs(a[piv][col]) < 1e-12:
            raise ValueError("singular")
        a[col], a[piv] = a[piv], a[col]
        d = a[col][col]
        a[col] = [v / d for v in a[col]]
        for r in range(n):
            if r != col:
                f = a[r][col]
                a[r] = [a[r][k] - f * a[col][k] for k in range(2 * n)]
    return [row[n:] for row in a]


def ols(X, y, ridge=0.0):
    """X includes a bias column. Returns coefficient vector."""
    n = len(X[0])
    XtX = [[sum(X[r][i] * X[r][j] for r in range(len(X))) for j in range(n)] for i in range(n)]
    for i in range(n):
        XtX[i][i] += ridge
    Xty = [sum(X[r][i] * y[r] for r in range(len(X))) for i in range(n)]
    inv = gj_inverse(XtX)
    return [sum(inv[i][k] * Xty[k] for k in range(n)) for i in range(n)]


def r2_of(X, y, beta):
    mean = sum(y) / len(y)
    ss_tot = sum((v - mean) ** 2 for v in y) or 1e-9
    ss_res = sum((y[r] - sum(beta[i] * X[r][i] for i in range(len(beta)))) ** 2 for r in range(len(y)))
    return 1.0 - ss_res / ss_tot


def write_csv(name, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())
    return path, len(buf.getvalue())


def write_json(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)
    return path, os.path.getsize(path)


manifest = []


# Algorithms a compute-tier dataset permits over its plaintext. MUST match the
# worker's registered algos (worker/algoRegistry.ts) — only these two are
# registered; anything else is rejected before decryption. The seed upload
# runner passes this to uploadCompute as allowedAlgoHashes.
DEFAULT_COMPUTE_ALLOW = ["sha256:mean-aggregate", "sha256:logistic-regression"]


def add(key, kind, file, title, desc, tags, tier, terms=None, parent=None, allow=None):
    # Compute datasets default to the registered allowlist so they are never
    # seeded with an empty list (which renders "No algorithms are permitted").
    if allow is None and tier == "compute":
        allow = DEFAULT_COMPUTE_ALLOW
    manifest.append(
        {
            "key": key,
            "kind": kind,
            "file": os.path.basename(file),
            "title": title,
            "description": desc,
            "tags": tags,
            "tier": tier,
            "terms": terms,
            "parent": parent,
            "allowedAlgoHashes": allow,
        }
    )


# ============================ DATASETS (10) =================================
# 1. housing (public) — regression source
rows = []
for _ in range(60):
    sqft = round(600 + rnd() * 2800, 0)
    beds = 1 + int(rnd() * 4)
    age = int(rnd() * 60)
    price = round(50000 + 120 * sqft + 8000 * beds - 600 * age + gauss() * 8000, 0)
    rows.append([int(sqft), beds, age, int(price)])
f, _ = write_csv("housing.csv", ["sqft", "bedrooms", "age_years", "price_usd"], rows)
add("d_housing", "dataset", f, "US Housing Prices (sample)", "60-row tabular sample: square footage, bedrooms, age → sale price. Clean regression target.", ["housing", "regression", "tabular", "dataset"], "public")

# 2. iris (gated) — classification source
species = ["setosa", "versicolor", "virginica"]
rows = []
for i in range(45):
    sp = i % 3
    base = [[5.0, 3.4, 1.5, 0.2], [6.0, 2.8, 4.3, 1.3], [6.6, 3.0, 5.6, 2.1]][sp]
    rows.append([round(b + gauss() * 0.25, 2) for b in base] + [species[sp]])
f, _ = write_csv("iris.csv", ["sepal_len", "sepal_wid", "petal_len", "petal_wid", "species"], rows)
add("d_iris", "dataset", f, "Iris Flowers (sample)", "45-row classic multiclass classification set: 4 floral measurements → species.", ["iris", "classification", "tabular", "dataset"], "gated", {"rev": 10, "fee": "0.01"})

# 3. weather (gated, zero-fee rev-only) — timeseries
rows = []
t = 15.0
for d in range(48):
    t = 0.85 * t + 0.15 * (18 + 8 * math.sin(d / 7.0)) + gauss() * 0.6
    rows.append([d, round(t, 2), round(60 + 20 * rnd(), 1), round(max(0, gauss() * 3), 1)])
f, _ = write_csv("weather.csv", ["day", "temp_c", "humidity_pct", "rain_mm"], rows)
add("d_weather", "dataset", f, "Daily Weather (sample)", "48-day weather time series: temperature, humidity, rainfall. Autocorrelated temp.", ["weather", "timeseries", "tabular", "dataset"], "gated", {"rev": 25, "fee": "0"})

# 4. sales (compute) — compute-only aggregation source
regions = ["NA", "EU", "APAC", "LATAM"]
rows = []
for m in range(1, 13):
    for r in regions:
        units = int(200 + rnd() * 800)
        rows.append([m, r, units, round(units * (20 + rnd() * 15), 2)])
f, _ = write_csv("sales.csv", ["month", "region", "units", "revenue_usd"], rows)
add("d_sales", "dataset", f, "Regional Sales (compute-only)", "Monthly sales by region — computable aggregations only; raw rows never downloadable.", ["sales", "compute", "tabular", "dataset"], "compute", {"rev": 15, "fee": "0.02"})

# 5. patients (private) — sensitive owner-only
rows = []
for _ in range(40):
    age = 20 + int(rnd() * 60)
    bmi = round(18 + rnd() * 18, 1)
    bp = int(90 + rnd() * 60)
    glu = int(70 + rnd() * 110)
    dia = 1 if (glu > 140 and bmi > 28) else 0
    rows.append([age, bmi, bp, glu, dia])
f, _ = write_csv("patients.csv", ["age", "bmi", "systolic_bp", "glucose", "diabetes"], rows)
add("d_patients", "dataset", f, "Patient Records (private)", "40 synthetic clinical records — owner-only. Demonstrates private, encrypted, non-downloadable PII.", ["health", "private", "tabular", "dataset"], "private")

# 6. wine (gated, high rev) — regression/quality
rows = []
for _ in range(50):
    acid = round(4 + rnd() * 6, 2)
    sugar = round(rnd() * 15, 2)
    alc = round(8 + rnd() * 6, 2)
    qual = int(max(3, min(9, round(3 + 0.4 * alc - 0.1 * sugar + gauss()))))
    rows.append([acid, sugar, alc, qual])
f, _ = write_csv("wine_quality.csv", ["acidity", "residual_sugar", "alcohol", "quality"], rows)
add("d_wine", "dataset", f, "Wine Quality (sample)", "50-row wine chemistry → quality score. Ordinal regression target.", ["wine", "regression", "tabular", "dataset"], "gated", {"rev": 50, "fee": "0.05"})

# 7. energy (compute, zero-fee) — load forecasting source
rows = []
for h in range(72):
    load = round(400 + 150 * math.sin(h / 12.0) + gauss() * 20, 1)
    rows.append([h, load, round(15 + 10 * math.sin(h / 24.0), 1)])
f, _ = write_csv("energy.csv", ["hour", "load_kw", "ambient_c"], rows)
add("d_energy", "dataset", f, "Grid Load (compute-only)", "72-hour electrical load + ambient temp. Compute-only forecasting source.", ["energy", "timeseries", "compute", "dataset"], "compute", {"rev": 20, "fee": "0"})

# 8. titanic (gated, low-rev high-fee) — classification
rows = []
for _ in range(55):
    pcl = 1 + int(rnd() * 3)
    age = int(1 + rnd() * 70)
    fare = round((4 - pcl) * 25 + rnd() * 30, 2)
    surv = 1 if (pcl == 1 and rnd() > 0.3) or rnd() > 0.7 else 0
    rows.append([pcl, age, fare, surv])
f, _ = write_csv("titanic.csv", ["pclass", "age", "fare", "survived"], rows)
add("d_titanic", "dataset", f, "Titanic Survival (sample)", "55-row passenger class/age/fare → survival. Binary classification.", ["titanic", "classification", "tabular", "dataset"], "gated", {"rev": 5, "fee": "0.1"})

# 9. iris augmented (derivative of d_iris) — adds engineered feature
rows = []
for i in range(45):
    sp = i % 3
    base = [[5.0, 3.4, 1.5, 0.2], [6.0, 2.8, 4.3, 1.3], [6.6, 3.0, 5.6, 2.1]][sp]
    m = [round(b + gauss() * 0.25, 2) for b in base]
    ratio = round(m[2] / m[3], 3) if m[3] else 0
    rows.append(m + [ratio, species[sp]])
f, _ = write_csv("iris_augmented.csv", ["sepal_len", "sepal_wid", "petal_len", "petal_wid", "petal_ratio", "species"], rows)
add("d_iris_aug", "dataset", f, "Iris + Engineered Features", "Derivative of the Iris set with an added petal_len/petal_wid ratio feature. Royalties flow to the parent.", ["iris", "derivative", "feature-engineering", "dataset"], "derivative", parent="d_iris")

# 10. stocks (gated, fee-only rev0) — timeseries
rows = []
px = 100.0
for d in range(60):
    px = round(px * (1 + gauss() * 0.02), 2)
    rows.append([d, px, round(px * (1 + abs(gauss()) * 0.01), 2), int(1e5 + rnd() * 9e5)])
f, _ = write_csv("stocks.csv", ["day", "close", "high", "volume"], rows)
add("d_stocks", "dataset", f, "Equity Prices (sample)", "60-day OHLC-style price/volume series. Fee-only license (0% revenue share).", ["stocks", "timeseries", "finance", "dataset"], "gated", {"rev": 0, "fee": "0.02"})

# ============================ MODELS (10) ===================================
def model_obj(algo, task, features, params, metrics, predict):
    return {
        "schema": "openvault.model.v1",
        "algorithm": algo,
        "task": task,
        "features": features,
        "params": params,
        "metrics": metrics,
        "predict": predict,
    }


# 1. linear regression (public) — fit on housing-like data
X, y = [], []
for _ in range(80):
    a = 600 + rnd() * 2800
    b = 1 + int(rnd() * 4)
    X.append([1.0, a / 1000.0, float(b)])
    y.append(50 + 0.12 * a + 8 * b + gauss() * 8)
beta = ols(X, y)
m = model_obj("linear_regression", "regression", ["sqft_k", "bedrooms"], {"intercept": round(beta[0], 4), "coef": [round(beta[1], 4), round(beta[2], 4)]}, {"r2": round(r2_of(X, y, beta), 4)}, "y = intercept + coef·x")
f, _ = write_json("linreg_housing.json", m)
add("m_linreg", "model", f, "LinReg: Housing Price", "Ordinary least squares price model (sqft, bedrooms). R² reported.", ["regression", "linear", "ols", "model"], "public")

# 2. logistic regression (gated) — setosa vs rest
X, y = [], []
for i in range(90):
    sp = i % 3
    base = [[1.5, 0.2], [4.3, 1.3], [5.6, 2.1]][sp]
    pl = base[0] + gauss() * 0.25
    pw = base[1] + gauss() * 0.15
    X.append([1.0, pl, pw])
    y.append(1.0 if sp == 0 else 0.0)
w = [0.0, 0.0, 0.0]
for _ in range(400):
    g = [0.0, 0.0, 0.0]
    for r in range(len(X)):
        z = sum(w[k] * X[r][k] for k in range(3))
        p = 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
        e = p - y[r]
        for k in range(3):
            g[k] += e * X[r][k]
    w = [w[k] - 0.05 * g[k] / len(X) for k in range(3)]
acc = sum(1 for r in range(len(X)) if (1 if sum(w[k] * X[r][k] for k in range(3)) > 0 else 0) == y[r]) / len(X)
m = model_obj("logistic_regression", "binary_classification", ["petal_len", "petal_wid"], {"bias": round(w[0], 4), "weights": [round(w[1], 4), round(w[2], 4)]}, {"accuracy": round(acc, 4)}, "p = sigmoid(bias + weights·x); class = p>0.5")
f, _ = write_json("logreg_iris.json", m)
add("m_logreg", "model", f, "LogReg: Iris (setosa)", "Logistic regression (gradient descent) separating setosa. Accuracy reported.", ["classification", "logistic", "model"], "gated", {"rev": 10, "fee": "0.01"})

# 3. polynomial regression (gated, zero-fee)
X, y = [], []
for _ in range(60):
    x = rnd() * 6 - 3
    X.append([1.0, x, x * x])
    y.append(2 + 1.5 * x - 0.8 * x * x + gauss() * 0.5)
beta = ols(X, y)
m = model_obj("polynomial_regression", "regression", ["x", "x^2"], {"intercept": round(beta[0], 4), "coef": [round(beta[1], 4), round(beta[2], 4)], "degree": 2}, {"r2": round(r2_of(X, y, beta), 4)}, "y = c0 + c1·x + c2·x²")
f, _ = write_json("polyreg.json", m)
add("m_poly", "model", f, "PolyReg: Degree-2 Curve", "Degree-2 polynomial regression fit by OLS on expanded features.", ["regression", "polynomial", "model"], "gated", {"rev": 30, "fee": "0"})

# 4. ridge regression (compute)
X, y = [], []
for _ in range(70):
    a, b, c = rnd(), rnd(), rnd()
    X.append([1.0, a, b, c])
    y.append(1 + 2 * a - 1 * b + 0.5 * c + gauss() * 0.1)
beta = ols(X, y, ridge=0.5)
m = model_obj("ridge_regression", "regression", ["a", "b", "c"], {"intercept": round(beta[0], 4), "coef": [round(v, 4) for v in beta[1:]], "alpha": 0.5}, {"r2": round(r2_of(X, y, beta), 4)}, "y = intercept + coef·x (L2-regularized)")
f, _ = write_json("ridge.json", m)
add("m_ridge", "model", f, "Ridge: 3-Feature (compute)", "L2-regularized linear regression. Compute-only inference.", ["regression", "ridge", "compute", "model"], "compute", {"rev": 15, "fee": "0.02"})

# 5. fraud logistic (private)
X, y = [], []
for _ in range(80):
    amt = rnd()
    night = 1.0 if rnd() > 0.5 else 0.0
    X.append([1.0, amt, night])
    y.append(1.0 if (amt > 0.8 and night) else 0.0)
w = [0.0, 0.0, 0.0]
for _ in range(300):
    g = [0.0, 0.0, 0.0]
    for r in range(len(X)):
        z = sum(w[k] * X[r][k] for k in range(3))
        p = 1.0 / (1.0 + math.exp(-max(-30, min(30, z))))
        e = p - y[r]
        for k in range(3):
            g[k] += e * X[r][k]
    w = [w[k] - 0.1 * g[k] / len(X) for k in range(3)]
m = model_obj("logistic_regression", "binary_classification", ["amount_norm", "is_night"], {"bias": round(w[0], 4), "weights": [round(w[1], 4), round(w[2], 4)]}, {"note": "proprietary"}, "p = sigmoid(bias + weights·x)")
f, _ = write_json("fraud_model.json", m)
add("m_fraud", "model", f, "Fraud Detector (private)", "Proprietary fraud logistic model — owner-only, encrypted, non-downloadable.", ["classification", "fraud", "private", "model"], "private")

# 6. multivariate linear (gated, high rev)
X, y = [], []
for _ in range(75):
    v = [rnd() for _ in range(4)]
    X.append([1.0] + v)
    y.append(3 + 2 * v[0] - 1.5 * v[1] + 0.7 * v[2] - 0.3 * v[3] + gauss() * 0.1)
beta = ols(X, y)
m = model_obj("multivariate_linear_regression", "regression", ["f1", "f2", "f3", "f4"], {"intercept": round(beta[0], 4), "coef": [round(v, 4) for v in beta[1:]]}, {"r2": round(r2_of(X, y, beta), 4)}, "y = intercept + coef·x")
f, _ = write_json("multireg.json", m)
add("m_multireg", "model", f, "MultiReg: 4-Feature", "Multivariate OLS over four features.", ["regression", "multivariate", "model"], "gated", {"rev": 50, "fee": "0.05"})

# 7. AR(2) timeseries (compute, zero-fee)
ser = []
v1 = v2 = 0.0
for _ in range(120):
    nv = 0.6 * v1 - 0.2 * v2 + gauss() * 0.3
    ser.append(nv)
    v2, v1 = v1, nv
X, y = [], []
for t in range(2, len(ser)):
    X.append([1.0, ser[t - 1], ser[t - 2]])
    y.append(ser[t])
beta = ols(X, y)
m = model_obj("autoregression", "timeseries_forecast", ["lag1", "lag2"], {"const": round(beta[0], 4), "phi": [round(beta[1], 4), round(beta[2], 4)], "order": 2}, {"r2": round(r2_of(X, y, beta), 4)}, "x_t = const + phi1·x_{t-1} + phi2·x_{t-2}")
f, _ = write_json("ar2.json", m)
add("m_ar", "model", f, "AR(2): Time Series (compute)", "Order-2 autoregression fit by OLS on lagged values. Compute-only.", ["timeseries", "autoregression", "compute", "model"], "compute", {"rev": 20, "fee": "0"})

# 8. kNN classifier (gated, low-rev high-fee) — stores prototypes
proto = []
for i in range(15):
    sp = i % 3
    base = [[1.5, 0.2], [4.3, 1.3], [5.6, 2.1]][sp]
    proto.append({"x": [round(base[0] + gauss() * 0.2, 3), round(base[1] + gauss() * 0.1, 3)], "label": species[sp]})
m = model_obj("knn_classifier", "multiclass_classification", ["petal_len", "petal_wid"], {"k": 3, "prototypes": proto}, {"n_prototypes": len(proto)}, "label = majority vote over k nearest prototypes (euclidean)")
f, _ = write_json("knn.json", m)
add("m_knn", "model", f, "kNN: Iris (k=3)", "k-nearest-neighbour classifier carrying 15 labelled prototypes.", ["classification", "knn", "model"], "gated", {"rev": 5, "fee": "0.1"})

# 9. refined regression (derivative of m_logreg)
X, y = [], []
for _ in range(80):
    a = 600 + rnd() * 2800
    b = 1 + int(rnd() * 4)
    age = rnd() * 60
    X.append([1.0, a / 1000.0, float(b), age])
    y.append(50 + 0.12 * a + 8 * b - 0.6 * age + gauss() * 6)
beta = ols(X, y)
m = model_obj("linear_regression", "regression", ["sqft_k", "bedrooms", "age"], {"intercept": round(beta[0], 4), "coef": [round(v, 4) for v in beta[1:]]}, {"r2": round(r2_of(X, y, beta), 4)}, "y = intercept + coef·x")
f, _ = write_json("linreg_v2.json", m)
add("m_linreg_v2", "model", f, "LinReg v2 (derivative)", "Refined 3-feature regression registered as a derivative — royalties flow to the parent model.", ["regression", "linear", "derivative", "model"], "derivative", parent="m_logreg")

# 10. decision stump (gated, fee-only rev0)
X, y = [], []
for _ in range(60):
    f1 = rnd()
    lab = 1 if f1 > 0.55 else 0
    X.append(f1)
    y.append(lab)
best = (0.5, 0, 0, 1e9)
for thr in [i / 20 for i in range(1, 20)]:
    left = [y[i] for i in range(len(X)) if X[i] <= thr]
    right = [y[i] for i in range(len(X)) if X[i] > thr]
    if not left or not right:
        continue
    lc = round(sum(left) / len(left))
    rc = round(sum(right) / len(right))
    err = sum((y[i] - (lc if X[i] <= thr else rc)) ** 2 for i in range(len(X)))
    if err < best[3]:
        best = (thr, lc, rc, err)
m = model_obj("decision_stump", "binary_classification", ["f1"], {"threshold": round(best[0], 3), "left_class": best[1], "right_class": best[2]}, {"sse": round(best[3], 2)}, "class = f1 <= threshold ? left_class : right_class")
f, _ = write_json("decision_stump.json", m)
add("m_tree", "model", f, "Decision Stump", "Single-split decision tree fit by best threshold. Fee-only license (0% rev share).", ["classification", "tree", "model"], "gated", {"rev": 0, "fee": "0.02"})

# --- manifest ---------------------------------------------------------------
mpath = os.path.join(OUT, "seed-manifest.json")
with open(mpath, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2)

ds = sum(1 for e in manifest if e["kind"] == "dataset")
ms = sum(1 for e in manifest if e["kind"] == "model")
print(f"wrote {len(manifest)} artifacts ({ds} datasets, {ms} models) to {OUT}")
for e in manifest:
    sz = os.path.getsize(os.path.join(OUT, e["file"]))
    t = e["tier"] + (f" rev{e['terms']['rev']}/fee{e['terms']['fee']}" if e.get("terms") else "")
    print(f"  {e['key']:<14} {e['kind']:<7} {e['file']:<22} {sz:>5}B  {t}")
