# 🧪 Testing Checklist - Sistema de Autenticación

**Fecha:** 2025-11-20
**Tester:** Testing con usuario real
**Entorno:** Development (localhost:3002)

---

## ✅ Pre-requisitos

- [ ] App corriendo en http://localhost:3002/
- [ ] Supabase Dashboard accesible
- [ ] Base de datos con migraciones aplicadas
- [ ] Navegador con DevTools abierto (para ver logs)

---

## 📋 Test Suite 1: Navegación Básica

### Test 1.1: Pantalla de Perfil (No autenticado)

**Objetivo:** Verificar que usuario no autenticado ve opciones de login/signup

**Pasos:**
1. ✅ Abrir http://localhost:3002/
2. ✅ Click en tab "Perfil" (último icono del bottom nav)
3. ✅ Verificar que aparece:
   - Título "Mi Perfil"
   - Icono de usuario genérico
   - Texto "¡Bienvenido a ShopUnite!"
   - Botón azul "Iniciar Sesión"
   - Botón con borde azul "Crear Cuenta"
   - Sección "Explora sin cuenta"

**Resultado esperado:**
- [ ] ✅ Pantalla de bienvenida visible
- [ ] ✅ Botones funcionan al hacer click

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 2: Registro de Usuario

### Test 2.1: Validación de formulario de registro

**Objetivo:** Verificar que validaciones funcionan correctamente

**Pasos:**
1. ✅ Click en "Crear Cuenta" desde Profile
2. ✅ Intentar enviar formulario vacío
3. ✅ Verificar que aparecen errores:
   - "El nombre es requerido"
   - "El email es requerido"
   - "La contraseña es requerida"
4. ✅ Escribir email inválido (ej: "test@")
5. ✅ Verificar error: "Email inválido"
6. ✅ Escribir contraseña < 6 caracteres (ej: "123")
7. ✅ Verificar error: "La contraseña debe tener al menos 6 caracteres"
8. ✅ Escribir contraseñas diferentes en contraseña y confirmar
9. ✅ Verificar error: "Las contraseñas no coinciden"

**Resultado esperado:**
- [ ] ✅ Todas las validaciones funcionan
- [ ] ✅ Mensajes de error claros en español

**Status:** ⏳ Pendiente

---

### Test 2.2: Registro exitoso

**Objetivo:** Crear usuario nuevo y verificar en DB

**Datos de prueba:**
```
Nombre: Test Usuario ShopUnite
Email: test.shopunite@gmail.com
Teléfono: +56912345678
Contraseña: test123456
Confirmar: test123456
```

**Pasos:**
1. ✅ Click en "Crear Cuenta"
2. ✅ Completar todos los campos con datos de prueba
3. ✅ Click en botón "Crear Cuenta"
4. ✅ Esperar loading
5. ✅ Verificar Alert: "¡Registro exitoso!"
6. ✅ Click en "Continuar"
7. ✅ Verificar redirección a HOME

**Verificación en Supabase Dashboard:**

1. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/auth/users
2. Verificar que aparece el nuevo usuario
3. Copiar el UUID del usuario

4. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/editor
5. Ejecutar query:
```sql
SELECT
  id,
  full_name,
  phone,
  email,
  total_orders,
  total_spent,
  created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:**
- [ ] ✅ Usuario creado en auth.users
- [ ] ✅ Perfil creado en user_profiles con mismo ID
- [ ] ✅ full_name = "Test Usuario ShopUnite"
- [ ] ✅ phone = "+56912345678"
- [ ] ✅ total_orders = 0
- [ ] ✅ total_spent = 0

**Status:** ⏳ Pendiente

**UUID del usuario creado:** ________________

---

### Test 2.3: Registro con email duplicado

**Objetivo:** Verificar que no permite registrar mismo email dos veces

**Pasos:**
1. ✅ Click en "Crear Cuenta"
2. ✅ Usar el MISMO email del test anterior: test.shopunite@gmail.com
3. ✅ Completar resto de datos
4. ✅ Click en "Crear Cuenta"
5. ✅ Verificar Alert de error: "Este email ya está registrado"

**Resultado esperado:**
- [ ] ✅ Error mostrado correctamente
- [ ] ✅ No se crea usuario duplicado

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 3: Inicio de Sesión

### Test 3.1: Login con credenciales incorrectas

**Objetivo:** Verificar manejo de errores en login

**Pasos:**
1. ✅ Si estás logueado, hacer logout primero
2. ✅ Ir a Profile → "Iniciar Sesión"
3. ✅ Intentar con credenciales incorrectas:
   - Email: wrong@email.com
   - Contraseña: wrongpass
4. ✅ Click en "Iniciar Sesión"
5. ✅ Verificar Alert: "Email o contraseña incorrectos"

**Resultado esperado:**
- [ ] ✅ Error mostrado correctamente
- [ ] ✅ No se inicia sesión

**Status:** ⏳ Pendiente

---

### Test 3.2: Login exitoso

**Objetivo:** Iniciar sesión con usuario creado en Test 2.2

**Credenciales:**
```
Email: test.shopunite@gmail.com
Contraseña: test123456
```

**Pasos:**
1. ✅ Ir a Profile → "Iniciar Sesión"
2. ✅ Completar credenciales
3. ✅ Click en "Iniciar Sesión"
4. ✅ Esperar loading
5. ✅ Verificar redirección a HOME
6. ✅ Ir a Profile de nuevo
7. ✅ Verificar que ahora aparece:
   - Iniciales del usuario (ej: "TU")
   - Nombre completo: "Test Usuario ShopUnite"
   - Email: "test.shopunite@gmail.com"
   - Estadísticas: "0 pedidos • $0"

**Verificación en Supabase:**

Ejecutar query:
```sql
SELECT
  id,
  last_active_at
FROM user_profiles
WHERE email = 'test.shopunite@gmail.com';
```

**Resultado esperado:**
- [ ] ✅ Login exitoso
- [ ] ✅ Profile muestra datos correctos
- [ ] ✅ last_active_at actualizado a timestamp reciente

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 4: Flujo de Compra con Usuario Autenticado

### Test 4.1: Compra de prueba (sin MercadoPago)

**Objetivo:** Verificar que transacciones se asocian al usuario

**Pasos:**
1. ✅ Estando logueado como test.shopunite@gmail.com
2. ✅ Ir a HOME
3. ✅ Seleccionar una tienda (ej: Spot Essence)
4. ✅ Agregar 2 productos al carrito
5. ✅ Ir al Carrito
6. ✅ Click en "Proceder al Pago"
7. ✅ Completar datos de envío:
   ```
   Nombre: Test Usuario
   Dirección: Av. Providencia 1234
   Región: RM
   Comuna: Providencia
   Teléfono: +56912345678
   Email: test.shopunite@gmail.com
   ```
8. ✅ Click en "MODO PRUEBA: Simular Pago Exitoso"
9. ✅ Esperar a que procese
10. ✅ Verificar Alert: "✅ Prueba Exitosa"
11. ✅ Anotar el Transaction ID del alert

**Verificación en Supabase:**

Ejecutar query (reemplazar TRANSACTION_ID):
```sql
SELECT
  id,
  user_id,
  buyer_email,
  total_amount,
  status,
  created_at
FROM transactions
WHERE id = TRANSACTION_ID;
```

**Resultado esperado:**
- [ ] ✅ Compra procesada exitosamente
- [ ] ✅ transactions.user_id = UUID del usuario
- [ ] ✅ buyer_email = test.shopunite@gmail.com
- [ ] ✅ status = 'approved'

**Transaction ID:** ________________

**Verificar actualización de estadísticas:**

```sql
SELECT
  id,
  full_name,
  total_orders,
  total_spent
FROM user_profiles
WHERE email = 'test.shopunite@gmail.com';
```

**Resultado esperado:**
- [ ] ✅ total_orders = 1
- [ ] ✅ total_spent = [monto de la compra]

**Status:** ⏳ Pendiente

---

### Test 4.2: Verificar estadísticas en Profile

**Objetivo:** Ver que estadísticas se actualizan en UI

**Pasos:**
1. ✅ Ir a Profile
2. ✅ Verificar que ahora muestra:
   - "1 pedidos • $[monto]"
   - El monto debe coincidir con la compra

**Resultado esperado:**
- [ ] ✅ Estadísticas actualizadas en UI
- [ ] ✅ Datos correctos

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 5: Guest Checkout (Sin Login)

### Test 5.1: Compra sin estar logueado

**Objetivo:** Verificar que guest checkout sigue funcionando

**Pasos:**
1. ✅ Hacer LOGOUT (botón "Cerrar Sesión" en Profile)
2. ✅ Verificar que Profile muestra pantalla de bienvenida
3. ✅ Ir a HOME
4. ✅ Agregar productos al carrito
5. ✅ Ir al Carrito → Checkout
6. ✅ Completar datos de envío (con email diferente: guest@test.com)
7. ✅ Click en "MODO PRUEBA: Simular Pago Exitoso"
8. ✅ Verificar que procesa correctamente
9. ✅ Anotar Transaction ID

**Verificación en Supabase:**

```sql
SELECT
  id,
  user_id,
  buyer_email,
  total_amount,
  status
