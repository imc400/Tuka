import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkStores() {
  console.log('🔍 Verificando tiendas en Supabase...\n');

  const { data: stores, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error al consultar:', error);
    return;
  }

  if (!stores || stores.length === 0) {
    console.log('⚠️  No hay tiendas registradas');
    return;
  }

  console.log(`✅ Encontradas ${stores.length} tiendas:\n`);

  stores.forEach((store, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${index + 1}] ${store.store_name || store.domain}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID:          ${store.id}`);
    console.log(`Domain:      ${store.domain}`);
    console.log(`Store Name:  ${store.store_name || '(vacío)'}`);
    console.log(`Description: ${store.description || '(vacío)'}`);
    console.log(`Logo URL:    ${store.logo_url || '(vacío)'}`);
    console.log(`Banner URL:  ${store.banner_url || '(vacío)'}`);
    console.log(`Theme Color: ${store.theme_color || '(vacío)'}`);
    console.log(`Created At:  ${store.created_at}`);
    console.log();
  });

  // Buscar específicamente spotessence
  const spotessence = stores.find(s => s.domain.includes('spotessence'));
  if (spotessence) {
    console.log('\n🎯 Datos específicos de Spotessence:');
    console.log(JSON.stringify(spotessence, null, 2));
  }
}

checkStores();
