import { useState, useEffect, useRef } from "react";
import { 
  Download, 
  ChevronDown, 
  Check, 
  RefreshCw, 
  Table, 
  AlertCircle,
  Search
} from "lucide-react";

export default function MacroDownloader({ 
  API_URL, 
  currentUser, 
  indicators, 
  countries, 
  fetchedData, 
  setFetchedData 
}) {
  // Selector selections for World Bank
  const [selectedCountries, setSelectedCountries] = useState(["TUR", "USA", "DEU"]);
  const [selectedIndicators, setSelectedIndicators] = useState([
    "EN.ATM.CO2E.PC",
    "EG.FEC.RNEW.ZS",
    "SP.DYN.LE00.IN"
  ]);
  const [startYear, setStartYear] = useState(2010);
  const [endYear, setEndYear] = useState(2022);

  // Search filters
  const [countrySearch, setCountrySearch] = useState("");
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [indicatorCategoryFilter, setIndicatorCategoryFilter] = useState("All");

  // World Bank data state
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState(null);
  
  // Exporter state
  const [exporting, setExporting] = useState(false);

  // Dropdown UI states
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false);

  // Refs for closing dropdowns
  const countryDropdownRef = useRef(null);
  const indicatorDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
      if (indicatorDropdownRef.current && !indicatorDropdownRef.current.contains(event.target)) {
        setShowIndicatorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const fetchWithProxyFallback = async (targetUrl) => {
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`Direct fetch status: ${res.status}`);
      }
      return res;
    } catch (directErr) {
      console.warn(`Direct fetch to ${targetUrl} failed. Trying proxy...`, directErr);
      const proxyUrl = `${API_URL}/api/proxy/worldbank?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        throw new Error(`Proxy fetch status: ${res.status}`);
      }
      return res;
    }
  };

  // Fetch World Bank Data
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
      const allResults = {};

      const fetchPromises = selectedIndicators.map(async (indCode) => {
        const indicatorName = indicators.find(i => i.code === indCode)?.name || indCode;
        
        // 1. Try standard WDI source (Source 2)
        const url = `https://api.worldbank.org/v2/country/${countryCodesStr}/indicator/${indCode}?date=${startYear}:${endYear}&format=json&per_page=1000`;
        let res;
        let json;
        try {
          res = await fetchWithProxyFallback(url);
          json = await res.json();
        } catch (err) {
          throw new Error(`${indCode} verisi çekilemedi: ${err.message}`);
        }
        
        let hasData = false;
        if (Array.isArray(json) && json[1] && (!json[0]?.message)) {
          hasData = true;
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

        // 2. If not found in WDI, fallback to Source 75 (ESG Data)
        if (!hasData) {
          const esgUrl = `https://api.worldbank.org/v2/sources/75/country/${countryCodesStr}/series/${indCode}?date=${startYear}:${endYear}&format=json&per_page=1000`;
          try {
            const esgRes = await fetchWithProxyFallback(esgUrl);
            const esgJson = await esgRes.json();
            const dataList = esgJson?.source?.data || esgJson?.data || [];
            if (dataList.length > 0 && !esgJson?.message) {
              hasData = true;
              dataList.forEach(row => {
                if (row.value === null || row.value === undefined) return;
                
                const countryVar = row.variable?.find(v => v.concept === "Country");
                const timeVar = row.variable?.find(v => v.concept === "Time");
                if (!countryVar || !timeVar) return;

                const cCode = countryVar.id;
                const cName = countryVar.value;
                const yearVal = parseInt(timeVar.value);

                const key = `${cCode}_${yearVal}`;
                if (!allResults[key]) {
                  allResults[key] = {
                    Country: cName,
                    Code: cCode,
                    Year: yearVal
                  };
                }
                allResults[key][indicatorName] = parseFloat(row.value.toFixed(4));
              });
            }
          } catch (e) {
            console.error("ESG source fetch failed", e);
          }
        }

        // 3. If still not found, fallback to Source 57 (WDI Archives)
        if (!hasData) {
          const archiveUrl = `https://api.worldbank.org/v2/sources/57/country/${countryCodesStr}/series/${indCode}?date=${startYear}:${endYear}&format=json&per_page=1000`;
          try {
            const archRes = await fetchWithProxyFallback(archiveUrl);
            const archJson = await archRes.json();
            const dataList = archJson?.source?.data || archJson?.data || [];
            if (dataList.length > 0 && !archJson?.message) {
              // We filter for the latest version per year to avoid duplicates
              const latestMap = {};
              dataList.forEach(row => {
                if (row.value === null || row.value === undefined) return;
                const countryVar = row.variable?.find(v => v.concept === "Country");
                const timeVar = row.variable?.find(v => v.concept === "Time");
                const versionVar = row.variable?.find(v => v.concept === "Version");
                if (!countryVar || !timeVar || !versionVar) return;

                const cCode = countryVar.id;
                const cName = countryVar.value;
                const yearVal = parseInt(timeVar.value);
                const versionId = parseInt(versionVar.id);

                const key = `${cCode}_${yearVal}`;
                if (!latestMap[key] || latestMap[key].version < versionId) {
                  latestMap[key] = {
                    Country: cName,
                    Code: cCode,
                    Year: yearVal,
                    value: row.value,
                    version: versionId
                  };
                }
              });

              Object.values(latestMap).forEach(item => {
                const key = `${item.Code}_${item.Year}`;
                if (!allResults[key]) {
                  allResults[key] = {
                    Country: item.Country,
                    Code: item.Code,
                    Year: item.Year
                  };
                }
                allResults[key][indicatorName] = parseFloat(item.value.toFixed(4));
              });
            }
          } catch (e) {
            console.error("Archive source fetch failed", e);
          }
        }
      });

      await Promise.all(fetchPromises);

      const dataArray = Object.values(allResults).sort((a, b) => {
        const countryCompare = a.Country.localeCompare(b.Country);
        if (countryCompare !== 0) return countryCompare;
        return b.Year - a.Year;
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

  const handleExport = async (format) => {
    if (fetchedData.length === 0) return;
    setExporting(true);
    try {
      const response = await fetch(`${API_URL}/api/export`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ data: fetchedData, format })
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

  return (
    <div className="dashboard-grid">
      {/* Sidebar Filters */}
      <aside className="glass-card vertical-gap-lg">
        <div>
          <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Filtreler</h3>
          <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
        </div>

        {/* Country Selector */}
        <div style={{ position: "relative" }} ref={countryDropdownRef}>
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
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: "6px 16px", fontSize: "0.8rem", width: "100%" }}
                  onClick={() => setShowCountryDropdown(false)}
                >
                  Tamam
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Indicator Selector */}
        <div style={{ position: "relative" }} ref={indicatorDropdownRef}>
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
              
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                {["All", "Environmental", "Social", "Economic & Governance"].map(cat => (
                  <button 
                    key={cat}
                    type="button"
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
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: "6px 16px", fontSize: "0.8rem", width: "100%" }}
                  onClick={() => setShowIndicatorDropdown(false)}
                >
                  Tamam
                </button>
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

      {/* Preview Area */}
      <section className="glass-card active-border">
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Veri Önizleme & Analiz Çıktıları</h2>
            <p>World Bank veri tabanından seçilen ülkelere ait geniş formatta analize hazır tablolar.</p>
          </div>

          {fetchedData.length > 0 && (
            <div className="flex-gap-sm">
              {currentUser.user.role === "viewer" ? (
                <span style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 600, background: "rgba(239, 68, 68, 0.1)", padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                  ⚠️ Dışa aktarım için en az Kullanıcı (User) yetkisi gerekir.
                </span>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>

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
                Analize Hazır! Bu verileri SPSS (.sav) veya STATA (.dta) olarak indirdiğinizde sütun isimleri otomatik olarak istatistik araçlarına uygun hale getirilir.
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
  );
}
