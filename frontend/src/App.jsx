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
  Plus
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
        // 1. Fetch Indicators from backend
        const indResponse = await fetch(`${API_URL}/api/indicators`);
        if (indResponse.ok) {
          const indData = await indResponse.json();
          setIndicators(indData);
        }

        // 2. Fetch Countries from World Bank API
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
    } finally {
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
    } finally {
      setAdminLoading(false);
    }
  }, [currentUser]);

  // Trigger Admin data fetches on admin view subtab switch
  useEffect(() => {
    if (activeTab === "admin" && currentUser?.user?.role === "admin") {
      if (adminTab === "users") {
        const timer = setTimeout(() => {
          fetchAdminUsers();
        }, 0);
        return () => clearTimeout(timer);
      } else if (adminTab === "logs") {
        const timer = setTimeout(() => {
          fetchAdminLogs();
        }, 0);
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
      
      // Auto login
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

  // Admin User & Roles Handlers
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
      
      // Reload indicators list
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
      
      // Reload indicators list
      const indResponse = await fetch(`${API_URL}/api/indicators`);
      if (indResponse.ok) {
        const indData = await indResponse.json();
        setIndicators(indData);
      }
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

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

  // Export downloaded World Bank data
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

  // Export extracted data from AI Extractor
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
                    <option value="admin">Admin (Yönetici) - Tam Yetki</option>
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

          {/* Quick Login Section */}
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
                      Analize Hazır! Bu verileri SPSS (.sav) veya STATA (.dta) olarak indirdiğinizde sütun isimleri otomatik olarak istatistik araçlarına uygun hale getirilir, tam isimler ise SPSS/STATA etiketleri olarak eklenir.
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
          currentUser.user.role === "viewer" ? (
            <div className="flex-center glass-card active-border" style={{ height: "450px", flexDirection: "column", gap: "20px", padding: "40px", textAlign: "center" }}>
              <Sparkles size={64} style={{ color: "var(--secondary)", opacity: 0.7 }} />
              <h2>Yapay Zeka Analiz Modülü Kilitli</h2>
              <p style={{ maxWidth: "550px", color: "var(--text-secondary)", fontSize: "1rem" }}>
                Sürdürülebilirlik ve ESG raporlarından veri ayıklayan Yapay Zeka Rapor Analizcisi özelliği, <strong>Viewer (Gözlemci)</strong> hesapları için sınırlandırılmıştır.
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "450px" }}>
                Bu özelliği kullanabilmek için en az <strong>Kullanıcı (User)</strong> yetkisine sahip olmalısınız. Sistem yöneticiniz (Admin) aracılığıyla yetkinizi güncelleyebilirsiniz.
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

                {/* Text Input area */}
                <div>
                  <span className="label">Metin Yapıştırın</span>
                  <textarea 
                    placeholder="Kurum raporunun ilgili veri sayfalarını veya performans performans tablolarını doğrudan buraya yapıştırabilirsiniz..."
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
          )
        )}

        {/* TAB 3: Admin Panel */}
        {activeTab === "admin" && currentUser.user.role === "admin" && (
          <div className="admin-layout">
            <div className="admin-sidebar glass-card">
              <h3 style={{ color: "var(--text-primary)" }}>Yönetici Menüsü</h3>
              <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", margin: "12px 0" }} />
              
              <div className="admin-nav-list">
                <button 
                  className={`admin-nav-btn ${adminTab === "users" ? "active" : ""}`}
                  onClick={() => setAdminTab("users")}
                >
                  Kullanıcı Yönetimi
                </button>
                <button 
                  className={`admin-nav-btn ${adminTab === "indicators" ? "active" : ""}`}
                  onClick={() => setAdminTab("indicators")}
                >
                  Gösterge Yönetimi
                </button>
                <button 
                  className={`admin-nav-btn ${adminTab === "logs" ? "active" : ""}`}
                  onClick={() => setAdminTab("logs")}
                >
                  Kullanım Logları
                </button>
              </div>
            </div>

            <div className="admin-content glass-card active-border" style={{ flex: 1 }}>
              {adminError && (
                <div className="auth-error flex-gap-sm" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={18} />
                  <span>{adminError}</span>
                </div>
              )}

              {/* Users management subtab */}
              {adminTab === "users" && (
                <div>
                  <div className="flex-between" style={{ marginBottom: "20px" }}>
                    <div>
                      <h2>Kullanıcı Hesapları Yönetimi</h2>
                      <p>Sistemdeki tüm kayıtlı kullanıcıların yetki rollerini düzenleyin veya hesapları silin.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchAdminUsers} disabled={adminLoading}>
                      Yenile
                    </button>
                  </div>

                  {adminLoading ? (
                    <div className="flex-center" style={{ height: "200px" }}>
                      <RefreshCw className="spinner" />
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Kullanıcı E-Posta</th>
                            <th>Mevcut Yetki Rolü</th>
                            <th>Kayıt Tarihi</th>
                            <th style={{ textAlign: "right" }}>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map(user => (
                            <tr key={user.id}>
                              <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.email}</td>
                              <td>
                                <select 
                                  value={user.role} 
                                  onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                  className="input-field"
                                  style={{ padding: "6px 12px", fontSize: "0.85rem", width: "160px" }}
                                  disabled={user.id === currentUser.user.id}
                                >
                                  <option value="viewer">Viewer (Gözlemci)</option>
                                  <option value="user">User (Kullanıcı)</option>
                                  <option value="admin">Admin (Yönetici)</option>
                                </select>
                              </td>
                              <td>{new Date(user.createdAt).toLocaleString("tr-TR")}</td>
                              <td style={{ textAlign: "right" }}>
                                <button 
                                  className="btn btn-danger"
                                  style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: "var(--radius-sm)", display: "inline-flex", gap: "4px" }}
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={user.id === currentUser.user.id}
                                >
                                  <Trash2 size={14} />
                                  Sil
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Indicators management subtab */}
              {adminTab === "indicators" && (
                <div>
                  <div style={{ marginBottom: "20px" }}>
                    <h2>Sürdürülebilirlik Göstergeleri Yönetimi</h2>
                    <p>Sistemde listelenen ve Dünya Bankası API'sinden çekilen ESG göstergelerini ekleyin veya silin.</p>
                  </div>

                  {/* Add Indicator Form */}
                  <form onSubmit={handleAddIndicator} style={{ marginBottom: "32px", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "rgba(255, 255, 255, 0.02)" }}>
                    <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Yeni ESG Göstergesi Ekle</h3>
                    {newIndSuccess && (
                      <div className="flex-gap-sm" style={{ color: "var(--primary)", fontSize: "0.9rem", marginBottom: "16px", fontWeight: 600 }}>
                        <Check size={18} />
                        <span>{newIndSuccess}</span>
                      </div>
                    )}
                    <div className="inner-grid" style={{ gap: "16px" }}>
                      <div>
                        <label className="label">Gösterge Kodu (WB Indicator Code)</label>
                        <input 
                          type="text" 
                          placeholder="örn. EG.ELC.RNEW.ZS" 
                          className="input-field" 
                          required
                          value={newIndCode}
                          onChange={(e) => setNewIndCode(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Gösterge Adı (Türkçe / İngilizce)</label>
                        <input 
                          type="text" 
                          placeholder="örn. Yenilenebilir enerji tüketimi (%)" 
                          className="input-field" 
                          required
                          value={newIndCode ? newIndName : ""} // Keep reactive
                          value={newIndName}
                          onChange={(e) => setNewIndName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Kategori</label>
                        <select 
                          className="input-field"
                          value={newIndCategory}
                          onChange={(e) => setNewIndCategory(e.target.value)}
                        >
                          <option value="Environmental">Çevresel (Environmental)</option>
                          <option value="Social">Sosyal (Social)</option>
                          <option value="Economic & Governance">Ekonomik & Yönetişim</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label className="label">Kısa Açıklama</label>
                      <input 
                        type="text" 
                        placeholder="Gösterge hakkında ek açıklama yazın..." 
                        className="input-field" 
                        value={newIndDesc}
                        onChange={(e) => setNewIndDesc(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: "16px", display: "inline-flex", gap: "6px" }}>
                      <Plus size={16} />
                      Göstergeyi Kaydet
                    </button>
                  </form>

                  {/* Indicators Table */}
                  <div>
                    <h3 style={{ marginBottom: "12px", color: "var(--text-primary)" }}>Mevcut ESG Gösterge Listesi ({indicators.length} Adet)</h3>
                    <div className="table-container" style={{ maxHeight: "350px" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Kategori</th>
                            <th>Kod</th>
                            <th>Gösterge Adı</th>
                            <th style={{ textAlign: "right" }}>İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indicators.map(ind => (
                            <tr key={ind.code}>
                              <td>
                                <span className={`badge ${
                                  ind.category.toLowerCase().startsWith("env") 
                                    ? "badge-env" 
                                    : ind.category.toLowerCase().startsWith("soc") 
                                      ? "badge-soc" 
                                      : "badge-gov"
                                }`}>
                                  {ind.category}
                                </span>
                              </td>
                              <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{ind.code}</td>
                              <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ind.name}</td>
                              <td style={{ textAlign: "right" }}>
                                <button 
                                  className="btn btn-danger"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "var(--radius-sm)", display: "inline-flex", gap: "4px" }}
                                  onClick={() => handleDeleteIndicator(ind.code)}
                                >
                                  <Trash2 size={12} />
                                  Sil
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Logs subtab */}
              {adminTab === "logs" && (
                <div>
                  <div className="flex-between" style={{ marginBottom: "20px" }}>
                    <div>
                      <h2>Kullanıcı Aktivite Günlükleri (System Activity Logs)</h2>
                      <p>Kullanıcıların platformda gerçekleştirdiği indirme, ayıklama ve kayıt gibi tüm log kayıtları.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchAdminLogs} disabled={adminLoading}>
                      Yenile
                    </button>
                  </div>

                  {adminLoading ? (
                    <div className="flex-center" style={{ height: "200px" }}>
                      <RefreshCw className="spinner" />
                    </div>
                  ) : (
                    <div className="table-container" style={{ maxHeight: "400px" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Tarih & Saat</th>
                            <th>E-Posta</th>
                            <th>Yetki</th>
                            <th>İşlem Türü</th>
                            <th>İşlem Detayı</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminLogs.map(log => (
                            <tr key={log.id}>
                              <td style={{ fontSize: "0.8rem" }}>{new Date(log.timestamp).toLocaleString("tr-TR")}</td>
                              <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.userEmail}</td>
                              <td>
                                <span className={`badge ${
                                  log.userRole === "admin" ? "badge-gov" : log.userRole === "user" ? "badge-soc" : "badge-env"
                                }`} style={{ fontSize: "0.65rem" }}>
                                  {log.userRole.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{log.actionType}</td>
                              <td style={{ whiteSpace: "normal", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{log.description}</td>
                            </tr>
                          ))}
                          {adminLogs.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>Sistemde henüz bir işlem kaydı yok.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} SustainData. Tüm hakları saklıdır. Akademik Araştırma ve Analiz Desteği.</p>
        <p style={{ fontSize: "0.75rem", marginTop: "4px", color: "var(--text-muted)" }}>
          World Bank WDI API ve OpenAI GPT-4o-Mini entegrasyonu ile geliştirilmiştir. Entegre Rol Tabanlı Yetkilendirme Kontrolü.
        </p>
      </footer>
    </>
  );
}
