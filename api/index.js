import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import * as XLSX from "xlsx";
import * as pdfParseModule from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import os from "os";

dotenv.config();

// Fallback to env.txt if variables are not in .env
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  dotenv.config({ path: "env.txt" });
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Helper function to parse PDF buffer supporting both pdf-parse 1.x.x and 2.x.x
async function parsePdfBuffer(dataBuffer) {
  if (pdfParseModule && pdfParseModule.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    return pdfData;
  } else {
    const parseFunc = typeof pdfParseModule === 'function' 
      ? pdfParseModule 
      : (pdfParseModule.default || pdfParseModule);
    if (typeof parseFunc !== 'function') {
      throw new Error("pdf-parse library is not loaded correctly.");
    }
    return await parseFunc(dataBuffer);
  }
}



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for large JSON exports
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Multer configuration for file uploads (stored in a temp directory)
const uploadDir = path.join(os.tmpdir(), "temp_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON Database File Paths
const usersFilePath = path.join(__dirname, "users.json");
const indicatorsFilePath = path.join(__dirname, "indicators.json");
const logsFilePath = path.join(__dirname, "activity_logs.json");

// Helper function to read/write JSON files
const readJsonFile = (filePath, defaultValue = []) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return defaultValue;
  }
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
};

// Activity logging helper
const logActivity = (user, actionType, description) => {
  const logs = readJsonFile(logsFilePath, []);
  const newLog = {
    id: "log_" + Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toISOString(),
    userEmail: user ? user.email : "anonymous",
    userRole: user ? user.role : "none",
    actionType,
    description
  };
  logs.unshift(newLog);
  writeJsonFile(logsFilePath, logs.slice(0, 100)); // Limit to last 100 logs
};

// Authentication & Authorization Middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    req.user = null;
    return next();
  }

  // Token format: Bearer <userID>
  const token = authHeader.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  const users = readJsonFile(usersFilePath, []);
  const user = users.find(u => u.id === token);
  if (user) {
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } else {
    req.user = null;
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Oturum açmanız gerekmektedir." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Bu işlemi gerçekleştirmek için yetkiniz yetersizdir." });
    }
    next();
  };
};

// --- AUTHENTICATION ENDPOINTS ---

// User Registration
app.post("/api/auth/register", (req, res) => {
  // role parametresini req.body'den çıkartıyoruz, dışarıdan alınmasını engelliyoruz
  const { email, password } = req.body; 
  if (!email || !password) {
    return res.status(400).json({ error: "E-posta ve şifre alanları zorunludur." });
  }

  const users = readJsonFile(usersFilePath, []);
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut." });
  }

  const newUser = {
    id: "u_" + Math.random().toString(36).substring(2, 11),
    email,
    password, 
    role: "viewer", // DIŞARIDAN NE GELİRSE GELSİN, VARSAYILAN OLARAK "viewer" YAPIYORUZ
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJsonFile(usersFilePath, users);

  logActivity(newUser, "Kayıt", "Yeni kullanıcı kaydı oluşturuldu.");

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role
  });
});

// User Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-posta ve şifre alanları zorunludur." });
  }

  const users = readJsonFile(usersFilePath, []);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Hatalı e-posta veya şifre girdiniz." });
  }

  logActivity(user, "Giriş", "Kullanıcı sisteme giriş yaptı.");

  res.json({
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});

// --- INDICATOR ENDPOINTS ---

// Get sustainability indicators metadata
app.get("/api/indicators", (req, res) => {
  const indicators = readJsonFile(indicatorsFilePath, []);
  res.json(indicators);
});

// Admin: Add new indicator
app.post("/api/indicators", authenticateUser, requireRole(["admin"]), (req, res) => {
  const { code, name, category, description } = req.body;
  if (!code || !name || !category) {
    return res.status(400).json({ error: "Gösterge kodu, adı ve kategorisi zorunludur." });
  }

  const indicators = readJsonFile(indicatorsFilePath, []);
  if (indicators.some(i => i.code.toLowerCase() === code.toLowerCase())) {
    return res.status(400).json({ error: "Bu gösterge kodu zaten mevcut." });
  }

  const newIndicator = { code, name, category, description: description || "" };
  indicators.push(newIndicator);
  writeJsonFile(indicatorsFilePath, indicators);

  logActivity(req.user, "Gösterge Ekleme", `Yeni ESG göstergesi eklendi: ${code} - ${name}`);

  res.status(201).json(newIndicator);
});

