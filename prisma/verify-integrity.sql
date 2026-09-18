-- Menguji constraint & relasi langsung di database, melewati layer aplikasi.
-- Semua perubahan dibatalkan di akhir (ROLLBACK).
--
-- Tiap pengujian dibungkus BEGIN ... EXCEPTION sendiri, yang di PL/pgSQL
-- otomatis membuat savepoint, jadi satu kegagalan tidak membatalkan sisanya.
SET client_min_messages TO NOTICE;
BEGIN;

DO $$
DECLARE
  cat_id text := (SELECT id FROM categories WHERE slug = 'pastry');
  ok int := 0;
  fail int := 0;
BEGIN
  -- ---------------------------------------------------- CHECK constraint ---
  BEGIN
    INSERT INTO products (id, name, description, price, emoji, tone, category_id, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'Gratisan', 'tes', 0, 'x', 'y', cat_id, now(), now());
    RAISE NOTICE 'X   1. harga 0 TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  1. harga menu 0 ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    INSERT INTO products (id, name, description, price, emoji, tone, category_id, created_at, updated_at)
    VALUES (gen_random_uuid()::text, '   ', 'tes', 10000, 'x', 'y', cat_id, now(), now());
    RAISE NOTICE 'X   2. nama kosong TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  2. nama menu berisi spasi saja ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    INSERT INTO users (id, name, email, password, role, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'Ceroboh', 'ceroboh@example.com', 'password123', 'CUSTOMER', now(), now());
    RAISE NOTICE 'X   3. password teks biasa TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  3. password teks biasa ditolak, wajib hash bcrypt [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    INSERT INTO users (id, name, email, password, role, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'Kapital', 'Kapital@Example.com',
            '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', now(), now());
    RAISE NOTICE 'X   4. email kapital TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  4. email dengan huruf kapital ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    UPDATE order_items SET subtotal = 1 WHERE id = (SELECT id FROM order_items LIMIT 1);
    RAISE NOTICE 'X   5. subtotal ngawur TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  5. subtotal != unit_price x quantity ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    INSERT INTO categories (id, slug, name, emoji, tone, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'Kue Kering', 'Kue Kering', 'x', 'y', now(), now());
    RAISE NOTICE 'X   6. slug berspasi TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  6. slug kategori berspasi ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  -- ------------------------------------------- foreign key: onDelete Restrict
  BEGIN
    DELETE FROM categories WHERE id = cat_id;
    RAISE NOTICE 'X   7. hapus kategori berisi menu TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  7. hapus kategori yang masih berisi menu ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    DELETE FROM products WHERE id = (SELECT product_id FROM order_items LIMIT 1);
    RAISE NOTICE 'X   8. hapus menu yang sudah dipesan TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  8. hapus menu yang sudah pernah dipesan ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  BEGIN
    INSERT INTO orders (id, order_number, user_id, pickup_date, status, total_price, created_at, updated_at)
    VALUES (gen_random_uuid()::text, 'HC-TEST-0001', 'user-hantu', CURRENT_DATE + 1, 'PENDING', 1000, now(), now());
    RAISE NOTICE 'X   9. order dengan user hantu TIDAK ditolak';  fail := fail + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK  9. order yang menunjuk user tidak ada ditolak [%]', SQLSTATE;  ok := ok + 1;
  END;

  -- ------------------------------------------- foreign key: onDelete Cascade
  DECLARE
    target_order text := (SELECT id FROM orders LIMIT 1);
    items_before int;
    items_after int;
    target_user text;
    orders_before int;
    orders_after int;
  BEGIN
    SELECT count(*) INTO items_before FROM order_items WHERE order_id = target_order;
    DELETE FROM orders WHERE id = target_order;
    SELECT count(*) INTO items_after FROM order_items WHERE order_id = target_order;
    IF items_before > 0 AND items_after = 0 THEN
      RAISE NOTICE 'OK 10. hapus order -> % item ikut terhapus (cascade)', items_before;  ok := ok + 1;
    ELSE
      RAISE NOTICE 'X  10. cascade order->item tidak jalan (% -> %)', items_before, items_after;  fail := fail + 1;
    END IF;

    SELECT id INTO target_user FROM users
      WHERE role = 'CUSTOMER' AND id IN (SELECT user_id FROM orders) LIMIT 1;
    SELECT count(*) INTO orders_before FROM orders WHERE user_id = target_user;
    DELETE FROM users WHERE id = target_user;
    SELECT count(*) INTO orders_after FROM orders WHERE user_id = target_user;
    IF orders_before > 0 AND orders_after = 0 THEN
      RAISE NOTICE 'OK 11. hapus user -> % order ikut terhapus (cascade)', orders_before;  ok := ok + 1;
    ELSE
      RAISE NOTICE 'X  11. cascade user->order tidak jalan (% -> %)', orders_before, orders_after;  fail := fail + 1;
    END IF;
  END;

  RAISE NOTICE '';
  RAISE NOTICE 'HASIL: % lolos, % gagal', ok, fail;
END $$;

ROLLBACK;
