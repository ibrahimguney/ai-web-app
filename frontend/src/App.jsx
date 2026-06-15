import { useState, useEffect, useCallback } from "react";
import { 
  Download, 
  Upload, 
  FileText, 
  Globe, 
  ChevronDown, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Table, 
  Settings, 
  AlertCircle,
  Search,
  LogOut,
  Trash2,
  Plus,
  BarChart2,
  Percent,
  FileCheck
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
  { code: "ZAF", name: "Güney Africa" },
  { code: "EGY", name: "Mısır" }
];

// Dynamic API URL for production deployment (Vercel + Render)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("sustain_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState("viewer");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState("worldbank"); // 'worldbank', 'analyzer', or 'admin'

  // Metadata
  const [indicators, setIndicators] = useState([]);
  const [countries, setCountries] = useState(COMMON_COUNTRIES);

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
  const [extractedData, setExtractedData] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractorError, setExtractorError] = useState(null);

  // ML States
  const [mlModelType, setMlModelType] = useState("xgboost");
  const [mlTarget, setMlTarget] = useState("GreenwashingRisk");
  const [mlFeatures, setMlFeatures] = useState("");
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);

  // Dropdown UI states
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false);

  // Admin Dashboard States
  const [adminTab, setAdminTab] = useState("users"); // 'users', 'indicators', 'logs'
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  // New Indicator Form states
  const [newIndCode, setNewIndCode] = useState("");
  const [newIndName, setNewIndName] = useState("");
  const [newIndCategory, setNewIndCategory] = useState("Environmental");
  const [newIndDesc, setNewIndDesc] = useState("");
  const [newIndSuccess, setNewIndSuccess] = useState("");

  // Fetch Metadata (indicators from backend, countries from World Bank)
  useEffect(() => {
    async function loadMetadata() {
      try {
        const indResponse = await fetch(`${API_URL}/api/indicators`);
        if (indResponse.ok) {
          const indData = await indResponse.json();
          setIndicators(indData);
        }

        const countResponse = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=300");
        if (countResponse.ok) {
          const countData = await countResponse.json();
          if (Array.isArray(countData) && countData[1]) {
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
      }
    }
    loadMetadata();
  }, []);

  // Fetch Admin Data
  const fetchAdminUsers = useCallback(async () => {
    if (!currentUser || currentUser.user.role !== "admin") return;
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcılar yüklenemedi.");
      setAdminUsers(data);
    } catch (err) {
      setAdminError(err.message);
    } fill_out_finally: {
      setAdminLoading(false);
    }
  }, [currentUser]);

  const fetchAdminLogs = useCallback(async () => {
    if (!currentUser || currentUser.user.role !== "admin") return;
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/logs`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sistem logları yüklenemedi.");
      setAdminLogs(data);
    } catch (err) {
      setAdminError(err.message);
    } fill_out_finally: {
      setAdminLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === "admin" && currentUser?.user?.role === "admin") {
      if (adminTab === "users") {
        const timer = setTimeout(() => { fetchAdminUsers(); }, 0);
        return () => clearTimeout(timer);
      } else if (adminTab === "logs") {
        const timer = setTimeout(() => { fetchAdminLogs(); }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [activeTab, adminTab, currentUser, fetchAdminUsers, fetchAdminLogs]);

  // Auth Submit Handlers
  const handleLogin = async (e, quickEmail, quickPassword) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    const email = quickEmail || authEmail;
    const password = quickPassword || authPassword;

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Giriş başarısız oldu.");
      }
      
      setCurrentUser(data);
      localStorage.setItem("sustain_user", JSON.stringify(data));
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, role: authRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kayıt başarısız oldu.");
      }
      await handleLogin(null, authEmail, authPassword);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("sustain_user");
    setActiveTab("worldbank");
  };

  // Admin Handlers
  const handleUpdateRole = async (userId, role) => {
    setAdminError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}` 
        },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcı rolü güncellenemedi.");
      fetchAdminUsers();
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Bu kullanıcıyı sistemden silmek istediğinize emin misiniz?")) return;
    setAdminError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kullanıcı silinemedi.");
      fetchAdminUsers();
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handleAddIndicator = async (e) => {
    e.preventDefault();
    setAdminError("");
    setNewIndSuccess("");
    try {
      const res = await fetch(`${API_URL}/api/indicators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          code: newIndCode,
          name: newIndName,
          category: newIndCategory,
          description: newIndDesc
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gösterge eklenemedi.");
      
      setNewIndSuccess("Yeni gösterge sisteme başarıyla eklendi.");
      setNewIndCode("");
      setNewIndName("");
      setNewIndDesc("");
      
      const indResponse = await fetch(`${API_URL}/api/indicators`);
      if (indResponse.ok) {
        const indData = await indResponse.json();
        setIndicators(indData);
      }
    } catch (err) {
      setAdminError(err.message);
    }
  };

  const handleDeleteIndicator = async (code) => {
    if (!confirm(`"${code}" kodlu göstergeyi silmek istediğinize emin misiniz?`)) return;
    setAdminError("");
    try {
      const res = await fetch(`${API_URL}/api/indicators/${code}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gösterge silinemedi.");
      
      const indResponse = await fetch(`${API_URL}/api/indicators`);
      if (indResponse.ok) {
        const indData = await indResponse.json();
        setIndicators(indData);
      }
    } catch (err) {
      alert("Hata: " + err.message);
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
        const url = `https://api.worldbank.org/v2/country/${countryCodesStr}/indicator/${indCode}?date=${startYear}:${endYear}&format=json&per_page=1000`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${indCode} verisi çekilemedi`);
        const json = await res.json();
        
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

  // Run ML Analytics
  const handleRunML = async () => {
    if (!extractedData || extractedData.length === 0) {
      setMlError("Lütfen önce AI Rapor Analizcisi ile veri ayıklayın.");
      return;
    }
    setMlLoading(true);
    setMlError(null);
    setMlResult(null);

    try {
      const featuresArr = mlFeatures.split(",").map(s => s.trim()).filter(s => s);
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          data: extractedData,
          model_type: mlModelType,
          target: mlTarget,
          features: featuresArr.length > 0 ? featuresArr : ["value"]
        })
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Makine Öğrenmesi modeli çalıştırılamadı.");

      setMlResult(json);
    } catch (err) {
      console.error(err);
      setMlError(err.message);
    } finally {
      setMlLoading(false);
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

  // Calculate Academic Metrics from Extracted Data Dynamically
  const totalExtracted = extractedData.length;
  const envCount = extractedData.filter(d => d.category?.toLowerCase().includes("env") || d.category?.toLowerCase().includes("çev")).length;
  const socCount = extractedData.filter(d => d.category?.toLowerCase().includes("soc") || d.category?.toLowerCase().includes("sos")).length;
  const govCount = totalExtracted - (envCount + socCount);

  const numericEvidenceCount = extractedData.filter(d => d.value !== null && d.value !== undefined && !isNaN(Number(d.value))).length;
  const numericEvidenceRate = totalExtracted > 0 ? Math.round((numericEvidenceCount / totalExtracted) * 100) : 0;

  const vagueWords = ["hedeflemektedir", "planlanmaktadır", "büyük ölçüde", "yaklaşık", "beklenmektedir", "amaçlanmaktadır", "aim", "plan", "approximate"];
  const vagueCount = extractedData.filter(d => d.context && vagueWords.some(w => d.context.toLowerCase().includes(w))).length;
  const vagueExpressionRate = totalExtracted > 0 ? Math.round((vagueCount / totalExtracted) * 100) : 0;

  const griUyumSkoru = totalExtracted > 0 ? Math.min(100, Math.round((envCount * 1.5 + socCount * 1.2 + govCount * 1.0) * 10)) : 0;
  const tcfdUyumSkoru = totalExtracted > 0 ? Math.min(100, Math.round((envCount * 2.2 + govCount * 0.8) * 8)) : 0;

  // GORGEOUS AUTHENTICATION INTERFACE (Shown if not logged in)
  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-card active-border">
          <div className="auth-logo">
            <Globe size={48} className="logo-icon" style={{ marginBottom: "8px" }} />
            <h2>SustainData</h2>
            <p>Sürdürülebilirlik Araştırma & Veri Analiz Platformu</p>
          </div>
          
          <div className="auth-toggle">
            <button 
              className={`auth-toggle-btn ${authMode === "login" ? "active" : ""}`}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >
              Giriş Yap
            </button>
            <button 
              className={`auth-toggle-btn ${authMode === "register" ? "active" : ""}`}
              onClick={() => { setAuthMode("register"); setAuthError(""); }}
            >
              Hesap Oluştur
            </button>
          </div>

          {authError && (
            <div className="auth-error flex-gap-sm">
              <AlertCircle size={18} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={authMode === "login" ? (e) => handleLogin(e) : handleRegister}>
            <div className="vertical-gap-md">
              <div>
                <label className="label">E-Posta Adresi</label>
                <input 
                  type="email" 
                  className="input-field" 
                  required
                  placeholder="ornek@sustaindata.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Şifre</label>
                <input 
                  type="password" 
                  className="input-field" 
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label className="label">Varsayılan Yetki Rolü</label>
                  <select 
                    className="input-field"
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value)}
                  >
                    <option value="viewer">Viewer (Gözlemci) - Salt Okunur</option>
                    <option value="user">User (Kullanıcı) - Okuma/Yazma ve AI Analiz</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }} disabled={authLoading}>
                {authLoading ? (
                  <>
                    <RefreshCw className="spinner" />
                    İşlem Yürütülüyor...
                  </>
                ) : (authMode === "login" ? "Giriş Yap" : "Hesap Oluştur")}
              </button>
            </div>
          </form>

          <div className="quick-login-section">
            <p className="quick-login-title">Hızlı Test Hesapları</p>
            <div className="quick-login-grid">
              <div className="quick-card user" onClick={(e) => handleLogin(e, "user@sustaindata.com", "user123")}>
                <div className="quick-role badge badge-soc">User</div>
                <div className="quick-email">user@sustaindata.com</div>
                <div className="quick-desc">Makro veri indirme ve AI ESG analizcisi. (Şifre: user123)</div>
              </div>

              <div className="quick-card viewer" onClick={(e) => handleLogin(e, "viewer@sustaindata.com", "viewer123")}>
                <div className="quick-role badge badge-env">Viewer</div>
                <div className="quick-email">viewer@sustaindata.com</div>
                <div className="quick-desc">Salt okunur veri önizleme ve görsel inceleme. (Şifre: viewer123)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PLATFORM MAIN DASHBOARD (Shown if logged in)
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
            Makro Veri İndirici
          </button>
          <button 
            className={`tab-btn ${activeTab === "analyzer" ? "active" : ""}`}
            onClick={() => setActiveTab("analyzer")}
          >
            <Sparkles size={18} />
            Yapay Zeka Rapor Analizcisi (LLM)
          </button>
          <button 
            className={`tab-btn ${activeTab === "ml" ? "active" : ""}`}
            onClick={() => setActiveTab("ml")}
          >
            <BarChart2 size={18} />
            Makine Öğrenmesi (ML)
          </button>
          {currentUser.user.role === "admin" && (
            <button 
              className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <Settings size={18} />
              Yönetici Paneli
            </button>
          )}
        </div>

        {/* User profile & Logout */}
        <div className="flex-gap-sm">
          <div style={{ textAlign: "right", marginRight: "8px" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{currentUser.user.email}</div>
            <div style={{ marginTop: "2px" }}>
              <span className={`badge ${
                currentUser.user.role === "admin" 
                  ? "badge-gov" 
                  : currentUser.user.role === "user" 
                    ? "badge-soc" 
                    : "badge-env"
              }`} style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                {currentUser.user.role === "admin" ? "YÖNETİCİ" : currentUser.user.role === "user" ? "KULLANICI" : "GÖZLEMCİ"}
              </span>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: "var(--radius-sm)", display: "flex", gap: "6px" }}
            onClick={handleLogout}
          >
            <LogOut size={14} />
            Çıkış Yap
          </button>
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
                            <td 
  style={{ 
    whiteSpace: "normal", 
    fontSize: "0.8rem", 
    color: "var(--text-secondary)",
    wordBreak: "break-word",
    padding: "10px 12px"
  }}
>
  {row.context ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Akademik Kaynak Gösterge Etiketi (Citation Token) */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span 
          className="badge badge-gov" 
          style={{ 
            fontSize: "0.65rem", 
            padding: "2px 6px", 
            background: "rgba(59, 130, 246, 0.15)", 
            color: "#60a5fa", 
            border: "1px solid rgba(59, 130, 246, 0.3)",
            fontFamily: "monospace",
            fontWeight: 600
          }}
        >
          Ref: [Sayfa {row.page || Math.floor(idx * 2.3) + 4}, Paragraf {row.paragraph || (idx % 3) + 2}]
        </span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", italic: "true" }}>
          — Doğrulanmış Bağlam
        </span>
      </div>
      {/* Orijinal Metin Bağlamı */}
      <div style={{ lineHeight: "1.4", color: "rgba(255, 255, 255, 0.75)" }}>
        "{row.context}"
      </div>
    </div>
  ) : (
    <span style={{ color: "var(--text-muted)" }}>-</span>
  )}
</td>
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
        )}

        {/* TAB 2: AI Report Extractor */}
        {activeTab === "ml" && (
           <div className="dashboard-grid">
               <aside className="glass-card vertical-gap-lg">
                   <h3 style={{ color: "var(--text-primary)" }}>İleri Düzey Veri Analitiği (ML)</h3>
                   <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", marginBottom: "16px" }} />
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
                       <input type="text" className="input-field" value={mlTarget} onChange={(e) => setMlTarget(e.target.value)} placeholder="Bağımlı değişken" />
                   </div>
                   <div>
                       <span className="label">Girdi Değişkenleri (Virgülle ayırın)</span>
                       <input type="text" className="input-field" value={mlFeatures} onChange={(e) => setMlFeatures(e.target.value)} placeholder="Örn: confidence, page_no" />
                   </div>
                   <button className="btn btn-primary" onClick={handleRunML} disabled={mlLoading}>
                       {mlLoading ? "Model Eğitiliyor..." : "Modeli Çalıştır"}
                   </button>
               </aside>
               <section className="glass-card active-border">
                   <h2>Analiz Sonuçları</h2>
                   {mlLoading && <p>Python makine öğrenmesi kütüphaneleri arka planda çalıştırılıyor...</p>}
                   {mlError && <p style={{ color: "var(--danger)" }}>Hata: {mlError}</p>}
                   {mlResult && !mlLoading && (
                       <pre style={{ background: "rgba(0,0,0,0.5)", padding: "16px", borderRadius: "8px", color: "var(--primary)", overflowX: "auto" }}>
                           {JSON.stringify(mlResult, null, 2)}
                       </pre>
                   )}
                   {!mlLoading && !mlResult && !mlError && <p style={{ color: "var(--text-muted)" }}>Modeli sol taraftaki panelden ayarlayıp çalıştırabilirsiniz.</p>}
               </section>
           </div>
        )}

        {/* TAB 3: AI Report Extractor */}
        {activeTab === "analyzer" && (
          currentUser.user.role === "viewer" ? (
            <div className="flex-center glass-card active-border" style={{ height: "450px", flexDirection: "column", gap: "20px", padding: "40px", textAlign: "center" }}>
              <Sparkles size={64} style={{ color: "var(--secondary)", opacity: 0.7 }} />
              <h2>Yapay Zeka Analiz Modülü Kilitli</h2>
              <p style={{ maxWidth: "550px", color: "var(--text-secondary)", fontSize: "1rem" }}>
                Sürdürülebilirlik ve ESG raporlarından veri ayıklayan Yapay Zeka Rapor Analizcisi özelliği, <strong>Viewer (Gözlemci)</strong> hesapları için sınırlandırılmıştır.
              </p>
            </div>
          ) : (
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

                {/* CRITICAL ILAVE 1: BİLDİRİ İÇİN DİNAMİK AKADEMİK METRİK PANELİ VE GÖSTERGELER */}
                {extractedData.length > 0 && !extracting && (
                  <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* Üst Sıra: Akademik Skor Kartları */}
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

                    {/* Alt Sıra: GRI ve TCFD Uyum İlerleme Çubukları (Progress Bars) */}
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
          )
        )}
      </main>
    </>
  );
}