// Admin: Delete an indicator
app.delete("/api/indicators/:code", authenticateUser, requireRole(["admin"]), (req, res) => {
  const { code } = req.params;
  const indicators = readJsonFile(indicatorsFilePath, []);
  
  const initialLength = indicators.length;
  const filtered = indicators.filter(i => i.code.toLowerCase() !== code.toLowerCase());

  if (filtered.length === initialLength) {
    return res.status(404).json({ error: "Gösterge bulunamadı." });
  }

  writeJsonFile(indicatorsFilePath, filtered);

  logActivity(req.user, "Gösterge Silme", `Gösterge sistemden silindi: ${code}`);

  res.json({ message: "Gösterge başarıyla silindi." });
});

// --- ADMIN MANAGEMENT ENDPOINTS ---

// Admin: List all users
app.get("/api/admin/users", authenticateUser, requireRole(["admin"]), (req, res) => {
  const users = readJsonFile(usersFilePath, []);
  const sanitizedUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json(sanitizedUsers);
});

// Admin: Update user role
app.put("/api/admin/users/:id/role", authenticateUser, requireRole(["admin"]), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["admin", "user", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Geçersiz rol tanımlandı." });
  }

  const users = readJsonFile(usersFilePath, []);
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  }

  if (users[userIndex].id === req.user.id && role !== "admin") {
    return res.status(400).json({ error: "Kendi yöneticilik yetkinizi kaldıramazsınız." });
  }

  const oldRole = users[userIndex].role;
  users[userIndex].role = role;
  writeJsonFile(usersFilePath, users);

  logActivity(req.user, "Rol Güncelleme", `Kullanıcı (${users[userIndex].email}) rolü değiştirildi: ${oldRole} -> ${role}`);

  res.json({ id: users[userIndex].id, email: users[userIndex].email, role: users[userIndex].role });
});

// Admin: Delete user
app.delete("/api/admin/users/:id", authenticateUser, requireRole(["admin"]), (req, res) => {
  const { id } = req.params;
  const users = readJsonFile(usersFilePath, []);

  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  }

  if (users[userIndex].id === req.user.id) {
    return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  }

  const deletedUser = users[userIndex];
  users.splice(userIndex, 1);
  writeJsonFile(usersFilePath, users);

  logActivity(req.user, "Kullanıcı Silme", `Kullanıcı hesabı silindi: ${deletedUser.email}`);

  res.json({ message: "Kullanıcı başarıyla silindi." });
});

// Admin: Get usage/activity logs
app.get("/api/admin/logs", authenticateUser, requireRole(["admin"]), (req, res) => {
  const logs = readJsonFile(logsFilePath, []);
  res.json(logs);
});

// --- CORE FUNCTIONAL ENDPOINTS (SECURED) ---

