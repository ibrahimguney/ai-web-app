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
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const p = require("pdf-parse");
const pdfParse = p.PDFParse || p;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for large JSON exports
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Multer configuration for file uploads (stored in a temp directory)
const uploadDir = path.join(__dirname, "temp_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: "temp_uploads/" });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Predefined Sustainability Indicators (categorized for ease of use)
const SUSTAINABILITY_INDICATORS = [
  // Environmental Indicators
  { code: "EN.ATM.CO2E.PC", name: "CO2 emissions (metric tons per capita)", category: "Environmental", description: "Carbon dioxide emissions from energy use, per person." },
  { code: "EN.ATM.CO2E.KT", name: "CO2 emissions (kt)", category: "Environmental", description: "Total carbon dioxide emissions in kilotons." },
  { code: "EN.ATM.GHGT.KT.CE", name: "Total greenhouse gas emissions (kt CO2 eq)", category: "Environmental", description: "Sum of all greenhouse gas emissions." },
  { code: "EN.ATM.METH.KT.CE", name: "Methane emissions (kt CO2 eq)", category: "Environmental", description: "Methane emissions in carbon dioxide equivalent." },
  { code: "EN.ATM.NOXE.KT.CE", name: "Nitrous oxide emissions (kt CO2 eq)", category: "Environmental", description: "Nitrous oxide emissions in carbon dioxide equivalent." },
  { code: "EG.FEC.RNEW.ZS", name: "Renewable energy consumption (% of total final energy)", category: "Environmental", description: "Share of renewable energy in total final energy consumption." },
  { code: "EG.ELC.RNEW.ZS", name: "Renewable electricity output (% of total electricity)", category: "Environmental", description: "Share of electricity produced from renewable sources." },
  { code: "AG.LND.FRST.ZS", name: "Forest area (% of land area)", category: "Environmental", description: "Forest area is land under natural or planted stands of trees." },
  { code: "EN.ATM.PM25.MC.M3", name: "PM2.5 air pollution, mean annual exposure (micrograms/m³)", category: "Environmental", description: "Population-weighted exposure to ambient PM2.5." },
  { code: "EG.ELC.ACCS.ZS", name: "Access to electricity (% of population)", category: "Environmental", description: "Percentage of population with access to electricity." },
  { code: "NY.GDP.TOTL.RT.ZS", name: "Total natural resources rents (% of GDP)", category: "Environmental", description: "Sum of oil rents, natural gas rents, coal rents, mineral rents, and forest rents." },
  { code: "AG.LND.AGRI.ZS", name: "Agricultural land (% of land area)", category: "Environmental", description: "Share of land area that is arable, under permanent crops, or permanent pastures." },
  { code: "ER.PTD.TOTL.GD.ZS", name: "Terrestrial & marine protected areas (% of total area)", category: "Environmental", description: "Percentage of territorial area that is nationally protected." },
  { code: "EG.USE.COMM.GD.PP.KD", name: "Energy use (kg oil equivalent per capita)", category: "Environmental", description: "Energy use per person, measured in kg of oil equivalent." },
  { code: "EG.ELC.COAL.ZS", name: "Electricity production from coal sources (% of total)", category: "Environmental", description: "Share of electricity generated using coal." },

  // Social Indicators
  { code: "SP.DYN.LE00.IN", name: "Life expectancy at birth, total (years)", category: "Social", description: "Number of years a newborn infant would live if prevailing patterns of mortality at the time of its birth were to stay the same." },
  { code: "SH.DYN.MORT", name: "Mortality rate, under-5 (per 1,000 live births)", category: "Social", description: "Probability of dying between birth and exactly five years of age per 1,000 live births." },
  { code: "SH.H2O.SMGW.ZS", name: "People using safely managed drinking water (% of population)", category: "Social", description: "Percentage of people using drinking water from an improved source that is accessible on premises, available when needed and free from contamination." },
  { code: "SH.STA.SMTC.ZS", name: "People using safely managed sanitation (% of population)", category: "Social", description: "Percentage of people using improved sanitation facilities that are not shared with other households and where excreta are safely disposed of in situ or transported and treated off-site." },
  { code: "SE.PRM.ENRR", name: "School enrollment, primary (% gross)", category: "Social", description: "Total enrollment in primary education, regardless of age, expressed as a percentage of the population of official primary education age." },
  { code: "SE.SEC.ENRR", name: "School enrollment, secondary (% gross)", category: "Social", description: "Total enrollment in secondary education, regardless of age." },
  { code: "SE.TER.ENRR", name: "School enrollment, tertiary (% gross)", category: "Social", description: "Total enrollment in tertiary education, regardless of age." },
  { code: "SE.ADT.LITR.ZS", name: "Literacy rate, adult total (% of people ages 15+)", category: "Social", description: "Percentage of people aged 15 and above who can both read and write with understanding a short simple statement about their everyday life." },
  { code: "SL.UEM.TOTL.ZS", name: "Unemployment, total (% of total labor force)", category: "Social", description: "Share of the labor force that is without work but available for and seeking employment." },
  { code: "SL.TLF.CACT.FE.ZS", name: "Labor force participation rate, female (% of female pop 15+)", category: "Social", description: "Percentage of female population aged 15 and older that is economically active." },
  { code: "SI.POV.GINI", name: "Gini index (World Bank estimate)", category: "Social", description: "Gini index measures the extent to which the distribution of income among individuals or households within an economy deviates from a perfectly equal distribution." },
  { code: "SI.POV.NAHC", name: "Poverty headcount ratio at national poverty lines (% of pop)", category: "Social", description: "Percentage of the population living below the national poverty line." },
  { code: "EG.CFT.ACCS.ZS", name: "Access to clean fuels and cooking technologies (% of pop)", category: "Social", description: "Percentage of population with primary reliance on clean fuels and technology for cooking." },
  { code: "IQ.CPA.GEND.XQ", name: "CPIA gender equality rating (1=low to 6=high)", category: "Social", description: "Measures the extent to which the country has installed institutions and programs to promote gender equality." },

  // Economic & Governance Indicators
  { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth (annual %)", category: "Economic & Governance", description: "Annual percentage growth rate of GDP at market prices based on constant local currency." },
  { code: "NY.GDP.PCAP.KD", name: "GDP per capita (constant 2015 US$)", category: "Economic & Governance", description: "GDP per capita is gross domestic product divided by midyear population, in constant 2015 dollars." },
  { code: "FP.CPI.TOTL.ZG", name: "Inflation, consumer prices (annual %)", category: "Economic & Governance", description: "Annual percentage change in the cost to the average consumer of acquiring a basket of goods and services." },
  { code: "NV.IND.TOTL.ZS", name: "Industry, value added (% of GDP)", category: "Economic & Governance", description: "Net output of industry (mining, manufacturing, construction, electricity, water, gas) divided by GDP." },
  { code: "NV.SRV.TOTL.ZS", name: "Services, value added (% of GDP)", category: "Economic & Governance", description: "Net output of services sector divided by GDP." },
  { code: "NV.AGR.TOTL.ZS", name: "Agriculture, forestry, and fishing, value added (% of GDP)", category: "Economic & Governance", description: "Net output of agriculture sector divided by GDP." },
  { code: "BX.KLT.DINV.WD.GD.ZS", name: "Foreign direct investment, net inflows (% of GDP)", category: "Economic & Governance", description: "Net inflows of investment to acquire a lasting management interest in an enterprise operating in an economy other than that of the investor." },
  { code: "GB.XPD.RSDV.GD.ZS", name: "Research and development expenditure (% of GDP)", category: "Economic & Governance", description: "Gross domestic expenditure on R&D as a percentage of GDP." },
  { code: "TX.VAL.TECH.MF.ZS", name: "High-technology exports (% of manufactured exports)", category: "Economic & Governance", description: "Products with high R&D intensity, such as in aerospace, computers, pharmaceuticals, scientific instruments, and electrical machinery." },
  { code: "IP.PAT.RESD", name: "Patent applications, residents", category: "Economic & Governance", description: "Patent applications filed by residents of the country." },
  { code: "MS.MIL.XPND.GD.ZS", name: "Military expenditure (% of GDP)", category: "Economic & Governance", description: "Military expenditures as a percentage of GDP." },
  { code: "SE.XPD.TOTL.GD.ZS", name: "Government expenditure on education, total (% of GDP)", category: "Economic & Governance", description: "Total public expenditure on education (current and capital) expressed as a percentage of GDP." }
];

// Endpoint: Get sustainability indicators metadata
app.get("/api/indicators", (req, res) => {
  res.json(SUSTAINABILITY_INDICATORS);
});

// Endpoint: Export sustainability data to Excel, SPSS, or STATA
app.post("/api/export", async (req, res) => {
  try {
    const { data, format } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Missing or invalid data for export" });
    }

    const fileFormat = format ? format.toLowerCase() : "xlsx";

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
      const tempJsonPath = path.join(__dirname, `temp_${tempId}.json`);
      const fileExt = fileFormat === "spss" ? "sav" : "dta";
      const tempOutPath = path.join(__dirname, `temp_${tempId}.${fileExt}`);

      // Write data to temporary JSON file
      fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), "utf-8");

      // Execute Python script
      const cmd = `python convert.py "${tempJsonPath}" "${tempOutPath}" "${fileFormat}"`;
      
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
app.post("/api/extract", upload.single("reportFile"), async (req, res) => {
  try {
    let reportText = "";

    // 1. Get text content from file or raw text input
    if (req.file) {
      const filePath = req.file.path;
      if (req.file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        reportText = pdfData.text;
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

    // Truncate to save token limits if extremely large (e.g. 150k characters is ~35k tokens, easily fits in gpt-4o-mini / gemini)
    const maxChars = 200000;
    if (reportText.length > maxChars) {
      reportText = reportText.substring(0, maxChars) + "\n\n[TRUNCATED FOR LENGTH]";
    }

    const customPrompt = req.body.prompt || `Aşağıdaki sürdürülebilirlik raporundan verileri ve ESG göstergelerini ayıkla.
Bulduğun göstergeleri şu JSON şemasında döndür. JSON dışında hiçbir şey yazma:
[
  {
    "indicator": "Gösterge Adı (örn. Kapsam 1 Emisyonları)",
    "category": "Environmental | Social | Governance",
    "value": 12500, // Sayısal değer (varsa, sayı olarak)
    "unit": "ton CO2e", // Birim
    "year": 2023, // Hangi yıla ait olduğu
    "context": "Metindeki ilgili cümle veya bağlam"
  }
]`;

    // 2. Query OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use gpt-4o-mini for fast, high context extraction
      messages: [
        {
          role: "system",
          content: "You are an expert ESG (Environmental, Social, Governance) analyst. Extract all quantitative indicators from reports. Always return your response in a valid JSON array format containing the objects as requested, and nothing else.",
        },
        {
          role: "user",
          content: `${customPrompt}\n\n[RAPOR METNİ]:\n${reportText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    let aiOutput = response.choices[0].message.content;

    // Parse the JSON output. Sometime models wrap inside a root object even when asked for an array, or return markdown blocks.
    aiOutput = aiOutput.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let resultJson;
    try {
      resultJson = JSON.parse(aiOutput);
      // If the result has a root key (like "indicators" or "data"), try to extract the array
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
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

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

app.get("/", (req, res) => {
  res.send("Sustainability AI Backend Running 🚀");
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));