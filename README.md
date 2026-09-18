# Hadish Cake API

Backend booking system toko kue Hadish Cake. Dibuat dengan **NestJS 11 + Prisma 7 + PostgreSQL**,
dengan autentikasi **JWT**.

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
npm run db:migrate    # membuat tabel dari prisma/schema.prisma
npm run db:seed       # mengisi data awal (kategori, menu, user, contoh order)
npm run start:dev     # server jalan di http://localhost:3001/api
```

Perintah lain yang tersedia:

| Perintah              | Fungsi                                              |
| --------------------- | --------------------------------------------------- |
| `npm run db:generate` | Generate ulang Prisma Client setelah schema berubah |
| `npm run db:reset`    | Hapus semua tabel, migrasi ulang, lalu seed ulang   |
| `npm run db:studio`   | Buka Prisma Studio untuk melihat isi database       |
| `npm run test:api`    | Jalankan seluruh pengujian API (Newman/Postman)     |
| `npm test`            | Jalankan unit test                                  |
| `npm run build`       | Compile TypeScript ke folder `dist`                 |

### Akun hasil seed

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| ADMIN    | `admin@hadishcake.com` | `Admin123!`    |
| CUSTOMER | `siti@example.com`     | `Customer123!` |
| CUSTOMER | `budi@example.com`     | `Customer123!` |
| CUSTOMER | `dewi@example.com`     | `Customer123!` |

Semua password disimpan sebagai hash bcrypt (10 salt rounds), tidak pernah sebagai teks biasa.

---

## Autentikasi

API memakai **JWT bearer token**. Alurnya:

1. Customer mendaftar lewat `POST /api/auth/register`, atau login lewat `POST /api/auth/login`.
2. Server membalas dengan `accessToken`.
3. Client menyertakan token itu di setiap request berikutnya:

```http
Authorization: Bearer <accessToken>
```

Isi token (payload) hanya berupa `sub` (id user), `email`, dan `role` — tidak ada data sensitif.
Masa berlakunya diatur lewat `JWT_EXPIRES_IN`, default 7 hari.

Beberapa hal yang sengaja dibuat begini:

- **Register selalu menghasilkan role `CUSTOMER`.** DTO-nya tidak punya field `role`, dan
  `ValidationPipe` menolak request yang menyelipkannya. Akun ADMIN hanya dibuat lewat seed.
- **Pesan error login selalu sama** (`"Email atau password salah"`) baik ketika emailnya tidak
  terdaftar maupun passwordnya salah, supaya endpoint ini tidak bisa dipakai menebak email
  mana yang punya akun.
- **Token diverifikasi ulang ke database** pada setiap request, jadi token milik akun yang
  sudah dihapus langsung tidak berlaku.
- **Password tidak pernah muncul di response mana pun**, termasuk di `GET /api/users`.

### Perangkat yang sudah siap untuk proteksi route

Sudah tersedia dan bisa langsung dipakai, tapi **baru dipasang di `GET /api/auth/me`**:

| Berkas                                | Fungsi                                          |
| ------------------------------------- | ----------------------------------------------- |
| `guards/jwt-auth.guard.ts`            | Mewajibkan token valid                          |
| `guards/roles.guard.ts`               | Membatasi endpoint berdasarkan role             |
| `decorators/roles.decorator.ts`       | `@Roles(Role.ADMIN)`                            |
| `decorators/public.decorator.ts`      | `@Public()` untuk endpoint tanpa token          |
| `decorators/current-user.decorator.ts`| `@CurrentUser()` mengambil user dari token      |

> **Endpoint selain `/api/auth/me` masih terbuka tanpa token.** Memasang guard ke seluruh
> route adalah pekerjaan tahap berikutnya.

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
- **`onDelete: Cascade`** pada Order → OrderItem dan User → Order; **`onDelete: Restrict`**
  pada Product dan Category supaya data yang masih dipakai tidak bisa hilang.

### Status order

```
PENDING ──> CONFIRMED ──> READY ──> COMPLETED
   │            │            │
   └────────────┴────────────┴──> CANCELLED
```

`COMPLETED` dan `CANCELLED` bersifat final dan tidak bisa diubah lagi.

---

## Daftar endpoint

Semua endpoint diawali `/api`, contoh: `http://localhost:3001/api/products`.

### Auth

| Method | Endpoint             | Token | Keterangan                          |
| ------ | -------------------- | ----- | ----------------------------------- |
| POST   | `/api/auth/register` | –     | Customer baru mendaftar             |
| POST   | `/api/auth/login`    | –     | Menukar email & password jadi token |
| GET    | `/api/auth/me`       | wajib | Data akun yang sedang login         |

Contoh body `POST /api/auth/register`:

```json
{
  "name": "Siti Rahayu",
  "email": "siti@example.com",
  "password": "Rahasia123",
  "phone": "081298765432"
}
```

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

| Method | Endpoint | Keterangan         |
| ------ | -------- | ------------------ |
| GET    | `/api`   | Mengecek API hidup |

### Categories

