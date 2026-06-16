# Node.js tabanlı hafif bir imaj kullanıyoruz (Debian Bullseye tabanlı)
FROM node:18-bullseye-slim

# İşletim sistemi güncellemelerini yap ve Python 3, pip, ve XGBoost için gereken libgomp1 paketlerini kur
RUN apt-get update && \
    apt-get install -y python3 python3-pip libgomp1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Çalışma dizinini ayarla
WORKDIR /app

# Node.js paket dosyalarını kopyala ve kurulum yap
COPY package*.json ./
RUN npm install

# Python paket listesini kopyala ve kurulum yap
# Not: Yeni Debian sürümlerinde root olarak pip kurmaya izin vermek için --break-system-packages kullanılır.
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt || pip3 install --no-cache-dir -r requirements.txt

# Projedeki tüm dosyaları çalışma dizinine kopyala
COPY . .

# Uygulamanın çalışacağı port
EXPOSE 3001

# Uygulamayı başlat
CMD ["npm", "start"]