// Endpoint: Export sustainability data to Excel, SPSS, or STATA
app.post("/api/export", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    const { data, format } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Missing or invalid data for export" });
    }

    const fileFormat = format ? format.toLowerCase() : "xlsx";

    // Log the activity
    logActivity(req.user, "Veri Aktarımı", `Veriler dışa aktarıldı. Format: ${fileFormat.toUpperCase()}, Boyut: ${data.length} satır`);

    // 1. Export to Excel (using JS directly)
    if (fileFormat === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Sustainability Data");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", 'attachment; filename="sustainability_data.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    }

    // 2. Export to SPSS (.sav) or STATA (.dta) using Python script
    if (fileFormat === "spss" || fileFormat === "stata") {
      const tempId = Math.random().toString(36).substring(7);
      const tempJsonPath = path.join(os.tmpdir(), `temp_${tempId}.json`);
      const fileExt = fileFormat === "spss" ? "sav" : "dta";
      const tempOutPath = path.join(os.tmpdir(), `temp_${tempId}.${fileExt}`);

      // Write data to temporary JSON file
      fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), "utf-8");

      // Execute Python script
      const convertPyPath = path.join(__dirname, "..", "convert.py");
      const cmd = `python "${convertPyPath}" "${tempJsonPath}" "${tempOutPath}" "${fileFormat}"`;
      
      exec(cmd, (error, stdout, stderr) => {
        // Clean up input json file immediately
        if (fs.existsSync(tempJsonPath)) {
          fs.unlinkSync(tempJsonPath);
        }

        if (error) {
          console.error("Python exec error:", error);
          console.error("Python stderr:", stderr);
          return res.status(500).json({ error: "Conversion failed", details: stderr });
        }

        if (!fs.existsSync(tempOutPath)) {
          return res.status(500).json({ error: "Output file was not generated by Python" });
        }

        // Send output file
        const contentType = fileFormat === "spss"
          ? "application/x-spss-sav"
          : "application/x-stata-dta";

        res.setHeader("Content-Disposition", `attachment; filename="sustainability_data.${fileExt}"`);
        res.setHeader("Content-Type", contentType);
        
        res.sendFile(tempOutPath, {}, (err) => {
          // Clean up output file after send
          if (fs.existsSync(tempOutPath)) {
            fs.unlinkSync(tempOutPath);
          }
          if (err) {
            console.error("File sending error:", err);
          }
        });
      });
      return;
    }

    return res.status(400).json({ error: "Unsupported format" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Extract sustainability indicators from PDF/Text reports using LLM
app.post("/api/extract", upload.single("reportFile"), authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    let reportText = "";

    // 1. Get text content from file or raw text input
    if (req.file) {
      const filePath = req.file.path;
      if (req.file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await parsePdfBuffer(dataBuffer);
        reportText = typeof pdfData === 'string' ? pdfData : (pdfData.text || "");
      } else {
        // Text file
        reportText = fs.readFileSync(filePath, "utf-8");
      }
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } else if (req.body.text) {
      reportText = req.body.text;
    } else {
      return res.status(400).json({ error: "No file uploaded or text provided." });
    }

    if (!reportText || reportText.trim().length === 0) {
      return res.status(400).json({ error: "Empty report content." });
    }

    // Truncate to save token limits if extremely large
    const maxChars = 200000;
    if (reportText.length > maxChars) {
      reportText = reportText.substring(0, maxChars) + "\n\n[TRUNCATED FOR LENGTH]";
    }

    // Log the activity
    logActivity(req.user, "Yapay Zeka Analizi", `ESG Analizcisi çalıştırıldı. Kaynak: ${req.file ? "PDF Dosyası (" + req.file.originalname + ")" : "Metin Alanı"}`);

    const customPrompt = req.body.prompt || `Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
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
}`;

    // 2. Query OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert ESG (Environmental, Social, Governance) analyst. Extract all quantitative indicators from reports. Always return your response in a valid JSON object format containing an 'indicators' array, and nothing else.",
        },
        {
          role: "user",
          content: `${customPrompt}\n\n[RAPOR METNİ]:\n${reportText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    let aiOutput = response.choices[0].message.content;

    // Parse the JSON output
    aiOutput = aiOutput.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let resultJson;
    try {
      resultJson = JSON.parse(aiOutput);
      if (!Array.isArray(resultJson)) {
        const keys = Object.keys(resultJson);
        for (const key of keys) {
          if (Array.isArray(resultJson[key])) {
            resultJson = resultJson[key];
            break;
          }
        }
      }
    } catch (e) {
      console.error("JSON parsing error on AI output:", aiOutput);
      return res.status(500).json({ error: "AI output is not a valid JSON structure", raw: aiOutput });
    }

    res.json({ data: resultJson });

  } catch (err) {
    console.error("Extraction error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: AI Assistant Chat
app.post("/chat", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    const { message } = req.body;

    // Log the activity
    logActivity(req.user, "AI Chat", `Soru soruldu: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sürdürülebilirlik araştırmaları, ESG göstergeleri ve makale yazımı konusunda yardımcı olan uzman bir asistansın." },
        { role: "user", content: message }
      ]
    });

    const aiText = response.choices[0].message.content;

    res.json({ answer: aiText });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Advanced ML Analytics
