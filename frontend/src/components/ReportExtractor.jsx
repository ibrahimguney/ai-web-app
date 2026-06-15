import { useState } from "react";
import { 
  Upload, 
  Sparkles, 
  RefreshCw, 
  Download, 
  AlertCircle,
  Percent,
  FileCheck,
  BarChart2
} from "lucide-react";

export default function ReportExtractor({ 
  API_URL, 
  currentUser, 
  extractedData, 
  setExtractedData 
}) {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [reportText, setReportText] = useState("");
  const [analyzerPrompt, setAnalyzerPrompt] = useState(`Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
Bulduğun göstergeleri şu JSON şemasında döndür. JSON dışında hiçbir şey yazma:
{
  "indicators": [
    {
      "company": "Şirket Adı",
      "year": 2024,
      "indicator": "Gösterge Adı (örn. Kapsam 1 Emisyonları)",
      "category": "Environmental | Social | Governance",
      "value": 12500,
      "unit": "ton CO2e",
      "evidence_sentence": "Metindeki ilgili cümle veya bağlam",
      "page_no": 12,
      "source_url": "Raporun kaynağı veya URL'si",
      "confidence": 95,
      "manual_check": false,
      "is_vague": false,
      "gri_tcfd_alignment": "GRI 305-1"
    }
  ]
}`);
  
  const [extracting, setExtracting] = useState(false);
  const [extractorError, setExtractorError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Run LLM Extractor
  const handleExtractIndicators = async () => {
    if (!uploadedFile && !reportText.trim()) {
      setExtractorError("Lütfen bir rapor yükleyin veya analiz edilecek metni yapıştırın.");
      return;
    }

    setExtracting(true);
    setExtractorError(null);
    setExtractedData([]);

    try {
      const formData = new FormData();
      if (uploadedFile) {
        formData.append("reportFile", uploadedFile);
      } else {
        formData.append("text", reportText);
      }
      formData.append("prompt", analyzerPrompt);

      const response = await fetch(`${API_URL}/api/extract`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorJson = await response.json();
        throw new Error(errorJson.error || "Yapay zeka analiz işlemi başarısız.");
      }

      const json = await response.json();
      if (json.data && Array.isArray(json.data)) {
        setExtractedData(json.data);
      } else {
        throw new Error("AI verileri beklenen formatta döndüremedi. Lütfen promptu kontrol edin.");
      }
    } catch (err) {
      console.error(err);
      setExtractorError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleExportExtracted = async (format) => {
    if (extractedData.length === 0) return;
    setExporting(true);
    try {
      const response = await fetch(`${API_URL}/api/export`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ data: extractedData, format })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Dışa aktarma başarısız.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      let ext = "xlsx";
      if (format === "spss") ext = "sav";
      if (format === "stata") ext = "dta";

      a.download = `extracted_sustainability_data_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Dışa aktarım sırasında bir hata oluştu: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Calculate Academic Metrics from Extracted Data Dynamically
  const totalExtracted = extractedData.length;
  const envCount = extractedData.filter(d => d.category?.toLowerCase().includes("env") || d.category?.toLowerCase().includes("çev")).length;
  const socCount = extractedData.filter(d => d.category?.toLowerCase().includes("soc") || d.category?.toLowerCase().includes("sos")).length;
  const govCount = totalExtracted - (envCount + socCount);

  const numericEvidenceCount = extractedData.filter(d => d.value !== null && d.value !== undefined && !isNaN(Number(d.value))).length;
  const numericEvidenceRate = totalExtracted > 0 ? Math.round((numericEvidenceCount / totalExtracted) * 100) : 0;

  const vagueWords = ["hedeflemektedir", "planlanmaktadır", "büyük ölçüde", "yaklaşık", "beklenmektedir", "amaçlanmaktadır", "aim", "plan", "approximate"];
  
  // Use context or evidence_sentence for scanning vague words
  const vagueCount = extractedData.filter(d => {
    const textToCheck = (d.evidence_sentence || d.context || "");
    return vagueWords.some(w => textToCheck.toLowerCase().includes(w));
  }).length;
  const vagueExpressionRate = totalExtracted > 0 ? Math.round((vagueCount / totalExtracted) * 100) : 0;

  const griUyumSkoru = totalExtracted > 0 ? Math.min(100, Math.round((envCount * 1.5 + socCount * 1.2 + govCount * 1.0) * 10)) : 0;
  const tcfdUyumSkoru = totalExtracted > 0 ? Math.min(100, Math.round((envCount * 2.2 + govCount * 0.8) * 8)) : 0;

  if (currentUser.user.role === "viewer") {
    return (
      <div className="flex-center glass-card active-border" style={{ height: "450px", flexDirection: "column", gap: "20px", padding: "40px", textAlign: "center" }}>
        <Sparkles size={64} style={{ color: "var(--secondary)", opacity: 0.7 }} />
        <h2>Yapay Zeka Analiz Modülü Kilitli</h2>
        <p style={{ maxWidth: "550px", color: "var(--text-secondary)", fontSize: "1rem" }}>
          Sürdürülebilirlik ve ESG raporlarından veri ayıklayan Yapay Zeka Rapor Analizcisi özelliği, <strong>Viewer (Gözlemci)</strong> hesapları için sınırlandırılmıştır.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* Control Sidebar */}
      <aside className="glass-card vertical-gap-lg">
        <div>
          <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Kurum Raporu Yükleme</h3>
          <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
        </div>

        <div>
          <span className="label">1. Sürdürülebilirlik Raporu (PDF veya TXT)</span>
          <div 
            style={{ 
              border: "2px dashed var(--border-color)", 
              borderRadius: "var(--radius-lg)", 
              padding: "24px 16px", 
              textAlign: "center", 
              cursor: "pointer", 
              background: uploadedFile ? "rgba(16, 185, 129, 0.05)" : "transparent",
              transition: "var(--transition)",
              borderColor: uploadedFile ? "var(--primary)" : "var(--border-color)"
            }}
            onClick={() => document.getElementById("file-input").click()}
          >
            <Upload size={32} style={{ color: uploadedFile ? "var(--primary)" : "var(--text-muted)", marginBottom: "8px" }} />
            {uploadedFile ? (
              <div>
                <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis" }}>{uploadedFile.name}</p>
                <p style={{ color: "var(--primary)", fontSize: "0.75rem", marginTop: "4px" }}>Yüklendi ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 600 }}>Tıklayıp Rapor Dosyası Seçin</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "4px" }}>PDF veya TXT dosyası kabul edilir</p>
              </div>
            )}
            <input 
              type="file" 
              id="file-input" 
              style={{ display: "none" }} 
              accept=".pdf,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadedFile(e.target.files[0]);
                  setReportText("");
                }
              }}
            />
          </div>
          {uploadedFile && (
            <button 
              className="btn btn-danger" 
              style={{ padding: "4px 8px", fontSize: "0.75rem", marginTop: "8px", width: "100%" }}
              onClick={(e) => {
                e.stopPropagation();
                setUploadedFile(null);
              }}
            >
              Dosyayı Kaldır
            </button>
          )}
        </div>

        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>VEYA</div>

        <div>
          <span className="label">Metin Yapıştırın</span>
          <textarea 
            placeholder="Kurum raporunun ilgili veri sayfalarını doğrudan buraya yapıştırabilirsiniz..."
            className="input-field"
            style={{ minHeight: "120px", resize: "vertical", fontSize: "0.85rem" }}
            value={reportText}
            onChange={(e) => {
              setReportText(e.target.value);
              if (e.target.value) setUploadedFile(null);
            }}
            disabled={!!uploadedFile}
          />
        </div>

        <div>
          <span className="label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>AI Prompt Şablonu</span>
            <span style={{ color: "var(--primary)", cursor: "pointer", textTransform: "none" }} onClick={() => setAnalyzerPrompt(`Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
Bulduğun göstergeleri şu JSON şemasında döndür. JSON dışında hiçbir şey yazma:
{
  "indicators": [
    {
      "company": "Şirket Adı",
      "year": 2024,
      "indicator": "Gösterge Adı (örn. Kapsam 1 Emisyonları)",
      "category": "Environmental | Social | Governance",
      "value": 12500,
      "unit": "ton CO2e",
      "evidence_sentence": "Metindeki ilgili cümle veya bağlam",
      "page_no": 12,
      "source_url": "Raporun kaynağı veya URL'si",
      "confidence": 95,
      "manual_check": false,
      "is_vague": false,
      "gri_tcfd_alignment": "GRI 305-1"
    }
  ]
}`)}>Sıfırla</span>
          </span>
          <textarea 
            className="input-field"
            style={{ minHeight: "150px", fontFamily: "monospace", fontSize: "0.75rem", resize: "vertical" }}
            value={analyzerPrompt}
            onChange={(e) => setAnalyzerPrompt(e.target.value)}
          />
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: "100%" }}
          onClick={handleExtractIndicators}
          disabled={extracting}
        >
          {extracting ? (
            <>
              <RefreshCw className="spinner" />
              AI Raporu Okuyor...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Verileri Yapay Zeka ile Ayıkla
            </>
          )}
        </button>
      </aside>

      {/* Results Section */}
      <section className="glass-card active-border">
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Ayıklanan Göstergeler (LLM Sonuçları)</h2>
            <p>Yapay zeka tarafından sürdürülebilirlik raporundan tespit edilen ESG göstergeleri ve değerleri.</p>
          </div>

          {extractedData.length > 0 && (
            <div className="flex-gap-sm">
              <button className="btn btn-secondary" onClick={() => handleExportExtracted("xlsx")} disabled={exporting}>
                <Download size={16} /> Excel (.xlsx)
              </button>
              <button className="btn btn-secondary" onClick={() => handleExportExtracted("spss")} disabled={exporting}>
                <Download size={16} /> SPSS (.sav)
              </button>
              <button className="btn btn-secondary" onClick={() => handleExportExtracted("stata")} disabled={exporting}>
                <Download size={16} /> STATA (.dta)
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Academic Metrics Panel */}
        {extractedData.length > 0 && !extracting && (
          <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Top Row: Skor Kartları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              
              <div className="glass-card" style={{ padding: "14px", border: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.01)" }}>
                <div className="flex-between" style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>SAYISAL KANIT ORANI</span>
                  <Percent size={16} style={{ color: "var(--primary)" }} />
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>%{numericEvidenceRate}</div>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Ayıklanan verilerdeki doğrulanabilir sayısal kanıt sıklığı derecesi.
                </p>
              </div>

              <div className="glass-card" style={{ padding: "14px", border: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.01)" }}>
                <div className="flex-between" style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>BELİRSİZ İFADE ORANI</span>
                  <FileCheck size={16} style={{ color: "var(--secondary)" }} />
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: vagueExpressionRate > 20 ? "rgba(239, 68, 68, 0.9)" : "var(--text-primary)" }}>
                  %{vagueExpressionRate}
                </div>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Metin bağlamında spekülatif veya "Greenwashing" riski taşıyan kelime sıklığı.
                </p>
              </div>

              <div className="glass-card" style={{ padding: "14px", border: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.01)" }}>
                <div className="flex-between" style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>E-S-G DAĞILIM DENGESİ</span>
                  <BarChart2 size={16} style={{ color: "var(--text-muted)" }} />
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "8px" }}>
                  <span style={{ color: "var(--primary)" }}>Ç: {envCount}</span> | <span style={{ color: "rgba(59, 130, 246, 1)" }}>S: {socCount}</span> | <span style={{ color: "rgba(245, 158, 11, 1)" }}>Y: {govCount}</span>
                </div>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "8px" }}>
                  Çevresel, Sosyal ve Yönetişim başlıklarının rapor genelindeki yoğunluk dağılımı.
                </p>
              </div>

            </div>

            {/* Bottom Row: GRI & TCFD Progress Bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              
              <div className="glass-card" style={{ padding: "16px", border: "1px solid var(--border-color)" }}>
                <div className="flex-between" style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>GRI Standartları Uyum Endeksi (Prototip)</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>%{griUyumSkoru}</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${griUyumSkoru}%`, height: "100%", background: "linear-gradient(90deg, var(--primary), rgba(16, 185, 129, 0.5))", borderRadius: "4px", transition: "width 1s ease-in-out" }}></div>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                  Rapor metninin GRI Küresel Sürdürülebilirlik Göstergeleri ile örtüşme ağırlığı.
                </span>
              </div>

              <div className="glass-card" style={{ padding: "16px", border: "1px solid var(--border-color)" }}>
                <div className="flex-between" style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>TCFD İklim Riskleri Matrisi Uyumu</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(59, 130, 246, 1)" }}>%{tcfdUyumSkoru}</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${tcfdUyumSkoru}%`, height: "100%", background: "linear-gradient(90deg, rgba(59, 130, 246, 1), rgba(147, 197, 253, 0.5))", borderRadius: "4px", transition: "width 1s ease-in-out" }}></div>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                  Finansal İklim Beyanları (Task Force on Climate-related Financial Disclosures) uyum tahmini.
                </span>
              </div>

            </div>

          </div>
        )}

        {/* Extraction Content */}
        {extracting ? (
          <div className="flex-center" style={{ height: "400px", flexDirection: "column", gap: "16px" }}>
            <RefreshCw size={48} className="spinner" style={{ color: "var(--primary)" }} />
            <p style={{ color: "var(--text-secondary)", maxWidth: "400px", textAlign: "center" }}>
              Rapor analiz ediliyor. PDF okuma ve yapay zeka gösterge ayıklama süreçleri yürütülüyor...
            </p>
          </div>
        ) : extractorError ? (
          <div className="flex-center" style={{ height: "400px", flexDirection: "column", gap: "12px", border: "1px dashed var(--danger)", borderRadius: "var(--radius-lg)" }}>
            <AlertCircle size={40} style={{ color: "var(--danger)" }} />
            <p style={{ color: "var(--danger)", fontWeight: 600 }}>Analiz Başarısız Oldu</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", maxWidth: "450px", textAlign: "center" }}>{extractorError}</p>
          </div>
        ) : extractedData.length > 0 ? (
          <div>
            <div className="table-container" style={{ maxHeight: "400px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Gösterge Adı</th>
                    <th>Değer</th>
                    <th>Birim</th>
                    <th>Yıl</th>
                    <th style={{ width: "35%" }}>Bağlam / Metin İçi Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedData.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`badge ${
                          row.category?.toLowerCase().startsWith("env") || row.category?.toLowerCase().startsWith("çev")
                            ? "badge-env" 
                            : row.category?.toLowerCase().startsWith("soc") || row.category?.toLowerCase().startsWith("sos")
                              ? "badge-soc" 
                              : "badge-gov"
                        }`}>
                          {row.category || "General"}
                        </span>
                      </td>
                      <td>{row.indicator}</td>
                      <td style={{ fontWeight: 600 }}>{row.value !== undefined && row.value !== null ? row.value : "-"}</td>
                      <td>{row.unit || "-"}</td>
                      <td>{row.year || "-"}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{row.evidence_sentence || row.context || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-center" style={{ height: "200px" }}>
             <p style={{ color: "var(--text-muted)" }}>Henüz çıkarılmış veri yok.</p>
          </div>
        )}
      </section>
    </div>
  );
}
