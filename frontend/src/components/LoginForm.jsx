import { useState } from "react";
import { Globe, AlertCircle, RefreshCw } from "lucide-react";

export default function LoginForm({ API_URL, setCurrentUser }) {
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState("viewer");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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
