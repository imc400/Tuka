# 🎨 Integración Frontend - Sistema de Envíos

**Status:** Componentes creados ✅ | Integración pendiente ⏳

---

## ✅ Componentes Creados

1. **`src/components/ShippingMethodSelector.tsx`**
   - Muestra opciones de envío de una tienda
   - Radio buttons para seleccionar método
   - Loading state mientras calcula

2. **`src/components/ShippingSection.tsx`**
   - Componente principal que agrupa todo
   - Auto-calcula shipping cuando dirección completa
   - Maneja múltiples tiendas
   - Callback cuando cambian selecciones

3. **`src/services/shippingService.ts`**
   - Funciones para calcular shipping
   - Helpers para agrupar por tienda
   - Validaciones

---

## 🔧 Integración en tu Checkout Existente

### Paso 1: Import del componente

```typescript
// En tu CheckoutScreen.tsx (o donde tengas el checkout)
import { ShippingSection } from '../components/ShippingSection';
import type { SelectedShippingRates } from '../services/shippingService';
```

### Paso 2: Agregar state para shipping

```typescript
// Dentro de tu componente de Checkout
const [selectedShippingRates, setSelectedShippingRates] = useState<SelectedShippingRates>({});
const [shippingTotal, setShippingTotal] = useState(0);

// Handler para cuando se calculan/cambian los envíos
const handleShippingCalculated = (rates: SelectedShippingRates, total: number) => {
  setSelectedShippingRates(rates);
  setShippingTotal(total);
};
```

### Paso 3: Actualizar cálculo de total

```typescript
// Subtotal de productos
const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Total final (productos + envíos)
const grandTotal = subtotal + shippingTotal;
```

### Paso 4: Agregar el componente en el JSX

```tsx
{/* Tu formulario de dirección existente */}
<View>
  <TextInput
    placeholder="Dirección"
    value={shippingAddress.address}
    onChangeText={(text) => setShippingAddress({...shippingAddress, address: text})}
  />
  {/* ... resto de campos ... */}
</View>

{/* NUEVA SECCIÓN: Métodos de Envío */}
<ShippingSection
  cartItems={cartItems}
  shippingAddress={shippingAddress}
  onShippingCalculated={handleShippingCalculated}
  autoCalculate={true}
/>

{/* Resumen de totales actualizado */}
<View className="mt-4 p-4 bg-gray-50 rounded-lg">
  <View className="flex-row justify-between mb-2">
    <Text>Subtotal:</Text>
    <Text className="font-semibold">${subtotal.toLocaleString('es-CL')}</Text>
  </View>
  <View className="flex-row justify-between mb-2">
    <Text>Envíos:</Text>
    <Text className="font-semibold">${shippingTotal.toLocaleString('es-CL')}</Text>
  </View>
  <View className="border-t border-gray-300 pt-2 flex-row justify-between">
    <Text className="text-lg font-bold">Total:</Text>
    <Text className="text-lg font-bold">${grandTotal.toLocaleString('es-CL')}</Text>
  </View>
</View>

{/* Botón de pagar */}
<Pressable onPress={handleCheckout}>
  <Text>Proceder al Pago</Text>
</Pressable>
```

### Paso 5: Actualizar función de checkout

```typescript
const handleCheckout = async () => {
  // Validar que se hayan seleccionado envíos
  const validation = validateShippingSelection(cartItems, selectedShippingRates);
  if (!validation.valid) {
    Alert.alert(
      'Selecciona métodos de envío',
      `Falta seleccionar envío para: ${validation.missingStores?.join(', ')}`
    );
    return;
  }

  // Crear transacción incluyendo shipping_costs
  const transactionData: TransactionData = {
    cartItems,
    shippingInfo: {
      fullName,
      address: shippingAddress.address,
      city: shippingAddress.city,
      region: shippingAddress.region,
      zipCode: shippingAddress.zipCode,
      phone,
      email,
    },
    totalAmount: grandTotal, // ⭐ INCLUYE SHIPPING
    storeSplits: calculateStoreSplits(cartItems),
    shippingCosts: selectedShippingRates, // ⭐ NUEVO
    userId: user?.id,
  };

  const result = await createPendingTransaction(transactionData);

  if (result) {
    // Proceder con MercadoPago...
    const mpResult = await createMercadoPagoPreference(
      cartItems,
      { name: fullName, email, phone },
      result.transactionId
    );

    if (mpResult.success && mpResult.initPoint) {
      await openMercadoPagoCheckout(mpResult.initPoint);
    }
  }
};
```

