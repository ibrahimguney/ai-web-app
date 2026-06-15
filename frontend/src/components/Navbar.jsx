import { 
  Globe, 
  Sparkles, 
  BarChart2, 
  FileCheck, 
  Settings, 
  LogOut 
} from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, currentUser, handleLogout }) {
  if (!currentUser) return null;

  return (
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
        {(currentUser.user.role === "admin" || currentUser.user.role === "user") && (
          <button 
            className={`tab-btn ${activeTab === "n8n" ? "active" : ""}`}
            onClick={() => setActiveTab("n8n")}
          >
            <FileCheck size={18} />
            n8n Rapor Takipçisi
          </button>
        )}
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
  );
}
