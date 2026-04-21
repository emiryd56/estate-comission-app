# Tasarım ve Mimari

> Diller: [English](./DESIGN.md) · **Türkçe**

Bu belge **estate-comission-app** projesindeki mimari ve uygulama
kararlarının arkasındaki gerekçeleri açıklar. Kaynak kodla birlikte
okunmak üzere yazılmıştır: her bölüm "bu nasıl çalışıyor?" değil, "neden
böyle yapılmış?" sorusunu yanıtlar.

> **Terminoloji notu.** Bu belge ve arayüz, admin olmayan kullanıcı
> rolünü "**danışman**" olarak adlandırır. Kod tabanında bu rol, İngilizce
> emlak sektörünün alışılmış terimi olduğu için hâlâ `UserRole.AGENT`
> (değer `'agent'`) şeklinde geçer. İkisi de aynı rolü ifade eder;
> `listingAgent`, `sellingAgent`, `agentId` gibi kod/alan isimleri
> kasıtlı olarak değiştirilmemiştir.

## İçindekiler

1. [Sistem Genel Bakış](#1-sistem-genel-bak%C4%B1%C5%9F)
2. [Teknoloji Seçimleri](#2-teknoloji-se%C3%A7imleri)
3. [Alan Modeli (Domain Model)](#3-alan-modeli-domain-model)
4. [Komisyon Kuralları](#4-komisyon-kurallar%C4%B1)
5. [Aşama Durum Makinesi](#5-a%C5%9Fama-durum-makinesi)
6. [Eşzamanlılık ve Atomik Güncellemeler](#6-e%C5%9Fzamanl%C4%B1l%C4%B1k-ve-atomik-g%C3%BCncellemeler)
7. [Kimlik Doğrulama ve Yetkilendirme](#7-kimlik-do%C4%9Frulama-ve-yetkilendirme)
8. [API Tasarımı](#8-api-tasar%C4%B1m%C4%B1)
9. [Backend Modül Düzeni](#9-backend-mod%C3%BCl-d%C3%BCzeni)
10. [Frontend Mimarisi](#10-frontend-mimarisi)
11. [Durum Yönetim Stratejisi](#11-durum-y%C3%B6netim-stratejisi)
12. [UI/UX Kararları](#12-uiux-kararlar%C4%B1)
13. [PDF Dışa Aktarım Akışı](#13-pdf-d%C4%B1%C5%9Fa-aktar%C4%B1m-ak%C4%B1%C5%9F%C4%B1)
14. [Güvenlik Yaklaşımı](#14-g%C3%BCvenlik-yakla%C5%9F%C4%B1m%C4%B1)
15. [Gözlemlenebilirlik ve Sağlık](#15-g%C3%B6zlemlenebilirlik-ve-sa%C4%9Fl%C4%B1k)
16. [Test Stratejisi](#16-test-stratejisi)
17. [Geliştirici Deneyimi (DX)](#17-geli%C5%9Ftirici-deneyimi-dx)
18. [Ödünleşimler ve İlerisi](#18-%C3%B6d%C3%BCnle%C5%9Fimler-ve-ilerisi)

---

## 1. Sistem Genel Bakış

Uygulama klasik iki katmanlı bir SPA + REST mimarisidir:

```
┌──────────────────┐      HTTPS / JSON      ┌──────────────────┐
│   Nuxt 3 istemci │ ──────────────────────▶│    NestJS API    │
│  (tarayıcı SPA)  │ ◀──────────────────────│    (Node.js)     │
└──────────────────┘   Authorization: Bearer└─────────┬────────┘
                                                      │ mongoose
                                                      ▼
                                             ┌──────────────────┐
                                             │  MongoDB Atlas   │
                                             └──────────────────┘
```

- Frontend tek sayfa bir Nuxt uygulamasıdır. Kendi başına alan durumu
  (domain state) tutmaz; her şey REST API'den çekilir ve Pinia
  store'larında önbelleklenir.
- Backend tek bir NestJS süreci ile durumsuz (stateless) bir REST API
  sunar. Durum MongoDB'de yaşar; sunucu geçici istek bağlamı dışında
  bellekte hiçbir şey tutmaz.
- Kimlik doğrulama da durumsuzdur: erişim, bearer token olarak taşınan
  imzalı bir JWT üzerinden verilir. Sunucu tarafında oturum deposu
  yoktur.

Bu ayrım işletim basitliği (tek Node sürecı, tek MongoDB kümesi), ilgi
ayrımının temiz olması (SPA UX'e sahip, API kurallara sahip) ve yatay
ölçekleme kolaylığı (stateless API → yük dengeleyici arkasına eklenen
bir sürüm anında çalışır) için seçildi.

---

## 2. Teknoloji Seçimleri

### NestJS (backend)

- **Yapı, varsayılan olarak geliyor.** Modüller, providerlar ve
  controller'lar, iş kuralı ağırlıklı bir uygulama için ham Express'ten
  daha iyi bir başlangıçtır: DI, guard, pipe, decorator ve yaşam döngüsü
  kancalarını kutudan çıkar çıkmaz alırız. Alan (domain) şu an küçük
  olsa da komisyon mantığı, aşama makinesi ve RBAC gibi kesiklerden
  yararlanır.
- **Birinci sınıf doğrulama.** Global `ValidationPipe` + DTO'lar
  "`class-validator`" sayesinde doğrulamayı prosedürel kontroller yerine
  bildirimsel metadataya dönüştürür — eksik alan, tip zorlaması gibi
  bütün kategoriyi kaynağında çözer.
- **Mongo uyumu mükemmel.** `@nestjs/mongoose`, Mongoose şemalarını
  Nest'in DI sistemine bağlar; env tabanlı yapılandırma için
  `ConfigModule` ile harika uyum sağlar.

### MongoDB + Mongoose

- **Evrilen doküman şekline esneklik.** İşlemler, ebeveynleriyle birlikte
  atomik olarak okunup yazılan `stageHistory` ve `financialBreakdown`
  gibi gömülü alt dokümanlar taşır. Doküman tabanlı veritabanında bu
  doğal gelir; ilişkisel bir modelde extra tablolar ve join'lerle aynı
  değeri üretmek külfetli olurdu.
- **Atlas avantajı.** Yönetilen Mongo, replikasyon, yedekleme ve
  bağlantı yönetimini üstlenir. Ücretsiz M0 geliştirme ve inceleme için
  fazlasıyla yeterlidir.
- **Atomik doküman güncellemeleri.** Mongo'nun doküman başına atomik
  garantisi (`findOneAndUpdate` içinde tek operasyonda `$set`, `$push`)
  eşzamanlılık korumalı aşama geçişleri için tam ihtiyacımız olan
  primitiftir (bkz. §6).

### Nuxt 3 (frontend)

- **Vue 3 Composition API + SSR'a hazır varsayılanlar.** Bir SPA olarak
  dağıtsak bile Nuxt'ın dosya bazlı routing'i, otomatik import sistemi,
  Vite hattı ve Nitro sunucusu geliştirme döngüsünü hızlı, çıktıyı
  küçük tutar.
- **Pinia entegrasyonu.** Resmi durum yöneticisi, Nuxt'ın auto-import
  yapısıyla sürtünmesiz çalışır. Tutkal kodu gerekmez.
- **TypeScript sahipliği.** Şablonlar ve `<script setup lang="ts">`
  bloklarıyla normal bileşen yazarmışçasına tam tip çıkarımı elde
  edilir.

### Tailwind CSS

- **Utility-first, özel bir tasarım sistemi borç yapmadan tutarlılık
  sağlar.** Piksel hizalı boşluk, erişilebilir varsayılan renkler ve
  karanlık modu destekleyen primitifler sıfır özel CSS borcuyla gelir.
- **Varsayılan olarak tree-shake edilir.** Son paket sadece gerçekten
  kullanılan sınıfları taşır.

### Diğer kütüphaneler

- **`pdfkit` + DejaVu fontları** — headless tarayıcıya gerek kalmadan
  saf Node üzerinde PDF üretimi. TTF'leri bundle etmek, pdfkit'in
  varsayılan fontlarının karşılayamadığı Türkçe glifleri verir.
- **`@nestjs/throttler`, `helmet`** — pilleri dahil gelen güvenlik.
- **`@nestjs/terminus`** — prodüksiyon seviyesinde sağlık kontrolü.
- **`@nestjs/swagger`** — koddan üretilmiş API dokümantasyonu.
- **`concurrently`** — küçük, bağımlılıksız, `npm run dev` için süreç
  çoğaltıcı.

---

## 3. Alan Modeli (Domain Model)

Temel toplam (aggregate) **Transaction**:

```ts
Transaction {
  _id: ObjectId
  title: string                         // serbest formatlı işlem adı
  stage: 'agreement' | 'earnest_money' | 'title_deed' | 'completed'
  totalFee: number                      // müşteriyle anlaşılan brüt komisyon
  listingAgent: ObjectId ref User       // ilan danışmanı
  sellingAgent: ObjectId ref User       // satış danışmanı
  stageHistory: StageHistoryEntry[]     // yalnızca-ekle denetim logu
  financialBreakdown?: {                // COMPLETED'te doldurulur
    companyCut: number
    listingAgentCut: number
    sellingAgentCut: number
  }
  createdAt / updatedAt                 // timestamps: true ile
}

StageHistoryEntry {
  stage: TransactionStage
  changedAt: Date
  changedBy?: ObjectId ref User         // aşamayı kim ilerletti
}
```

Dikkat çekmek istediğimiz kararlar:

- **Gömülü `stageHistory` ve `financialBreakdown`.** Bu alt dokümanlar
  her zaman ebeveynleriyle birlikte okunur, asla ayrı sorgulanmaz;
  gömmek, fetch'i tek doküman ve tek round-trip olarak tutar.
- **`totalFee`, emlak bedeli değil, anlaşılan komisyondur.** Bu iş
  senaryosunu bire bir yansıtır: ofis baştan komisyonu belirler;
  iç paylaşımlar bundan sonra yapılır. Türetilmiş paylaşımı brüt
  komisyondan ayrı tutmak modelin dürüstlüğünü korur.
- **`stage`, `stageHistory`'den denormalizedir.** Mevcut aşamayı her
  seferinde `stageHistory`'nin son elemanından hesaplayabilirdik; üst
  düzey bir alan olarak materyalize etmek liste sorgularını,
  indekslemeyi ve UI render'ını basit tutar. Değişmez
  (`stage === son(stageHistory).stage`) tek bir kod yolunda
  (`updateStage`) zorunlu kılındığı için sapma riski yoktur.
- **`financialBreakdown`, tamamlanana kadar opsiyoneldir.** Oluşturulurken
  sıfırlarla doldurabilirdik ama `undefined` bırakmak "henüz para
  paylaştırılmadı" niyetini daha net aktarır. Arayüz ve raporlar bu
  varlığın olup olmaması üzerinden "tamamlandı mı?" sinyalini alır.
- **`User`, flat bir `role` enum'u taşır (`admin` | `agent`).** Çoklu
  rol ya da izin matrisine ihtiyacımız yok; erken karmaşıklık eklemek
  spekülatif olur. (Kavramsal olarak bu rol bize danışmandır.)

---

## 4. Komisyon Kuralları

Kaynak: [`backend/src/transactions/utils/commission-calculator.ts`](./backend/src/transactions/utils/commission-calculator.ts).

Bir `totalFee` (`T`) ve iki danışman id'si (`L`, `S`) verilen saf
fonksiyon şunu döner:

| Senaryo                               | Ofis payı   | İlan danışmanı payı | Satış danışmanı payı |
| ------------------------------------- | ----------- | ------------------- | -------------------- |
| `L === S` (aynı danışman)             | `0.5 × T`   | `0.5 × T`           | `0`                  |
| `L !== S` (farklı danışmanlar)        | `0.5 × T`   | `0.25 × T`          | `0.25 × T`           |

Neden bu şekil:

- **Ofis brüt komisyonun her zaman %50'sini alır.** Oran adlandırılmış
  bir sabit olarak durur (`AGENCY_SHARE_RATIO`) — değişmesi tek satırlık
  bir iş + test.
- Kalan yarı **danışman havuzu**dur; iki farklı danışman varsa eşit
  şekilde bölünür. Aynı kişi hem ilan hem satış danışmanıysa havuzun
  tamamını alır; satış danışmanı payı tutar çiftlenmesin diye `0`'a
  düşer.
- **Fonksiyon saftır.** Veritabanına dokunmaz, doküman almaz, geçersiz
  girdi dışında (`totalFee < 0`, `NaN`) iş kuralı nedeniyle fırlatmaz.
  Bu bilerek yapıldı: unit testi trivialdir ve fonksiyon istenen yerde
  yeniden kullanılabilir (PDF render, ileriki raporlar, hipotetik
  simülasyonlar).
- **İdempotentlik.** `updateStage` atomik önkoşulla çalıştığı için (§6),
  `calculateCommission` işlem başına en fazla bir kez çalışır —
  `COMPLETED`'e geçişin olduğu an.

---

## 5. Aşama Durum Makinesi

Kaynak: [`backend/src/transactions/utils/stage-transitions.ts`](./backend/src/transactions/utils/stage-transitions.ts):

```
ANLAŞMA ─▶ KAPARO ─▶ TAPU ─▶ TAMAMLANDI
    ▲          ▲         ▲          │
    └─ geri dönüş yok ───┘          └─ terminal
```

İzinli geçiş tablosu `Readonly<Record<stage, stage[]>>` şeklinde; hedefin
dizide olup olmadığını kontrol eden `canTransition(current, next)` tek
satırlık bir look-up'tır.

Neden tablo, neden ad-hoc `if` zincirleri değil:

- **Tek doğruluk kaynağı.** Controller, servis ve testler aynı tabloya
  başvurur. Unutulmuş bir vakayla karşılaşmak mümkün değil.
- **İzole test.** Spec, tüm ileri geçişleri, atlamaları, geri
  dönüşleri, aynı duruma geçişi ve terminal durumu kapsar.
- **Kolay evrim.** "Admin override" ya da "reject" dallarını eklemek
  tabloyu düzenlemekten ibaret, `if` zincirlerini yeniden yazmayı
  gerektirmez.

Geriye gitmeye **bilerek** izin verilmiyor. Gerçek dünyada bir aşamayı
geri almak (ör. tapu süreci iptal olur) bir iz bırakarak yapılmalıdır,
sessizce undo değil. Bunu doğru modellemek gelecek işi; şimdilik terminal
`COMPLETED` ve ileri-yönlü kural audit log'u temiz tutar.

---

## 6. Eşzamanlılık ve Atomik Güncellemeler

`updateStage`'in erken sürümü oku-değiştir-yaz deseniyle çalışıyordu:

```ts
const doc = await model.findOne({...});
doc.stage = nextStage;
doc.stageHistory.push({...});
await doc.save();
```

Bu güvensiz: iki istemci aynı `AGREEMENT` dokümanını okuyup her ikisi de
`EARNEST_MONEY` olarak kaydederse iki tane stage history girdisi doğar
ve ileride çift-ilerletme riski çıkar.

Mevcut implementasyon **Mongo'nun doküman başına atomik güncelleme**
garantisinden, mevcut aşamayı filtreye dahil ederek yararlanır:

```ts
await model.findOneAndUpdate(
  { _id, stage: current.stage },           // önkoşul
  { $set: { stage: nextStage, /* breakdown */ },
    $push: { stageHistory: { ... } } },
  { new: true },
);
```

Başka bir yazar dokümanı çoktan ilerlettiyse filtre eşleşmez,
`findOneAndUpdate` `null` döner ve servis `ConflictException` fırlatır
(HTTP 409). Frontend'in `useApi`'si mesajı yüzeye çıkarır; kullanıcı
yeniler ve tekrar dener.

Neden `session.withTransaction` yerine bu:

- **Tek-doküman atomikliği Mongo tarafından zaten garantilidir.** Burada
  çok dokümanlı bir transaction gerektirecek cross-document invariant
  yok; değişiklik tek dokümanın içindedir.
- **Replica set zorunluluğu yok.** Çok dokümanlı transaction replica set
  veya mongos ister; atomik filtre yaklaşımı Atlas M0 dahil her Mongo
  topolojisinde çalışır.
- **Açık, çakışmayı görünür kılan semantik.** 409 çağırana ne olduğunu
  net söyler ve çözümü (yeniden yükle + tekrar dene) işaret eder;
  last-writer-wins ile yarışı gizlemez.

Daha keskin hata mesajları için (`NotFoundException`, geçersiz
geçiş/aynı aşama `BadRequestException`) atomik swap'ten önce bir
`findOne` ön-kontrolü yapılır. Ön-kontrol yardımcı nitelikte — gerçek
sözleşmeyi `findOneAndUpdate` filtresi uygular.

---

## 7. Kimlik Doğrulama ve Yetkilendirme

### Giriş

`POST /auth/login` `{ email, password }` kabul eder. Servis, varsayılan
`select: false` olan parola alanını `+password` ile yükler, `bcrypt.compare`
ile doğrular ve yapılandırılmış secret + TTL ile `{ sub, email, role }`
içeren bir JWT imzalar. Parolalar, servis katmanına asla ham halde
ulaşmayacak şekilde Mongoose `pre('save')` kancasında bcrypt ile
(`saltRounds = 10`) hashlenir.

### Oturum taşıyıcı

- JWT istemciye dönülür ve frontend tarafından **`lax` `token` cookie'sinde**
  saklanır. `lax`, üst seviye GET'lere izin verirken cross-site
  navigasyonlara karşı CSRF direnci sağlar; `strict`'e göre dev
  portlarda daha affedici.
- Cookie **`HttpOnly` değildir.** Nuxt tarafı, cookie'nin otomatik
  gönderilmesine güvenmek yerine tipli `useApi` ile `Authorization`
  başlığı gönderir; `HttpOnly`, bir sunucu middleware'i üzerinden
  gitmeyi zorlardı. Ödünleşim: SPA'da bir XSS cookie'yi okuyabilir.
  API'ye `helmet` ekleyerek ve SPA giriş yüzeyini küçük tutarak bunu
  yumuşatıyoruz. Ürün büyürse katı CSP + HttpOnly cookie bir sonraki
  doğal adım olur.

### Bearer başlık

- Tüm kimliklendirilmiş çağrılar tipli `useApi` composable'ı üzerinden
  `Authorization: Bearer <jwt>` eklenir. Merkezileşmek, ileriki
  değişikliklerin (refresh token, retry, tracing) tek bir yerde
  yapılabilmesini sağlar.
- Herhangi bir `401` yanıtında composable cookie'yi temizler ve
  `/login`'e yönlendirir. Süresi dolmuş veya iptal edilmiş token'lar,
  "kırık API çağrıları silsilesi" yerine öngörülebilir bir UX olayına
  dönüşür.

### RBAC

- `@Roles(...roles)` decorator'ı handler/class'a metadata ekler.
- `RolesGuard` metadata'yı okur, kimliklendirilmiş kullanıcının rolüyle
  karşılaştırır ve eşleşmezse `ForbiddenException` fırlatır.
- Transactions controller sınıf düzeyinde `@Roles(ADMIN, AGENT)` bildirir:
  iki rol de her endpoint'e ulaşır. Daha sert "danışman dahil olmalı"
  kontrolü **servis içinde** (`assertAgentInvolvement`) uygulanır çünkü
  istek gövdesine bağlıdır, yalnızca role değil. Böylece guard'lar
  kimlikle, servisler iş kurallarıyla ilgilenir.
- Users controller aynı mekanizmayla `POST /users`'i admin'e özel
  tutarken, `GET /users`'i iki role de açar — böylece danışmanlar işlem
  oluştururken meslektaşlarını seçebilir.

### İstemcide JWT hijyeni

`frontend/utils/jwt.ts` `decodeJwtPayload`, `isTokenExpired` ve
`isValidSession` fonksiyonlarını merkezileştirir. Nuxt plugin'i soğuk
açılışta store'u bu fonksiyonlarla hidratlar; global route middleware
süresi dolmuş token'larda erken başarısız olur. Bu parse mantığı
farklı yerlerde çoğaltılsaydı çok yüzeyli ince hatalar ortaya
çıkabilirdi; tek bir "kullanılabilir oturumum var mı?" çağrısı, tutarlı
bir noktada toplanır.

---

## 8. API Tasarımı

- **Kaynak-odaklı rotalar.** `/transactions`, `/transactions/:id`,
  `/transactions/:id/stage`, `/transactions/:id/export`, `/users`,
  `/auth/login`. Her günkü REST beklentilerine uyar.
- **Her payload'a açık DTO + validator.** Yakalanmamış istisnalar
  yerine net mesajlı 400, Swagger için sözleşme analizi.
- **Birörnek sayfalama.** Uygulama boyunca
  `PaginatedResult<T> = { data, total, page, totalPages }`. Tahmin
  edilebilir şekil → frontend için tek bir sayfalama kod yolu.
- **Durum kodları.** Create'te `201`, stage patch'te `200`, eşzamanlı
  çakışmada `409`, eksik/geçersiz token'da `401`, rol uyumsuzluğunda
  `403`, "bulunamadı veya sizin değil"de `404` (danışman kapsam filtresi
  ile uygulanır, erişilemez dokümanlar çağırana nonexistent gibi
  görünür).
- **Stage güncellemesi `PATCH /transactions/:id/stage`.** Mutasyonunu
  yaptığımız kaynak transaction'ın `stage` alanıdır; alt rota ile
  niyeti açıkça belirtmek, ileride aynı kaynakta başka alanlara `PATCH`
  atmayı URL çakışması yaratmadan mümkün kılar.
- **PDF dışa aktarımı ayrı bir GET.** Aynı kaynak ağacından
  `Content-Type: application/pdf` stream döndürmek istemci tarafını
  basit tutar (`fetch`, blob, `URL.createObjectURL`) ve content
  negotiation geleneklerine uyar.
- **Filtre parametreleri opsiyonel ve eklenebilir.** Her filtre serviste
  bağımsız `$and`-lenebilir bir parça; kombinasyonlar controller
  tarafında ek kablolamaya gerek olmadan "zaten çalışır".

---

## 9. Backend Modül Düzeni

```
app.module.ts
├── ConfigModule (global)
├── MongooseModule (forRootAsync + ConfigService)
├── ThrottlerModule (global guard)
├── TerminusModule           → /health
├── AuthModule               → /auth/login, /auth/me
├── UsersModule              → /users
└── TransactionsModule       → /transactions[, /stage, /export]
```

Tasarım seçimleri:

- **Config tek seferde, global yüklenir.** Bireysel modüller doğrudan
  `process.env` okumak yerine `ConfigService`'i enjekte eder; env
  yüzeyi gözden geçirilebilir ve test edilebilir hale gelir.
- **Throttler `APP_GUARD` olarak bağlanır.** Her istek varsayılan olarak
  sınırlı; endpoint'e özel `@Throttle` (ör. sıkı login limiti)
  eklemelidir, bozucu değil.
- **`AppController` sadece `/health`'e sahiptir, başka bir şey yok.**
  Varsayılan NestJS iskelesi (`AppService.getHello`) silindi; root
  modülde yalnızca anlamlı kod bırakmak "nest new" kokusunu engeller.
- **Filter builder'lar `TransactionsService`'in içindedir.** Her biri
  küçük bir Mongo filtresi parçası döndüren private metodlar
  (`buildAccessFilter`, `buildSearchFilter`, …). Açık
  `findAllPaginated` bunları spread ile birleştirir. Altı kısa, adlı
  fonksiyon, 80 satırlık prosedürel bir metoddan çok daha iyi taranır
  ve test edilir.

---

## 10. Frontend Mimarisi

```
app.vue
└── layouts/default.vue       (kenar çubuğu + ana alan, /login'de gizli)
    └── pages/
        ├── index.vue         (pano / işlem listesi)
        ├── transactions/[id].vue (detay + PDF + zaman çizelgesi + dağılım)
        ├── transactions/new.vue  (SearchableSelect ile oluşturma formu)
        ├── users.vue             (admin-only, kullanıcı yönetimi)
        └── login.vue             (layout'suz)

plugins/auth.ts               soğuk açılışta Pinia auth store'unu hidratlar
middleware/auth.global.ts     giriş ve admin-only rotaları korur
composables/useApi.ts         bearer + 401 yönetimli tipli $fetch
utils/{jwt,stage,error}.ts    store ve sayfaların paylaştığı saf yardımcılar
components/SearchableSelect.vue   genel combobox (pano + form'da kullanılır)
stores/{auth,user,transaction}.ts  Pinia store'ları
types/{transaction,user}.ts   backend sözleşmelerinin aynadaki karşılıkları
```

Neden bu ayrım:

- **Sayfalar orkestratör; store'lar veri sahibi.** Sayfalar Pinia
  getter'ları üzerinden store'dan okur, action'ları tetikler ve DOM'a
  yansıtır. Fetch mantığı bileşende durmaz, böylece aynı veri iki
  sayfayı tutarlı besleyebilir.
- **Composable'lar yan etkili primitif'leri sarar.** `useApi`, `$fetch`
  yapılandırmasının tek noktasıdır; `useFetch`'e geçiş ya da retry
  ekleme tek dosyalık bir değişikliktir.
- **Middleware vs plugin.** Plugin uygulama açılışında tek kere çalışır
  ve JWT'den store'u hidratlar; middleware her navigasyonda rotaları
  korur. İkisini birlikte kullanmak ilk boyamanın doğruluğunu ve
  sonraki geçişlerin hızlı (network round-trip'siz) olmasını sağlar.
- **Paylaşılan `utils/`.** `jwt.ts` (decode/expiry), `stage.ts`
  (etiketler, para biçimlendirme, sonraki aşama), `error.ts` (fetch
  hata düzleyici) — hepsi saf ve unit-test edilebilir. `decodeJwtPayload`
  ve `isFetchError`'ın önceki duplike halleri birleştirildi.

---

## 11. Durum Yönetim Stratejisi

Her biri tek sorumluluğa sahip üç Pinia store'u:

- **`auth`** — kimliklendirilmiş kullanıcıyı tutar; `isAuthenticated` ve
  `isAdmin` getter'larını; `login`, `hydrate`, `logout` action'larını
  sunar. Cookie yaşam döngüsü buradadır, yani `token`'a yazan tek yer.
- **`user`** — UI'nın ihtiyaç duyduğu kullanıcı listesini tutar
  (seçiciler, admin sayfası); `agents` (danışman alt kümesi) ve
  `getById` sunar. `fetchUsers`, `createUser` sahibidir.
- **`transaction`** — aktif sayfadaki işlemleri, tüm filtre durumunu
  (`search`, `stage`, `advancedFilters`), sayfalamayı ve UI
  bayraklarını (`loading`, `error`) tutar. Action'lar fetch, create,
  update-stage ve filtre işlemlerini birleştirir; sayfalar bildirimsel
  kalır.

Neden Pinia + ayrılmış store'lar, bileşen yerel `ref`ler değil:

- **Sayfa arası süreklilik.** Panoyu filtreleyip
  `/transactions/[id]`'ye gidip geri dönüldüğünde filtrelerin sıfırlanmaması
  gerekir. Store düzeyinde state, "listeye dön" deneyiminin bağlamı
  koruması anlamına gelir.
- **Deterministik filtre boru hattı.** `fetchTransactions` bir options
  bag alır; `if ('key' in options)` kontrolü kasıtlı olarak
  `if (options.key !== undefined)`'nin yerine kondu: ikincisi "ayarlanmadı"
  ile "açıkça temizlendi"yi ayırt edemiyordu. Bu incelik, projede
  daha önce düzeltilen "Tüm aşamalar" bug'ının kaynağıydı.
- **Tipli action > watcher.** Action'lar niyeti adlandırır
  (`setAdvancedFilters`, `resetFilters`, `setPage`). Sayfalar state'i
  doğrudan poke etmek yerine bu action'ları çağırır; güncelleme yüzeyi
  dar kalır.

---

## 12. UI/UX Kararları

- **Açılıp kapanan "Gelişmiş Filtreleme" paneli** ana filtre çubuğu
  içinde. Varsayılan UI'yı temiz tutarken güç kullanıcısı filtrelerini
  keşfedilebilir kılar (aktif filtre sayısı bir rozetle gösterilir).
- **`SearchableSelect` bileşeni.** Yerel `<select>` ~20 seçenek
  sonrasında acı verir ve aranamaz. Klavye navigasyonu, arama ve
  temizleme destekli özel combobox onlarca danışmanla sorunsuz çalışır
  ve formu hızlı hissettirir. Hem panonun danışman filtresinde hem de
  yeni-işlem formunda yeniden kullanılır.
- **Anlamsal renklerle aşama rozetleri** (slate / amber / sky /
  emerald) tablo satırları, detay sayfası ve PDF arasında aynı şekilde
  görünür; kullanıcı eşlemeyi bir kez öğrenir, her yerde aynı şekilde
  okunur.
- **Dikey zaman çizelgesi** detay sayfasında dört adımlı state
  makinesini aynalar. "Yapıldı / şu an / bekliyor" şekil ve renk olarak
  birbirinden ayrışır; mevcut adım bir bakışta görülür.
- **Inline PDF indirme** `fetch` + `blob` + `URL.createObjectURL` ile
  yapılır. Düz bir `<a href>` başlık ekleyemezdi; bu akış hem bearer
  auth'u korur hem de sunucuya `Content-Disposition` üzerinden akıllı
  dosya adı atamasını sağlar.
- **Arama için 500 ms debounce** her tuş vuruşunda API'yi yormayı
  önler. 500 ms, "tepkisel hissettiriyor" ile "makul ölçüde ucuz"
  arasındaki yaygın bir tatlı nokta.
- **Buton boyutlarında tutarlılık** (sabit `h-8`, `whitespace-nowrap`)
  — küçük bir detay ama hücreler farklı uzunlukta etiketler içerse bile
  tabloların dikeyde zıplamamasını sağlar.

---

## 13. PDF Dışa Aktarım Akışı

`GET /transactions/:id/export` `pdfkit` ile PDF üretir:

1. Servis, doldurulmuş danışmanlarla işlemi yükler ve hidrate bir
   Mongoose dokümanı döner.
2. `buildTransactionPdf` gömülü DejaVu fontlarını (Sans + Sans Bold)
   kaydeder; böylece Türkçe diakritler platformlar arası tutarlı
   render edilir.
3. `doc.on('data')` chunk'ları bir Promise içinde diziye toplanır;
   `doc.on('end')` çözdüğünde controller buffer'ı açık `Content-Type`,
   `Content-Length` ve `Content-Disposition` başlıklarıyla gönderir.

Neden doğrudan response'a stream etmek yerine "buffer → gönder":

- **Hata yönetimi deterministik.** Font kaydı veya herhangi bir çizim
  adımında hata atılırsa 500 temiz bir gövdeyle döner. Stream'lesek
  hata anında başlıklar çoktan yazılmış olurdu; istemci kesik, "başarılı
  gibi duran" bir download görür.
- **Doğru Content-Length.** Nihai bayt sayısını biliriz; istemciler
  progress gösterebilir.
- **Daha kolay test.** `Buffer` dönen bir fonksiyonu test etmek,
  değiştirilebilir bir `Response`'u poke eden fonksiyonu test etmekten
  çok daha basittir.

Varlık (asset) stratejisi:

- Font TTF'leri `backend/src/assets/fonts/` altında durur ve derleme
  zamanında `nest-cli.json`'un `assets` bloğu ile
  `backend/dist/assets/fonts/` içine kopyalanır. Runtime'da
  `__dirname`'e göre çözümlenen path `nest start`, `node dist/main` ve
  test koşucuları için aynı şekilde çalışır.

---

## 14. Güvenlik Yaklaşımı

- **Helmet** standart koruyucu başlıkları koyar (`X-Content-Type-Options`,
  `Referrer-Policy`, vb.). CSP şimdilik kapalı çünkü Swagger UI ve
  harici frontend host'ları beyaz liste gerektirirdi; dağıtım sabitlenince
  bu küçük bir sertleştirme kazanımı olarak eklenebilir.
- **`@nestjs/throttler`** her isteği hız sınırlar (IP başına dakikada
  100) ve `POST /auth/login`'i 10/dk ile sıkılaştırıp parola brute
  force'u köreltir.
- **CORS** kaynakları `CORS_ORIGIN` (virgülle ayrılmış) envden gelir.
  Dev için varsayılan `http://localhost:3000`; prodüksiyonda dağıtılmış
  frontend URL'ine açıkça ayarlanmalı.
- **Global `ValidationPipe`** `whitelist: true` ve
  `forbidNonWhitelisted: true` ile çalışır; payload'ta bilinmeyen bir
  alan varsa hızla hata döner. İmplisit dönüşüm + `class-transformer`
  query string'leri (`page=2`) sayı olarak güvenli tüketmeyi sağlar.
- **Parolalar dinlenirken.** bcrypt `saltRounds = 10` ile hashlenir;
  alan `select: false` olduğundan `findOne` / `findById` hash'i yanlışlıkla
  dış dünyaya açmaz.
- **Rol zorunluluğu sunucuda**, istemcide değil. Frontend, admin
  olmayana "Kullanıcılar" linkini gizleyebilir ama backend `RolesGuard`
  ile isteği bağımsız olarak reddeder.
- **`GET /users` hiçbir hassas veri dönmez** — varsayılan şema select
  ayarları sayesinde yanıtlarda parola alanı yoktur.

---

## 15. Gözlemlenebilirlik ve Sağlık

- **`GET /health`** (Terminus) MongoDB'yi pingler ve bilinen bir JSON
  şekli döner. Konteyner orkestratörleri, yük dengeleyiciler ve uptime
  monitörleri bunu poll eder.
- **NestJS `Logger`** önemli iş olayları için kullanılır (işlem
  yaratıldı, aşama ilerledi). Prodüksiyonda `LoggerService` arkasına
  yapılandırılmış bir logger (pino, winston) takılabilir — drop-in
  yükseltme.
- **`/docs` üzerinde Swagger UI** hem kendini anlatan API sözleşmesi
  hem de hızlı debug aracıdır. Operatör JWT'yi yapıştırıp hiçbir şey
  kurmadan çalışan sistemi keşfedebilir.

---

## 16. Test Stratejisi

Sinyal/emek oranına göre üç katman:

1. **Saf unit testler** (`commission-calculator`, `stage-transitions`).
   Bu dosyalarda kod başına en yoğun değişmezler vardır; ucuz,
   deterministik testler en iyi savunmadır.
2. **Servis düzeyinde unit testler** (`transactions.service.spec.ts`);
   Mongoose `Model` `getModelToken` aracılığıyla mock'lanır. Yalnızca
   statik tiplerle çıkarsanamayan orkestrasyon kurallarını kapsar:
   ilk stage history girdisi, yasak aşama geçişleri, çakışma tespiti,
   finansal dağılım yan etkisi ve role göre erişim filtre şekli.
   `chain(resolved)` mock yardımcısı, Mongoose'un akıcı
   `populate/select/lean/sort/skip/limit/exec` zincirini tek satırda
   ifade edebilmek için yazılmıştır.
3. **Uçtan uca smoke testler** (`test/app.e2e-spec.ts`) tüm Nest
   uygulamasını ayağa kaldırır ve `/health`'in yanıt verdiğini,
   `/transactions`'ın anonim çağrıları reddettiğini doğrular. E2E
   kapsamı bilinçli olarak ince — login/create/advance/export gibi
   akışlar ilgili özelliklerle birlikte büyümeli.

Frontend bileşen testleri bilinçli olarak yazılmamıştır. UI ince ve
çoğunlukla store'ları render ediyor; Vitest + Testing Library kurulumu
için ödenen maliyet bu boyutta geri dönmez.

---

## 17. Geliştirici Deneyimi (DX)

- **`npm run dev`** kökten çalıştırıldığında `concurrently` ile backend
  ve frontend aynı anda başlar, renk kodlanmış çıktı döner. Terminal
  jonglörlüğüne gerek kalmaz.
- **`npm run install:all`** taze bir klonlamayı kök/backend/frontend
  sırasıyla tek seferde hazırlar.
- **`npm run seed`** — boş bir veritabanı üzerinde tıklanmaya hazır bir
  noktaya ulaşmanın deterministik yolu. "Admin'i nasıl oluşturayım?"
  sürtüşmesini yok eder.
- **`.env.example` dosyaları** her iki tarafta da env yüzeyini açık ve
  PR'larda gözden geçirilebilir kılar.
- **ESLint + Prettier** backend'de stil kaymalarını tutar. Test
  dosyalarında `unsafe-*` kuralları gevşetilmiştir çünkü Jest mock'ları
  kaçınılmaz olarak `any` yüzeye çıkarır; "doğru" tipleri yazmak
  sinyalden çok gürültü üretirdi.
- **Sıkı TypeScript** her iki tarafta; kamu fonksiyon imzalarında açık
  tipler. Uygulama kodunda `any` kullanılmaz — union, mapped type ve
  generic'ler ağır işi görür.

---

## 18. Ödünleşimler ve İlerisi

Kapsam gereği bilerek kabul ettiğimiz ödünleşimler:

- **Cookie `HttpOnly` değil.** Basit bir bearer-başlık akışı karşılığında
  XSS riskini kabul ediyoruz. Prodüksiyonda HttpOnly + Secure +
  SameSite=lax cookie'lerine geçip API çağrılarını Nuxt sunucusundan
  proxyleyerek bu riski kapatabilirsin.
- **Arama regex tabanlı.** Yüzlerce işlem için yeterli; büyük veri
  kümelerinde MongoDB text index veya Atlas Search tercih edilmelidir.
- **Soft delete / arşivleme yok.** İşlemler tamamlandıktan sonra
  yalnızca-ekle mantığıyla yaşar; bu muhasebe zihniyetine uyar ama
  yaşam döngüsü yönetimi gereksinim olursa değişmesi gerekecektir.
- **Komisyon oranları kod sabiti.** Ofis başına veya işlem başına
  override isteniyorsa sabitler bir ayarlar koleksiyonuna taşınıp her
  işleme anlık görüntü olarak yazılmalıdır.
- **Tek veritabanı, tek kiracı.** Mevcut model tek kiracılıdır.
  Multi-tenant dağıtım için her dokümana ve her sorguya bir tenant id
  eklemek gerekir.

Değer / emek sırasına göre sonraki adımlar:

- **Yapılandırılmış log + request id** (pino, korelasyon başlıkları) —
  prodüksiyon debug'ı için.
- **Dockerfile + docker-compose** (Mongo + backend + frontend) — onboard
  hikâyesini `docker compose up` ile tek komuta indirmek.
- **Dağıtım otomasyonu** (Fly.io / Render / Vercel yapılandırmaları,
  tek tıkla preview).
- **Her aşama girdisine not ve ek belge (attachment)** — daha zengin
  bir denetim anlatısı için.
- **Soft delete + admin tarafında aşama undo** — mevcut sıkı ileri-yön
  kuralının yerine.

---

Soru, itiraz ya da iyileştirme fikri her zaman açıktır — bu belgedeki
her karar, iş bağlamı değişince geri alınabilir.