FROM transactions
WHERE id = TRANSACTION_ID;
```

**Resultado esperado:**
- [ ] ✅ Compra procesada exitosamente
- [ ] ✅ transactions.user_id = NULL (guest)
- [ ] ✅ buyer_email = guest@test.com
- [ ] ✅ status = 'approved'

**Transaction ID:** ________________

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 6: Logout

### Test 6.1: Cerrar sesión

**Objetivo:** Verificar que logout funciona correctamente

**Pasos:**
1. ✅ Login como test.shopunite@gmail.com
2. ✅ Ir a Profile
3. ✅ Scroll hasta el final
4. ✅ Click en botón rojo "Cerrar Sesión"
5. ✅ Verificar que Profile vuelve a mostrar:
   - Pantalla de bienvenida
   - Botones de Login/SignUp
6. ✅ Verificar que NO aparecen datos personales

**Resultado esperado:**
- [ ] ✅ Logout exitoso
- [ ] ✅ UI vuelve a estado no autenticado
- [ ] ✅ Datos borrados de memoria

**Status:** ⏳ Pendiente

---

## 📋 Test Suite 7: Funciones PostgreSQL

### Test 7.1: get_user_dashboard_stats()

**Objetivo:** Verificar función helper de estadísticas

**Query en Supabase SQL Editor:**

```sql
-- Reemplazar con tu UUID del Test 2.2
SELECT * FROM get_user_dashboard_stats('UUID-AQUI');
```

**Resultado esperado (JSON):**
```json
{
  "total_orders": 1,
  "total_spent": [monto],
  "active_subscriptions": 0,
  "saved_addresses": 0,
  "favorites_count": 0,
  "pending_orders": 0,
  "last_order_date": "2025-11-20T..."
}
```

**Status:** ⏳ Pendiente

---

### Test 7.2: get_user_recent_orders()

**Objetivo:** Verificar función de historial de pedidos

**Query:**

```sql
SELECT * FROM get_user_recent_orders('UUID-AQUI', 10);
```

**Resultado esperado:**
- [ ] ✅ Retorna la transacción creada en Test 4.1
- [ ] ✅ Muestra transaction_id, created_at, total_amount, status
- [ ] ✅ Muestra orders_count y stores[]

**Status:** ⏳ Pendiente

---

## 📋 Resumen de Resultados

### Tests Ejecutados

| Suite | Tests | Pasados | Fallidos | Status |
|-------|-------|---------|----------|--------|
| 1. Navegación | 1 | - | - | ⏳ |
| 2. Registro | 3 | - | - | ⏳ |
| 3. Login | 2 | - | - | ⏳ |
| 4. Compra Autenticada | 2 | - | - | ⏳ |
| 5. Guest Checkout | 1 | - | - | ⏳ |
| 6. Logout | 1 | - | - | ⏳ |
| 7. Funciones SQL | 2 | - | - | ⏳ |
| **TOTAL** | **12** | **-** | **-** | **⏳** |

### Bugs Encontrados

| # | Descripción | Severidad | Status |
|---|-------------|-----------|--------|
| - | - | - | - |

### Notas Adicionales

```
[Espacio para notas durante el testing]
```

---

## 🎯 Criterios de Éxito

Para considerar el testing exitoso, deben pasar:

- [ ] ✅ 100% de los tests de Registro (3/3)
- [ ] ✅ 100% de los tests de Login (2/2)
- [ ] ✅ 100% de los tests de Compra (2/2)
- [ ] ✅ Guest checkout funciona (1/1)
- [ ] ✅ Logout funciona (1/1)
- [ ] ✅ Funciones SQL correctas (2/2)

**Total requerido:** 11/12 tests pasados (mínimo 92%)

---

**Tester:** ________________
**Fecha de ejecución:** ________________
**Tiempo total:** ________________
**Status final:** ⏳ Pendiente
