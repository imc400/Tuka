# 🚀 Guía de Migración - Sistema de Autenticación

## ⚠️ IMPORTANTE: LEE COMPLETO ANTES DE EJECUTAR

Esta guía detalla cómo ejecutar las migraciones del sistema de autenticación de forma segura en producción.

---

## 📋 Pre-requisitos

- [ ] Acceso al dashboard de Supabase
- [ ] Backup automático habilitado en Supabase (viene por defecto)
- [ ] Navegador con acceso a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac
- [ ] 15 minutos sin interrupciones

---

## 🎯 Orden de Ejecución

```
1. 000_pre_migration_backup.sql    (Verificación + Backup)
2. 001_auth_and_users.sql          (Tablas principales)
3. 002_integrate_existing_tables.sql (Integración)
4. 999_post_migration_validation.sql (Validación)
```

---

## 📝 Paso a Paso

### Paso 1: Acceder al SQL Editor

1. Ve a https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac
2. En el menú lateral izquierdo, click en **"SQL Editor"**
3. Click en **"New query"**

### Paso 2: Ejecutar Pre-Migration Backup

1. **Abrir archivo**: `supabase/migrations/000_pre_migration_backup.sql`
2. **Copiar TODO el contenido**
3. **Pegar en SQL Editor**
4. **Click en "Run"** (▶️)
5. **Verificar output**:
   ```
   NOTICE: === VERIFICACIÓN PRE-MIGRACIÓN ===
   NOTICE: stores: X registros
   NOTICE: transactions: Y registros
   NOTICE: ✓ Verificación de conflictos: OK
   ```

**SI HAY ERROR**: DETENER y revisar. No continuar.

**SI TODO OK**: Anotar cantidad de registros y continuar.

---

### Paso 3: Ejecutar Migración Principal (001)

**⏱️ Tiempo estimado: 2-3 minutos**

1. **New query** en SQL Editor
2. **Abrir archivo**: `supabase/migrations/001_auth_and_users.sql`
3. **Copiar TODO el contenido** (22,225 líneas)
4. **Pegar en SQL Editor**
5. **REVISAR una última vez** que sea el archivo correcto
6. **Click en "Run"** (▶️)
7. **Esperar** - Verás mensajes de creación de tablas

**Output esperado**:
```
CREATE TABLE
CREATE INDEX
CREATE TRIGGER
CREATE FUNCTION
...
```

**SI HAY ERROR**:
- Leer el mensaje de error
- Verificar en qué línea falló
- NO CONTINUAR hasta resolver
- Supabase tiene auto-rollback, los cambios parciales se revierten

**SI TODO OK**: Continuar al paso 4

---

### Paso 4: Ejecutar Integración (002)

**⏱️ Tiempo estimado: 1-2 minutos**

1. **New query** en SQL Editor
2. **Abrir archivo**: `supabase/migrations/002_integrate_existing_tables.sql`
3. **Copiar TODO el contenido**
4. **Pegar en SQL Editor**
5. **Click en "Run"** (▶️)

**Output esperado**:
```
ALTER TABLE
CREATE INDEX
CREATE TRIGGER
CREATE FUNCTION
...
```

**SI HAY ERROR**: Ver sección de Troubleshooting más abajo.

**SI TODO OK**: Continuar al paso 5

---

### Paso 5: Validación Post-Migración

**⏱️ Tiempo estimado: 30 segundos**

1. **New query** en SQL Editor
2. **Abrir archivo**: `supabase/migrations/999_post_migration_validation.sql`
3. **Copiar TODO el contenido**
4. **Pegar en SQL Editor**
5. **Click en "Run"** (▶️)

**Output esperado**:
```
NOTICE: === VALIDACIÓN POST-MIGRACIÓN ===
NOTICE: 1. VERIFICANDO TABLAS...
NOTICE:   ✓ user_profiles creada
NOTICE:   ✓ user_addresses creada
NOTICE:   ✓ store_subscriptions creada
...
NOTICE: === VALIDACIÓN COMPLETADA ===
NOTICE: Estado: EXITOSA ✓
```

**SI TODOS LOS CHECKS PASAN**: ✅ **MIGRACIÓN EXITOSA**

**SI ALGÚN CHECK FALLA**: Ver Troubleshooting

---

## ✅ Verificación Manual Adicional

Después de las migraciones, verifica manualmente:

### 1. Tablas creadas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles',
    'user_addresses',
    'store_subscriptions',
    'user_push_tokens',
    'user_favorites',
    'user_sessions'
  )
