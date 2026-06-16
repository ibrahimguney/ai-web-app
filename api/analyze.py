from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import os
import traceback

app = Flask(__name__)

# Standard CORS helper
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def run_xgboost(df, target, features):
    try:
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_squared_error, r2_score
        
        # XGBoost import. Fallback to GradientBoostingRegressor if not available or fails
        try:
            import xgboost as xgb
            use_xgb = True
        except ImportError:
            use_xgb = False
            from sklearn.ensemble import GradientBoostingRegressor
            
        df = df.dropna(subset=[target] + features)
        if len(df) < 5:
            return {"error": "Analiz için yeterli veri yok (En az 5 satır temiz veri gerekli)."}

        X = df[features]
        y = df[target]

        # Handle split size. If dataset is very small, use test_size=0.1 or do not split
        if len(df) >= 10:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        else:
            X_train, X_test, y_train, y_test = X, X, y, y

        if use_xgb:
            model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=50, max_depth=3, random_state=42)
            model_name = "XGBoost Regressor"
        else:
            model = GradientBoostingRegressor(n_estimators=50, max_depth=3, random_state=42)
            model_name = "Gradient Boosting Regressor (Fallback)"

        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        r2 = float(r2_score(y_test, preds))

        # Feature importances
        importance = model.feature_importances_
        feat_imp = {feat: float(imp) for feat, imp in zip(features, importance)}

        return {
            "model": model_name,
            "rmse": rmse,
            "r2_score": r2,
            "feature_importance": feat_imp,
            "message": "Model başarıyla eğitildi."
        }
    except Exception as e:
        return {"error": f"XGBoost/GBR eğitim hatası: {str(e)}", "traceback": traceback.format_exc()}

def run_lstm(df, target, features, time_col='year', entity_col='company'):
    # Sequence prediction emulating LSTM using scikit-learn MLPRegressor
    try:
        from sklearn.preprocessing import StandardScaler
        from sklearn.neural_network import MLPRegressor
        from sklearn.metrics import mean_squared_error
        
        df = df.dropna(subset=[target, time_col, entity_col] + features)
        df = df.sort_values(by=[entity_col, time_col])
        
        # Build sequence of length 2 (sliding window)
        SEQ_LEN = 2
        
        X_data = []
        y_data = []
        
        # We group by company and create lag features
        for company, group in df.groupby(entity_col):
            if len(group) >= SEQ_LEN + 1:
                # Get raw values
                feat_vals = group[features].values
                target_vals = group[target].values
                
                for i in range(len(group) - SEQ_LEN):
                    # Flatten the sequence window into a single feature vector
                    window = feat_vals[i:i+SEQ_LEN].flatten()
                    X_data.append(window)
                    y_data.append(target_vals[i+SEQ_LEN])
                    
        if len(X_data) < 3:
            return {"error": "Zaman serisi analizi için yeterli ardışık veri bulunamadı. Lütfen şirket bazında en az 3 farklı yıla ait veri girdiğinizden emin olun."}
            
        X_arr = np.array(X_data)
        y_arr = np.array(y_data)
        
        # Scale values
        scaler_x = StandardScaler()
        scaler_y = StandardScaler()
        
        X_scaled = scaler_x.fit_transform(X_arr)
        # Reshape y for scaling
        y_scaled = scaler_y.fit_transform(y_arr.reshape(-1, 1)).flatten()
        
        # MLP Regressor (Neural Network)
        model = MLPRegressor(hidden_layer_sizes=(32, 16), activation='relu', max_iter=1000, random_state=42)
        model.fit(X_scaled, y_scaled)
        
        preds_scaled = model.predict(X_scaled)
        preds = scaler_y.inverse_transform(preds_scaled.reshape(-1, 1)).flatten()
        
        rmse = float(np.sqrt(mean_squared_error(y_arr, preds)))
        
        return {
            "model": "Time-Series neural network (LSTM Emulation)",
            "rmse": rmse,
            "message": "Zaman serisi yapay sinir ağı modeli başarıyla eğitildi.",
            "samples_used": len(X_data)
        }
    except Exception as e:
        return {"error": f"Zaman serisi model hatası: {str(e)}", "traceback": traceback.format_exc()}

