# Hadish Cake API

Backend booking system toko kue Hadish Cake. Dibuat dengan **NestJS 11 + Prisma 7 + PostgreSQL**.

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

Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` sesuai user & password PostgreSQL kamu:

```env
DATABASE_URL="postgresql://postgres:PASSWORD_KAMU@localhost:5432/hadish_cake?schema=public"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

### 3. Install, migrasi, dan isi data awal

```bash
npm install
npm run db:migrate    # membuat tabel dari prisma/schema.prisma
npm run db:seed       # mengisi data awal (kategori, menu, user, contoh order)
npm run start:dev     # server jalan di http://localhost:3001/api
```

Perintah lain yang tersedia:

| Perintah             | Fungsi                                                |
| -------------------- | ----------------------------------------------------- |
| `npm run db:generate` | Generate ulang Prisma Client setelah schema berubah   |
| `npm run db:reset`    | Hapus semua tabel, migrasi ulang, lalu seed ulang     |
| `npm run db:studio`   | Buka Prisma Studio untuk melihat isi database         |
| `npm run build`       | Compile TypeScript ke folder `dist`                   |

### Akun hasil seed

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| ADMIN    | `admin@hadishcake.com` | `Admin123!`    |
| CUSTOMER | `siti@example.com`     | `Customer123!` |
| CUSTOMER | `budi@example.com`     | `Customer123!` |
| CUSTOMER | `dewi@example.com`     | `Customer123!` |

Semua password disimpan sebagai hash bcrypt, tidak pernah sebagai teks biasa.

---

## Struktur database

```
User 1 ──< Order 1 ──< OrderItem >── 1 Product >── 1 Category
```

| Tabel         | Isi                                                                    |
| ------------- | ---------------------------------------------------------------------- |
| `users`       | Akun admin & customer, beserta role dan hash password                  |
| `categories`  | Kelompok menu: birthday, cupcake, pastry, custom                       |
| `products`    | Menu kue beserta harga dan kategorinya                                 |
| `orders`      | Satu pesanan: siapa, tanggal ambil, status, total harga                |
| `order_items` | Rincian menu di dalam satu pesanan, lengkap dengan harga saat dipesan  |

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

> Catatan: endpoint di bawah ini belum dilindungi autentikasi. Login/register (JWT)
> dan middleware proteksi route dikerjakan di tahap berikutnya. Untuk sementara
> `userId` masih dikirim lewat body/query, nanti diambil dari token.

### Health check

| Method | Endpoint | Keterangan            |
| ------ | -------- | --------------------- |
| GET    | `/api`   | Mengecek API hidup    |

### Categories

| Method | Endpoint                    | Keterangan                              |
| ------ | --------------------------- | --------------------------------------- |
| POST   | `/api/categories`           | Admin menambah kategori                 |
| GET    | `/api/categories`           | Daftar kategori + jumlah menu           |
| GET    | `/api/categories/slug/:slug`| Kategori beserta menunya (untuk filter) |
| GET    | `/api/categories/:id`       | Detail satu kategori                    |
| PATCH  | `/api/categories/:id`       | Admin mengubah kategori                 |
| DELETE | `/api/categories/:id`       | Admin menghapus kategori (harus kosong) |

### Products (menu)

| Method | Endpoint             | Keterangan                       |
| ------ | -------------------- | -------------------------------- |
| POST   | `/api/products`      | Admin menambah menu              |
| GET    | `/api/products`      | Daftar menu, mendukung filter    |
| GET    | `/api/products/:id`  | Detail satu menu                 |
| PATCH  | `/api/products/:id`  | Admin mengubah menu              |
| DELETE | `/api/products/:id`  | Admin menghapus menu             |

Query string untuk `GET /api/products`:

| Query                | Contoh                    | Fungsi                                        |
| -------------------- | ------------------------- | --------------------------------------------- |
| `category`           | `?category=birthday`      | Filter berdasarkan slug kategori              |
| `search`             | `?search=coklat`          | Cari berdasarkan nama menu                    |
| `bestSeller`         | `?bestSeller=true`        | Hanya menu favorit                            |
| `includeUnavailable` | `?includeUnavailable=true`| Ikutkan menu nonaktif (untuk halaman admin)   |
| `page` & `limit`     | `?page=2&limit=10`        | Pagination                                    |

### Users

| Method | Endpoint          | Keterangan                                |
| ------ | ----------------- | ----------------------------------------- |
| POST   | `/api/users`      | Membuat user (password otomatis di-hash)  |
| GET    | `/api/users`      | Daftar user                               |
| GET    | `/api/users/:id`  | Detail satu user                          |
| PATCH  | `/api/users/:id`  | Mengubah data user                        |
| DELETE | `/api/users/:id`  | Menghapus user                            |

Field `password` tidak pernah ikut dikirim di response mana pun.

### Orders

| Method | Endpoint                        | Keterangan                                  |
| ------ | ------------------------------- | ------------------------------------------- |
| POST   | `/api/orders`                   | Customer membuat pesanan                    |
| GET    | `/api/orders`                   | Semua pesanan (dashboard admin)             |
| GET    | `/api/orders/user/:userId`      | History pesanan milik satu customer         |
| GET    | `/api/orders/:id`               | Detail satu pesanan                         |
| PATCH  | `/api/orders/:id/pickup-date`   | Customer mengganti tanggal pengambilan      |
| PATCH  | `/api/orders/:id/status`        | Admin mengatur status pesanan               |
| PATCH  | `/api/orders/:id/cancel`        | Customer membatalkan pesanan                |
| DELETE | `/api/orders/:id`               | Admin menghapus pesanan                     |

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
- pesan error dikirim dalam bahasa Indonesia.

Aturan yang divalidasi di level service (bukan hanya format):

- tanggal pengambilan minimal **H+1** dari hari ini,
- menu yang dipesan harus ada, belum dihapus, dan berstatus tersedia,
- satu menu tidak boleh dikirim dua kali dalam satu order,
- perpindahan status order harus mengikuti alur yang diizinkan.
