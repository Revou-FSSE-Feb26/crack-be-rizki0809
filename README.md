# Hadish Cake API

Backend booking system toko kue Hadish Cake. Dibuat dengan **NestJS 11 + Prisma 7 + PostgreSQL**,
dengan autentikasi **JWT** dan pembagian hak akses **admin / customer**.

Customer memesan kue untuk diambil langsung di toko pada tanggal yang dipilih.
Aturan toko: **booking paling lambat 1 hari sebelum tanggal pengambilan.**

---

## Cara menjalankan

### 1. Siapkan database

Buat database kosong di PostgreSQL:

```sql
CREATE DATABASE hadish_cake;
```

### 2. Siapkan file `.env`

Salin `.env.example` menjadi `.env`, lalu isi sesuai konfigurasi kamu:

```env
DATABASE_URL="postgresql://postgres:PASSWORD_KAMU@localhost:5432/hadish_cake?schema=public"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
JWT_SECRET="string-acak-yang-panjang"
JWT_EXPIRES_IN="7d"
```

Buat nilai `JWT_SECRET` yang aman dengan:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Install, migrasi, dan isi data awal

```bash
npm install
npm run db:migrate    # membuat tabel + constraint dari folder prisma/migrations
npm run db:seed       # mengisi data awal (kategori, menu, user, contoh order)
npm run start:dev     # server jalan di http://localhost:3001/api
```

### Daftar perintah

| Perintah              | Fungsi                                              |
| --------------------- | --------------------------------------------------- |
| `npm run start:dev`   | Jalankan server dengan auto-reload                  |
| `npm run build`       | Compile TypeScript ke folder `dist`                 |
| `npm run lint`        | Periksa & rapikan kode                              |
| `npm test`            | Unit test                                           |
| `npm run test:e2e`    | Seed ulang lalu jalankan integration test           |
| `npm run test:api`    | Jalankan koleksi Postman lewat Newman               |
| `npm run db:generate` | Generate ulang Prisma Client setelah schema berubah |
| `npm run db:migrate`  | Terapkan migrasi baru                               |
| `npm run db:seed`     | Isi ulang data awal                                 |
| `npm run db:reset`    | Hapus semua tabel, migrasi ulang, lalu seed ulang   |
| `npm run db:studio`   | Buka Prisma Studio untuk melihat isi database       |

### Akun hasil seed

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| ADMIN    | `admin@hadishcake.com` | `Admin123!`    |
| CUSTOMER | `siti@example.com`     | `Customer123!` |
| CUSTOMER | `budi@example.com`     | `Customer123!` |
| CUSTOMER | `dewi@example.com`     | `Customer123!` |

Semua password disimpan sebagai hash bcrypt (10 salt rounds), tidak pernah sebagai teks biasa.

---

## Autentikasi & hak akses

API memakai **JWT bearer token**. Alurnya:

1. Customer mendaftar lewat `POST /api/auth/register`, atau login lewat `POST /api/auth/login`.
2. Server membalas dengan `accessToken`.
3. Client menyertakan token itu di setiap request berikutnya:

```http
Authorization: Bearer <accessToken>
```

Isi token (payload) hanya berupa `sub` (id user), `email`, dan `role`. Masa berlakunya
diatur lewat `JWT_EXPIRES_IN`, default 7 hari.

### Cara proteksinya dipasang

`JwtAuthGuard` dan `RolesGuard` dipasang **global** di `app.module.ts`, jadi aturan
dasarnya: **semua endpoint tertutup**. Endpoint membuka dirinya sendiri lewat decorator:

| Decorator            | Arti                                           |
| -------------------- | ---------------------------------------------- |
| `@Public()`          | Boleh diakses tanpa token                      |
| `@Roles(Role.ADMIN)` | Wajib login **dan** rolenya ADMIN              |
| (tanpa decorator)    | Wajib login, role apa pun boleh                |
| `@CurrentUser()`     | Mengambil user dari token di dalam controller  |

