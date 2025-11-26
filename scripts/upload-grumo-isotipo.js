/**
 * Script para subir el isotipo de Grumo a Supabase Storage
 * y obtener la URL pública para usar en notificaciones push
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase
const supabaseUrl = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadIsotipo() {
  const imagePath = path.join(__dirname, '../Copia de Branding Grumo/Copia de Isotipo sin fondo 1024x1024.png');

  // Verificar que el archivo existe
  if (!fs.existsSync(imagePath)) {
    console.error('❌ No se encontró el archivo:', imagePath);
    process.exit(1);
  }

  console.log('📁 Leyendo archivo:', imagePath);
  const fileBuffer = fs.readFileSync(imagePath);

  const bucketName = 'assets';
  const fileName = 'grumo-isotipo-1024.png';

  // Primero, intentar crear el bucket si no existe
  console.log('🪣 Verificando bucket...');
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log('📦 Creando bucket "assets"...');
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 5242880 // 5MB
    });

    if (createError) {
      console.error('❌ Error creando bucket:', createError.message);
      console.log('\n💡 Necesitas crear el bucket manualmente en Supabase Dashboard:');
      console.log('   1. Ve a https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/storage/buckets');
      console.log('   2. Crea un bucket llamado "assets" con acceso público');
      console.log('   3. Ejecuta este script de nuevo');
      process.exit(1);
    }
  }

  // Subir el archivo
  console.log('⬆️ Subiendo isotipo...');
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileBuffer, {
      contentType: 'image/png',
      upsert: true // Sobrescribir si ya existe
    });

  if (error) {
    console.error('❌ Error subiendo archivo:', error.message);
    process.exit(1);
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  console.log('\n✅ ¡Isotipo subido exitosamente!');
  console.log('\n🔗 URL Pública:');
  console.log(urlData.publicUrl);
  console.log('\n📱 Usa esta URL en las notificaciones push para mostrar el isotipo de Grumo');
}

uploadIsotipo().catch(console.error);
