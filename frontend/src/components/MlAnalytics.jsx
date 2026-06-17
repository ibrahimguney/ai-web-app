import { useState, useEffect } from "react";

export default function MlAnalytics({
  API_URL,
  currentUser,
  fetchedData = [],
  n8nChecks = [],
  extractedData = [],
  indicators = [],
  selectedIndicators = []
}) {
  // ML States
  const [mlDataSource, setMlDataSource] = useState("extractor"); // 'extractor', 'n8n', 'macro'
  const [mlModelType, setMlModelType] = useState("xgboost");
  const [mlTarget, setMlTarget] = useState("confidence");
  const [selectedFeatures, setSelectedFeatures] = useState(["page_no"]);
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Dynamic column extraction based on active dataset
  const getAvailableColumns = () => {
    let sourceData = [];
    if (mlDataSource === "extractor") {
      sourceData = extractedData;
    } else if (mlDataSource === "n8n") {
      sourceData = n8nChecks;
    } else if (mlDataSource === "macro") {
      sourceData = fetchedData;
    }

    if (sourceData && sourceData.length > 0) {
      const allKeys = new Set();
      sourceData.forEach(row => {
        Object.keys(row).forEach(k => allKeys.add(k));
      });
      return Array.from(allKeys);
    }

    // Default fallbacks if no data is loaded yet
    if (mlDataSource === "extractor") {
      return ["company", "year", "indicator", "category", "value", "unit", "confidence", "page_no", "manual_check", "is_vague", "gri_tcfd_alignment"];
    } else if (mlDataSource === "n8n") {
      return ["company_name", "ticker", "report_year", "status_code", "content_type", "is_pdf", "year_in_url", "validation_score", "validation_status", "error_message"];
    } else {
      // Fallback for macro
      if (selectedIndicators && selectedIndicators.length > 0) {
        return ["Country", "Code", "Year", ...selectedIndicators];
      }
      return ["Country", "Code", "Year"];
    }
  };

  const availableCols = getAvailableColumns();

  const EXCLUDED_COLS = [
    "Country", "Code", "Year", "country", "code", "year",
    "company", "company_name", "ticker", "report_year",
    "indicator", "category", "unit", "evidence_sentence", "source_url",
    "manual_check", "is_vague", "gri_tcfd_alignment", "context",
    "validation_status", "error_message", "content_type", "id", "created_at"
  ];

  const filteredCols = availableCols.filter(col => !EXCLUDED_COLS.includes(col));

  // Watch for data source or data changes to keep target and features synchronized
  useEffect(() => {
    if (filteredCols.length > 0) {
      let nextTarget = mlTarget;
      // If target is not in the list of filtered columns, set it to a sensible fallback
      if (!filteredCols.includes(mlTarget)) {
        if (mlDataSource === "extractor") {
          nextTarget = filteredCols.includes("value") ? "value" : (filteredCols.includes("confidence") ? "confidence" : filteredCols[0]);
        } else if (mlDataSource === "n8n") {
          nextTarget = filteredCols.includes("validation_score") ? "validation_score" : filteredCols[0];
        } else if (mlDataSource === "macro") {
          nextTarget = filteredCols[0];
        } else {
          nextTarget = filteredCols[0];
        }
        setMlTarget(nextTarget);
      }

      // Filter selected features to only keep ones that are in filtered columns and not equal to target
      let validFeatures = selectedFeatures.filter(f => filteredCols.includes(f) && f !== nextTarget);
      if (validFeatures.length === 0) {
        // Fallback: select first column that isn't target
        const fallback = filteredCols.filter(c => c !== nextTarget);
        validFeatures = fallback.length > 0 ? [fallback[0]] : [];
        setSelectedFeatures(validFeatures);
      } else {
        setSelectedFeatures(validFeatures);
      }
    }
  }, [mlDataSource, fetchedData, extractedData, n8nChecks, mlTarget]);

  // Handle source switch from dropdown
  const handleSourceChange = (val) => {
    setMlDataSource(val);
    setMlResult(null);
    setMlError(null);
    
    // Set sensible defaults instantly
    if (val === "extractor") {
      setMlTarget("confidence");
      setSelectedFeatures(["page_no"]);
    } else if (val === "n8n") {
      setMlTarget("validation_score");
      setSelectedFeatures(["status_code"]);
    } else if (val === "macro") {
      const cols = fetchedData.length > 0 ? Object.keys(fetchedData[0]) : ["Country", "Code", "Year", ...selectedIndicators];
      const indCols = cols.filter(k => !EXCLUDED_COLS.includes(k));
      if (indCols.length > 0) {
        setMlTarget(indCols[0]);
        setSelectedFeatures(indCols.slice(1).length > 0 ? [indCols[1]] : []);
      } else {
        setMlTarget("");
        setSelectedFeatures([]);
      }
    }
  };

  // Run ML Analytics
  const handleRunML = async () => {
    let sourceData = [];
    if (mlDataSource === "extractor") {
      if (!extractedData || extractedData.length === 0) {
        setMlError("Lütfen önce AI Rapor Analizcisi ile veri ayıklayın.");
        return;
      }
      sourceData = extractedData;
    } else if (mlDataSource === "n8n") {
      if (!n8nChecks || n8nChecks.length === 0) {
        setMlError("Lütfen önce n8n Rapor Takipçisi ile internetten veri çekilmesini sağlayın veya veritabanını kontrol edin.");
        return;
      }
      sourceData = n8nChecks;
    } else if (mlDataSource === "macro") {
      if (!fetchedData || fetchedData.length === 0) {
        setMlError("Lütfen önce Makro Veri İndirici sekmesinden veri çekin ve önizleyin.");
        return;
      }
      sourceData = fetchedData;
    }

    if (selectedFeatures.length === 0) {
      setMlError("Lütfen en az bir adet girdi değişkeni (bağımsız değişken) seçin.");
      return;
    }

    setMlLoading(true);
    setMlError(null);
    setMlResult(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          data: sourceData,
          model_type: mlModelType,
          target: mlTarget,
          features: selectedFeatures
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.details ? `${json.error}\nDetay:\n${json.details}` : (json.error || "Makine Öğrenmesi modeli çalıştırılamadı."));
      }

      setMlResult(json);
    } catch (err) {
      console.error(err);
      setMlError(err.message);
    } finally {
      setMlLoading(false);
    }
  };

  // Export Report to Word/TXT
  const exportReportTxt = () => {
    if (!mlResult) return;
    
    let content = `==================================================\n`;
    content += `         SUSTAINDATA ANALİZ RAPORU\n`;
    content += `==================================================\n`;
    content += `Tarih: ${new Date().toLocaleString("tr-TR")}\n`;
    content += `Model Türü: ${mlResult.model || "Bilinmiyor"}\n`;
    content += `Veri Kaynağı: ${
      mlDataSource === "extractor" 
        ? "AI Rapor Analizcisi Verileri" 
        : mlDataSource === "n8n" 
          ? "n8n Web Tarayıcısı Verileri" 
          : "Makro Veri İndiricisi Verileri"
    }\n`;
    content += `Hedef Değişken (Y): ${mlTarget}\n`;
    content += `Girdi Değişkenleri (X): ${selectedFeatures.join(", ")}\n`;
    content += `--------------------------------------------------\n`;
    content += `MODEL PERFORMANS METRİKLERİ:\n`;
    const r2Val = mlResult.r2_score !== undefined ? mlResult.r2_score : (mlResult.r2 !== undefined ? mlResult.r2 : null);
    content += `Açıklayıcılık Oranı (R²): ${r2Val !== null ? (r2Val * 100).toFixed(2) + "%" : "N/A"}\n`;
    content += `Hata Değeri (RMSE): ${mlResult.rmse !== undefined ? mlResult.rmse.toFixed(4) : "N/A"}\n`;
    if (mlResult.samples_used !== undefined) {
      content += `Kullanılan Örnek Sayısı: ${mlResult.samples_used}\n`;
    }
    content += `--------------------------------------------------\n`;
    
    if (mlResult.feature_importance) {
      content += `DEĞİŞKEN ÖNEM DERECELERİ (FEATURE IMPORTANCE):\n`;
      Object.entries(mlResult.feature_importance).forEach(([feat, imp]) => {
        content += `- ${feat}: ${(imp * 100).toFixed(2)}%\n`;
      });
    } else if (mlResult.coefficients) {
      content += `DEĞİŞKEN KATSAYILARI VE ANLAMLILIKLARI:\n`;
      content += `Değişken Adı | Katsayı | P-Değeri | Yorum\n`;
      content += `------------|---------|----------|------\n`;
      Object.entries(mlResult.coefficients).forEach(([feat, coef]) => {
        const pval = mlResult.pvalues?.[feat];
        const pvalStr = pval !== undefined ? pval.toFixed(4) : "N/A";
        const comment = pval !== undefined && pval < 0.05 ? "İstatistiksel Olarak Anlamlı" : "Anlamsız";
        content += `${feat} | ${coef.toFixed(4)} | ${pvalStr} | ${comment}\n`;
      });
    }
    
    content += `==================================================\n`;
    content += `Rapor sonu.\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sustaindata_ml_analiz_raporu_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Export report parameters / importances to Excel (XLSX)
  const exportReportExcel = async () => {
    if (!mlResult) return;
    setExporting(true);
    try {
      const r2Val = mlResult.r2_score !== undefined ? mlResult.r2_score : (mlResult.r2 !== undefined ? mlResult.r2 : null);
      
      const summaryRows = [
        { "Parametre / Değişken": "Model Adı", "Değer / Katsayı": mlResult.model, "P-Değeri (Anlamlılık)": "N/A" },
        { "Parametre / Değişken": "R2 Açıklayıcılık Oranı", "Değer / Katsayı": r2Val !== null ? r2Val.toFixed(4) : "N/A", "P-Değeri (Anlamlılık)": "N/A" },
        { "Parametre / Değişken": "Hata Oranı (RMSE)", "Değer / Katsayı": mlResult.rmse !== undefined ? mlResult.rmse.toFixed(4) : "N/A", "P-Değeri (Anlamlılık)": "N/A" }
      ];

      if (mlResult.samples_used !== undefined) {
        summaryRows.push({ "Parametre / Değişken": "Örnek Sayısı", "Değer / Katsayı": mlResult.samples_used.toString(), "P-Değeri (Anlamlılık)": "N/A" });
      }

      // Add blank row
      summaryRows.push({ "Parametre / Değişken": "", "Değer / Katsayı": "", "P-Değeri (Anlamlılık)": "" });
      summaryRows.push({ "Parametre / Değişken": "DEĞİŞKEN ANALİZİ DETAYLARI", "Değer / Katsayı": "---", "P-Değeri (Anlamlılık)": "---" });

      if (mlResult.feature_importance) {
        Object.entries(mlResult.feature_importance).forEach(([feat, imp]) => {
          summaryRows.push({
            "Parametre / Değişken": feat,
            "Değer / Katsayı": `${(imp * 100).toFixed(2)}%`,
            "P-Değeri (Anlamlılık)": "Gereksiz (XGBoost)"
          });
        });
      } else if (mlResult.coefficients) {
        Object.entries(mlResult.coefficients).forEach(([feat, coef]) => {
          const pval = mlResult.pvalues?.[feat];
          summaryRows.push({
            "Parametre / Değişken": feat,
            "Değer / Katsayı": coef.toFixed(4),
            "P-Değeri (Anlamlılık)": pval !== undefined ? pval.toFixed(4) : "N/A"
          });
        });
      }

      const response = await fetch(`${API_URL}/api/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ data: summaryRows, format: "xlsx" })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Excel indirme başarısız.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sustaindata_ml_model_ozeti_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Excel aktarım hatası: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dashboard-grid">
      <aside className="glass-card vertical-gap-lg">
        <h3 style={{ color: "var(--text-primary)" }}>İleri Düzey Veri Analitiği (ML)</h3>
        <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
        
        <div>
          <span className="label">Veri Kaynağı</span>
          <select 
            className="input-field" 
            value={mlDataSource} 
            onChange={(e) => handleSourceChange(e.target.value)}
          >
            <option value="extractor">AI Rapor Analizcisi Verileri (PDF/Metin)</option>
            <option value="n8n">n8n Web Tarayıcısı Verileri (İnternet)</option>
            <option value="macro">Makro Veri İndiricisi Verileri (Dünya Bankası)</option>
          </select>
        </div>

        <div>
          <span className="label">Model Tipi</span>
          <select className="input-field" value={mlModelType} onChange={(e) => setMlModelType(e.target.value)}>
            <option value="xgboost">XGBoost Sınıflandırma/Regresyon</option>
            <option value="lstm">LSTM (Zaman Serisi)</option>
            <option value="panel">Panel Veri Analizi</option>
          </select>
        </div>

        <div>
          <span className="label">Hedef Değişken (Bağımlı Değişken - Y)</span>
          <select 
            className="input-field" 
            value={mlTarget} 
            onChange={(e) => setMlTarget(e.target.value)}
          >
            {filteredCols.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Girdi Değişkenleri (Bağımsız Değişkenler - X)</span>
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "8px", 
            maxHeight: "150px", 
            overflowY: "auto", 
            border: "1px solid var(--border-color)", 
            padding: "10px", 
            borderRadius: "6px", 
            background: "rgba(0,0,0,0.2)" 
          }}>
            {filteredCols.filter(col => col !== mlTarget).length > 0 ? (
              filteredCols
                .filter(col => col !== mlTarget) // Target cannot be a feature itself
                .map(col => (
                  <label key={col} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px", 
                    color: "var(--text-secondary)", 
                    fontSize: "0.85rem", 
                    cursor: "pointer" 
                  }}>
                    <input 
                       type="checkbox" 
                       checked={selectedFeatures.includes(col)}
                       onChange={(e) => {
                         if (e.target.checked) {
                           setSelectedFeatures([...selectedFeatures, col]);
                         } else {
                           setSelectedFeatures(selectedFeatures.filter(f => f !== col));
                         }
                       }}
                    />
                    {col}
                  </label>
                ))
            ) : (
              <div style={{ color: "var(--warning)", fontSize: "0.75rem", padding: "4px 0", lineHeight: "1.3" }}>
                ⚠️ Seçilebilir girdi değişkeni bulunamadı. Lütfen "Makro Veri İndirici" sekmesinden en az iki adet gösterge çekildiğinden emin olun.
              </div>
            )}
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleRunML} disabled={mlLoading}>
          {mlLoading ? "Model Eğitiliyor..." : "Modeli Çalıştır"}
        </button>
      </aside>

      <section className="glass-card active-border" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="flex-between">
          <h2>Analiz Sonuçları</h2>
          {mlResult && !mlLoading && (
            <div className="flex-gap-sm">
              <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.85rem", display: "flex", gap: "4px", alignItems: "center" }} onClick={exportReportTxt} disabled={exporting}>
                Raporu İndir (Word/TXT)
              </button>
              <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.85rem", display: "flex", gap: "4px", alignItems: "center" }} onClick={exportReportExcel} disabled={exporting}>
                Excel'e Aktar (XLSX)
              </button>
            </div>
          )}
        </div>
        
        <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", margin: "0" }} />

        {mlLoading && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ color: "var(--primary)", fontWeight: "bold" }}>Python makine öğrenmesi algoritmaları çalıştırılıyor...</p>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Model eğitiliyor, hata metrikleri ve katsayılar hesaplanıyor.</span>
          </div>
        )}
        
        {mlError && (
          <pre style={{ 
            color: "var(--danger)", 
            background: "rgba(239, 68, 68, 0.05)", 
            padding: "12px", 
            borderRadius: "8px", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            whiteSpace: "pre-wrap", 
            fontFamily: "monospace", 
            fontSize: "0.85rem" 
          }}>
            Hata: {mlError}
          </pre>
        )}

        {mlResult && !mlLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Seçilen Model</div>
                <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: "var(--primary)", marginTop: "4px" }}>{mlResult.model || "Bilinmiyor"}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Açıklayıcılık Oranı (R²)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--success)", marginTop: "4px" }}>
                  {r2ValForCard(mlResult)}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Hata Değeri (RMSE)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--warning)", marginTop: "4px" }}>
                  {mlResult.rmse !== undefined ? mlResult.rmse.toFixed(4) : "N/A"}
                </div>
              </div>
              {mlResult.samples_used !== undefined && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Örnek Sayısı</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--text-primary)", marginTop: "4px" }}>{mlResult.samples_used}</div>
                </div>
              )}
            </div>

            {/* Model Message */}
            {mlResult.message && (
              <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "10px 14px", borderRadius: "6px", fontSize: "0.85rem", color: "var(--success)" }}>
                {mlResult.message}
              </div>
            )}

            {/* Variable Importance / Coefficients Table */}
            <div>
              <h3 style={{ fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "8px" }}>
                {mlResult.feature_importance ? "Değişken Etkileri / Önem Dereceleri (XGBoost)" : "Katsayılar ve İstatistiki Anlamlılık (OLS)"}
              </h3>
              <div className="table-container" style={{ border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                <table className="data-table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Değişken Adı</th>
                      {mlResult.feature_importance ? (
                        <th>Önem Derecesi</th>
                      ) : (
                        <>
                          <th>Katsayı (Coefficient)</th>
                          <th>P-Değeri (Significance)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mlResult.feature_importance && Object.entries(mlResult.feature_importance).map(([feat, imp]) => (
                      <tr key={feat}>
                        <td style={{ fontWeight: 600 }}>{feat}</td>
                        <td style={{ color: "var(--primary)", fontWeight: 700 }}>{(imp * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                    {mlResult.coefficients && Object.entries(mlResult.coefficients).map(([feat, coef]) => {
                      const pval = mlResult.pvalues?.[feat];
                      const isSignificant = pval !== undefined && pval < 0.05;
                      return (
                        <tr key={feat}>
                          <td style={{ fontWeight: 600 }}>{feat}</td>
                          <td style={{ color: coef >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                            {coef >= 0 ? "+" : ""}{coef.toFixed(4)}
                          </td>
                          <td>
                            {pval !== undefined ? (
                              <span style={{ 
                                padding: "2px 6px", 
                                borderRadius: "4px", 
                                fontSize: "0.75rem",
                                background: isSignificant ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.05)",
                                color: isSignificant ? "var(--success)" : "var(--text-secondary)",
                                fontWeight: isSignificant ? 700 : 500
                              }}>
                                {pval.toFixed(4)} {isSignificant ? "(Anlamlı * )" : "(Anlamsız)"}
                              </span>
                            ) : "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Collapsible raw JSON */}
            <details style={{ marginTop: "10px", cursor: "pointer" }}>
              <summary style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ham JSON Çıktısını Göster</summary>
              <pre style={{ 
                background: "rgba(0,0,0,0.5)", 
                padding: "16px", 
                borderRadius: "8px", 
                color: "var(--primary)", 
                overflowX: "auto",
                marginTop: "8px",
                fontSize: "0.8rem"
              }}>
                {JSON.stringify(mlResult, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {!mlLoading && !mlResult && !mlError && (
          <p style={{ color: "var(--text-muted)" }}>
            Modeli sol taraftaki panelden ayarlayıp çalıştırabilirsiniz.
          </p>
        )}
      </section>
    </div>
  );
}

// Helper to extract R2 string for the card
function r2ValForCard(mlResult) {
  const r2Val = mlResult.r2_score !== undefined ? mlResult.r2_score : (mlResult.r2 !== undefined ? mlResult.r2 : null);
  if (r2Val === null) return "N/A";
  return `${(r2Val * 100).toFixed(2)}%`;
}