Pendekatan ini dipilih supaya endpoint baru **otomatis tertutup** kalau lupa diberi
proteksi — kebalikan dari terbuka secara default yang gampang bocor tanpa disadari.

### Siapa boleh apa

| Bagian                     | Tanpa login | Customer                | Admin       |
| -------------------------- | ----------- | ----------------------- | ----------- |
| Health check               | ✅          | ✅                      | ✅          |
| Register & login           | ✅          | ✅                      | ✅          |
| Lihat katalog menu & kategori | ✅       | ✅                      | ✅          |
| Kelola menu & kategori     | ❌          | ❌                      | ✅          |
| Buat order                 | ❌          | ✅                      | ✅          |
| Lihat order                | ❌          | hanya miliknya          | semua order |
| Ganti tanggal & batalkan   | ❌          | hanya ordernya sendiri  | semua order |
| Ubah status order          | ❌          | ❌                      | ✅          |
| Lihat daftar user          | ❌          | ❌                      | ✅          |
| Ubah profil                | ❌          | hanya akunnya sendiri   | semua akun  |
| Ubah role user             | ❌          | ❌                      | ✅          |

### Hal-hal yang sengaja dibuat begini

- **Register selalu menghasilkan role `CUSTOMER`.** DTO-nya tidak punya field `role`, dan
  `ValidationPipe` menolak request yang menyelipkannya. Akun ADMIN hanya dibuat lewat seed
  atau oleh admin lain.
- **Role diubah lewat endpoint terpisah** (`PATCH /api/users/:id/role`) yang khusus admin,
  supaya customer tidak bisa menaikkan rolenya sendiri lewat endpoint update profil.
- **`userId` pemesan diambil dari token, bukan dari body.** Body yang menyelipkan `userId`
  langsung ditolak `400`.
- **Pesan error login selalu sama** (`"Email atau password salah"`) baik ketika emailnya tidak
  terdaftar maupun passwordnya salah, supaya endpoint ini tidak bisa dipakai menebak email
  mana yang punya akun.
- **Token diverifikasi ulang ke database** pada setiap request, jadi token milik akun yang
  sudah dihapus langsung tidak berlaku.
- **Mengakses order milik orang lain dibalas `403`, bukan `404`**, karena pemanggil sudah
  login dan ordernya memang ada — hanya saja bukan miliknya.
- **Selalu ada minimal satu admin.** Menghapus atau menurunkan admin terakhir ditolak `409`.

---

## Penanganan error

Semua error — dari validasi, dari service, maupun dari database — melewati satu
`AllExceptionsFilter`, sehingga bentuk responsnya selalu sama:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Booking paling lambat 1 hari sebelum pengambilan. Tanggal pengambilan paling cepat adalah 2026-09-19.",
  "path": "/api/orders",
  "timestamp": "2026-09-18T15:04:21.882Z"
}
```

Untuk error validasi, `message` berupa array berisi seluruh pesan sekaligus.

| Kode  | Kapan muncul                                                    |
| ----- | --------------------------------------------------------------- |
| `400` | Format request salah, atau melanggar aturan bisnis              |
| `401` | Token tidak ada, kedaluwarsa, atau tidak valid                  |
| `403` | Sudah login tapi tidak berhak (role salah / bukan miliknya)     |
| `404` | Data tidak ditemukan                                            |
| `409` | Bentrok dengan data lain (email dobel, kategori masih terpakai) |
| `500` | Kesalahan tak terduga di server                                 |

Error Prisma diterjemahkan ke kode HTTP yang wajar (`P2002` → `409`, `P2025` → `404`,
`P2003` → `400`), dan pelanggaran CHECK constraint database menjadi `400`. Detail internal
seperti stack trace atau nama kolom **tidak pernah dikirim ke client** — hanya dicatat di
log server untuk error `5xx`.

---

## Struktur database

```
User 1 ──< Order 1 ──< OrderItem >── 1 Product >── 1 Category
```

| Tabel         | Isi                                                                   |
| ------------- | --------------------------------------------------------------------- |
| `users`       | Akun admin & customer, beserta role dan hash password                 |
| `categories`  | Kelompok menu: birthday, cupcake, pastry, custom                      |
| `products`    | Menu kue beserta harga dan kategorinya                                |
| `orders`      | Satu pesanan: siapa, tanggal ambil, status, total harga               |
| `order_items` | Rincian menu di dalam satu pesanan, lengkap dengan harga saat dipesan |

Beberapa keputusan desain yang penting:

- **`price` dan `totalPrice` bertipe `Int`** (rupiah penuh, bukan desimal) supaya tidak
  ada galat pembulatan seperti pada tipe `Float`.
- **`order_items.unitPrice` menyimpan salinan harga saat order dibuat.** Kalau admin
  mengubah harga menu besok, total order lama tidak ikut berubah.
- **`pickupDate` bertipe `DATE`** (tanpa jam), karena customer hanya memilih hari.
- **Menu tidak benar-benar dihapus kalau sudah pernah dipesan.** Kolom `deletedAt`
  dipakai untuk mengarsipkannya, supaya history order lama tidak kehilangan produknya.

### Status order

```
PENDING ──> CONFIRMED ──> READY ──> COMPLETED
   │            │            │
   └────────────┴────────────┴──> CANCELLED
