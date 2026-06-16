-- Supabase/PostgreSQL Veri Tabanı Şeması
-- Bu kodları Supabase panelinizdeki SQL Editor alanına yapıştırıp "Run" butonuna basarak tabloları oluşturabilirsiniz.

-- 1. ESG Göstergeleri Tablosu (AI Analiz Sonuçları için)
CREATE TABLE IF NOT EXISTS esg_indicators (
    id SERIAL PRIMARY KEY,
    company_name TEXT,
    year TEXT,
    indicator_name TEXT,
    category TEXT,
    metric_type TEXT,
    value TEXT,
    numeric_value DOUBLE PRECISION,
    unit TEXT,
    page INTEGER,
    source_keyword TEXT,
    evidence_text TEXT,
    confidence DOUBLE PRECISION,
    notes TEXT,
    user_id INTEGER,
    username TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hızlı sorgulama için indeksler
CREATE INDEX IF NOT EXISTS idx_esg_company_year ON esg_indicators (company_name, year);
CREATE INDEX IF NOT EXISTS idx_esg_indicator ON esg_indicators (indicator_name);

-- 2. Rapor Takip Kaynakları Tablosu (n8n taranacak sayfalar için)
CREATE TABLE IF NOT EXISTS report_sources (
    id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    ticker TEXT,
    report_year TEXT NOT NULL DEFAULT '2024',
    source_url TEXT NOT NULL,
    source_type TEXT DEFAULT 'investor_relations_page',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Rapor Link Kontrolleri Tablosu (n8n tarama sonuçları için)
CREATE TABLE IF NOT EXISTS report_link_checks (
    id SERIAL PRIMARY KEY,
    company_name TEXT,
    ticker TEXT,
    report_year TEXT,
    source_url TEXT,
    candidate_url TEXT,
    status_code INTEGER,
    content_type TEXT,
    is_pdf BOOLEAN,
    year_in_url BOOLEAN,
    validation_score INTEGER,
    validation_status TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Aynı şirket ve yıl için aynı aday rapor linkinin mükerrer eklenmesini önleyen benzersizlik indeksi
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_candidate
ON report_link_checks (company_name, report_year, candidate_url);