ORDER BY table_name;
```

**Debe retornar 6 filas**.

### 2. Datos existentes intactos

```sql
SELECT
  (SELECT COUNT(*) FROM stores) as stores_count,
  (SELECT COUNT(*) FROM transactions) as transactions_count,
  (SELECT COUNT(*) FROM shopify_orders) as orders_count;
```

**Los números deben coincidir** con los anotados en Paso 2.

### 3. RLS habilitado

```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'user_%';
```

**Todos deben tener `rowsecurity = true`**.

### 4. Triggers activos

```sql
SELECT
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name IN (
    'on_auth_user_created',
    'update_store_subscriber_count_trigger',
    'update_user_stats_trigger'
  );
```

**Debe retornar 3 triggers**.

---

## 🧪 Testing Post-Migración

### Test 1: Crear usuario de prueba (NO EN PRODUCCIÓN)

**Solo si estás en staging/development:**

```sql
-- Insertar usuario de prueba en auth.users
-- (Supabase Auth creará esto automáticamente en producción)
```

**En producción**: El testing se hará con el primer usuario real que se registre.

### Test 2: Verificar trigger de auto-crear perfil

```sql
-- Ver si hay perfiles creados
SELECT COUNT(*) FROM user_profiles;

-- Debe ser 0 si aún no hay usuarios registrados
```

### Test 3: Verificar funciones helper

```sql
-- Test función de suscriptores
SELECT * FROM get_store_subscribers_with_tokens('spot-essence.myshopify.com');

-- Debe retornar 0 rows (aún no hay suscripciones)
```

---

## 🚨 Troubleshooting

### Error: "relation already exists"

**Causa**: La tabla ya existe (migración ejecutada previamente)

**Solución**:
```sql
-- Verificar qué tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'user_%';

-- Si las tablas ya existen y están correctas, continuar con siguiente migración
```

### Error: "permission denied"

**Causa**: Usuario sin permisos suficientes

**Solución**: Verificar que estás ejecutando como postgres (usuario admin). En dashboard de Supabase esto es automático.

### Error: "constraint already exists"

**Causa**: Restricción ya creada

**Solución**: Ignorar o usar `IF NOT EXISTS` en el constraint.

### Error: Timeout en migración

**Causa**: Migración muy grande

**Solución**: Dividir en partes más pequeñas o aumentar timeout del query.

---

## 🔄 Rollback (Si algo sale mal)

Supabase tiene **backups automáticos cada 24 horas**.

### Opción 1: Rollback desde Dashboard

1. Ve a **Settings** → **Database**
2. Click en **"Database Backups"**
3. Selecciona backup más reciente ANTES de la migración
4. Click en **"Restore"**

⚠️ **CUIDADO**: Esto revertirá TODA la base de datos al estado anterior.

### Opción 2: Rollback manual (solo estructuras)

Si solo quieres eliminar las nuevas tablas:

```sql
-- ADVERTENCIA: Esto eliminará las tablas y todos sus datos

DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.user_push_tokens CASCADE;
DROP TABLE IF EXISTS public.store_subscriptions CASCADE;
DROP TABLE IF EXISTS public.user_addresses CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Revertir cambios en tablas existentes
ALTER TABLE public.transactions DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.shopify_orders DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.stores DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.stores DROP COLUMN IF EXISTS subscriber_count;
```

---

## 📊 Métricas de Éxito

Después de la migración, deberías ver:

- ✅ **6 nuevas tablas** creadas
- ✅ **30+ índices** creados
- ✅ **8+ triggers** activos
- ✅ **10+ funciones** helper disponibles
- ✅ **RLS habilitado** en todas las tablas de usuarios
- ✅ **Datos existentes** preservados
- ✅ **0 errores** en validación

---

## 📞 Soporte

Si algo sale mal:

1. **NO PÁNICO** - Supabase tiene backups
2. **Captura screenshot** del error
3. **Anota** en qué paso estabas
4. **Contacta** al equipo de desarrollo

---

## ✨ Próximo Paso (Después de Migración Exitosa)

Una vez completadas las migraciones:

1. ✅ Configurar Auth Providers en Supabase (Google, Apple)
2. ✅ Implementar UI de login en la app
3. ✅ Testear flujo completo de registro
4. ✅ Verificar creación automática de perfil
5. ✅ Testear suscripción a tiendas

---

**Última actualización**: 2025-11-20
**Versión**: 1.0.0
**Autor**: Tuka Team