| Method | Endpoint                     | Keterangan                              |
| ------ | ---------------------------- | --------------------------------------- |
| POST   | `/api/categories`            | Admin menambah kategori                 |
| GET    | `/api/categories`            | Daftar kategori + jumlah menu           |
| GET    | `/api/categories/slug/:slug` | Kategori beserta menunya (untuk filter) |
| GET    | `/api/categories/:id`        | Detail satu kategori                    |
| PATCH  | `/api/categories/:id`        | Admin mengubah kategori                 |
| DELETE | `/api/categories/:id`        | Admin menghapus kategori (harus kosong) |

### Products (menu)

| Method | Endpoint            | Keterangan                    |
| ------ | ------------------- | ----------------------------- |
| POST   | `/api/products`     | Admin menambah menu           |
| GET    | `/api/products`     | Daftar menu, mendukung filter |
| GET    | `/api/products/:id` | Detail satu menu              |
| PATCH  | `/api/products/:id` | Admin mengubah menu           |
| DELETE | `/api/products/:id` | Admin menghapus menu          |

Query string untuk `GET /api/products`:

| Query                | Contoh                     | Fungsi                                      |
| -------------------- | -------------------------- | ------------------------------------------- |
| `category`           | `?category=birthday`       | Filter berdasarkan slug kategori            |
| `search`             | `?search=coklat`           | Cari berdasarkan nama menu                  |
| `bestSeller`         | `?bestSeller=true`         | Hanya menu favorit                          |
| `includeUnavailable` | `?includeUnavailable=true` | Ikutkan menu nonaktif (untuk halaman admin) |
| `page` & `limit`     | `?page=2&limit=10`         | Pagination                                  |

### Users

| Method | Endpoint         | Keterangan                               |
| ------ | ---------------- | ---------------------------------------- |
| POST   | `/api/users`     | Membuat user (password otomatis di-hash) |
| GET    | `/api/users`     | Daftar user                              |
| GET    | `/api/users/:id` | Detail satu user                         |
| PATCH  | `/api/users/:id` | Mengubah data user                       |
| DELETE | `/api/users/:id` | Menghapus user                           |

### Orders

| Method | Endpoint                      | Keterangan                             |
| ------ | ----------------------------- | -------------------------------------- |
| POST   | `/api/orders`                 | Customer membuat pesanan               |
| GET    | `/api/orders`                 | Semua pesanan (dashboard admin)        |
| GET    | `/api/orders/user/:userId`    | History pesanan milik satu customer    |
| GET    | `/api/orders/:id`             | Detail satu pesanan                    |
| PATCH  | `/api/orders/:id/pickup-date` | Customer mengganti tanggal pengambilan |
| PATCH  | `/api/orders/:id/status`      | Admin mengatur status pesanan          |
| PATCH  | `/api/orders/:id/cancel`      | Customer membatalkan pesanan           |
| DELETE | `/api/orders/:id`             | Admin menghapus pesanan                |

Query string untuk `GET /api/orders`: `userId`, `status`, `pickupDate`, `page`, `limit`.

Contoh body `POST /api/orders`:

```json
{
  "userId": "uuid-customer",
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
- email harus unik saat register maupun saat mengubah profil.

---

## Pengujian API

Koleksi Postman lengkap ada di folder [`postman/`](postman/):

| Berkas                                          | Isi                            |
| ----------------------------------------------- | ------------------------------ |
| `Hadish-Cake-API.postman_collection.json`       | 63 request dalam 6 folder      |
| `Hadish-Cake-Local.postman_environment.json`    | Variabel `baseUrl` untuk lokal |

### Lewat aplikasi Postman

1. **Import** kedua file di atas.
2. Pilih environment **Hadish Cake - Local**.
3. Klik **Run collection** dan jalankan dari atas ke bawah.

Urutannya penting: request login menyimpan token ke variabel koleksi, dan request
berikutnya memakai token serta id yang dihasilkan request sebelumnya. Tanggal
(`besok`, `minggu depan`, `kemarin`) dihitung ulang otomatis setiap kali dijalankan,
jadi pengujian aturan H-1 tidak pernah kedaluwarsa.

### Lewat terminal

```bash
npm run start:dev    # terminal 1 - server harus hidup
npm run db:seed      # kembalikan data ke kondisi awal
npm run test:api     # terminal 2 - jalankan seluruh koleksi
```

Yang diuji mencakup jalur normal **dan** jalur yang harus gagal: token palsu, register
dengan role ADMIN, order untuk hari ini, mengirim `totalPrice` sendiri, menu duplikat,
lompat status order, serta menghapus kategori yang masih berisi menu.

> Catatan: `newman` adalah devDependency dan tidak ikut ke hasil build. Paket ini
> membawa cukup banyak dependensi lawas, jadi `npm audit` akan menampilkan temuan dari
> pohon dependensinya. Kalau mau menjaga `npm audit` tetap bersih, hapus saja
> (`npm uninstall newman`) dan jalankan sesekali lewat `npx newman run ...`.
