from flask import Flask, request, send_file, jsonify
import pandas as pd
import pyreadstat
import os
import tempfile
import re

app = Flask(__name__)

def clean_variable_name(name, max_len=30):
    """
    Cleans column names to make them valid SPSS/STATA variable names:
    - Only alphanumeric and underscores
    - Starts with a letter
    - Length <= max_len
    """
    turkish_map = {
        'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c'
    }
    for tr_char, eng_char in turkish_map.items():
        name = name.replace(tr_char, eng_char)
        
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    clean = re.sub(r'_+', '_', clean)
    clean = clean.strip('_')
    
    if not clean or not clean[0].isalpha():
        clean = 'var_' + clean
        
    clean = clean[:max_len]
    return clean.lower()

@app.route('/api/export', methods=['POST'])
@app.route('/', methods=['POST'])
def export_data():
    try:
        req_data = request.get_json()
        if not req_data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        data = req_data.get('data')
        file_format = req_data.get('format', 'xlsx').lower()
        
        if not data or not isinstance(data, list):
            return jsonify({"error": "Missing or invalid data for export"}), 400
            
        df = pd.DataFrame(data)
        
        # Column renaming logic for SPSS/STATA
        original_cols = df.columns.tolist()
        cleaned_cols = []
        labels_dict = {}
        seen_names = set()
        
        for col in original_cols:
            clean = clean_variable_name(col)
                
            base_clean = clean
            counter = 1
            while clean in seen_names:
                suffix = f"_{counter}"
                clean = base_clean[:30 - len(suffix)] + suffix
                counter += 1
                
            seen_names.add(clean)
            cleaned_cols.append(clean)
            labels_dict[clean] = col
            
        df.columns = cleaned_cols
        
        for col in df.columns:
            if col not in ['country', 'code', 'country_name', 'country_code']:
                df[col] = pd.to_numeric(df[col], errors='ignore')
                
        temp_dir = tempfile.gettempdir()
        
        if file_format == 'xlsx':
            output_path = os.path.join(temp_dir, "export.xlsx")
            df.to_excel(output_path, index=False)
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            download_name = "sustainability_data.xlsx"
            
        elif file_format == 'spss':
            output_path = os.path.join(temp_dir, "export.sav")
            pyreadstat.write_sav(df, output_path, column_labels=labels_dict)
            mimetype = 'application/x-spss-sav'
            download_name = "sustainability_data.sav"
            
        elif file_format == 'stata':
            output_path = os.path.join(temp_dir, "export.dta")
            pyreadstat.write_dta(df, output_path, column_labels=labels_dict)
            mimetype = 'application/x-stata-dta'
            download_name = "sustainability_data.dta"
            
        else:
            return jsonify({"error": f"Unsupported format: {file_format}"}), 400
            
        return send_file(output_path, mimetype=mimetype, as_attachment=True, download_name=download_name)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=3002)
