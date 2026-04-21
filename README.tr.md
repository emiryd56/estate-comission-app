# Emlak Komisyon Uygulaması

> Diller: [English](./README.md) · **Türkçe**

Emlak işlemlerini **anlaşma → kaparo → tapu → tamamlandı** akışı üzerinden
takip eden, tamamlanan her işlemin komisyonunu ofis ve ilgili danışmanlar
arasında otomatik olarak bölen tam yığın (full-stack) bir uygulama.

Proje bir mono-repo olarak iki bağımsız çalıştırılabilir paketten oluşur:

- **`backend/`** — NestJS 11 + Mongoose + MongoDB Atlas, JWT kimlik
  doğrulama, rol bazlı yetkilendirme (RBAC), PDF dışa aktarım, Swagger
  belgelendirme, sağlık kontrolü, hız sınırlama.
- **`frontend/`** — Nuxt 3 + Vue 3 Composition API, Pinia, Tailwind CSS,
  tipli API istemcisi, aranabilir seçim kutuları, debounce'lu arama.

Mimari gerekçeler için: [`DESIGN.tr.md`](./DESIGN.tr.md).

> **Terminoloji notu.** Bu dokümantasyonda ve Türkçe arayüzde, admin
> olmayan kullanıcı rolü için **"danışman"** kelimesini kullanıyoruz. Kod
> tabanında bu rol İngilizce emlak terimi olduğu için hâlâ
> `UserRole.AGENT` (değer `'agent'`) olarak geçer; ikisi de aynı rolü
> ifade eder.

---

## İçindekiler

