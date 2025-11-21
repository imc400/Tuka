const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjA0NDg3OCwiZXhwIjoyMDQ3NjIwODc4fQ.5h_pJr1mHJyPV_NmYuRU8xgbsY4-DjXq8s9PbqKZPvw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeMigration(filename) {
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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`SQL CONTENT PREVIEW (first 500 chars):`);
  console.log(sql.substring(0, 500) + '...');
  console.log(`${'─'.repeat(60)}\n`);

  const startTime = Date.now();

  try {
    // Use supabase-js client to execute raw SQL
    // Note: This requires the SQL to be broken into individual statements
    // For complex migrations, manual execution via Dashboard is more reliable

    console.log('⚠️  IMPORTANTE: Este script tiene limitaciones.');
    console.log('Para migraciones complejas, se recomienda:');
    console.log('1. Copiar el contenido del archivo');
    console.log('2. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/sql/new');
    console.log('3. Pegar el SQL completo');
    console.log('4. Click en "Run"');
    console.log('\n📋 ARCHIVO A EJECUTAR:');
    console.log(`   ${filepath}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Script ejecutado en ${duration}s`);

    return true;

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ ERROR después de ${duration}s:`);
    console.error(error.message);
    throw error;
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2] || '001_auth_and_users_FIXED.sql';

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║       🚀  TUKA - EJECUTAR MIGRACIÓN INDIVIDUAL  🚀   ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

executeMigration(migrationFile)
  .then(() => {
    console.log('\n✅ PROCESO COMPLETADO\n');
    console.log('📝 PRÓXIMO PASO:');
    console.log('   Ejecutar manualmente el SQL en el Dashboard de Supabase\n');
  })
  .catch(error => {
    console.error('\n💥 ERROR:');
    console.error(error);
    process.exit(1);
  });
