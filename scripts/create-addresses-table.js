require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createTable() {
  console.log('🔄 Creando tabla user_addresses...\n');

  // Intentar crear la tabla directamente
  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .limit(1);

  if (error && error.code === '42P01') {
    // Tabla no existe
    console.log('✅ Necesitamos ejecutar la migración manualmente en el dashboard de Supabase');
    console.log('\n📋 Pasos:');
    console.log('1. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/sql/new');
    console.log('2. Copiar el contenido de: supabase/migrations/014_user_addresses.sql');
    console.log('3. Pegar en el editor SQL');
    console.log('4. Click en "Run"');
    console.log('\n⏳ Por ahora, continuaremos con el desarrollo local usando la estructura esperada...\n');
  } else if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ La tabla user_addresses ya existe!');
  }
}

createTable();
