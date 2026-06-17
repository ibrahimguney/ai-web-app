# SustainData 🌱
**Sürdürülebilirlik Araştırma & Veri Analiz Platformu**

SustainData, araştırmacılar, akademisyenler ve sürdürülebilirlik profesyonelleri için geliştirilmiş, **Yapay Zeka (LLM)** ve **Makine Öğrenmesi (ML)** destekli yenilikçi bir web platformudur. 

Bu platform, sürdürülebilirlik (ESG) raporlarının yapay zeka ile saniyeler içinde analiz edilmesini, dünya çapındaki makroekonomik verilerin çekilmesini ve bu veriler kullanılarak ileri düzey makine öğrenmesi modelleriyle tahminler yapılmasını sağlar.

---

## 🚀 Öne Çıkan Özellikler

- **🤖 Yapay Zeka Rapor Analizcisi (LLM):** 
  Kurumların yayınladığı karmaşık sürdürülebilirlik raporlarını (PDF veya Metin) okur, GPT-4 entegrasyonu ile çevresel (E), sosyal (S) ve yönetişim (G) göstergelerini yüksek doğrulukla ayıklar.
  
- **📊 Makro Veri İndiricisi:** 
  Dünya Bankası veritabanına doğrudan bağlanarak binlerce farklı göstergeyi yıllara ve ülkelere göre filtreler. Verileri araştırmacıların en çok kullandığı **Excel (.xlsx)**, **SPSS (.sav)** ve **STATA (.dta)** formatlarında tek tıkla dışa aktarır.

- **🧠 İleri Düzey Veri Analitiği (Makine Öğrenmesi):** 
  Toplanan verileri (İster LLM sonuçları ister Makro veriler) kullanarak **XGBoost** gibi güçlü makine öğrenmesi algoritmalarını tarayıcı üzerinden çalıştırır. Hedef değişkenler ve girdi değişkenleri arasındaki ilişkiyi kurar, RMSE ve R² skorlarını hesaplayarak hangi değişkenin sonuca ne kadar etki ettiğini (Feature Importance) bulur.

- **🕷️ n8n Rapor Takipçisi (Otomasyon):** 
  n8n iş akışı otomasyonu ile entegre çalışır. Belirlenen şirketlerin yatırımcı ilişkileri sayfalarını her gün otomatik olarak tarar, yayımlanan yeni Sürdürülebilirlik Raporlarını tespit eder ve skorlayarak doğrudan veritabanına kaydeder.

---

## 🏗️ Sistem Mimarisi ve Teknolojiler

Proje, kurumsal seviyede güvenilir ve ölçeklenebilir bir "Monorepo" (Tek Depo) mimarisine sahiptir.

- **Ön Yüz (Frontend):** React.js (Vite), Tailwind CSS esintileriyle özel UI tasarımı. (Sunucu: **Vercel**)
- **Arka Yüz (Backend):** Node.js & Express. Python (Makine Öğrenmesi ve Veri Dönüşümleri için).
- **Altyapı (Konteynerizasyon):** Docker (Debian tabanlı çoklu çalışma ortamı). (Sunucu: **Render**)
- **Veritabanı (Database):** Supabase (PostgreSQL), güvenli kullanıcı yetkilendirme (Admin/Viewer rolleri).
- **Veri & Yapay Zeka:** OpenAI API, XGBoost, Pandas, PDF-Parse.

> **💡 Mimari Not:** Ağır makine öğrenmesi süreçleri (TensorFlow/XGBoost) Vercel'in bulut fonksiyon sınırlarını aştığı için, arka plan özel yapılandırılmış bir **Render Docker konteynerinde** çalıştırılmaktadır.

---

## ⚙️ Kurulum ve Çalıştırma (Lokal Geliştirme)

Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Gereksinimler
- Node.js (v18+)
- Python (v3.9+) ve `pip`
- Supabase ve OpenAI API Anahtarları

### 2. Projeyi Klonlayın
```bash
git clone https://github.com/ibrahimguney/ai-web-app.git
cd ai-web-app
```

### 3. Çevre Değişkenleri
Proje dizininde `env.txt` (veya `.env`) dosyası oluşturun ve aşağıdaki şifreleri ekleyin:
```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=ey...
```

### 4. Kurulum
Node.js ve Python kütüphanelerini kurun:
```bash
# Frontend kütüphaneleri
cd frontend && npm install && cd ..

# Backend (Node) kütüphaneleri
npm install

# Python kütüphaneleri
pip install -r requirements.txt
```

### 5. Uygulamayı Başlatın
Aynı anda hem backend hem frontend'i çalıştırmak için:
```bash
# Terminal 1 (Backend için)
npm start

# Terminal 2 (Frontend için)
cd frontend
npm run dev
```

Platform **http://localhost:5173** adresinde yayına girecektir.

---
*Geleceğin sürdürülebilir dünyası için veriden bilgiye, bilgiden aksiyona...* 🌱
