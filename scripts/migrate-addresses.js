require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function executeMigration() {
  console.log('🔄 Ejecutando migración de user_addresses...\n');

  const migrationPath = path.join(__dirname, '../supabase/migrations/014_user_addresses.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Dividir el SQL en statements individuales
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`📝 Ejecutando statement ${i + 1}/${statements.length}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error(`❌ Error en statement ${i + 1}:`, error.message);
        // Algunos errores son esperables (como "already exists")
        if (!error.message.includes('already exists')) {
          throw error;
        } else {
          console.log(`   ⚠️  Ya existe, continuando...`);
        }
      } else {
        console.log(`   ✅ Statement ${i + 1} ejecutado correctamente`);
      }
    } catch (err) {
      console.error(`❌ Error fatal:`, err);
      process.exit(1);
    }
  }

  console.log('\n✅ Migración completada con éxito!');
}

executeMigration();