---

## 📱 Ejemplo Completo de Pantalla de Checkout

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { ShippingSection } from '../components/ShippingSection';
import { validateShippingSelection, type SelectedShippingRates } from '../services/shippingService';
import { createPendingTransaction, calculateStoreSplits } from '../services/orderService';
import { createMercadoPagoPreference, openMercadoPagoCheckout } from '../services/mercadopagoService';

export function CheckoutScreen({ cartItems, user }) {
  // State de shipping
  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    region: '',
    zipCode: '',
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');

  // State de shipping rates
  const [selectedShippingRates, setSelectedShippingRates] = useState<SelectedShippingRates>({});
  const [shippingTotal, setShippingTotal] = useState(0);

  // State de UI
  const [processing, setProcessing] = useState(false);

  // Cálculos
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = subtotal + shippingTotal;

  // Handler de shipping calculado
  const handleShippingCalculated = (rates: SelectedShippingRates, total: number) => {
    setSelectedShippingRates(rates);
    setShippingTotal(total);
  };

  // Handler de checkout
  const handleCheckout = async () => {
    // Validaciones
    if (!fullName || !phone || !email) {
      Alert.alert('Faltan datos', 'Por favor completa todos los campos');
      return;
    }

    if (!shippingAddress.address || !shippingAddress.city) {
      Alert.alert('Dirección incompleta', 'Por favor completa la dirección de envío');
      return;
    }

    // Validar shipping
    const validation = validateShippingSelection(cartItems, selectedShippingRates);
    if (!validation.valid) {
      Alert.alert(
        'Selecciona métodos de envío',
        `Falta seleccionar envío para: ${validation.missingStores?.join(', ')}`
      );
      return;
    }

    setProcessing(true);

    try {
      // Crear transacción
      const transactionData = {
        cartItems,
        shippingInfo: {
          fullName,
          address: shippingAddress.address,
          city: shippingAddress.city,
          region: shippingAddress.region,
          zipCode: shippingAddress.zipCode,
          phone,
          email,
        },
        totalAmount: grandTotal,
        storeSplits: calculateStoreSplits(cartItems),
        shippingCosts: selectedShippingRates,
        userId: user?.id,
      };

      const result = await createPendingTransaction(transactionData);

      if (!result) {
        throw new Error('Error creating transaction');
      }

      // Crear preferencia de MercadoPago
      const mpResult = await createMercadoPagoPreference(
        cartItems,
        { name: fullName, email, phone },
        result.transactionId
      );

      if (mpResult.success && mpResult.initPoint) {
        // Abrir checkout de MercadoPago
        await openMercadoPagoCheckout(mpResult.initPoint);
      } else {
        throw new Error(mpResult.error || 'Error creating payment preference');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert(
        'Error',
        error.message || 'Ocurrió un error al procesar tu pago'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold mb-4">Checkout</Text>

      {/* Información Personal */}
      <View className="bg-white p-4 rounded-lg mb-4">
        <Text className="text-lg font-semibold mb-3">Información Personal</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Nombre completo"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          className="border border-gray-300 rounded-lg p-3"
          placeholder="Teléfono"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      {/* Dirección de Envío */}
      <View className="bg-white p-4 rounded-lg mb-4">
        <Text className="text-lg font-semibold mb-3">Dirección de Envío</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Dirección (calle y número)"
          value={shippingAddress.address}
          onChangeText={(text) => setShippingAddress({...shippingAddress, address: text})}
        />
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Ciudad"
          value={shippingAddress.city}
          onChangeText={(text) => setShippingAddress({...shippingAddress, city: text})}
        />
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-3"
          placeholder="Región"
          value={shippingAddress.region}
          onChangeText={(text) => setShippingAddress({...shippingAddress, region: text})}
        />
        <TextInput
          className="border border-gray-300 rounded-lg p-3"
          placeholder="Código Postal"
          value={shippingAddress.zipCode}
          onChangeText={(text) => setShippingAddress({...shippingAddress, zipCode: text})}
        />
      </View>

      {/* Métodos de Envío */}
      <View className="bg-white p-4 rounded-lg mb-4">
        <ShippingSection
          cartItems={cartItems}
          shippingAddress={shippingAddress}
          onShippingCalculated={handleShippingCalculated}
          autoCalculate={true}
        />
      </View>

      {/* Resumen */}
      <View className="bg-white p-4 rounded-lg mb-4">
        <Text className="text-lg font-semibold mb-3">Resumen</Text>
        <View className="flex-row justify-between mb-2">
          <Text>Subtotal ({cartItems.length} items):</Text>
          <Text className="font-semibold">${subtotal.toLocaleString('es-CL')}</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text>Envíos:</Text>
          <Text className="font-semibold">${shippingTotal.toLocaleString('es-CL')}</Text>
        </View>
        <View className="border-t border-gray-300 pt-2 mt-2 flex-row justify-between">
          <Text className="text-xl font-bold">Total:</Text>
          <Text className="text-xl font-bold text-blue-600">
            ${grandTotal.toLocaleString('es-CL')}
          </Text>
        </View>
      </View>

      {/* Botón de Pago */}
      <Pressable
        onPress={handleCheckout}
        disabled={processing || shippingTotal === 0}
        className={`p-4 rounded-lg ${
          processing || shippingTotal === 0
            ? 'bg-gray-300'
            : 'bg-blue-600'
        }`}
      >
        <Text className="text-white text-center font-bold text-lg">
          {processing ? 'Procesando...' : `Pagar $${grandTotal.toLocaleString('es-CL')}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

---

## 🧪 Testing Local

1. **Ejecutar migración SQL** (copiar/pegar en Supabase Dashboard)
2. **Ejecutar app:**
   ```bash
   npx expo start --clear
   ```
3. **Agregar productos al carrito** de 2 tiendas diferentes
4. **Ir a checkout** y completar dirección
5. **Ver auto-cálculo de shipping** por tienda
6. **Seleccionar métodos** y ver total actualizado
7. **Proceder al pago**

---

## 🚨 Troubleshooting

### Error: "Cannot read property 'invoke' of undefined"
**Causa:** Edge Function no desplegada aún
**Solución:** Esperar a que se despliegue `calculate-shipping`

### No se calculan envíos automáticamente
**Causa:** `autoCalculate` en false o dirección incompleta
**Solución:** Verificar que todos los campos de dirección estén completos

### "No hay métodos de envío configurados"
**Causa:** La tienda no tiene zonas de envío en Shopify
**Solución:** Configurar en Shopify Admin → Settings → Shipping and delivery

---

## 📦 Exports disponibles

```typescript
// Componentes
import { ShippingSection } from '../components/ShippingSection';
import { ShippingMethodSelector } from '../components/ShippingMethodSelector';

// Servicios
import {
  calculateShippingRates,
  calculateTotalShipping,
  validateShippingSelection,
  groupCartItemsByStore,
  formatAddressForShopify,
} from '../services/shippingService';

// Types
import type {
  ShippingRate,
  SelectedShippingRate,
  SelectedShippingRates,
  ShippingRatesByStore,
} from '../services/shippingService';
```

---

**Última actualización:** 2025-11-24
**Status:** Ready to integrate ✅
