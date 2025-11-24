/**
 * Buscar tabla de pedidos
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const possibleTables = [
  'orders',
  'order',
  'marketplace_orders',
  'user_orders',
  'purchases',
  'transactions',
  'sales',
  'checkouts',
  'carts',
  'cart'
];

async function findOrderTable() {
  console.log('\n🔍 Buscando tabla de pedidos...\n');

  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`✅ Encontrada tabla: "${tableName}"`);

        if (data && data.length > 0) {
          console.log(`   Columnas disponibles:`, Object.keys(data[0]).join(', '));
        }

        console.log('');

        // Intentar obtener últimos registros
        const { data: recent, error: recentError } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!recentError && recent && recent.length > 0) {
          console.log(`📦 Últimos ${recent.length} registros:\n`);

          recent.forEach((record, i) => {
            console.log(`${i + 1}. ID: ${record.id}`);
            console.log(`   Creado: ${new Date(record.created_at).toLocaleString('es-CL')}`);

            // Mostrar campos relevantes
            Object.keys(record).forEach(key => {
              if (key.includes('total') || key.includes('shipping') || key.includes('cost') ||
                  key.includes('user') || key.includes('status')) {
                console.log(`   ${key}: ${record[key]}`);
              }
            });

            console.log('');
          });
        }

        return;
      }
    } catch (err) {
      // Tabla no existe, continuar
    }
  }

  console.log('❌ No se encontró ninguna tabla de pedidos conocida');
  console.log('\nTablas probadas:', possibleTables.join(', '));
}

findOrderTable();
