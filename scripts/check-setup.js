/**
 * Script para verificar el setup del proyecto
 * Ejecutar: node scripts/check-setup.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
];

const OPTIONAL_ENV = [
  'EXPO_PUBLIC_GEMINI_API_KEY'
];

async function checkSetup() {
  console.log('\n🔍 Verificando setup de ShopUnite Marketplace...\n');

  let hasErrors = false;

  // 1. Verificar variables de entorno
  console.log('1️⃣  Verificando variables de entorno...');

  REQUIRED_ENV.forEach(key => {
    if (process.env[key]) {
      console.log(`   ✅ ${key}`);
    } else {
      console.log(`   ❌ ${key} - FALTA (requerida)`);
      hasErrors = true;
    }
  });

  OPTIONAL_ENV.forEach(key => {
    if (process.env[key]) {
      console.log(`   ✅ ${key}`);
    } else {
      console.log(`   ⚠️  ${key} - Opcional (para demo stores)`);
    }
  });

  if (hasErrors) {
    console.log('\n❌ Faltan variables de entorno requeridas.');
    console.log('   Revisa el archivo .env y copia .env.example si es necesario.\n');
    process.exit(1);
  }

  // 2. Verificar conexión a Supabase
  console.log('\n2️⃣  Verificando conexión a Supabase...');

  try {
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error } = await supabase.from('stores').select('count').limit(1);

    if (error) {
      console.log(`   ❌ Error de conexión: ${error.message}`);
      hasErrors = true;
    } else {
      console.log('   ✅ Conexión exitosa a Supabase');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    hasErrors = true;
  }

  // 3. Verificar tablas requeridas
  console.log('\n3️⃣  Verificando tablas de base de datos...');

  const requiredTables = [
    'stores',
    'products',
    'product_variants',
    'sync_logs',
    'transactions',
    'shopify_orders',
    'payouts',
    'users'
  ];

  try {
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );

    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('count').limit(0);

      if (error) {
        console.log(`   ❌ Tabla '${table}' - ${error.message}`);
        hasErrors = true;
      } else {
        console.log(`   ✅ Tabla '${table}'`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error verificando tablas: ${error.message}`);
    hasErrors = true;
  }

  // 4. Verificar tiendas configuradas
  console.log('\n4️⃣  Verificando tiendas Shopify...');

  try {
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: stores, error } = await supabase
      .from('stores')
      .select('domain, store_name, access_token');

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      hasErrors = true;
    } else if (stores.length === 0) {
      console.log('   ⚠️  No hay tiendas registradas');
      console.log('   💡 Usa el Admin Dashboard (npm run dev:web) para agregar tiendas');
    } else {
      console.log(`   ✅ ${stores.length} tienda(s) encontrada(s):\n`);

      stores.forEach(store => {
        const hasToken = store.access_token ? '✅' : '❌';
        console.log(`      ${hasToken} ${store.store_name || store.domain}`);
        if (!store.access_token) {
          console.log(`         ⚠️  Falta Admin API token`);
        }
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    hasErrors = true;
  }

  // 5. Verificar productos sincronizados
  console.log('\n5️⃣  Verificando productos sincronizados...');

  try {
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: products, error } = await supabase
      .from('products')
      .select('id, store_domain')
      .limit(1000);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      hasErrors = true;
    } else if (products.length === 0) {
      console.log('   ⚠️  No hay productos sincronizados');
      console.log('   💡 Ejecuta: npm run sync');
    } else {
      // Contar productos por tienda
      const countByStore = products.reduce((acc, p) => {
        acc[p.store_domain] = (acc[p.store_domain] || 0) + 1;
        return acc;
      }, {});

      console.log(`   ✅ ${products.length} producto(s) total\n`);

      Object.entries(countByStore).forEach(([domain, count]) => {
        console.log(`      • ${domain}: ${count} productos`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    hasErrors = true;
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('❌ Setup incompleto - Por favor corrige los errores arriba\n');
    console.log('📚 Guías disponibles:');
    console.log('   • QUICK_START.md - Para empezar rápidamente');
    console.log('   • DEPLOYMENT_GUIDE.md - Guía completa de deployment\n');
    process.exit(1);
  } else {
    console.log('✅ ¡Setup completo! Todo listo para empezar\n');
    console.log('🚀 Comandos disponibles:');
    console.log('   • npm start - Iniciar app mobile');
    console.log('   • npm run dev:web - Admin Dashboard');
    console.log('   • npm run sync - Sincronizar productos\n');
  }
}

// Ejecutar
checkSetup().catch(error => {
  console.error('\n❌ Error inesperado:', error.message);
  process.exit(1);
});
