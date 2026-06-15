import { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  Check 
} from "lucide-react";

export default function AdminPanel({ 
  API_URL, 
  currentUser, 
  indicators, 
  setIndicators 
}) {
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
  }, [currentUser, API_URL]);

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
  }, [currentUser, API_URL]);

  useEffect(() => {
    if (adminTab === "users") {
      fetchAdminUsers();
    } else if (adminTab === "logs") {
      fetchAdminLogs();
    }
  }, [adminTab, fetchAdminUsers, fetchAdminLogs]);

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

  if (!currentUser || currentUser.user.role !== "admin") {
    return (
      <div className="flex-center glass-card active-border" style={{ height: "300px", padding: "40px", textAlign: "center" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600 }}>Yetkisiz Erişim: Bu sayfayı görüntülemek için Yönetici (Admin) yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
      <section className="glass-card active-border">
        <div className="flex-between" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Yönetici Kontrol Paneli</h2>
            <p>Sistem kullanıcılarını yönetin, ESG veri göstergelerini düzenleyin ve sistem günlüklerini inceleyin.</p>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              className={`btn ${adminTab === "users" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setAdminTab("users")}
            >
              Kullanıcılar
            </button>
            <button 
              className={`btn ${adminTab === "indicators" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setAdminTab("indicators")}
            >
              ESG Göstergeleri
            </button>
            <button 
              className={`btn ${adminTab === "logs" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setAdminTab("logs")}
            >
              Sistem Günlükleri
            </button>
          </div>
        </div>

        {adminError && (
          <div className="auth-error flex-gap-sm" style={{ marginBottom: "16px" }}>
            <AlertCircle size={18} />
            <span>{adminError}</span>
          </div>
        )}

        {/* LOADING STATE */}
        {adminLoading && (
          <div className="flex-center" style={{ height: "200px" }}>
            <RefreshCw className="spinner" size={32} style={{ color: "var(--primary)" }} />
            <span style={{ marginLeft: "10px", color: "var(--text-secondary)" }}>Veriler yükleniyor...</span>
          </div>
        )}

        {/* USERS MANAGEMENT */}
        {!adminLoading && adminTab === "users" && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>E-Posta</th>
                  <th>Kayıt Tarihi</th>
                  <th>Mevcut Rol</th>
                  <th>Rolü Değiştir</th>
                  <th style={{ width: "100px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(user => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.email}</td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"}</td>
                    <td>
                      <span className={`badge ${
                        user.role === "admin" 
                          ? "badge-gov" 
                          : user.role === "user" 
                            ? "badge-soc" 
                            : "badge-env"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="input-field" 
                        style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto" }}
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        disabled={user.email === currentUser.user.email}
                      >
                        <option value="viewer">viewer</option>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }}
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.email === currentUser.user.email}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ESG INDICATORS MANAGEMENT */}
        {!adminLoading && adminTab === "indicators" && (
          <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 2fr", gap: "20px", padding: 0 }}>
            {/* Add indicator form */}
            <aside className="glass-card" style={{ padding: "16px", border: "1px solid var(--border-color)" }}>
              <h4 style={{ marginBottom: "16px", color: "var(--primary)" }}>Yeni Gösterge Tanımla</h4>
              
              {newIndSuccess && (
                <div style={{ color: "var(--success)", fontSize: "0.75rem", padding: "6px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "4px", marginBottom: "12px" }}>
                  {newIndSuccess}
                </div>
              )}

              <form onSubmit={handleAddIndicator} className="vertical-gap-md">
                <div>
                  <label className="label">Gösterge Kodu (Dünya Bankası / Custom)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Örn: EN.ATM.CO2E.PC" 
                    required 
                    value={newIndCode} 
                    onChange={(e) => setNewIndCode(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="label">Gösterge Adı (Türkçe)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Örn: Karbon Emisyonu (Kişi Başı)" 
                    required 
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
                    <option value="Economic & Governance">Yönetişim & Ekonomik (Economic & Governance)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Açıklama</label>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: "80px", resize: "none" }}
                    placeholder="Göstergenin detay açıklaması..."
                    value={newIndDesc}
                    onChange={(e) => setNewIndDesc(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
                  <Plus size={16} /> Gösterge Ekle
                </button>
              </form>
            </aside>

            {/* List indicators */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Adı</th>
                    <th>Kategori</th>
                    <th style={{ width: "80px", textAlign: "center" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map(ind => (
                    <tr key={ind.code}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{ind.code}</td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ind.name}</td>
                      <td>
                        <span className={`badge ${
                          ind.category === "Environmental" 
                            ? "badge-env" 
                            : ind.category === "Social" 
                              ? "badge-soc" 
                              : "badge-gov"
                        }`}>
                          {ind.category === "Environmental" ? "Çevre" : ind.category === "Social" ? "Sosyal" : "Yönetişim"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }}
                          onClick={() => handleDeleteIndicator(ind.code)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SYSTEM ACTIVITY LOGS */}
        {!adminLoading && adminTab === "logs" && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih / Saat</th>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>İşlem / Aksiyon</th>
                  <th>Detaylar</th>
                </tr>
              </thead>
              <tbody>
                {adminLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "-"}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.email || "Sistem / Anonim"}</td>
                    <td>
                      <span className={`badge ${
                        log.role === "admin" 
                          ? "badge-gov" 
                          : log.role === "user" 
                            ? "badge-soc" 
                            : "badge-env"
                      }`}>
                        {log.role || "system"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.action}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details}>
                      {log.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
