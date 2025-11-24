# 🔧 Guía Rápida: Arreglar Autenticación

**Problema:** Login falla con "Invalid credentials" o "JSON Parse error"

**Causa:** Las tablas de autenticación no están creadas en Supabase

---

## ✅ Solución Paso a Paso (5 minutos)

### Opción A: Ejecutar Migración via Dashboard (Recomendado)

1. **Ir a Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/editor
   ```

2. **Abrir SQL Editor:**
   - Click en "SQL Editor" en el menú lateral
   - Click en "New query"

3. **Copiar y pegar el SQL:**
   - Abrir el archivo: `supabase/migrations/001_auth_and_users_FIXED.sql`
   - Copiar TODO el contenido
   - Pegar en el editor SQL
   - Click "Run"

4. **Verificar que se creó:**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE '%user%';
   ```

   Deberías ver:
   - `user_profiles`
   - `user_addresses`
   - `user_payment_methods`
   - `user_wishlists`

---

### Opción B: Crear Usuario Directamente (Más Rápido)

Si solo quieres probar el login sin crear todas las tablas:

1. **Ir a Authentication:**
   ```
   https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/auth/users
   ```

2. **Click "Add User" (botón verde arriba derecha)**

3. **Llenar formulario:**
   - Email: `info@intothecom.com`
   - Password: `Test123456!` (o la que quieras)
   - ✅ Auto Confirm User: **ACTIVAR**
   - Click "Create user"

4. **Probar login en la app**

---

## 🧪 Verificación

Después de ejecutar la migración o crear el usuario, ejecuta:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Test login
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'info@intothecom.com',
    password: 'Test123456!'
  });

  if (error) {
    console.log('❌ Login falló:', error.message);
  } else {
    console.log('✅ Login exitoso!');
    console.log('Usuario:', data.user.email);
    console.log('Token válido hasta:', new Date(data.session.expires_at * 1000));
  }
})();
"
```

---

## 📝 Usuarios de Prueba Recomendados

Crea estos usuarios para testing:

| Email | Password | Rol | Propósito |
|-------|----------|-----|-----------|
| `info@intothecom.com` | `Test123456!` | admin | Testing general |
| `c.camusfellay@gmail.com` | `Test123456!` | user | Cliente normal |
| `test@example.com` | `Test123456!` | user | Testing rápido |

---

## 🐛 Troubleshooting

### Error: "Invalid credentials"
- ✅ Usuario no existe → Crear en Dashboard
- ✅ Password incorrecta → Resetear password
- ✅ Usuario no confirmado → Activar "Auto Confirm" al crear

### Error: "JSON Parse error: Unexpected character: I"
- ✅ Error temporal de Supabase
- ✅ Esperar 30 segundos y reintentar
- ✅ Verificar que Supabase no está en mantenimiento

### Error: "Could not find table 'user_profiles'"
- ✅ Migraciones no ejecutadas
- ✅ Ejecutar SQL de Opción A arriba

### Login funciona pero app crashea
- ✅ Verificar que tabla `user_profiles` tiene RLS habilitado
- ✅ Ver logs en consola para más detalles

---

## 🚀 Siguiente Paso

Después de arreglar auth:

1. ✅ Crear usuario de prueba
2. ✅ Login en la app
3. ✅ Verificar que carga productos correctamente
4. ✅ Continuar con desarrollo

---

**Última actualización:** 2025-11-24
