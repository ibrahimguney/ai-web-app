import React, { useState, useEffect } from "react";
import { 
  Download, 
  Upload, 
  FileText, 
  Globe, 
  Calendar, 
  ChevronDown, 
  Check, 
  X, 
  Sparkles, 
  RefreshCw, 
  Table, 
  Settings, 
  HelpCircle, 
  Layers, 
  AlertCircle,
  Search,
  Filter,
  ArrowRight
} from "lucide-react";

// Predefined fallback countries list in case World Bank API is slow
const COMMON_COUNTRIES = [
  { code: "TUR", name: "Türkiye" },
  { code: "USA", name: "Amerika Birleşik Devletleri" },
  { code: "DEU", name: "Almanya" },
  { code: "GBR", name: "İngiltere" },
  { code: "FRA", name: "Fransa" },
  { code: "CHN", name: "Çin" },
  { code: "IND", name: "Hindistan" },
  { code: "BRA", name: "Brezilya" },
  { code: "JPN", name: "Japonya" },
  { code: "ITA", name: "İtalya" },
  { code: "CAN", name: "Kanada" },
  { code: "RUS", name: "Rusya" },
  { code: "ESP", name: "İspanya" },
  { code: "AUS", name: "Avustralya" },
  { code: "NLD", name: "Hollanda" },
  { code: "SWE", name: "İsveç" },
  { code: "NOR", name: "Norveç" },
  { code: "CHE", name: "İsviçre" },
  { code: "ZAF", name: "Güney Afrika" },
  { code: "EGY", name: "Mısır" }
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState("worldbank"); // 'worldbank' or 'analyzer'

  // Metadata
  const [indicators, setIndicators] = useState([]);
  const [countries, setCountries] = useState(COMMON_COUNTRIES);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Selector selections for World Bank
  const [selectedCountries, setSelectedCountries] = useState(["TUR", "USA", "DEU"]);
  const [selectedIndicators, setSelectedIndicators] = useState([
    "EN.ATM.CO2E.PC",
    "EG.FEC.RNEW.ZS",
    "SP.DYN.LE00.IN",
    "SI.POV.GINI"
  ]);
  const [startYear, setStartYear] = useState(2010);
  const [endYear, setEndYear] = useState(2022);

  // Search filters
  const [countrySearch, setCountrySearch] = useState("");
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [indicatorCategoryFilter, setIndicatorCategoryFilter] = useState("All");

  // World Bank data state
  const [fetchedData, setFetchedData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState(null);
  
  // Exporter state
  const [exporting, setExporting] = useState(false);

  // LLM Analyzer State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [reportText, setReportText] = useState("");
  const [analyzerPrompt, setAnalyzerPrompt] = useState(`Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
Bulduğun göstergeleri şu JSON şemasında döndür. JSON dışında hiçbir şey yazma:
{
  "indicators": [
    {
      "indicator": "Gösterge Adı (örn. Kapsam 1 Emisyonları)",
      "category": "Environmental | Social | Governance",
      "value": 12500, // Sayısal değer (varsa, sayı olarak)
      "unit": "ton CO2e", // Birim
      "year": 2023, // Hangi yıla ait olduğu
      "context": "Metindeki ilgili cümle veya bağlam"
    }
  ]
}`);
  const [extractedData, setExtractedData] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractorError, setExtractorError] = useState(null);

  // Dropdown UI states
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false);

  // Fetch Metadata (indicators from backend, countries from World Bank)
  useEffect(() => {
    async function loadMetadata() {
      setLoadingMetadata(true);
      try {
        // 1. Fetch Indicators from backend
        const indResponse = await fetch("http://localhost:3001/api/indicators");
        if (indResponse.ok) {
          const indData = await indResponse.json();
          setIndicators(indData);
        }

        // 2. Fetch Countries from World Bank API
        const countResponse = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=300");
        if (countResponse.ok) {
          const countData = await countResponse.json();
          if (Array.isArray(countData) && countData[1]) {
            // Filter out regions or empty names
            const cleanCountries = countData[1]
              .filter(c => c.name && c.iso2Code && c.region && c.region.value !== "Aggregates")
              .map(c => ({
                code: c.id,
                name: c.name
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setCountries(cleanCountries);
          }
        }
      } catch (err) {
        console.error("Metadata yükleme hatası (fallback kullanılıyor):", err);
      } finally {
        setLoadingMetadata(false);
      }
    }
    loadMetadata();
  }, []);

  // Fetch World Bank Data based on selections
  const fetchWorldBankData = async () => {
    if (selectedCountries.length === 0 || selectedIndicators.length === 0) {
      setDataError("Lütfen en az bir ülke ve gösterge seçin.");
      return;
    }

    setLoadingData(true);
    setDataError(null);
    setFetchedData([]);

    try {
      const countryCodesStr = selectedCountries.join(";").toLowerCase();
      const allResults = {}; // { "TUR_2015": { Country: "Turkey", Code: "TUR", Year: 2015, "CO2...": X } }

      // Fetch each indicator in parallel
      const fetchPromises = selectedIndicators.map(async (indCode) => {
        const url = `https://api.worldbank.org/v2/country/${countryCodesStr}/indicator/${indCode}?date=${startYear}:${endYear}&format=json&per_page=1000`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${indCode} verisi çekilemedi`);
        const json = await res.ok ? await res.json() : null;
        
        if (Array.isArray(json) && json[1]) {
          const indicatorName = indicators.find(i => i.code === indCode)?.name || indCode;
          json[1].forEach(row => {
            if (row.value === null || row.value === undefined) return;
            
            const key = `${row.countryiso3code}_${row.date}`;
            if (!allResults[key]) {
              allResults[key] = {
                Country: row.country.value,
                Code: row.countryiso3code,
                Year: parseInt(row.date)
              };
            }
            allResults[key][indicatorName] = parseFloat(row.value.toFixed(4));
          });
        }
      });

      await Promise.all(fetchPromises);

      // Convert dict to sorted array (by Country, then Year desc)
      const dataArray = Object.values(allResults).sort((a, b) => {
        const countryCompare = a.Country.localeCompare(b.Country);
        if (countryCompare !== 0) return countryCompare;
        return b.Year - a.Year; // Descending years
      });

      if (dataArray.length === 0) {
        setDataError("Seçilen kriterlere uygun veri bulunamadı.");
      } else {
        setFetchedData(dataArray);
      }
    } catch (err) {
      console.error(err);
      setDataError("World Bank API'sinden veri çekilirken hata oluştu: " + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Export downloaded World Bank data
  const handleExport = async (format) => {
    if (fetchedData.length === 0) return;
    setExporting(true);
    try {
      const response = await fetch("http://localhost:3001/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: fetchedData, format })
      });

      if (!response.ok) throw new Error("Dosya dışa aktarma başarısız.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      let ext = "xlsx";
      if (format === "spss") ext = "sav";
      if (format === "stata") ext = "dta";

      a.download = `sustainability_data_${new Date().toISOString().split('T')[0]}.${ext}`;
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

  // Export extracted data from AI Extractor
  const handleExportExtracted = async (format) => {
    if (extractedData.length === 0) return;
    setExporting(true);
    try {
      const response = await fetch("http://localhost:3001/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: extractedData, format })
      });

      if (!response.ok) throw new Error("Dosya dışa aktarma başarısız.");

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

      const response = await fetch("http://localhost:3001/api/extract", {
        method: "POST",
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

  // Helper toggle selected items
  const toggleCountry = (code) => {
    if (selectedCountries.includes(code)) {
      setSelectedCountries(selectedCountries.filter(c => c !== code));
    } else {
      setSelectedCountries([...selectedCountries, code]);
    }
  };

  const toggleIndicator = (code) => {
    if (selectedIndicators.includes(code)) {
      setSelectedIndicators(selectedIndicators.filter(i => i !== code));
    } else {
      setSelectedIndicators([...selectedIndicators, code]);
    }
  };

  // Filtering metadata lists
  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredIndicators = indicators.filter(ind => {
    const matchesSearch = ind.name.toLowerCase().includes(indicatorSearch.toLowerCase()) || 
                          ind.code.toLowerCase().includes(indicatorSearch.toLowerCase()) || 
                          (ind.description && ind.description.toLowerCase().includes(indicatorSearch.toLowerCase()));
    const matchesCategory = indicatorCategoryFilter === "All" || ind.category === indicatorCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <Globe size={32} className="logo-icon" />
          <div>
            <h1 style={{ fontSize: "1.8rem", margin: 0 }}>SustainData</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "-2px" }}>
              Sürdürülebilirlik Araştırma & Veri Analiz Platformu
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="tab-container" style={{ margin: 0 }}>
          <button 
            className={`tab-btn ${activeTab === "worldbank" ? "active" : ""}`}
            onClick={() => setActiveTab("worldbank")}
          >
            <Globe size={18} />
            Makro Veri İndirici (World Bank)
          </button>
          <button 
            className={`tab-btn ${activeTab === "analyzer" ? "active" : ""}`}
            onClick={() => setActiveTab("analyzer")}
          >
            <Sparkles size={18} />
            Yapay Zeka Rapor Analizcisi (LLM)
          </button>
        </div>

        <div className="flex-gap-sm" style={{ opacity: 0.8 }}>
          <Settings size={18} className="logo-icon" />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>v1.0.0</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBottom: "40px" }}>
        
        {/* TAB 1: World Bank Downloader */}
        {activeTab === "worldbank" && (
          <div className="dashboard-grid">
            
            {/* Sidebar Filters */}
            <aside className="glass-card vertical-gap-lg">
              <div>
                <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Filtreler</h3>
                <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
              </div>

              {/* Country Selector */}
              <div style={{ position: "relative" }}>
                <span className="label">1. ÜLKELER ({selectedCountries.length} Seçili)</span>
                <button 
                  className="input-field flex-between"
                  onClick={() => {
                    setShowCountryDropdown(!showCountryDropdown);
                    setShowIndicatorDropdown(false);
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedCountries.length > 0 
                      ? selectedCountries.map(code => countries.find(c => c.code === code)?.name || code).join(", ") 
                      : "Ülke seçin..."}
                  </span>
                  <ChevronDown size={18} />
                </button>

                {showCountryDropdown && (
                  <div className="dropdown-popover glass-card" style={{ padding: "12px", width: "100%" }}>
                    <div className="flex-gap-sm" style={{ marginBottom: "8px", position: "relative" }}>
                      <Search size={16} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-muted)" }} />
                      <input 
                        type="text" 
                        placeholder="Ülke ara..." 
                        className="input-field" 
                        style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                      />
                    </div>
                    
                    <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)" }}>
                      {filteredCountries.map(c => (
                        <div 
                          key={c.code}
                          className={`dropdown-item flex-between ${selectedCountries.includes(c.code) ? "selected" : ""}`}
                          onClick={() => toggleCountry(c.code)}
                        >
                          <span>{c.name} ({c.code})</span>
                          {selectedCountries.includes(c.code) && <Check size={16} />}
                        </div>
                      ))}
                      {filteredCountries.length === 0 && (
                        <div style={{ padding: "10px", textAlign: "center", color: "var(--text-muted)" }}>Sonuç bulunamadı</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Indicator Selector */}
              <div style={{ position: "relative" }}>
                <span className="label">2. SÜRDÜRÜLEBİLİRLİK DEĞİŞKENLERİ ({selectedIndicators.length} Seçili)</span>
                <button 
                  className="input-field flex-between"
                  onClick={() => {
                    setShowIndicatorDropdown(!showIndicatorDropdown);
                    setShowCountryDropdown(false);
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedIndicators.length > 0 
                      ? selectedIndicators.map(code => indicators.find(i => i.code === code)?.name || code).join(", ") 
                      : "Gösterge seçin..."}
                  </span>
                  <ChevronDown size={18} />
                </button>

                {showIndicatorDropdown && (
                  <div className="dropdown-popover glass-card" style={{ padding: "12px", width: "400px", maxWidth: "90vw" }}>
                    
                    {/* Category Filter Pills */}
                    <div style={{ display: "flex", gap: "6px", marginBottom: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                      {["All", "Environmental", "Social", "Economic & Governance"].map(cat => (
                        <button 
                          key={cat}
                          className="btn btn-secondary"
                          style={{ 
                            padding: "4px 8px", 
                            fontSize: "0.75rem",
                            borderRadius: "4px",
                            background: indicatorCategoryFilter === cat ? "var(--primary)" : "transparent",
                            color: indicatorCategoryFilter === cat ? "var(--bg-main)" : "var(--text-primary)"
                          }}
                          onClick={() => setIndicatorCategoryFilter(cat)}
                        >
                          {cat === "All" ? "Hepsi" : cat === "Environmental" ? "Çevre" : cat === "Social" ? "Sosyal" : "Yönetişim"}
                        </button>
                      ))}
                    </div>

                    <div className="flex-gap-sm" style={{ marginBottom: "8px", position: "relative" }}>
                      <Search size={16} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-muted)" }} />
                      <input 
                        type="text" 
                        placeholder="Gösterge ara..." 
                        className="input-field" 
                        style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
                        value={indicatorSearch}
                        onChange={(e) => setIndicatorSearch(e.target.value)}
                      />
                    </div>

                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)" }}>
                      {filteredIndicators.map(ind => (
                        <div 
                          key={ind.code}
                          className={`dropdown-item flex-between ${selectedIndicators.includes(ind.code) ? "selected" : ""}`}
                          onClick={() => toggleIndicator(ind.code)}
                          style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}
                        >
                          <div style={{ marginRight: "10px", maxWidth: "80%" }}>
                            <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>{ind.name}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{ind.code}</div>
                          </div>
                          {selectedIndicators.includes(ind.code) && <Check size={16} style={{ flexShrink: 0 }} />}
                        </div>
                      ))}
                      {filteredIndicators.length === 0 && (
                        <div style={{ padding: "10px", textAlign: "center", color: "var(--text-muted)" }}>Sonuç bulunamadı</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Year Selectors */}
              <div className="flex-gap-md" style={{ width: "100%" }}>
                <div style={{ flex: 1 }}>
                  <span className="label">BAŞLANGIÇ YILI</span>
                  <select 
                    value={startYear} 
                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {Array.from({ length: 37 }, (_, i) => 1990 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <span className="label">BİTİŞ YILI</span>
                  <select 
                    value={endYear} 
                    onChange={(e) => setEndYear(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {Array.from({ length: 37 }, (_, i) => 1990 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <button 
                className="btn btn-primary" 
                style={{ width: "100%", marginTop: "12px" }}
                onClick={fetchWorldBankData}
                disabled={loadingData}
              >
                {loadingData ? (
                  <>
                    <RefreshCw className="spinner" />
                    Veriler Yükleniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Verileri Çek ve Önizle
                  </>
                )}
              </button>
            </aside>

            {/* Preview and Download Area */}
            <section className="glass-card active-border">
              <div className="flex-between" style={{ marginBottom: "20px" }}>
                <div>
                  <h2>Veri Önizleme & Analiz Çıktıları</h2>
                  <p>World Bank veri tabanından seçilen ülkelere ait geniş formatta analize hazır tablolar.</p>
                </div>

                {/* Download Actions */}
                {fetchedData.length > 0 && (
                  <div className="flex-gap-sm">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExport("xlsx")}
                      disabled={exporting}
                      title="Microsoft Excel Formatında İndir"
                    >
                      <Download size={16} />
                      Excel (.xlsx)
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExport("spss")}
                      disabled={exporting}
                      title="IBM SPSS Formatında İndir"
                    >
                      <Download size={16} />
                      SPSS (.sav)
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExport("stata")}
                      disabled={exporting}
                      title="STATA Formatında İndir"
                    >
                      <Download size={16} />
                      STATA (.dta)
                    </button>
                  </div>
                )}
              </div>

              {/* Data Table */}
              {loadingData ? (
                <div className="flex-center" style={{ height: "350px", flexDirection: "column", gap: "16px" }}>
                  <RefreshCw size={48} className="spinner" style={{ color: "var(--primary)" }} />
                  <p style={{ color: "var(--text-secondary)" }}>Sürdürülebilirlik verileri World Bank API'sinden çekiliyor...</p>
                </div>
              ) : dataError ? (
                <div className="flex-center" style={{ height: "350px", flexDirection: "column", gap: "12px", border: "1px dashed var(--danger)", borderRadius: "var(--radius-lg)" }}>
                  <AlertCircle size={40} style={{ color: "var(--danger)" }} />
                  <p style={{ color: "var(--danger)", fontWeight: 600 }}>{dataError}</p>
                </div>
              ) : fetchedData.length > 0 ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Toplam {fetchedData.length} veri satırı listeleniyor.
                    </span>
                  </div>
                  
                  <div className="table-container" style={{ maxHeight: "400px" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ülke</th>
                          <th>Kod</th>
                          <th>Yıl</th>
                          {selectedIndicators.map(code => {
                            const name = indicators.find(i => i.code === code)?.name || code;
                            // Shortened display in table header
                            return (
                              <th key={code} title={name}>
                                {name.length > 30 ? name.substring(0, 27) + "..." : name}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {fetchedData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.Country}</td>
                            <td><span className="badge badge-soc">{row.Code}</span></td>
                            <td style={{ fontWeight: 600 }}>{row.Year}</td>
                            {selectedIndicators.map(code => {
                              const name = indicators.find(i => i.code === code)?.name || code;
                              const val = row[name];
                              return (
                                <td key={code}>
                                  {val !== undefined ? val : <span style={{ color: "var(--text-muted)" }}>-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "24px", padding: "16px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color-glow)" }}>
                    <p style={{ color: "var(--primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Check size={18} />
                      Analize Hazır! Bu verileri SPSS (.sav) veya STATA (.dta) olarak indirdiğinizde sütun isimleri otomatik olarak istatistik araçlarına uygun (kısa ve boşluksuz) hale getirilir, tam gösterge isimleri ise SPSS/STATA etiketleri (Variable Labels) olarak eklenir.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-center" style={{ height: "350px", flexDirection: "column", gap: "12px", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-lg)" }}>
                  <Table size={40} style={{ color: "var(--text-muted)" }} />
                  <p style={{ color: "var(--text-secondary)" }}>Gösterilecek veri yok. Sol taraftan seçimlerinizi yapıp "Verileri Çek" butonuna basın.</p>
                </div>
              )}
            </section>

          </div>
        )}

        {/* TAB 2: AI Report Extractor */}
        {activeTab === "analyzer" && (
          <div className="dashboard-grid">
            
            {/* Control Sidebar */}
            <aside className="glass-card vertical-gap-lg">
              <div>
                <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Kurum Raporu Yükleme</h3>
                <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
              </div>

              {/* Upload Input */}
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
                        setReportText(""); // Clear manual text if file uploaded
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

              {/* Text Input area */}
              <div>
                <span className="label">Metin Yapıştırın</span>
                <textarea 
                  placeholder="Kurum raporunun ilgili veri sayfalarını veya performans tablolarını doğrudan buraya yapıştırabilirsiniz..."
                  className="input-field"
                  style={{ minHeight: "120px", resize: "vertical", fontSize: "0.85rem" }}
                  value={reportText}
                  onChange={(e) => {
                    setReportText(e.target.value);
                    if (e.target.value) setUploadedFile(null); // Clear file if typing manual text
                  }}
                  disabled={!!uploadedFile}
                />
              </div>

              {/* Prompt Editor */}
              <div>
                <span className="label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>AI Prompt Şablonu</span>
                  <span style={{ color: "var(--primary)", cursor: "pointer", textTransform: "none" }} onClick={() => setAnalyzerPrompt(`Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
Bulduğun göstergeleri şu JSON şemasında döndür. JSON dışında hiçbir şey yazma:
{
  "indicators": [
    {
      "indicator": "Gösterge Adı (örn. Kapsam 1 Emisyonları)",
      "category": "Environmental | Social | Governance",
      "value": 12500, // Sayısal değer (varsa, sayı olarak)
      "unit": "ton CO2e", // Birim
      "year": 2023, // Hangi yıla ait olduğu
      "context": "Metindeki ilgili cümle veya bağlam"
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

              {/* Run Action */}
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

                {/* Export Options for extracted data */}
                {extractedData.length > 0 && (
                  <div className="flex-gap-sm">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExportExtracted("xlsx")}
                      disabled={exporting}
                    >
                      <Download size={16} />
                      Excel (.xlsx)
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExportExtracted("spss")}
                      disabled={exporting}
                    >
                      <Download size={16} />
                      SPSS (.sav)
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleExportExtracted("stata")}
                      disabled={exporting}
                    >
                      <Download size={16} />
                      STATA (.dta)
                    </button>
                  </div>
                )}
              </div>

              {/* Extraction Content */}
              {extracting ? (
                <div className="flex-center" style={{ height: "400px", flexDirection: "column", gap: "16px" }}>
                  <RefreshCw size={48} className="spinner" style={{ color: "var(--primary)" }} />
                  <p style={{ color: "var(--text-secondary)", maxWidth: "400px", textAlign: "center" }}>
                    Rapor analiz ediliyor. PDF okuma ve yapay zeka gösterge ayıklama süreçleri yürütülüyor. Bu işlem raporun boyutuna bağlı olarak birkaç saniye sürebilir...
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
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Rapordan toplam {extractedData.length} gösterge ayıklandı.
                    </span>
                  </div>

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
                                row.category?.toLowerCase().startsWith("env") 
                                  ? "badge-env" 
                                  : row.category?.toLowerCase().startsWith("soc") 
                                    ? "badge-soc" 
                                    : "badge-gov"
                              }`}>
                                {row.category || "General"}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.indicator}</td>
                            <td style={{ fontWeight: 600, color: "var(--primary)" }}>{row.value}</td>
                            <td>{row.unit || <span style={{ color: "var(--text-muted)" }}>-</span>}</td>
                            <td style={{ fontWeight: 600 }}>{row.year || <span style={{ color: "var(--text-muted)" }}>-</span>}</td>
                            <td 
                              style={{ 
                                whiteSpace: "normal", 
                                fontSize: "0.8rem", 
                                color: "var(--text-secondary)",
                                wordBreak: "break-word"
                              }}
                            >
                              {row.context || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "24px", padding: "16px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color-glow)" }}>
                    <p style={{ color: "var(--primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Check size={18} />
                      Yapay zeka sürdürülebilirlik verilerini başarıyla çıkarttı. Bu verileri yukarıdaki dışa aktarma araçlarıyla analize hazır (Excel/SPSS/Stata) hale getirebilirsiniz.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-center" style={{ height: "400px", flexDirection: "column", gap: "12px", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-lg)" }}>
                  <FileText size={40} style={{ color: "var(--text-muted)" }} />
                  <p style={{ color: "var(--text-secondary)" }}>
                    Sürdürülebilirlik raporu veya veri metni henüz analiz edilmedi.
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "350px", textAlign: "center" }}>
                    Sol panelden bir PDF/TXT yükleyin veya metin yapıştırın, ardından "Yapay Zeka ile Ayıkla" butonuna tıklayın.
                  </p>
                </div>
              )}
            </section>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} SustainData. Tüm hakları saklıdır. Akademik Araştırma ve Analiz Desteği.</p>
        <p style={{ fontSize: "0.75rem", marginTop: "4px", color: "var(--text-muted)" }}>
          World Bank WDI API ve OpenAI GPT-4o-Mini entegrasyonu ile geliştirilmiştir.
        </p>
      </footer>
    </>
  );
}
