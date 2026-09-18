import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { OrderStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi koneksi database.',
  );
}

// Sejak Prisma 7, koneksi dibuat lewat driver adapter.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Sama dengan BCRYPT_SALT_ROUNDS di UsersService. */
const SALT_ROUNDS = 10;

/**
 * Tanggal relatif terhadap hari ini, tengah malam UTC.
 * offset negatif = masa lalu (untuk history), positif = masa depan.
 */
function daysFromToday(offset: number): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

const categories = [
  {
    slug: 'birthday',
    name: 'Birthday Cake',
    emoji: '🎂',
    tone: 'bg-strawberry-100',
  },
  { slug: 'cupcake', name: 'Cupcake', emoji: '🧁', tone: 'bg-butter-100' },
  { slug: 'pastry', name: 'Pastry', emoji: '🥐', tone: 'bg-pistachio-100' },
  {
    slug: 'custom',
    name: 'Custom Cake',
    emoji: '🍰',
    tone: 'bg-blueberry-100',
  },
];

/** Menu awal — sama dengan katalog statis di frontend (app/data/products.ts). */
const products = [
  {
    name: 'Strawberry Shortcake',
    description: 'Sponge lembut, krim segar, dan stroberi pilihan.',
    price: 185000,
    categorySlug: 'birthday',
    emoji: '🍰',
    tone: 'bg-strawberry-100',
    bestSeller: true,
  },
  {
    name: 'Rainbow Birthday Cake',
    description: 'Enam lapis warna dengan buttercream vanilla.',
    price: 250000,
    categorySlug: 'birthday',
    emoji: '🎂',
    tone: 'bg-blueberry-100',
    bestSeller: false,
  },
  {
    name: 'Choco Fudge Cake',
    description: 'Cokelat pekat dengan ganache yang lumer.',
    price: 195000,
    categorySlug: 'birthday',
    emoji: '🍫',
    tone: 'bg-cream-300',
    bestSeller: false,
  },
  {
    name: 'Vanilla Cupcake',
    description: 'Cupcake klasik dengan topping buttercream.',
    price: 25000,
    categorySlug: 'cupcake',
    emoji: '🧁',
    tone: 'bg-butter-100',
    bestSeller: true,
  },
  {
    name: 'Red Velvet Cupcake',
    description: 'Red velvet lembut dengan cream cheese frosting.',
    price: 30000,
    categorySlug: 'cupcake',
    emoji: '🧁',
    tone: 'bg-strawberry-100',
    bestSeller: false,
  },
  {
    name: 'Butter Croissant',
    description: 'Berlapis-lapis, renyah di luar, lembut di dalam.',
    price: 22000,
    categorySlug: 'pastry',
    emoji: '🥐',
    tone: 'bg-butter-200',
    bestSeller: false,
  },
  {
    name: 'Matcha Roll Cake',
    description: 'Gulung matcha Jepang dengan krim susu.',
    price: 150000,
    categorySlug: 'pastry',
    emoji: '🍵',
    tone: 'bg-pistachio-100',
    bestSeller: true,
  },
  {
    name: 'Cinnamon Roll',
    description: 'Roti manis kayu manis dengan glaze gula.',
    price: 28000,
    categorySlug: 'pastry',
    emoji: '🍩',
    tone: 'bg-cream-300',
    bestSeller: false,
  },
  {
    name: 'Blueberry Cheesecake',
    description: 'Cheesecake panggang dengan saus blueberry.',
    price: 210000,
    categorySlug: 'custom',
    emoji: '🫐',
    tone: 'bg-blueberry-100',
    bestSeller: true,
  },
  {
    name: 'Custom Photo Cake',
    description: 'Cetak foto favorit kamu di atas kue.',
    price: 320000,
    categorySlug: 'custom',
    emoji: '🎨',
    tone: 'bg-pistachio-100',
    bestSeller: false,
  },
];

const users = [
  {
    name: 'Admin Hadish',
    email: 'admin@hadishcake.com',
    password: 'Admin123!',
    phone: '081234567890',
    role: Role.ADMIN,
  },
  {
    name: 'Siti Rahayu',
    email: 'siti@example.com',
    password: 'Customer123!',
    phone: '081298765432',
    role: Role.CUSTOMER,
  },
  {
    name: 'Budi Santoso',
    email: 'budi@example.com',
    password: 'Customer123!',
    phone: '081211112222',
    role: Role.CUSTOMER,
  },
  {
    name: 'Dewi Lestari',
    email: 'dewi@example.com',
    password: 'Customer123!',
    phone: '081233334444',
    role: Role.CUSTOMER,
  },
];

/**
 * Contoh order yang mencakup semua status, termasuk order lama dengan tanggal
 * pengambilan di masa lalu supaya halaman history punya isi.
 */
