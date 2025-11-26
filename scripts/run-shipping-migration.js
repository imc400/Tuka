/**
 * Script para ejecutar la migración de shipping zones en Supabase
 * Ejecutar con: node scripts/run-shipping-migration.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
// Usar service role key para poder crear tablas
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU2NDA5MiwiZXhwIjoyMDc5MTQwMDkyfQ.YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Ejecutando migración de shipping zones...\n');

  try {
    // Verificar si las tablas ya existen
    const { data: existingTables } = await supabase
      .from('store_shipping_config')
      .select('id')
      .limit(1);

    if (existingTables !== null) {
      console.log('✅ Las tablas de shipping ya existen. Migración no necesaria.');
      return;
    }
  } catch (error) {
    // Si hay error, las tablas no existen, proceder con la migración
    console.log('📋 Las tablas no existen, procediendo con la migración...\n');
  }

  // La migración debe ejecutarse directamente en Supabase Dashboard
  console.log('⚠️  Para crear las tablas, necesitas ejecutar el SQL en Supabase Dashboard:');
  console.log('');
  console.log('1. Ve a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/sql');
  console.log('2. Copia y pega el contenido de: supabase/migrations/20241125_shipping_zones.sql');
  console.log('3. Ejecuta el SQL');
  console.log('');
  console.log('O ejecuta este comando si tienes psql instalado:');
  console.log('psql -h db.kscgibfmxnyfjxpcwoac.supabase.co -p 5432 -d postgres -U postgres -f supabase/migrations/20241125_shipping_zones.sql');
}

runMigration().catch(console.error);