```

`COMPLETED` dan `CANCELLED` bersifat final dan tidak bisa diubah lagi.

### Integritas data

Aturan penting dijaga di **dua lapis**: di aplikasi (DTO + service) supaya pesan errornya
ramah, dan di database supaya tetap aman kalau ada bug, skrip, atau query manual yang
melewati aplikasi.

Relasi antar tabel:

| Relasi                | Aturan hapus | Artinya                                              |
| --------------------- | ------------ | ---------------------------------------------------- |
| User → Order          | `Cascade`    | Hapus user, ordernya ikut terhapus                   |
| Order → OrderItem     | `Cascade`    | Hapus order, rincian itemnya ikut terhapus           |
| Category → Product    | `Restrict`   | Kategori yang masih berisi menu tidak bisa dihapus   |
| Product → OrderItem   | `Restrict`   | Menu yang sudah pernah dipesan tidak bisa dihapus    |

CHECK constraint (lihat `prisma/migrations/*_add_data_integrity_constraints/`):

| Tabel         | Aturan                                                       |
| ------------- | ------------------------------------------------------------ |
| `products`    | `price > 0`, nama tidak boleh berisi spasi saja              |
| `order_items` | `quantity > 0`, `unit_price > 0`                             |
| `order_items` | `subtotal = unit_price * quantity` — total tidak bisa dipalsukan |
| `orders`      | `total_price >= 0`                                           |
| `users`       | nama tidak kosong, email selalu huruf kecil                  |
| `users`       | password wajib berbentuk hash bcrypt, bukan teks biasa       |
| `categories`  | slug hanya huruf kecil, angka, dan tanda hubung              |

Untuk membuktikan semuanya benar-benar aktif, jalankan skrip verifikasi (semua
perubahannya di-rollback, jadi aman dijalankan kapan saja):

```bash
psql "postgresql://postgres:PASSWORD@localhost:5432/hadish_cake" -f prisma/verify-integrity.sql
```

---

## Daftar endpoint

Semua endpoint diawali `/api`, contoh: `http://localhost:3001/api/products`.
Kolom **Akses** menunjukkan siapa yang boleh memanggil.

### Auth

| Method | Endpoint             | Akses  | Keterangan                          |
| ------ | -------------------- | ------ | ----------------------------------- |
| POST   | `/api/auth/register` | publik | Customer baru mendaftar             |
| POST   | `/api/auth/login`    | publik | Menukar email & password jadi token |
| GET    | `/api/auth/me`       | login  | Data akun yang sedang login         |

Contoh balasan `POST /api/auth/login`:

```json
{
  "user": {
    "id": "c953c7f0-...",
    "name": "Admin Hadish",
    "email": "admin@hadishcake.com",
    "phone": "081234567890",
    "role": "ADMIN"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer"
}
```

### Health check

| Method | Endpoint | Akses  | Keterangan         |
| ------ | -------- | ------ | ------------------ |
| GET    | `/api`   | publik | Mengecek API hidup |

### Categories

| Method | Endpoint                     | Akses  | Keterangan                              |
| ------ | ---------------------------- | ------ | --------------------------------------- |
| GET    | `/api/categories`            | publik | Daftar kategori + jumlah menu           |
| GET    | `/api/categories/slug/:slug` | publik | Kategori beserta menunya (untuk filter) |
| GET    | `/api/categories/:id`        | publik | Detail satu kategori                    |
| POST   | `/api/categories`            | admin  | Menambah kategori                       |
| PATCH  | `/api/categories/:id`        | admin  | Mengubah kategori                       |
| DELETE | `/api/categories/:id`        | admin  | Menghapus kategori (harus kosong)       |

### Products (menu)

| Method | Endpoint            | Akses  | Keterangan                    |
| ------ | ------------------- | ------ | ----------------------------- |
| GET    | `/api/products`     | publik | Daftar menu, mendukung filter |
| GET    | `/api/products/:id` | publik | Detail satu menu              |
| POST   | `/api/products`     | admin  | Menambah menu                 |
| PATCH  | `/api/products/:id` | admin  | Mengubah menu                 |
| DELETE | `/api/products/:id` | admin  | Menghapus menu                |

Query string untuk `GET /api/products`:

| Query                | Contoh                     | Fungsi                                      |
| -------------------- | -------------------------- | ------------------------------------------- |
| `category`           | `?category=birthday`       | Filter berdasarkan slug kategori            |
| `search`             | `?search=coklat`           | Cari berdasarkan nama menu                  |
| `bestSeller`         | `?bestSeller=true`         | Hanya menu favorit                          |
| `includeUnavailable` | `?includeUnavailable=true` | Ikutkan menu nonaktif (untuk halaman admin) |
| `page` & `limit`     | `?page=2&limit=10`         | Pagination                                  |

### Users

| Method | Endpoint              | Akses            | Keterangan                    |
| ------ | --------------------- | ---------------- | ----------------------------- |
| POST   | `/api/users`          | admin            | Membuat akun (termasuk admin) |
| GET    | `/api/users`          | admin            | Daftar user                   |
| GET    | `/api/users/:id`      | diri sendiri/admin | Detail satu user            |
| PATCH  | `/api/users/:id`      | diri sendiri/admin | Ubah nama, email, telepon   |
| PATCH  | `/api/users/:id/role` | admin            | Ubah role user                |
| DELETE | `/api/users/:id`      | admin            | Menghapus user                |

### Orders

| Method | Endpoint                      | Akses              | Keterangan                    |
| ------ | ----------------------------- | ------------------ | ----------------------------- |
| POST   | `/api/orders`                 | login              | Membuat pesanan               |
| GET    | `/api/orders`                 | login              | Admin: semua; customer: miliknya |
| GET    | `/api/orders/user/:userId`    | diri sendiri/admin | History pesanan satu customer |
| GET    | `/api/orders/:id`             | pemilik/admin      | Detail satu pesanan           |
| PATCH  | `/api/orders/:id/pickup-date` | pemilik/admin      | Mengganti tanggal pengambilan |
| PATCH  | `/api/orders/:id/cancel`      | pemilik/admin      | Membatalkan pesanan           |
| PATCH  | `/api/orders/:id/status`      | admin              | Mengatur status pesanan       |
| DELETE | `/api/orders/:id`             | admin              | Menghapus pesanan             |

Query string untuk `GET /api/orders`: `userId` (admin saja), `status`, `pickupDate`,
`page`, `limit`.

Contoh body `POST /api/orders` — perhatikan **tidak ada `userId`**, karena pemesannya
diambil dari token:

```json
{
  "pickupDate": "2026-09-25",
  "notes": "Tolong tulis \"Happy Birthday\" di atas kue.",
  "items": [
    { "productId": "uuid-menu-1", "quantity": 1 },
    { "productId": "uuid-menu-2", "quantity": 6 }
  ]
}
```

Server yang menghitung `unitPrice`, `subtotal`, dan `totalPrice` dari harga menu di
database — bukan dari angka yang dikirim client, supaya harga tidak bisa dimanipulasi.

---

## Validasi request

`ValidationPipe` dipasang global dengan `whitelist` dan `forbidNonWhitelisted`, jadi:

- field yang tidak ada di DTO akan **ditolak** dengan status `400`,
- tipe data dikonversi otomatis sesuai DTO (`@Type(() => Number)`),
- parameter `:id` diperiksa `ParseUUIDPipe`,
- pesan error dikirim dalam bahasa Indonesia.

Aturan yang divalidasi di level service (bukan hanya format):

- tanggal pengambilan minimal **H+1** dari hari ini,
- menu yang dipesan harus ada, belum dihapus, dan berstatus tersedia,
- satu menu tidak boleh dikirim dua kali dalam satu order,
- perpindahan status order harus mengikuti alur yang diizinkan,
- email harus unik saat register maupun saat mengubah profil,
- harus selalu tersisa minimal satu akun admin.

---

## Pengujian

Ada tiga lapis pengujian.

### 1. Unit test

```bash
npm test
```

### 2. Integration test (Jest + supertest)

Menjalankan aplikasi lengkap — guard, pipe, filter, sampai ke database sungguhan —
memakai data hasil seed. Seed dijalankan otomatis dulu supaya hasilnya selalu konsisten.

```bash
npm run test:e2e
```

| Berkas                     | Yang diuji                                             |
| -------------------------- | ------------------------------------------------------ |
| `test/app.e2e-spec.ts`     | Health check                                           |
| `test/auth.e2e-spec.ts`    | Register, login, token, bentuk response error          |
| `test/catalog.e2e-spec.ts` | Katalog publik, CRUD menu, pembatasan role             |
| `test/orders.e2e-spec.ts`  | Alur booking, kepemilikan order, alur status, riwayat  |

### 3. Pengujian API lewat Postman / Newman

Koleksi lengkap ada di folder [`postman/`](postman/):

| Berkas                                       | Isi                            |
| -------------------------------------------- | ------------------------------ |
| `Hadish-Cake-API.postman_collection.json`    | 80 request dalam 6 folder      |
| `Hadish-Cake-Local.postman_environment.json` | Variabel `baseUrl` untuk lokal |

**Lewat aplikasi Postman:** import kedua file, pilih environment
**Hadish Cake - Local**, lalu **Run collection** dari atas ke bawah. Urutannya penting
karena request login menyimpan token ke variabel koleksi yang dipakai request berikutnya.

**Lewat terminal:**

```bash
npm run start:dev    # terminal 1 - server harus hidup
npm run db:seed      # kembalikan data ke kondisi awal
npm run test:api     # terminal 2 - jalankan seluruh koleksi
```

Yang diuji mencakup jalur normal **dan** jalur yang harus gagal: token palsu, register
sebagai ADMIN, customer mencoba endpoint admin, customer membuka order orang lain, order
untuk hari ini, mengirim `totalPrice` sendiri, menu duplikat, dan lompat status order.

---

## Deploy

Backend ini disiapkan untuk **Railway** atau **Render**. Keduanya memakai script yang sama:

| Tahap | Perintah                                          | Yang terjadi                                        |
| ----- | ------------------------------------------------- | --------------------------------------------------- |
| Build | `npm run build`                                   | `prisma generate` lalu `nest build`                  |
| Start | `npm run start:prod`                              | `prisma migrate deploy` lalu `node dist/main`        |

`prisma migrate deploy` dipakai (bukan `migrate dev`) karena non-interaktif, tidak butuh
shadow database, dan **tidak pernah mereset data**. Perintah ini aman dijalankan berkali-kali:
migrasi yang sudah pernah diterapkan akan dilewati.

### Environment variable yang wajib diisi

| Variable         | Contoh nilai                                   | Catatan                                       |
| ---------------- | ---------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`   | `postgresql://user:pass@host:5432/hadish_cake` | Dari database yang disediakan platform        |
| `JWT_SECRET`     | string acak 48 byte                            | **Jangan** pakai nilai yang sama dengan lokal |
| `JWT_EXPIRES_IN` | `7d`                                           |                                               |
| `CORS_ORIGIN`    | `https://namadomain-frontend.vercel.app`       | URL frontend produksi, bukan `localhost`      |
| `NODE_ENV`       | `production`                                   | Mengaktifkan pengaman seed                    |

`PORT` tidak perlu diisi manual — Railway dan Render mengisinya sendiri, dan aplikasi
sudah membacanya dari `process.env.PORT`.

Jangan pernah menyetel `ALLOW_PRODUCTION_SEED` di server. Variabel itu satu-satunya cara
menembus pengaman yang mencegah `npm run db:seed` menghapus seluruh data produksi.

### Railway

1. **New Project** → **Provision PostgreSQL**.
2. **New** → **GitHub Repo** → pilih repo ini.
3. Di tab **Variables**, isi variabel di atas. Untuk `DATABASE_URL` gunakan referensi
   `${{Postgres.DATABASE_URL}}` supaya otomatis mengikuti database yang barusan dibuat.
4. Di **Settings** → **Deploy**, set **Start Command**: `npm run start:prod`.
   Build command bisa dibiarkan default — Railway sudah menjalankan `npm run build`.
5. Set **Healthcheck Path** ke `/api`.

### Render

1. **New** → **PostgreSQL**, lalu salin **Internal Database URL**.
2. **New** → **Web Service** → hubungkan repo ini, Runtime **Node**.
3. **Build Command**:

   ```
   npm ci --include=dev && npm run build
   ```

   `--include=dev` wajib ada. Render menyetel `NODE_ENV=production`, yang membuat npm
   melewati `devDependencies` — padahal `@nestjs/cli` (untuk `nest build`) ada di sana,
   sehingga build akan gagal tanpa flag ini.

4. **Start Command**: `npm run start:prod`
5. **Health Check Path**: `/api`
6. Isi environment variable di atas, dengan `DATABASE_URL` dari langkah 1.

### Kenapa `prisma` ada di `dependencies`, bukan `devDependencies`

Kedua platform membuang `devDependencies` setelah build selesai. Karena `npm run start:prod`
menjalankan `prisma migrate deploy` **saat aplikasi menyala**, paket `prisma` harus ikut
terpasang di runtime — kalau tidak, server gagal start.

### Setelah deploy pertama

Database produksi akan kosong (migrasi hanya membuat tabel, tidak mengisi data). Buat akun
admin pertama secara manual, misalnya lewat `psql` dengan password yang sudah di-hash bcrypt,
atau sementara jalankan seed sekali dengan `ALLOW_PRODUCTION_SEED=true` **selagi database
masih kosong** — lalu segera ganti password akun adminnya.

---

## Catatan teknis

- **Prisma 7** tidak lagi menaruh URL koneksi di `schema.prisma`. Konfigurasinya pindah ke
  [`prisma.config.ts`](prisma.config.ts), dan koneksi dibuat lewat driver adapter
  `PrismaPg`. Bagian lain (model, relasi, migrate, seed) tetap seperti biasa.
- **Sebagian paket `@nestjs/*` sudah ESM-only** (`jwt`, `passport`, `config`,
  `mapped-types`). Node menjalankannya tanpa masalah, tapi Jest butuh flag
  `--experimental-vm-modules`. Flag itu sudah dipasang di script `test` lewat `cross-env`,
  jadi tidak perlu diatur manual.
- **`newman` hanya devDependency** dan tidak ikut ke hasil build. Paket ini membawa cukup
  banyak dependensi lawas, jadi `npm audit` akan menampilkan temuan dari pohon
  dependensinya. Kalau ingin `npm audit` bersih, hapus saja (`npm uninstall newman`) dan
  jalankan sesekali lewat `npx newman run postman/...`.
