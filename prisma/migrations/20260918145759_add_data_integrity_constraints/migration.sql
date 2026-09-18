-- Aturan integritas data yang dijaga langsung oleh PostgreSQL.
--
-- Aturan yang sama sudah divalidasi di layer aplikasi (DTO + service), tapi
-- dipasang juga di sini sebagai jaring pengaman terakhir: skrip seed, query
-- manual lewat psql, atau bug di kode tetap tidak bisa menyimpan data ngawur.
-- CHECK constraint tidak bisa dinyatakan lewat schema.prisma, jadi ditulis SQL.

-- Harga menu harus positif dan masuk akal.
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0);

-- Nama dan deskripsi menu tidak boleh berisi spasi doang.
ALTER TABLE "products"
  ADD CONSTRAINT "products_name_not_blank" CHECK (length(trim("name")) > 0);

-- Jumlah pesanan per menu minimal 1.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);

-- Harga yang dikunci saat order dibuat harus positif.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_unit_price_positive" CHECK ("unit_price" > 0);

-- Subtotal wajib konsisten dengan harga satuan dikali jumlahnya.
-- Ini yang menjaga agar total order tidak bisa dimanipulasi.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_subtotal_consistent"
  CHECK ("subtotal" = "unit_price" * "quantity");

-- Total order tidak boleh negatif.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_price_non_negative" CHECK ("total_price" >= 0);

-- Nama user tidak boleh kosong.
ALTER TABLE "users"
  ADD CONSTRAINT "users_name_not_blank" CHECK (length(trim("name")) > 0);

-- Email selalu disimpan huruf kecil, supaya pengecekan keunikan tidak bisa
-- diakali dengan menulis ulang email yang sama memakai huruf kapital.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- Password yang tersimpan harus berupa hash bcrypt (selalu 60 karakter dan
-- diawali $2a$/$2b$/$2y$), bukan teks biasa.
ALTER TABLE "users"
  ADD CONSTRAINT "users_password_is_bcrypt_hash"
  CHECK ("password" ~ '^\$2[aby]\$\d{2}\$.{53}$');

-- Slug kategori hanya huruf kecil, angka, dan tanda hubung.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_slug_format" CHECK ("slug" ~ '^[a-z0-9-]+$');
