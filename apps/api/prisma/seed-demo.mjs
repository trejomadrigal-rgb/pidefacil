/**
 * Seed de demostración — plain ESM (Node 20+, no TypeScript, no ts-node).
 * Crea 3 fondas con menú completo via la API HTTP.
 * Uso: node prisma/seed-demo.mjs
 */

const API_URL = (process.env.API_URL ?? 'http://h81lvlzrwjd7jf8bp0tkg1wa.2.24.201.108.sslip.io').replace(/\/$/, '');

async function api(path, method = 'GET', body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function createFonda({ businessName, slug, phone, email, password, menuName, categories }) {
  console.log(`\n🍽️  Procesando: ${businessName}`);

  // Register (ignore 409 if already exists)
  const registerErr = await api('/auth/register', 'POST', {
    businessName, slug, phone, ownerName: businessName, email, password,
  }).then(() => null).catch((e) => e);

  if (registerErr) {
    if (registerErr.message.includes('409') || registerErr.message.includes('already') || registerErr.message.includes('conflict')) {
      console.log('  ⚠️  Ya existe, limpiando menús anteriores...');
    } else {
      throw registerErr;
    }
  }

  const login = await api('/auth/login', 'POST', { email, password });
  const token = login.access_token;

  // Delete all existing menus (cascades categories + products) for idempotency
  const existingMenus = await api('/menus', 'GET', undefined, token).catch(() => []);
  for (const m of (Array.isArray(existingMenus) ? existingMenus : [])) {
    await api(`/menus/${m.id}`, 'DELETE', undefined, token).catch(() => {});
    console.log(`  🗑️  Menú eliminado: ${m.name}`);
  }

  // Create menu
  const menu = await api('/menus', 'POST', { name: menuName, type: 'FIXED' }, token);
  const menuId = menu.id;

  // Create categories and products
  for (const cat of categories) {
    const category = await api('/categories', 'POST', { name: cat.name, menuId }, token);
    const categoryId = category.id;
    for (const prod of cat.products) {
      await api('/products', 'POST', { ...prod, categoryId }, token);
    }
    console.log(`  ✓ ${cat.name} (${cat.products.length} productos)`);
  }

  await api(`/menus/${menuId}/publish`, 'PATCH', undefined, token);
  console.log(`  ✅ ${businessName} → ${email} / ${password}`);
}

const FONDAS = [
  {
    businessName: 'La Cocina de Doña Rosa',
    slug: 'dona-rosa',
    phone: '5512345671',
    email: 'rosa@pidefacil.demo',
    password: 'Demo1234!',
    menuName: 'Menú del Día',
    categories: [
      {
        name: 'Sopas',
        products: [
          { name: 'Sopa de Lima', description: 'Caldo yucateco con lima y tostadas', price: 45 },
          { name: 'Caldo Tlalpeño', description: 'Con garbanzo, chipotle y epazote', price: 50 },
          { name: 'Sopa de Fideos', description: 'Con jitomate y hierbabuena', price: 35 },
        ],
      },
      {
        name: 'Platos Fuertes',
        products: [
          { name: 'Pollo en Mole', description: 'Mole negro con arroz y frijoles', price: 95 },
          { name: 'Bistec a la Mexicana', description: 'Con nopales, jitomate y chile', price: 90 },
          { name: 'Chile Relleno', description: 'Relleno de queso, capeado, en caldillo', price: 85 },
          { name: 'Milanesa de Res', description: 'Con arroz, frijoles y ensalada', price: 88 },
        ],
      },
      {
        name: 'Antojitos',
        products: [
          { name: 'Enchiladas Verdes', description: 'Con pollo, crema y queso', price: 75 },
          { name: 'Tamales de Rajas', description: 'Con chile poblano y queso', price: 30 },
        ],
      },
      {
        name: 'Bebidas',
        products: [
          { name: 'Agua de Jamaica', price: 20 },
          { name: 'Agua de Horchata', price: 20 },
          { name: 'Refresco', price: 25 },
        ],
      },
    ],
  },
  {
    businessName: 'Tacos El Güero',
    slug: 'tacos-el-guero',
    phone: '5598765432',
    email: 'guero@pidefacil.demo',
    password: 'Demo1234!',
    menuName: 'Carta Tacos',
    categories: [
      {
        name: 'Tacos de Guisado',
        products: [
          { name: 'Taco de Cochinita Pibil', description: 'Con cebolla morada y habanero', price: 22 },
          { name: 'Taco de Chicharrón', description: 'En salsa verde con cilantro', price: 20 },
          { name: 'Taco de Rajas con Crema', description: 'Chile poblano, elote y crema', price: 20 },
          { name: 'Taco de Nopales', description: 'Con queso y chile de árbol', price: 18 },
          { name: 'Taco de Frijoles con Chorizo', description: 'Frijoles negros y chorizo dorado', price: 22 },
        ],
      },
      {
        name: 'Tacos a las Brasas',
        products: [
          { name: 'Taco de Arrachera', description: 'Res asada con guacamole', price: 35 },
          { name: 'Taco de Pollo', description: 'Pechuga asada con pico de gallo', price: 28 },
          { name: 'Taco de Costilla', description: 'Costilla de cerdo asada', price: 32 },
        ],
      },
      {
        name: 'Extras',
        products: [
          { name: 'Guacamole', description: 'Con totopos', price: 45 },
          { name: 'Frijoles de Olla', description: 'Negros o bayos', price: 30 },
          { name: 'Quesadilla', description: 'Con queso Oaxaca', price: 40 },
        ],
      },
      {
        name: 'Para Tomar',
        products: [
          { name: 'Agua Fresca del Día', price: 18 },
          { name: 'Tepache', description: 'Fermentado de piña artesanal', price: 25 },
          { name: 'Cerveza', price: 35 },
        ],
      },
    ],
  },
  {
    businessName: 'La Sazón del Norte',
    slug: 'sazon-del-norte',
    phone: '5511223344',
    email: 'norte@pidefacil.demo',
    password: 'Demo1234!',
    menuName: 'Menú Norteño',
    categories: [
      {
        name: 'Sopas y Caldos',
        products: [
          { name: 'Caldo de Res', description: 'Con verduras de temporada y chile serrano', price: 60 },
          { name: 'Menudo', description: 'Rojo, con orégano y limón', price: 70 },
          { name: 'Pozole Rojo', description: 'Con tostadas, rábano y orégano', price: 75 },
        ],
      },
      {
        name: 'Carnes y Asados',
        products: [
          { name: 'Carne Asada 200g', description: 'Corte de res norteño, frijoles y tortillas', price: 130 },
          { name: 'Machaca con Huevo', description: 'Carne seca deshebrada, jitomate y chile', price: 85 },
          { name: 'Discada', description: 'Mezcla de carnes y embutidos al disco', price: 110 },
          { name: 'Alambre Norteño', description: 'Res, tocino, pimientos y queso', price: 95 },
        ],
      },
      {
        name: 'Comida Corrida',
        products: [
          { name: 'Sopa + Plato Fuerte + Agua', description: 'Menú del día completo', price: 90 },
          { name: 'Solo Plato Fuerte', description: 'Con arroz y frijoles', price: 70 },
        ],
      },
      {
        name: 'Postres',
        products: [
          { name: 'Flan Napolitano', price: 35 },
          { name: 'Arroz con Leche', price: 30 },
          { name: 'Buñuelos', description: 'Con miel de piloncillo', price: 28 },
        ],
      },
      {
        name: 'Bebidas',
        products: [
          { name: 'Agua de Tamarindo', price: 20 },
          { name: 'Leche de Nuez', price: 25 },
          { name: 'Café de Olla', price: 22 },
          { name: 'Refresco', price: 25 },
        ],
      },
    ],
  },
];

async function main() {
  console.log(`\n🌱 Seed demo → ${API_URL}\n`);
  for (const fonda of FONDAS) {
    await createFonda(fonda);
  }
  console.log('\n🎉 Seed demo completo.\n');
  console.log('Credenciales:');
  for (const f of FONDAS) {
    console.log(`  ${f.businessName.padEnd(28)} → ${f.email} / ${f.password}`);
  }
  console.log('');
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
