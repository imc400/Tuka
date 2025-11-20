import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testUpdate() {
  console.log('🧪 Probando UPDATE en Supabase...\n');

  // Primero, consultar la tienda
  console.log('1️⃣ Consultando tienda ID 2...');
  const { data: store, error: selectError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', 2)
    .single();

  if (selectError) {
    console.error('❌ Error al consultar:', selectError);
    return;
  }

  console.log('✅ Tienda encontrada:', {
    id: store.id,
    domain: store.domain,
    store_name: store.store_name,
    logo_url: store.logo_url || '(vacío)',
    banner_url: store.banner_url || '(vacío)',
  });

  // Intentar actualizar
  console.log('\n2️⃣ Intentando actualizar logo y banner...');
  const { data: updated, error: updateError } = await supabase
    .from('stores')
    .update({
      logo_url: 'https://via.placeholder.com/200/FF0000/FFFFFF?text=Logo',
      banner_url: 'https://via.placeholder.com/800x300/00FF00/FFFFFF?text=Banner',
    })
    .eq('id', 2)
    .select();

  if (updateError) {
    console.error('❌ Error al actualizar:', updateError);
    return;
  }

  if (!updated || updated.length === 0) {
    console.error('⚠️ UPDATE ejecutado pero no devolvió datos');
    console.log('Esto usualmente significa un problema de permisos (RLS)');
  } else {
    console.log('✅ Actualización exitosa:', updated[0]);
  }

  // Verificar si se guardó
  console.log('\n3️⃣ Verificando si se guardó...');
  const { data: verified, error: verifyError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', 2)
    .single();

  if (verifyError) {
    console.error('❌ Error al verificar:', verifyError);
    return;
  }

  console.log('📊 Estado actual de la tienda:', {
    id: verified.id,
    domain: verified.domain,
    logo_url: verified.logo_url || '(vacío)',
    banner_url: verified.banner_url || '(vacío)',
  });

  if (verified.logo_url && verified.banner_url) {
    console.log('\n🎉 ¡Actualización confirmada! Los datos se guardaron correctamente.');
  } else {
    console.log('\n❌ Los datos NO se guardaron. Problema de permisos (RLS) confirmado.');
  }
}

testUpdate();
