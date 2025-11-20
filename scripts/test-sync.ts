/**
 * TEST SCRIPT - Primera Sincronización Manual
 *
 * Este script sincroniza todas las tiendas de Shopify a Supabase
 * Ejecutar: npx ts-node scripts/test-sync.ts
 */

import { syncAllStores } from '../src/services/syncService';

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   🚀 SHOPUNITE - PRIMERA SINCRONIZACIÓN     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    await syncAllStores();

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ SINCRONIZACIÓN COMPLETADA CON ÉXITO     ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('📊 Verifica los resultados en Supabase:');
    console.log('   1. Tabla "products" debe tener productos');
    console.log('   2. Tabla "product_variants" debe tener variantes');
    console.log('   3. Tabla "sync_logs" debe tener registros\n');

    process.exit(0);
  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════╗');
    console.error('║   ❌ ERROR EN LA SINCRONIZACIÓN              ║');
    console.error('╚═══════════════════════════════════════════════╝\n');
    console.error(error);
    process.exit(1);
  }
}

main();