app.post("/api/analyze", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    const { data, model_type, target, features } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Eksik veya geçersiz veri." });
    }
    if (!model_type || !target || !features || !Array.isArray(features)) {
      return res.status(400).json({ error: "Model yapılandırması eksik (model_type, target, features)." });
    }

    logActivity(req.user, "İleri Düzey Analiz", `${model_type.toUpperCase()} modeli çalıştırıldı. Hedef: ${target}`);

    const tempId = Math.random().toString(36).substring(7);
    const configPath = path.join(os.tmpdir(), `temp_config_${tempId}.json`);
    const outputPath = path.join(os.tmpdir(), `temp_output_${tempId}.json`);

    const config = { data, model_type, target, features };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    const analyzePyPath = path.join(__dirname, "..", "analyze.py");
    const cmd = `python "${analyzePyPath}" "${configPath}" "${outputPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      // Clean up config file
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

      if (error) {
        console.error("Python exec error:", error);
        console.error("Python stderr:", stderr);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return res.status(500).json({ error: "Analiz sırasında Python hatası oluştu.", details: stderr });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: "Analiz sonucu oluşturulamadı." });
      }

      try {
        const resultData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
        fs.unlinkSync(outputPath); // Clean up output file
        
        if (resultData.error) {
           return res.status(400).json({ error: resultData.error, details: resultData.traceback });
        }
        res.json(resultData);
      } catch (parseErr) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        res.status(500).json({ error: "Python çıktı formatı okunamadı.", details: parseErr.message });
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- n8n BIST REPORT TRACKER ENDPOINTS ---

// Get n8n report sources
app.get("/api/n8n/sources", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase bağlantısı yapılandırılmamış. Lütfen çevre değişkenlerini kontrol edin." });
    }
    const { data, error } = await supabase
      .from("report_sources")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Sources fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add n8n report source
app.post("/api/n8n/sources", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase bağlantısı yapılandırılmamış." });
    }
    const { company_name, ticker, report_year, source_type, source_url } = req.body;
    if (!company_name || !source_url) {
      return res.status(400).json({ error: "Şirket adı ve kaynak URL alanları zorunludur." });
    }
    const { data, error } = await supabase
      .from("report_sources")
      .insert([
        { 
          company_name, 
          ticker: ticker || "", 
          report_year: report_year || "2024", 
          source_type: source_type || "investor_relations_page",
          is_active: true
        }
      ])
      .select();
    
    if (error) throw error;
    
    logActivity(req.user, "n8n Kaynak Ekleme", `Yeni rapor takip kaynağı eklendi: ${company_name} (${ticker || "N/A"})`);
    res.status(201).json(data[0]);
  } catch (err) {
    console.error("Source add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete n8n report source
app.delete("/api/n8n/sources/:id", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase bağlantısı yapılandırılmamış." });
    }
    const { id } = req.params;
    const { data, error } = await supabase
      .from("report_sources")
      .delete()
      .eq("id", id)
      .select();
    
    if (error) throw error;
    
    logActivity(req.user, "n8n Kaynak Silme", `Rapor takip kaynağı silindi (ID: ${id})`);
    res.json({ message: "Kaynak başarıyla silindi.", data });
  } catch (err) {
    console.error("Source delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get n8n report link checks (crawl results)
app.get("/api/n8n/checks", authenticateUser, requireRole(["admin", "user"]), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase bağlantısı yapılandırılmamış. Lütfen çevre değişkenlerini kontrol edin." });
    }
    const { data, error } = await supabase
      .from("report_link_checks")
      .select("*")
      .order("checked_at", { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Checks fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint for World Bank API (bypasses browser CORS & corporate proxy filters)
app.get("/api/proxy/worldbank", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "url parameter is required" });
    }
    
    // Safety check: ensure target is a worldbank API URL
    if (!url.startsWith("https://api.worldbank.org/")) {
      return res.status(400).json({ error: "Only api.worldbank.org is allowed" });
    }
    
    const response = await fetch(url);
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: `World Bank proxy failed: ${err.message}` });
  }
});

app.get("/", (req, res) => {
  res.send("Sustainability AI Backend Running with Admin/User/Viewer Role Enforcements 🚀");
});

const PORT = process.env.PORT || 3001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;