const orders = [
  {
    ref: 'S001',
    userEmail: 'siti@example.com',
    pickupOffset: 3,
    status: OrderStatus.PENDING,
    notes: 'Tolong tulis "Happy Birthday Rani" di atas kue.',
    items: [
      { productName: 'Strawberry Shortcake', quantity: 1 },
      { productName: 'Vanilla Cupcake', quantity: 6 },
    ],
  },
  {
    ref: 'S002',
    userEmail: 'budi@example.com',
    pickupOffset: 1,
    status: OrderStatus.CONFIRMED,
    notes: 'Diambil sore sekitar jam 4.',
    items: [{ productName: 'Choco Fudge Cake', quantity: 1 }],
  },
  {
    ref: 'S003',
    userEmail: 'siti@example.com',
    pickupOffset: 2,
    status: OrderStatus.READY,
    notes: null,
    items: [
      { productName: 'Matcha Roll Cake', quantity: 2 },
      { productName: 'Butter Croissant', quantity: 4 },
    ],
  },
  {
    ref: 'S004',
    userEmail: 'dewi@example.com',
    pickupOffset: -5,
    status: OrderStatus.COMPLETED,
    notes: 'Untuk arisan keluarga.',
    items: [
      { productName: 'Blueberry Cheesecake', quantity: 1 },
      { productName: 'Red Velvet Cupcake', quantity: 12 },
    ],
  },
  {
    ref: 'S005',
    userEmail: 'budi@example.com',
    pickupOffset: -10,
    status: OrderStatus.CANCELLED,
    notes: 'Acara diundur.',
    items: [{ productName: 'Custom Photo Cake', quantity: 1 }],
  },
];

/**
 * Seed diawali dengan menghapus SELURUH isi tabel, jadi kalau tidak sengaja
 * dijalankan di server produksi, data pelanggan ikut hilang. Pengaman ini
 * menghentikannya kecuali memang diminta secara eksplisit lewat
 * ALLOW_PRODUCTION_SEED=true.
 */
function assertSafeToSeed() {
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyAllowed = process.env.ALLOW_PRODUCTION_SEED === 'true';

  if (isProduction && !explicitlyAllowed) {
    throw new Error(
      'Seed dibatalkan: NODE_ENV=production. Seed akan MENGHAPUS SEMUA DATA ' +
        '(user, menu, dan seluruh order). Kalau memang disengaja, jalankan ulang ' +
        'dengan ALLOW_PRODUCTION_SEED=true.',
    );
  }

  if (isProduction) {
    console.warn('PERINGATAN: menjalankan seed di produksi atas permintaan eksplisit.');
  }
}

async function main() {
  assertSafeToSeed();

  console.log('Menghapus data lama...');
  // Urutan penting: hapus dari tabel anak dulu agar tidak melanggar foreign key.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('Membuat kategori...');
  const categoryBySlug = new Map<string, string>();
  for (const category of categories) {
    const created = await prisma.category.create({ data: category });
    categoryBySlug.set(created.slug, created.id);
  }

  console.log('Membuat menu...');
  const productByName = new Map<string, { id: string; price: number }>();
  for (const { categorySlug, ...product } of products) {
    const categoryId = categoryBySlug.get(categorySlug);
    if (!categoryId) {
      throw new Error(`Kategori "${categorySlug}" tidak ada di daftar seed`);
    }

    const created = await prisma.product.create({
      data: { ...product, categoryId },
    });
    productByName.set(created.name, { id: created.id, price: created.price });
  }

  console.log('Membuat user (password di-hash dengan bcrypt)...');
  const userByEmail = new Map<string, string>();
  for (const user of users) {
    const created = await prisma.user.create({
      data: {
        ...user,
        password: await bcrypt.hash(user.password, SALT_ROUNDS),
      },
    });
    userByEmail.set(created.email, created.id);
  }

  console.log('Membuat contoh order...');
  for (const order of orders) {
    const userId = userByEmail.get(order.userEmail);
    if (!userId) {
      throw new Error(`User "${order.userEmail}" tidak ada di daftar seed`);
    }

    // Harga dikunci saat order dibuat, sama seperti yang dilakukan OrdersService.
    const items = order.items.map((item) => {
      const product = productByName.get(item.productName);
      if (!product) {
        throw new Error(`Menu "${item.productName}" tidak ada di daftar seed`);
      }
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: product.price * item.quantity,
      };
    });

    const pickupDate = daysFromToday(order.pickupOffset);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

    await prisma.order.create({
      data: {
        orderNumber: `HC-${pickupDate.toISOString().slice(0, 10).replace(/-/g, '')}-${order.ref}`,
        userId,
        pickupDate,
        status: order.status,
        totalPrice,
        notes: order.notes,
        items: { create: items },
      },
    });
  }

  console.log('');
  console.log('Seed selesai:');
  console.log(`  ${categories.length} kategori`);
  console.log(`  ${products.length} menu`);
  console.log(`  ${users.length} user (1 admin, ${users.length - 1} customer)`);
  console.log(`  ${orders.length} order contoh`);
  console.log('');
  console.log('Akun untuk testing:');
  console.log('  Admin    : admin@hadishcake.com / Admin123!');
  console.log('  Customer : siti@example.com / Customer123!');
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
