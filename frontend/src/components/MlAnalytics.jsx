import { useState } from "react";

export default function MlAnalytics({
  API_URL,
  currentUser,
  fetchedData,
  n8nChecks,
  extractedData,
  indicators,
  selectedIndicators = []
}) {
  // ML States
  const [mlDataSource, setMlDataSource] = useState("extractor"); // 'extractor', 'n8n', 'macro'
  const [mlModelType, setMlModelType] = useState("xgboost");
  const [mlTarget, setMlTarget] = useState("GreenwashingRisk");
  const [mlFeatures, setMlFeatures] = useState("confidence, page_no");
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);

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

    setMlLoading(true);
    setMlError(null);
    setMlResult(null);

    try {
      const featuresArr = mlFeatures.split(",").map(s => s.trim()).filter(s => s);
      const defaultFeatures = mlDataSource === "extractor" 
        ? ["value"] 
        : (mlDataSource === "n8n" ? ["report_year"] : ["Year"]);
      
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
          features: featuresArr.length > 0 ? featuresArr : defaultFeatures
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
            onChange={(e) => {
              const val = e.target.value;
              setMlDataSource(val);
              if (val === "n8n") {
                setMlTarget("validation_score");
                setMlFeatures("report_year");
              } else if (val === "macro") {
                const firstInd = selectedIndicators.length > 0 
                  ? (indicators.find(i => i.code === selectedIndicators[0])?.name || "value")
                  : "value";
                setMlTarget(firstInd);
                const otherInds = selectedIndicators.slice(1).map(code => indicators.find(i => i.code === code)?.name).filter(n => n);
                setMlFeatures(otherInds.length > 0 ? otherInds.join(", ") : "Year");
              } else {
                setMlTarget("GreenwashingRisk");
                setMlFeatures("confidence, page_no");
              }
            }}
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
          <span className="label">Hedef Değişken (Örn: value)</span>
          <input 
            type="text" 
            className="input-field" 
            value={mlTarget} 
            onChange={(e) => setMlTarget(e.target.value)} 
            placeholder="Bağımlı değişken" 
          />
        </div>

        <div>
          <span className="label">Girdi Değişkenleri (Virgülle ayırın)</span>
          <input 
            type="text" 
            className="input-field" 
            value={mlFeatures} 
            onChange={(e) => setMlFeatures(e.target.value)} 
            placeholder="Örn: confidence, page_no" 
          />
        </div>

        <button className="btn btn-primary" onClick={handleRunML} disabled={mlLoading}>
          {mlLoading ? "Model Eğitiliyor..." : "Modeli Çalıştır"}
        </button>
      </aside>

      <section className="glass-card active-border">
        <h2>Analiz Sonuçları</h2>
        {mlLoading && <p>Python makine öğrenmesi kütüphaneleri arka planda çalıştırılıyor...</p>}
        
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
          <pre style={{ 
            background: "rgba(0,0,0,0.5)", 
            padding: "16px", 
            borderRadius: "8px", 
            color: "var(--primary)", 
            overflowX: "auto" 
          }}>
            {JSON.stringify(mlResult, null, 2)}
          </pre>
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
