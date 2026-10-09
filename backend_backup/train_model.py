import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

# --------------------------------------------------
# 1. Load historical Delhi air-quality dataset
# --------------------------------------------------

DATA_PATH = "dataset/Delhi_AQI_Dataset.csv"
MODEL_PATH = "model/isolation_forest.pkl"

df = pd.read_csv(DATA_PATH)

print("Dataset loaded successfully!")
print("Number of records:", len(df))
print("\nColumns:")
print(df.columns.tolist())


# --------------------------------------------------
# 2. Select pollutant features
# --------------------------------------------------

features = [
    "PM2.5",
    "PM10",
    "NO2",
    "SO2",
    "CO",
    "O3"
]

X = df[features].copy()


# --------------------------------------------------
# 3. Convert values to numeric
# --------------------------------------------------

for column in features:
    X[column] = pd.to_numeric(X[column], errors="coerce")


# --------------------------------------------------
# 4. Handle missing values
# --------------------------------------------------

print("\nMissing values before preprocessing:")
print(X.isnull().sum())

imputer = SimpleImputer(strategy="median")


# --------------------------------------------------
# 5. Create Isolation Forest
# --------------------------------------------------

model = IsolationForest(
    n_estimators=200,
    contamination=0.05,
    random_state=42,
    n_jobs=-1
)


# --------------------------------------------------
# 6. Create complete ML pipeline
# --------------------------------------------------

pipeline = Pipeline([
    ("imputer", imputer),
    ("model", model)
])


# --------------------------------------------------
# 7. Train the model
# --------------------------------------------------

print("\nTraining Isolation Forest...")

pipeline.fit(X)

print("Training completed!")


# --------------------------------------------------
# 8. Detect anomalies in historical data
# --------------------------------------------------

predictions = pipeline.predict(X)

df["Anomaly"] = predictions

df["Anomaly_Status"] = df["Anomaly"].map({
    1: "Normal",
    -1: "Anomaly"
})


# --------------------------------------------------
# 9. Display results
# --------------------------------------------------

normal_count = (predictions == 1).sum()
anomaly_count = (predictions == -1).sum()

print("\n========== MODEL RESULTS ==========")
print("Total records :", len(df))
print("Normal records:", normal_count)
print("Anomalies     :", anomaly_count)

print("\nSample results:")
print(
    df[
        ["Date", "AQI", "PM2.5", "PM10",
         "NO2", "SO2", "CO", "O3", "Anomaly_Status"]
    ].head(10)
)


# --------------------------------------------------
# 10. Save trained model
# --------------------------------------------------

joblib.dump(pipeline, MODEL_PATH)

print("\n===================================")
print("Model saved successfully!")
print("Location:", MODEL_PATH)
print("===================================")