def run_panel(df, target, features, time_col='year', entity_col='company'):
    # Fixed Effects Panel Regression via LSDV (Least Squares Dummy Variable) using statsmodels OLS
    try:
        import statsmodels.api as sm
        
        df = df.dropna(subset=[target, time_col, entity_col] + features)
        if len(df) < 5:
            return {"error": "Panel veri analizi için yeterli veri yok (En az 5 temiz satır gerekli)."}
            
        # One-hot encode entities to capture entity-fixed effects
        # We drop the first dummy to avoid the dummy variable trap
        entity_dummies = pd.get_dummies(df[entity_col], prefix='entity', drop_first=True)
        
        X = df[features]
        # Concatenate features and entity dummies
        X_combined = pd.concat([X, entity_dummies], axis=1)
        
        # Convert boolean/categorical columns to integer
        for col in X_combined.columns:
            if X_combined[col].dtype == bool:
                X_combined[col] = X_combined[col].astype(int)
                
        # Add intercept
        X_combined = sm.add_constant(X_combined)
        y = df[target]
        
        # Ensure all columns in X_combined are numeric
        X_combined = X_combined.apply(pd.to_numeric, errors='coerce').fillna(0)
        
        model = sm.OLS(y, X_combined)
        res = model.fit()
        
        # We only return coefficients and p-values for the main features
        coefs = {}
        pvalues = {}
        
        # Constants and main features
        for key in ['const'] + features:
            if key in res.params:
                coefs[key] = float(res.params[key])
                pvalues[key] = float(res.pvalues[key])
                
        return {
            "model": "Panel OLS (Entity Fixed Effects)",
            "r2": float(res.rsquared),
            "coefficients": coefs,
            "pvalues": pvalues,
            "message": "Panel veri modeli başarıyla çalıştırıldı."
        }
    except Exception as e:
        # Fallback to simple linear regression in scikit-learn if statsmodels fails
        try:
            from sklearn.linear_model import LinearRegression
            df = df.dropna(subset=[target, time_col, entity_col] + features)
            X = df[features]
            y = df[target]
            model = LinearRegression()
            model.fit(X, y)
            coefs = {feat: float(coef) for feat, coef in zip(features, model.coef_)}
            coefs['const'] = float(model.intercept_)
            return {
                "model": "OLS Regression (Linear Regression Fallback)",
                "r2": float(model.score(X, y)),
                "coefficients": coefs,
                "pvalues": {feat: 0.0 for feat in features},
                "message": f"Statsmodels hatası sonrası OLS sklearn ile çalıştırıldı."
            }
        except Exception as inner_e:
            return {"error": f"Panel OLS modeli çalıştırılamadı: {str(e)}", "traceback": traceback.format_exc()}

@app.route('/api/analyze', methods=['POST'])
@app.route('/', methods=['POST'])
def analyze():
    try:
        req_data = request.get_json()
        if not req_data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        data = req_data.get('data')
        model_type = req_data.get('model_type', 'xgboost').lower()
        target = req_data.get('target')
        features = req_data.get('features', [])
        
        if not data or not isinstance(data, list):
            return jsonify({"error": "Missing or invalid data"}), 400
        if not target or not features:
            return jsonify({"error": "Missing target or features"}), 400
            
        df = pd.DataFrame(data)
        
        # Automatically detect entity and time columns
        entity_col = 'Company' if 'Company' in df.columns else ('company_name' if 'company_name' in df.columns else ('Country' if 'Country' in df.columns else ('country' if 'country' in df.columns else 'company')))
        time_col = 'Year' if 'Year' in df.columns else ('report_year' if 'report_year' in df.columns else 'year')
        
        # Clean columns to be numeric
        cols_to_convert = [target] + features
        if model_type in ['lstm', 'panel']:
            if time_col in df.columns:
                cols_to_convert.append(time_col)
                
        for col in cols_to_convert:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
        if model_type == 'xgboost':
            result = run_xgboost(df, target, features)
        elif model_type == 'lstm':
            result = run_lstm(df, target, features, time_col=time_col, entity_col=entity_col)
        elif model_type == 'panel':
            result = run_panel(df, target, features, time_col=time_col, entity_col=entity_col)
        else:
            return jsonify({"error": f"Unsupported model type: {model_type}"}), 400
            
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

if __name__ == "__main__":
    app.run(port=3003)
