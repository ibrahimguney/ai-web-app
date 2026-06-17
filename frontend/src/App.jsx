import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import LoginForm from "./components/LoginForm";
import MacroDownloader from "./components/MacroDownloader";
import ReportExtractor from "./components/ReportExtractor";
import MlAnalytics from "./components/MlAnalytics";
import N8NTracker from "./components/N8NTracker";
import AdminPanel from "./components/AdminPanel";

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
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("sustain_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState("worldbank"); // 'worldbank', 'analyzer', 'ml', 'n8n', 'admin'

  // Metadata
  const [indicators, setIndicators] = useState([]);
  const [countries, setCountries] = useState(COMMON_COUNTRIES);

  // Shared Datasets for ML analytics
  const [fetchedData, setFetchedData] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [n8nChecks, setN8nChecks] = useState([]);

  // Fetch Metadata (indicators from backend, countries from World Bank)
  useEffect(() => {
    async function loadMetadata() {
      try {
        const indResponse = await fetch(`${API_URL}/api/indicators`);
        if (indResponse.ok) {
          const indData = await indResponse.json();
          setIndicators(indData);
        }

        let countResponse;
        const countUrl = "https://api.worldbank.org/v2/country?format=json&per_page=300";
        try {
          countResponse = await fetch(countUrl);
          if (!countResponse.ok) throw new Error();
        } catch (e) {
          countResponse = await fetch(`${API_URL}/api/proxy/worldbank?url=${encodeURIComponent(countUrl)}`);
        }

        if (countResponse && countResponse.ok) {
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

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("sustain_user");
    setActiveTab("worldbank");
  };

  if (!currentUser) {
    return <LoginForm API_URL={API_URL} setCurrentUser={setCurrentUser} />;
  }

  return (
    <>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        handleLogout={handleLogout} 
      />
      <main style={{ flex: 1, paddingBottom: "40px" }}>
        {activeTab === "worldbank" && (
          <MacroDownloader 
            API_URL={API_URL} 
            currentUser={currentUser} 
            indicators={indicators} 
            countries={countries} 
            fetchedData={fetchedData} 
            setFetchedData={setFetchedData} 
          />
        )}
        
        {activeTab === "analyzer" && (
          <ReportExtractor 
            API_URL={API_URL} 
            currentUser={currentUser} 
            extractedData={extractedData} 
            setExtractedData={setExtractedData} 
          />
        )}

        {activeTab === "ml" && (
          <MlAnalytics 
            API_URL={API_URL} 
            currentUser={currentUser} 
            fetchedData={fetchedData} 
            n8nChecks={n8nChecks} 
            extractedData={extractedData} 
            indicators={indicators} 
            selectedIndicators={fetchedData.length > 0 ? Array.from(new Set(fetchedData.flatMap(Object.keys))).filter(k => k !== "Country" && k !== "Code" && k !== "Year") : []}
          />
        )}

        {activeTab === "n8n" && (
          <N8NTracker 
            API_URL={API_URL} 
            currentUser={currentUser} 
            n8nChecks={n8nChecks} 
            setN8nChecks={setN8nChecks} 
          />
        )}

        {activeTab === "admin" && (
          <AdminPanel 
            API_URL={API_URL} 
            currentUser={currentUser} 
            indicators={indicators} 
            setIndicators={setIndicators} 
          />
        )}
      </main>
    </>
  );
}