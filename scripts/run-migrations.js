const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjA0NDg3OCwiZXhwIjoyMDQ3NjIwODc4fQ.5h_pJr1mHJyPV_NmYuRU8xgbsY4-DjXq8s9PbqKZPvw'; // Service role key

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MIGRATIONS = [
  '000_pre_migration_backup.sql',
  '001_auth_and_users_FIXED.sql', // Using FIXED version to avoid auth.users permission issues
  '002_integrate_existing_tables.sql',
  '999_post_migration_validation.sql'
];

async function executeSQLFile(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Ejecutando: ${filename}`);
  console.log(`${'='.repeat(60)}\n`);

  const filepath = path.join(__dirname, '..', 'supabase', 'migrations', filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Archivo no encontrado: ${filepath}`);
  }

  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`📊 Tamaño: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`⏳ Ejecutando SQL...`);

  const startTime = Date.now();

  try {
    // Nota: Supabase JS client no soporta ejecutar SQL directo con service_role
    // Necesitamos usar la REST API directamente
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const error = await response.text();
      console.error(`\n❌ ERROR en ${filename}:`);
      console.error(error);
      throw new Error(`Migración falló: ${filename}`);
    }

    console.log(`\n✅ Completado en ${duration}s`);
    return true;

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ ERROR después de ${duration}s:`);
    console.error(error.message);
    throw error;
  }
}

async function runMigrations() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║       🚀  TUKA MARKETPLACE - MIGRACIONES DB  🚀       ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log(`📍 Proyecto: ${SUPABASE_URL}`);
  console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
  console.log(`📋 Migraciones a ejecutar: ${MIGRATIONS.length}`);

  // Estado PRE-migración
  console.log('\n📊 ESTADO PRE-MIGRACIÓN:');
  console.log('   - stores: 3 registros');
  console.log('   - transactions: 20 registros');
  console.log('   - shopify_orders: 11 registros');

  console.log('\n⚠️  INICIANDO MIGRACIONES EN 3 SEGUNDOS...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = {
    success: [],
    failed: []
  };

  for (const migration of MIGRATIONS) {
    try {
      await executeSQLFile(migration);
      results.success.push(migration);
    } catch (error) {
      results.failed.push({ migration, error: error.message });
      console.error(`\n💥 DETENIENDO MIGRACIONES - Error en ${migration}`);
      break; // Detener si una migración falla
    }
  }

  // Resumen
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                    RESUMEN FINAL                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log(`✅ Exitosas: ${results.success.length}/${MIGRATIONS.length}`);
  results.success.forEach(m => console.log(`   ✓ ${m}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ Fallidas: ${results.failed.length}`);
    results.failed.forEach(f => {
      console.log(`   ✗ ${f.migration}`);
      console.log(`     Error: ${f.error}`);
    });
    process.exit(1);
  }

  console.log('\n🎉 TODAS LAS MIGRACIONES COMPLETADAS EXITOSAMENTE\n');
}

// Ejecutar
runMigrations().catch(error => {
  console.error('\n💥 ERROR FATAL:');
  console.error(error);
  process.exit(1);
});
