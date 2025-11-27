// Test script para verificar el payload de push notifications
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function testPush() {
  // Obtener un token de prueba de la base de datos
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    'https://kscgibfmxnyfjxpcwoac.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk'
  );

  // Obtener un token activo
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('is_active', true)
    .limit(1);

  if (error || !tokens || tokens.length === 0) {
    console.log('No hay tokens activos:', error);
    return;
  }

  const token = tokens[0].expo_push_token;
  console.log('Token encontrado:', token);

  // Imagen de prueba
  const imageUrl = 'https://cdn.shopify.com/s/files/1/0583/4627/0498/files/logo-imanix.png';

  // Construir el mensaje exactamente como lo hace la Edge Function
  const message = {
    to: token,
    sound: 'default',
    title: '🧪 Test con imagen',
    body: 'Esta notificación debería tener una imagen',
    data: {
      imageUrl: imageUrl,
      storeId: 'test',
      type: 'test'
    },
    mutableContent: true,
    _contentAvailable: true,
    imageUrl: imageUrl
  };

  console.log('\n📦 Mensaje a enviar:');
  console.log(JSON.stringify(message, null, 2));

  // Enviar a Expo
  console.log('\n📤 Enviando a Expo Push API...');
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([message]),
  });

  const result = await response.json();
  console.log('\n📬 Respuesta de Expo:');
  console.log(JSON.stringify(result, null, 2));
}

testPush().catch(console.error);