1. [Teknoloji Yığını](#teknoloji-y%C4%B1%C4%9F%C4%B1n%C4%B1)
2. [Repo Yapısı](#repo-yap%C4%B1s%C4%B1)
3. [Gereksinimler](#gereksinimler)
4. [Hızlı Başlangıç](#h%C4%B1zl%C4%B1-ba%C5%9Flang%C4%B1%C3%A7)
5. [Ortam Değişkenleri](#ortam-de%C4%9Fi%C5%9Fkenleri)
6. [Varsayılan Hesapları Ekleme (Seed)](#varsay%C4%B1lan-hesaplar%C4%B1-ekleme-seed)
7. [Uygulamayı Çalıştırma](#uygulamay%C4%B1-%C3%A7al%C4%B1%C5%9Ft%C4%B1rma)
8. [Testler](#testler)
9. [API Özeti](#api-%C3%B6zeti)
10. [Özellik Turu](#%C3%B6zellik-turu)
11. [Prodüksiyon Derleme ve Dağıtım](#prod%C3%BCksiyon-derleme-ve-da%C4%9F%C4%B1t%C4%B1m)
12. [Sorun Giderme](#sorun-giderme)
13. [Komut Referansı](#komut-referans%C4%B1)

---

## Teknoloji Yığını

| Katman              | Tercih                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Backend çalıştırıcı | Node.js 20+ / NestJS 11                                          |
| Veritabanı          | MongoDB Atlas (Mongoose 9 üzerinden)                             |
| Kimlik doğrulama    | JWT (`@nestjs/jwt` + `passport-jwt`), bcrypt ile parola hashleme |
| Doğrulama           | `class-validator` + `class-transformer`, global `ValidationPipe` |
| API dokümantasyon   | Swagger UI `/docs` (`@nestjs/swagger`)                           |
| Güvenlik            | `helmet`, `@nestjs/throttler`, env tabanlı CORS                  |
| PDF üretimi         | `pdfkit` + DejaVu fontları (Türkçe karakter desteği)             |
| Sağlık kontrolü     | `@nestjs/terminus` + `/health` (Mongo ping)                      |
| Frontend framework  | Nuxt 3 (Vue 3, Vite, Nitro)                                      |
| Durum yönetimi      | Pinia (auth, users, transactions store'ları)                     |
| Stil                | Tailwind CSS + özel `SearchableSelect` bileşeni                  |
| Testler             | Jest (backend unit + e2e), `vue-tsc` / `tsc` tip kontrolleri     |
| Araç zinciri        | ESLint + Prettier (backend), tek komutla dev için `concurrently` |

---

## Repo Yapısı

```
estate-comission-app/
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── auth/             # JWT stratejisi, guard'lar, login/me controller'ları
│   │   ├── users/            # Kullanıcı şeması, RBAC korumalı CRUD
│   │   ├── transactions/     # Temel alan: şemalar, DTO'lar, servis, controller
│   │   │   ├── utils/        # commission-calculator, stage-transitions, PDF
│   │   │   └── schemas/      # Mongoose şemaları (transaction, stage history…)
│   │   ├── app.controller.ts # /health endpoint'i (terminus)
│   │   ├── app.module.ts     # Throttler, Mongoose, modül bağlantıları
│   │   └── main.ts           # helmet, CORS, Swagger, ValidationPipe
│   ├── scripts/
│   │   ├── seed.ts           # Admin + birkaç danışman oluşturur
│   │   └── promote-admin.ts  # Mevcut bir kullanıcıyı admin yapar
│   ├── src/assets/fonts/     # pdfkit için DejaVu TTF'leri
│   └── test/                 # e2e testleri
├── frontend/                 # Nuxt 3 istemcisi
│   ├── pages/                # login, dashboard (index), /transactions/[id], new, users
│   ├── components/           # SearchableSelect.vue (genel combobox)
│   ├── stores/               # Pinia store'ları (auth, user, transaction)
│   ├── composables/useApi.ts # Bearer + 401 yönetimli tipli $fetch istemcisi
│   ├── middleware/           # auth.global rota koruyucusu
│   ├── plugins/              # auth plugin'i (JWT'den kullanıcıyı hidrasyon)
│   ├── utils/                # jwt, stage etiketleri, hata biçimleyici
│   └── types/                # Frontend tarafında DTO/arayüzler
├── DESIGN.md / DESIGN.tr.md  # Mimari kararlar ve gerekçeler
├── README.md / README.tr.md  # Bu dosya ve İngilizce karşılığı
└── package.json              # Kök düzey orkestrasyon betikleri (concurrently)
```

---

## Gereksinimler

- **Node.js 20 LTS** (veya daha yeni) ve **npm 10+**
- Bir **MongoDB Atlas** kümesi (ücretsiz M0 yeterlidir) veya yerel bir
  MongoDB 6+ kurulumu. API standart `mongodb+srv://…` ya da
  `mongodb://…` URI'larını kullanır.
- Git (opsiyonel, klonlama için)

Yerel sürümleri kontrol edin:

```bash
node -v      # v20.x.x veya daha yeni
npm -v       # 10.x.x veya daha yeni
```

---

## Hızlı Başlangıç

Taze bir klonlamadan çalışır hale gelmek için en hızlı yol:

```bash
# 1. Kök + backend + frontend bağımlılıklarını tek seferde kur
npm run install:all

# 2. Backend ortam dosyasını oluştur, MONGODB_URI ve JWT_SECRET'ı doldur
cp backend/.env.example backend/.env
$EDITOR backend/.env

# 3. (Önerilen) Frontend ortam dosyasını oluştur
cp frontend/.env.example frontend/.env

# 4. Varsayılan admin + birkaç danışmanı veritabanına yükle
npm run seed

# 5. Backend (:3001) ve frontend (:3000) uygulamasını yan yana başlat
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresini açın ve seed
betiğinin bastığı varsayılan admin bilgileriyle giriş yapın.

---

## Ortam Değişkenleri

### Backend (`backend/.env`)

| Değişken              | Zorunlu | Varsayılan                 | Amaç                                                                   |
| --------------------- | ------- | -------------------------- | ---------------------------------------------------------------------- |
| `MONGODB_URI`         | evet    | —                          | `MongooseModule` tarafından kullanılan Mongo bağlantı dizesi.          |
| `PORT`                | hayır   | `3001`                     | NestJS sunucusunun dinlediği HTTP portu.                               |
| `JWT_SECRET`          | evet    | —                          | JWT imzalama/doğrulama anahtarı. **Prodüksiyon öncesi mutlaka değiştirin.** |
| `JWT_EXPIRES_IN`      | hayır   | `1d`                       | JWT ömrü (örn. `1h`, `7d`).                                            |
| `CORS_ORIGIN`         | hayır   | `http://localhost:3000`    | İzin verilen kaynakları virgülle ayırarak yazın.                       |
| `THROTTLE_TTL_MS`     | hayır   | `60000`                    | `@nestjs/throttler` için pencere süresi.                               |
| `THROTTLE_LIMIT`      | hayır   | `100`                      | IP başına pencere başına izin verilen istek sayısı.                    |
| `SEED_ADMIN_EMAIL`    | hayır   | `admin@firma.com`          | `npm run seed` tarafından oluşturulan admin e-postası.                 |
| `SEED_ADMIN_PASSWORD` | hayır   | `admin123`                 | Admin parolası.                                                        |
| `SEED_ADMIN_NAME`     | hayır   | `Admin User`               | Admin görünen adı.                                                     |

Güncel şablon: `backend/.env.example`.

### Frontend (`frontend/.env`)

| Değişken                | Zorunlu | Varsayılan               | Amaç                                                                |
| ----------------------- | ------- | ------------------------ | ------------------------------------------------------------------- |
| `NUXT_PUBLIC_API_BASE`  | hayır   | `http://localhost:3001`  | Tarayıcının NestJS API'yi çağıracağı temel adres.                   |

`runtimeConfig.public.apiBase` zaten `http://localhost:3001` olarak
ayarlı; `.env` dosyası yalnızca API farklı bir yerdeyse (staging, prod)
gerekir.

---

## Varsayılan Hesapları Ekleme (Seed)

Seed betiği idempotenttir: zaten var olan hesapları atlar, sadece
olmayanları ekler. İstediğiniz zaman çalıştırabilirsiniz:

```bash
npm run seed
```

Varsayılan kimlik bilgileri (yukarıdaki env değişkenleriyle özelleştirilebilir):

| Rol       | E-posta             | Parola     |
| --------- | ------------------- | ---------- |
| admin     | `admin@firma.com`   | `admin123` |
| danışman  | `ayse@firma.com`    | `agent123` |
| danışman  | `mehmet@firma.com`  | `agent123` |
| danışman  | `zeynep@firma.com`  | `agent123` |

Yeniden seed etmeden mevcut bir kullanıcıyı admin'e yükseltmek için:

```bash
npm --prefix backend run promote-admin -- birisi@example.com
```

---

## Uygulamayı Çalıştırma

### Seçenek A — tek terminalde ikisi birden (önerilen)

```bash
npm run dev
```

Bu komut arka planda `backend/npm run start:dev` ve
`frontend/npm run dev` süreçlerini `concurrently` ile yan yana çalıştırır
ve çıktıları renk kodlar.

### Seçenek B — ayrı terminallerde

```bash
# 1. terminal
npm run dev:backend        # NestJS → http://localhost:3001

# 2. terminal
npm run dev:frontend       # Nuxt   → http://localhost:3000
```

### Backend'in ayakta olduğunu doğrulama

```bash
curl http://localhost:3001/health
# → { "status": "ok", "info": { "mongodb": { "status": "up" } }, ... }
```

Etkileşimli API dokümantasyonu
[http://localhost:3001/docs](http://localhost:3001/docs) adresindedir.
"Authorize" butonuna basıp `POST /auth/login` yanıtındaki JWT'yi
yapıştırarak korumalı endpoint'leri deneyebilirsiniz.

---

## Testler

```bash
# Backend unit testleri (Jest — komisyon, geçişler, servis için 36 case)
npm test

# Backend coverage raporu (backend/coverage/ dizinine yazılır)
npm run test:cov

# Backend e2e (Nest uygulamasını ayağa kaldırır; MONGODB_URI gerekir)
npm --prefix backend run test:e2e

# Frontend tip kontrolü
npm --prefix frontend exec vue-tsc -- --noEmit

# Backend lint (--fix ile)
npm run lint
```

CI dostu tek komut:

```bash
npm test && npm run lint
```

---

## API Özeti

Tüm endpoint'ler backend portunda (`3001`) yayında olur. `POST /auth/login`
ve `GET /health` dışındaki her rota `Authorization: Bearer <jwt>` başlığı
bekler.

| Metod | Yol                           | Roller              | Notlar                                                      |
| ----- | ----------------------------- | ------------------- | ----------------------------------------------------------- |
| POST  | `/auth/login`                 | herkese açık        | `{ accessToken, user }` döndürür. Dakikada 10 istekle sınırlı. |
| GET   | `/auth/me`                    | herhangi kimliklendirilmiş | Token'dan `{ userId, email, role }` döndürür.        |
| POST  | `/users`                      | admin               | Kullanıcı oluşturur (danışman veya admin).                  |
| GET   | `/users`                      | admin, danışman     | Kullanıcıları listeler (seçim kutuları için).               |
| GET   | `/transactions`               | admin, danışman     | Sayfalı liste; `search`, `stage`, fiyat/tarih/danışman filtrelerini destekler. |
| POST  | `/transactions`               | admin, danışman     | Danışmanlar sadece kendilerini ilan veya satış danışmanı olarak seçtikleri işlemleri oluşturabilir. |
| GET   | `/transactions/:id`           | admin, danışman     | Danışmanlar yalnızca kendi işlemlerini görür.               |
| PATCH | `/transactions/:id/stage`     | admin, danışman     | Atomik, ileri yönlü aşama geçişi; eşzamanlı değişimde 409.  |
| GET   | `/transactions/:id/export`    | admin, danışman     | Şık bir PDF raporu gönderir.                                |
| GET   | `/health`                     | herkese açık        | Terminus sağlık kontrolü (Mongo ping).                      |
| GET   | `/docs`                       | herkese açık        | Swagger UI.                                                 |

### Örnek — giriş + liste

```bash
TOKEN=$(curl -s http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@firma.com","password":"admin123"}' | jq -r .accessToken)

curl -s http://localhost:3001/transactions \
  -H "Authorization: Bearer $TOKEN" | jq '.total, .data[0]'
```

### Gelişmiş filtreler

`GET /transactions` aşağıdaki query parametrelerini kabul eder (hepsi
opsiyonel ve birleşebilir):

| Parametre     | Tip       | Etkisi                                                                   |
| ------------- | --------- | ------------------------------------------------------------------------ |
| `page`        | tamsayı   | Sayfa numarası (varsayılan `1`).                                         |
| `limit`       | 1-100     | Sayfa başına kayıt (varsayılan `10`).                                    |
| `search`      | metin     | `title` alanında büyük/küçük harf duyarsız regex araması.                |
| `stage`       | enum      | `agreement`, `earnest_money`, `title_deed`, `completed`.                 |
| `minTotalFee` | sayı      | `totalFee` alt sınırı.                                                   |
| `maxTotalFee` | sayı      | `totalFee` üst sınırı.                                                   |
| `startDate`   | ISO tarih | `createdAt >= startDate`.                                                |
| `endDate`     | ISO tarih | `createdAt <= endDate 23:59:59`.                                         |
| `agentId`     | ObjectId  | **Sadece admin.** Seçilen kullanıcının ilan veya satış danışmanı olduğu işlemleri filtreler. |

---

## Özellik Turu

- **Giriş akışı** — API'den dönen JWT `lax` bir cookie'de saklanır. Nuxt
  plugin'i sayfa açılışında Pinia `auth` store'unu bu token'dan hidratlar;
  global route middleware hem oturum hem de admin'e özel sayfaları korur
  (token `exp` süresini kontrol eder).
- **Pano (`/`)** — İşlemleri listeler: arama (500 ms debounce), aşama
  filtresi, açılır "Gelişmiş Filtreleme" paneli, sayfalama, satır
  başına hızlı aksiyonlar (Sonraki Aşama, Detay).
- **Yeni işlem (`/transactions/new`)** — İlan ve satış danışmanı için
  aranabilir seçim kutuları. Danışman olarak giriş yapmışsanız en az bir
  taraf kendinizi seçmek zorundadır (sunucu tarafından zorunlu kılınır).
- **İşlem detayı (`/transactions/[id]`)** — Özet kartı, `stageHistory`'den
  türetilen dikey zaman çizelgesi, dinamik komisyon dağılım tablosu ve
  `/transactions/:id/export`'u çağıran **PDF İndir** butonu.
- **Kullanıcı yönetimi (`/users`, sadece admin)** — Danışman/admin ekleme
  ve mevcut kullanıcıları listeleme; ad, e-posta, rol ve avatar.
- **PDF dışa aktarımı** — Ofis kimliğiyle şık bir A4 rapor; aşama rozeti,
  anahtar/değer tablosu, aşama geçmişi ve finansal dağılım. Türkçe
  karakterlerin düzgün görünmesi için Nest varlık (asset) olarak
  paketlenmiş DejaVu fontları kullanılır.
- **Eşzamanlılık koruması** — Aşama ilerletme işlemleri
  `findOneAndUpdate` ile mevcut aşama şartı altında yapılır; iki yazar
  aynı anda ilerletmeye çalışırsa sadece biri başarılı olur.
- **Denetim izi (audit trail)** — Her `StageHistoryEntry` `changedBy`
  alanı ile hangi kullanıcının değişikliği yaptığını kaydeder, ileride
  kullanıcı bazlı aktivite raporlamaya hazır.

---

## Prodüksiyon Derleme ve Dağıtım

### Prodüksiyon derlemeleri

```bash
npm run build
# ├── backend/dist/          (derlenmiş NestJS + kopyalanmış font varlıkları)
# └── frontend/.output/      (Nitro sunucusu + public varlıklar)

# Derlenmiş backend'i çalıştır
NODE_ENV=production node backend/dist/main.js

# Nuxt sunucusunu çalıştır (Nitro)
node frontend/.output/server/index.mjs
```

### Backend dağıtım notları

- Herhangi bir Node barındırması yeterli (Render, Railway, Fly.io,
  Heroku, AWS App Runner vb.).
- Backend env değişkenlerini runtime'da sağlayın. `.env` asla commit
  edilmemelidir.
- Port `3001`'i (veya `PORT` değişkenini) dışarı açın.
- Sağlık kontrollerini `GET /health`'e yönlendirin.
- `CORS_ORIGIN` değerini dağıttığınız frontend URL'ine ayarlayın
  (birden çok kaynak varsa virgülle ayırarak).

### Frontend dağıtım notları

- Nuxt 3 bir Node sunucusu olarak dağıtılabilir (herhangi Node host) ya
  da statik export'a çevrilebilir. Varsayılan Nitro çıktısı
  `frontend/.output/` Node preset'idir.
- `NUXT_PUBLIC_API_BASE`'i dağıtılmış backend'in temel URL'ine ayarlayın
  (sonunda `/` olmadan).

### Konteyner dostu yapı

Repo'da Dockerfile checked in değil ama `npm run build` + `node dist/main.js`
kombinasyonu iki aşamalı bir `Dockerfile` için doğrudan şablondur.

---

## Sorun Giderme

**Başlangıçta `MONGODB_URI environment variable is not defined` hatası.**
`backend/.env` dosyasının var olduğundan ve `MONGODB_URI`'nin
tanımlandığından emin olun. `npm run dev` kök dizinden çalıştırıldığında
`backend/` klasörüne geçer, yani `.env` oradaki dosyadan okunur.

**Girişte `429 Too Many Requests` yanıtı.**
`POST /auth/login` brute-force saldırılarına karşı dakikada 10 istekle
sınırlıdır. ~60 saniye bekleyip tekrar deneyin.

**Aşama ilerletirken `409 Conflict`.**
Başka bir yazar (sekme, cihaz) sizden önce ilerletmiş. İşlemi yeniden
yükleyip tekrar deneyin; sunucu her geçiş için tek kazananı garantiler.

**Danışman işlem oluştururken `403 Forbidden`.**
Danışmanlar yalnızca kendilerini ilan veya satış danışmanı olarak
seçtikleri işlemleri oluşturabilir. En az bir tarafta kendinizi seçin.

**PDF'te Türkçe karakter yerine soru işareti.**
`backend/src/assets/fonts/` altındaki DejaVu fontları derleme sırasında
`backend/dist/` içine kopyalanmamış. `backend/nest-cli.json`'da
`assets` bloğunun hâlâ duruyor olduğundan emin olup yeniden derleyin.

**Frontend `http://localhost:3000/transactions` çağırıyor (404).**
`apiBase` yanlış portu gösteriyor. Ya `NUXT_PUBLIC_API_BASE`'i ayarsız
bırakın (varsayılan `3001`) ya da backend URL'inize açıkça yönlendirin.

**3001 portunda `EADDRINUSE`.**
Başka bir backend süreci bu portu tutuyor. Sonlandırın:

```bash
lsof -ti:3001 | xargs kill -9
```

---

## Komut Referansı

Kök düzey komutlar:

| Komut                   | Açıklama                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `npm run install:all`   | Kök, `backend/` ve `frontend/` bağımlılıklarını kurar.      |
| `npm run dev`           | Backend + frontend'i yan yana başlatır.                     |
| `npm run dev:backend`   | Sadece NestJS watch modunda.                                |
| `npm run dev:frontend`  | Sadece Nuxt dev sunucusu.                                   |
| `npm run build`         | İki uygulama için prodüksiyon derlemesi.                    |
| `npm test`              | Backend unit testleri.                                      |
| `npm run test:cov`      | Backend coverage raporu.                                    |
| `npm run lint`          | Backend ESLint (`--fix`).                                   |
| `npm run seed`          | Admin + 3 danışmanı ekler (idempotent).                     |

`backend/` içinden çalıştırılabilecek ek komutlar:

| Komut                        | Açıklama                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `npm run start:dev`          | NestJS watch modu.                                       |
| `npm run start:prod`         | Derlenmiş `dist/main.js`'i çalıştırır.                   |
| `npm run test:e2e`           | Jest uçtan uca test süiti.                               |
| `npm run seed`               | `scripts/seed.ts` (ts-node ile).                         |
| `npm run promote-admin`      | Verilen e-postayı `admin` rolüne yükseltir.              |

Keyifli kodlamalar!
