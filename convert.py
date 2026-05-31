import sys
import os
import json
import re
import pandas as pd
import pyreadstat

def clean_variable_name(name, max_len=30):
    """
    Cleans column names to make them valid SPSS/STATA variable names:
    - Only alphanumeric and underscores
    - Starts with a letter
    - Length <= max_len (Stata limit is 32)
    """
    # Replace Turkish characters with English equivalents
    turkish_map = {
        'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c'
    }
    for tr_char, eng_char in turkish_map.items():
        name = name.replace(tr_char, eng_char)
        
    # Replace non-alphanumeric with underscore
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # Collapse multiple underscores
    clean = re.sub(r'_+', '_', clean)
    # Strip leading/trailing underscores
    clean = clean.strip('_')
    
    # Ensure it starts with a letter
    if not clean or not clean[0].isalpha():
        clean = 'var_' + clean
        
    # Truncate
    clean = clean[:max_len]
    return clean.lower()

def main():
    if len(sys.argv) < 4:
        print("Usage: python convert.py <input_json_path> <output_file_path> <format>")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    file_format = sys.argv[3].lower()
    
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} does not exist.")
        sys.exit(1)
        
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if not data:
            print("Error: Empty data source.")
            sys.exit(1)
            
        df = pd.DataFrame(data)
        
        # We need to map original column names to clean variable names for SPSS/STATA
        original_cols = df.columns.tolist()
        cleaned_cols = []
        labels_dict = {}
        seen_names = set()
        
        for col in original_cols:
            if col in ['Country', 'Code', 'Year', 'Country Name', 'Country Code', 'country_name', 'country_code', 'year']:
                # Keep standard identifiers relatively simple
                clean = clean_variable_name(col)
            else:
                clean = clean_variable_name(col)
                
            # Handle duplicates
            base_clean = clean
            counter = 1
            while clean in seen_names:
                suffix = f"_{counter}"
                clean = base_clean[:30 - len(suffix)] + suffix
                counter += 1
                
            seen_names.add(clean)
            cleaned_cols.append(clean)
            labels_dict[clean] = col  # The label is the original indicator name
            
        # Rename columns in dataframe
        df.columns = cleaned_cols
        
        # Ensure proper data types (convert numeric strings to float, etc.)
        for col in df.columns:
            if col not in ['country', 'code', 'country_name', 'country_code']:
                df[col] = pd.to_numeric(df[col], errors='ignore')
                
        # Generate the output files
        if file_format == 'spss':
            # write_sav requires dictionary of column labels
            pyreadstat.write_sav(df, output_path, column_labels=labels_dict)
            print(f"Successfully wrote SPSS file to {output_path}")
            
        elif file_format == 'stata':
            # Stata also supports variable labels, version default is 15 (Stata 15)
            pyreadstat.write_dta(df, output_path, column_labels=labels_dict)
            print(f"Successfully wrote STATA file to {output_path}")
            
        else:
            print(f"Error: Unknown format {file_format}")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error occurred during conversion: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
