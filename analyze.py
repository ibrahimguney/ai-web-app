import sys
import json
import traceback
import pandas as pd
import numpy as np

def run_xgboost(df, target, features):
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_squared_error, r2_score

    df = df.dropna(subset=[target] + features)
    if len(df) < 10:
        return {"error": "XGBoost için yeterli veri yok (En az 10 satır temiz veri gerekli)."}

    X = df[features]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    r2 = float(r2_score(y_test, preds))

    importance = model.feature_importances_
    feat_imp = {feat: float(imp) for feat, imp in zip(features, importance)}

    return {
        "model": "XGBoost Regressor",
        "rmse": rmse,
        "r2_score": r2,
        "feature_importance": feat_imp,
        "message": "Model başarıyla eğitildi."
    }

def run_lstm(df, target, features, time_col='Year', entity_col='Company'):
    import tensorflow as tf
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.metrics import mean_squared_error

    # For LSTM, we need sequences.
    if time_col not in df.columns or entity_col not in df.columns:
        return {"error": f"LSTM için '{time_col}' ve '{entity_col}' sütunları gereklidir."}
    
    df = df.dropna(subset=[target, time_col, entity_col] + features)
    df = df.sort_values(by=[entity_col, time_col])

    # Try to build simple sequences of length 3 (or less if not possible, but we'll pad or error)
    SEQ_LEN = 3
    
    scaler_x = MinMaxScaler()
    scaler_y = MinMaxScaler()
    
    X_data = []
    y_data = []

    for company, group in df.groupby(entity_col):
        if len(group) >= SEQ_LEN:
            features_scaled = scaler_x.fit_transform(group[features].values)
            target_scaled = scaler_y.fit_transform(group[[target]].values)
            
            for i in range(len(group) - SEQ_LEN):
                X_data.append(features_scaled[i:i+SEQ_LEN])
                y_data.append(target_scaled[i+SEQ_LEN][0])

    if len(X_data) < 5:
        return {"error": "LSTM eğitmek için yeterli ardışık zaman serisi verisi bulunamadı."}

    X_arr = np.array(X_data)
    y_arr = np.array(y_data)

    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(32, activation='relu', input_shape=(SEQ_LEN, len(features))),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse')
    
    model.fit(X_arr, y_arr, epochs=20, verbose=0)
    
    preds_scaled = model.predict(X_arr)
    preds = scaler_y.inverse_transform(preds_scaled)
    y_actual = scaler_y.inverse_transform(y_arr.reshape(-1, 1))
    
    rmse = float(np.sqrt(mean_squared_error(y_actual, preds)))

    return {
        "model": "LSTM Time-Series",
        "rmse": rmse,
        "message": "LSTM modeli başarıyla eğitildi.",
        "samples_used": len(X_data)
    }

def run_panel(df, target, features, time_col='Year', entity_col='Company'):
    from linearmodels.panel import PanelOLS
    import statsmodels.api as sm

    if time_col not in df.columns or entity_col not in df.columns:
        return {"error": f"Panel veri analizi için '{time_col}' ve '{entity_col}' sütunları gereklidir."}
    
    df = df.dropna(subset=[target, time_col, entity_col] + features)
    
    # Set multi-index for Panel data
    df = df.set_index([entity_col, time_col])
    
    if len(df) < 10:
        return {"error": "Panel veri modeli için yeterli veri yok."}

    exog = sm.add_constant(df[features])
    endog = df[target]

    try:
        model = PanelOLS(endog, exog, entity_effects=True)
        res = model.fit(cov_type='robust')
        
        coefs = res.params.to_dict()
        pvalues = res.pvalues.to_dict()
        
        return {
            "model": "Panel OLS (Fixed Effects)",
            "r2": float(res.rsquared),
            "coefficients": {k: float(v) for k, v in coefs.items()},
            "pvalues": {k: float(v) for k, v in pvalues.items()},
            "message": "Panel veri modeli başarıyla çalıştırıldı."
        }
    except Exception as e:
        return {"error": f"Panel veri analizi hatası: {str(e)}"}


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Eksik parametreler. Kullanım: analyze.py <config.json> <output.json>"}))
        sys.exit(1)

    config_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        data = config.get("data", [])
        model_type = config.get("model_type", "xgboost")
        target = config.get("target")
        features = config.get("features", [])

        if not data or not target or not features:
            raise ValueError("Data, target veya features alanları eksik.")

        df = pd.DataFrame(data)

        # Temizlik: sayısal değerlere dönüştür
        for col in [target] + features:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        result = {}
        if model_type == "xgboost":
            result = run_xgboost(df, target, features)
        elif model_type == "lstm":
            # For extraction data, we might have 'company' instead of 'Company'
            entity_col = 'Company' if 'Company' in df.columns else ('company_name' if 'company_name' in df.columns else 'company')
            time_col = 'Year' if 'Year' in df.columns else ('report_year' if 'report_year' in df.columns else 'year')
            result = run_lstm(df, target, features, time_col=time_col, entity_col=entity_col)
        elif model_type == "panel":
            entity_col = 'Company' if 'Company' in df.columns else ('company_name' if 'company_name' in df.columns else 'company')
            time_col = 'Year' if 'Year' in df.columns else ('report_year' if 'report_year' in df.columns else 'year')
            result = run_panel(df, target, features, time_col=time_col, entity_col=entity_col)
        else:
            result = {"error": f"Bilinmeyen model tipi: {model_type}"}

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

    except Exception as e:
        error_msg = {"error": str(e), "traceback": traceback.format_exc()}
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(error_msg, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
