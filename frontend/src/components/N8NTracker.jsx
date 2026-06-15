import { useState, useEffect, useCallback } from "react";
import { 
  Download, 
  Table, 
  Plus, 
  Trash2, 
  AlertCircle, 
  RefreshCw 
} from "lucide-react";

export default function N8NTracker({ 
  API_URL, 
  currentUser, 
  n8nChecks, 
  setN8nChecks 
}) {
  const [n8nSources, setN8nSources] = useState([]);
  const [loadingN8n, setLoadingN8n] = useState(false);
  const [n8nError, setN8nError] = useState("");
  const [n8nScoreFilter, setN8nScoreFilter] = useState(0);
  const [n8nStatusFilter, setN8nStatusFilter] = useState("All");

  // Add Source Form States
  const [n8nNewCompany, setN8nNewCompany] = useState("");
  const [n8nNewTicker, setN8nNewTicker] = useState("");
  const [n8nNewYear, setN8nNewYear] = useState("2024");
  const [n8nNewSourceType, setN8nNewSourceType] = useState("investor_relations_page");
  const [n8nNewSourceUrl, setN8nNewSourceUrl] = useState("");
  const [n8nFormError, setN8nFormError] = useState("");
  const [n8nFormSuccess, setN8nFormSuccess] = useState("");
  const [exporting, setExporting] = useState(false);

  // Fetch n8n Data
  const fetchN8nData = useCallback(async () => {
    if (!currentUser || (currentUser.user.role !== "admin" && currentUser.user.role !== "user")) return;
    setLoadingN8n(true);
    setN8nError("");
    try {
      // Fetch sources
      const sourcesRes = await fetch(`${API_URL}/api/n8n/sources`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const sourcesData = await sourcesRes.json();
      if (!sourcesRes.ok) throw new Error(sourcesData.error || "Takip kaynakları yüklenemedi.");
      setN8nSources(sourcesData);

      // Fetch checks
      const checksRes = await fetch(`${API_URL}/api/n8n/checks`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const checksData = await checksRes.json();
      if (!checksRes.ok) throw new Error(checksData.error || "Link kontrol sonuçları yüklenemedi.");
      setN8nChecks(checksData);
    } catch (err) {
      setN8nError(err.message);
    } finally {
      setLoadingN8n(false);
    }
  }, [currentUser, API_URL, setN8nChecks]);

  useEffect(() => {
    fetchN8nData();
  }, [fetchN8nData]);

  const handleAddN8nSource = async (e) => {
    e.preventDefault();
    setN8nFormError("");
    setN8nFormSuccess("");
    try {
      const res = await fetch(`${API_URL}/api/n8n/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          company_name: n8nNewCompany,
          ticker: n8nNewTicker,
          report_year: n8nNewYear,
          source_type: n8nNewSourceType,
          source_url: n8nNewSourceUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaynak eklenemedi.");

      setN8nFormSuccess("Yeni takip kaynağı başarıyla eklendi. n8n bir sonraki çalışmada bu sayfayı tarayacak.");
      setN8nNewCompany("");
      setN8nNewTicker("");
      setN8nNewSourceUrl("");
      
      fetchN8nData();
    } catch (err) {
      setN8nFormError(err.message);
    }
  };

  const handleDeleteN8nSource = async (id) => {
    if (!confirm("Bu takip kaynağını silmek istediğinize emin misiniz?")) return;
    setN8nError("");
    try {
      const res = await fetch(`${API_URL}/api/n8n/sources/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaynak silinemedi.");

      fetchN8nData();
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handleExportN8nUrls = () => {
    if (n8nChecks.length === 0) return;
    
    const filtered = n8nChecks.filter(check => {
      const matchesScore = (check.validation_score || 0) >= n8nScoreFilter;
      const matchesStatus = n8nStatusFilter === "All" || check.validation_status === n8nStatusFilter;
      return matchesScore && matchesStatus;
    });

    const urls = filtered
      .map(check => check.candidate_url)
      .filter(url => url)
      .join("\n");

    if (!urls) {
      alert("Filtreleme kriterlerine uygun URL bulunamadı.");
      return;
    }

    const blob = new Blob([urls], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `n8n_validated_report_urls_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportN8nExcel = async () => {
    if (n8nChecks.length === 0) return;
    setExporting(true);
    try {
      const filtered = n8nChecks.filter(check => {
        const matchesScore = (check.validation_score || 0) >= n8nScoreFilter;
        const matchesStatus = n8nStatusFilter === "All" || check.validation_status === n8nStatusFilter;
        return matchesScore && matchesStatus;
      }).map(check => ({
        "Şirket Adı": check.company_name || "-",
        "BIST Kodu": check.ticker || "-",
        "Rapor Yılı": check.report_year || "-",
        "Ana Kaynak URL": check.source_url || "-",
        "Aday Rapor URL": check.candidate_url || "-",
        "HTTP Durumu": check.status_code || "-",
        "İçerik Tipi": check.content_type || "-",
        "PDF mi": check.is_pdf ? "Evet" : "Hayır",
        "URL'de Yıl Var mı": check.year_in_url ? "Evet" : "Hayır",
        "Doğruluk Skoru": check.validation_score || 0,
        "Durum": check.validation_status || "-",
        "Hata Mesajı": check.error_message || "-",
        "Kontrol Tarihi": check.checked_at ? new Date(check.checked_at).toLocaleString("tr-TR") : "-"
      }));

      if (filtered.length === 0) {
        alert("Filtrelenmiş tabloda veri bulunmamaktadır.");
        setExporting(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/export`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ data: filtered, format: "xlsx" })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Dışa aktarma başarısız.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `n8n_report_tracking_export_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      {/* Left Panel: Report Sources */}
      <aside className="glass-card vertical-gap-lg" style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
        <div>
          <h3 style={{ color: "var(--text-primary)" }}>1. Takip Kaynakları</h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>n8n BIST rapor takipçisinin tarayacağı sayfalar.</span>
          <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", margin: "12px 0" }} />
        </div>

        {/* Add New Source Form */}
        <form onSubmit={handleAddN8nSource} className="vertical-gap-md" style={{ background: "rgba(255, 255, 255, 0.02)", padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)" }}>Yeni Kaynak Ekle</span>
          
          {n8nFormError && (
            <div style={{ color: "var(--danger)", fontSize: "0.75rem", padding: "6px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "4px" }}>
              {n8nFormError}
            </div>
          )}
          {n8nFormSuccess && (
            <div style={{ color: "var(--success)", fontSize: "0.75rem", padding: "6px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "4px" }}>
              {n8nFormSuccess}
            </div>
          )}

          <div>
            <label className="label">Şirket Adı</label>
            <input type="text" className="input-field" placeholder="Örn: Arçelik" required value={n8nNewCompany} onChange={(e) => setN8nNewCompany(e.target.value)} />
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label className="label">BIST Kodu</label>
              <input type="text" className="input-field" placeholder="ARCLK" value={n8nNewTicker} onChange={(e) => setN8nNewTicker(e.target.value)} />
            </div>
            <div>
              <label className="label">Rapor Yılı</label>
              <input type="text" className="input-field" placeholder="2024" value={n8nNewYear} onChange={(e) => setN8nNewYear(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Kaynak Türü</label>
            <select className="input-field" value={n8nNewSourceType} onChange={(e) => setN8nNewSourceType(e.target.value)}>
              <option value="investor_relations_page">Yatırımcı İlişkileri Sayfası</option>
              <option value="reports_page">Raporlar / Faaliyet Raporları Sayfası</option>
              <option value="sustainability_page">Sürdürülebilirlik Sayfası</option>
            </select>
          </div>

          <div>
            <label className="label">Kaynak URL</label>
            <input type="url" className="input-field" placeholder="https://..." required value={n8nNewSourceUrl} onChange={(e) => setN8nNewSourceUrl(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "6px" }}>
            <Plus size={16} /> Takip Kaynağı Ekle
          </button>
        </form>

        {/* Sources List */}
        <div style={{ marginTop: "12px" }}>
          <span className="label" style={{ marginBottom: "8px", display: "block" }}>Mevcut Takip Listesi ({n8nSources.length})</span>
          {n8nSources.length === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>Kayıtlı takip kaynağı bulunmuyor.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {n8nSources.map((source) => (
                <div key={source.id} className="glass-card flex-between" style={{ padding: "10px", fontSize: "0.8rem", border: "1px solid var(--border-color)", background: "rgba(255, 255, 255, 0.01)" }}>
                  <div style={{ overflow: "hidden", marginRight: "8px", flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{source.company_name} {source.ticker && `(${source.ticker})`}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      <a href={source.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{source.source_url}</a>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px" }}>Yıl: {source.report_year} | Tür: {source.source_type}</div>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }} onClick={() => handleDeleteN8nSource(source.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right Panel: Link Check Results */}
      <section className="glass-card active-border" style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(100vh - 180px)" }}>
        <div className="flex-between">
          <div>
            <h2>n8n Link Tarama Sonuçları ({n8nChecks.length})</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              n8n robotunun web sitelerini tarayarak tespit ettiği sürdürülebilirlik raporu dosya bağlantıları.
            </span>
          </div>
          
          {/* Export & Actions */}
          <div className="flex-gap-sm">
            <button className="btn btn-secondary" style={{ display: "flex", gap: "6px" }} onClick={handleExportN8nUrls} disabled={n8nChecks.length === 0}>
              <Download size={16} /> URL Listesi (TXT)
            </button>
            <button className="btn btn-primary" style={{ display: "flex", gap: "6px" }} onClick={handleExportN8nExcel} disabled={n8nChecks.length === 0 || exporting}>
              <Table size={16} /> Excel İndir
            </button>
          </div>
        </div>

        <hr style={{ borderColor: "var(--border-color)", borderStyle: "solid", borderWidth: "0 0 1px 0", margin: "0" }} />

        {/* Filters */}
        <div className="flex-gap-md" style={{ background: "rgba(255, 255, 255, 0.02)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
          <div style={{ flex: 1 }}>
            <span className="label">Min Yapay Zeka Doğruluk Skoru: {n8nScoreFilter}</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5" 
              className="input-field" 
              style={{ cursor: "pointer", height: "6px", padding: 0 }}
              value={n8nScoreFilter} 
              onChange={(e) => setN8nScoreFilter(parseInt(e.target.value))} 
            />
          </div>
          
          <div style={{ width: "200px" }}>
            <span className="label">Crawl Durumu</span>
            <select className="input-field" value={n8nStatusFilter} onChange={(e) => setN8nStatusFilter(e.target.value)}>
              <option value="All">Tümü</option>
              <option value="success">Başarılı (success)</option>
              <option value="pending">İnceleniyor (pending)</option>
              <option value="failed">Hatalı (failed)</option>
            </select>
          </div>
        </div>

        {/* Results Table */}
        {loadingN8n ? (
          <div className="flex-center" style={{ flex: 1 }}>
            <RefreshCw className="spinner" size={32} style={{ color: "var(--primary)" }} />
            <span style={{ marginLeft: "10px", color: "var(--text-secondary)" }}>Veriler veritabanından çekiliyor...</span>
          </div>
        ) : n8nError ? (
          <div className="flex-center" style={{ flex: 1, flexDirection: "column", gap: "10px", color: "var(--danger)" }}>
            <AlertCircle size={32} />
            <span>Veritabanı bağlantı hatası: {n8nError}</span>
          </div>
        ) : n8nChecks.length === 0 ? (
          <div className="flex-center" style={{ flex: 1 }}>
            <span style={{ color: "var(--text-muted)" }}>Henüz taranmış rapor kaydı bulunmuyor. n8n robotu çalıştığında veriler burada listelenecektir.</span>
          </div>
        ) : (
          <div className="table-container" style={{ flex: 1, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Şirket</th>
                  <th>Kod</th>
                  <th>Yıl</th>
                  <th>Skor</th>
                  <th>Aday PDF Bağlantısı</th>
                  <th>Hata Detayı</th>
                  <th>Kontrol Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {n8nChecks
                  .filter(check => {
                    const matchesScore = (check.validation_score || 0) >= n8nScoreFilter;
                    const matchesStatus = n8nStatusFilter === "All" || check.validation_status === n8nStatusFilter;
                    return matchesScore && matchesStatus;
                  })
                  .map((check) => (
                    <tr key={check.id}>
                      <td>
                        <span className={`badge ${
                          check.validation_status === "success" 
                            ? "badge-env" 
                            : check.validation_status === "pending" 
                              ? "badge-soc" 
                              : "badge-gov"
                        }`}>
                          {check.validation_status === "success" ? "Başarılı" : check.validation_status === "pending" ? "İnceleniyor" : "Hatalı"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{check.company_name || "-"}</td>
                      <td>{check.ticker || "-"}</td>
                      <td>{check.report_year || "-"}</td>
                      <td style={{ fontWeight: 700, color: (check.validation_score || 0) >= 80 ? "var(--success)" : (check.validation_score || 0) >= 50 ? "var(--warning)" : "var(--danger)" }}>
                        {check.validation_score !== null && check.validation_score !== undefined ? `%${check.validation_score}` : "-"}
                      </td>
                      <td style={{ fontSize: "0.8rem", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <a href={check.candidate_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{check.candidate_url}</a>
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-secondary)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {check.error_message || "-"}
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>
                        {check.checked_at ? new Date(check.checked_at).toLocaleDateString("tr-TR") : "-"}
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
