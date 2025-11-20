import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, SafeAreaView, StatusBar, Alert, RefreshControl, Platform, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { generateMarketplaceData } from './src/services/marketplaceService';
import { addStoreConfig, getRegisteredConfigs, removeStoreConfig } from './src/services/shopifyService';
import { Store, Product, CartItem, ViewState, ProductVariant } from './src/types';
import {
  ShoppingBag,
  Store as StoreIcon,
  Search,
  User,
  Bell,
  BellRing,
  ChevronLeft,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Settings,
  ShieldCheck,
  Globe,
  LogOut,
  FlaskConical
} from 'lucide-react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { formatCLP } from './src/utils/currency';
import { ImageGallery } from './src/components/ImageGallery';
import { VariantSelector } from './src/components/VariantSelector';
import {
  createPendingTransaction,
  updateTransactionStatus,
  createTestOrders,
  validateShippingInfo,
  type ShippingInfo
} from './src/services/orderService';
import {
  createMercadoPagoPreference,
  openMercadoPagoCheckout,
  checkPaymentStatus
} from './src/services/mercadopagoService';
import { CHILEAN_REGIONS, getComunasByRegion } from './src/data/chileanRegions';

// --- Styled Components (NativeWind) ---
// In NativeWind 4, we can use className directly, but sometimes styled() is useful. 
// For simplicity, we will use className props on standard RN components where possible.

// --- Components ---

const Header = ({ 
  title, 
  canGoBack, 
  onBack, 
  rightAction 
}: { 
  title: string; 
  canGoBack?: boolean; 
  onBack?: () => void; 
  rightAction?: React.ReactNode 
}) => (
  <View className="flex-row items-center justify-between px-4 h-14 bg-white border-b border-gray-100">
    <View className="flex-row items-center gap-3">
      {canGoBack && (
        <TouchableOpacity onPress={onBack} className="p-1 rounded-full bg-gray-50">
          <ChevronLeft size={24} color="#4B5563" />
        </TouchableOpacity>
      )}
      <Text className="font-bold text-lg text-gray-900 max-w-[200px]" numberOfLines={1}>{title}</Text>
    </View>
    <View>{rightAction}</View>
  </View>
);

const BottomNav = ({ currentView, onChangeView, cartCount }: { currentView: ViewState, onChangeView: (v: ViewState) => void, cartCount: number }) => {
  const navItems = [
    { id: ViewState.HOME, icon: StoreIcon, label: 'Tiendas' },
    { id: ViewState.SEARCH, icon: Search, label: 'Explorar' },
    { id: ViewState.CART, icon: ShoppingBag, label: 'Carrito', badge: cartCount },
    { id: ViewState.PROFILE, icon: User, label: 'Perfil' },
  ];

  return (
    <View className="flex-row justify-between items-end px-6 pb-6 pt-2 bg-white border-t border-gray-200 h-[85px]">
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onChangeView(item.id)}
          className="items-center gap-1 w-16"
        >
          <View className="relative">
            <item.icon size={24} color={currentView === item.id ? '#4F46E5' : '#9CA3AF'} strokeWidth={currentView === item.id ? 2.5 : 2} />
            {item.badge ? (
              <View className="absolute -top-2 -right-2 bg-red-500 px-1.5 py-0.5 rounded-full border-2 border-white">
                <Text className="text-white text-[10px] font-bold">{item.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text className={`text-[10px] font-medium ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400'}`}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  // Toasts are simplified to Alerts for now, or custom view overlay
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'admin' } | null>(null);

  // Form states for Checkout
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<number | null>(null);

  // Shipping form fields
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [availableComunas, setAvailableComunas] = useState<string[]>([]);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showComunaPicker, setShowComunaPicker] = useState(false);
  const [tempRegion, setTempRegion] = useState('');
  const [tempComuna, setTempComuna] = useState('');

  // Handle region change
  const handleRegionChange = (regionCode: string) => {
    setRegion(regionCode);
    setCity(''); // Reset city when region changes
    const comunas = getComunasByRegion(regionCode);
    setAvailableComunas(comunas);
  };

  // Admin states
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [registeredConfigs, setRegisteredConfigs] = useState<any[]>([]);

  useEffect(() => {
    loadMarketplace();
  }, []);

  const loadMarketplace = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await generateMarketplaceData();
      setStores(data);

      if (isRefreshing) {
        setToast({ msg: '✅ Tiendas actualizadas', type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ msg: 'Error al cargar tiendas', type: 'info' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadMarketplace(true);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Navigation Helpers
  const goToStore = (store: Store) => {
    setSelectedStore(store);
    setView(ViewState.STORE_DETAIL);
  };

  const goToProduct = (product: Product) => {
    setSelectedProduct(product);
    // Initialize with first available variant or null
    if (product.variants && product.variants.length > 0) {
      const firstAvailable = product.variants.find(v => v.available) || product.variants[0];
      setSelectedVariant(firstAvailable);
    } else {
      setSelectedVariant(null);
    }
    setView(ViewState.PRODUCT_DETAIL);
  };

  const goBack = () => {
    if (view === ViewState.PRODUCT_DETAIL) {
      setView(ViewState.STORE_DETAIL);
      setSelectedProduct(null);
    } else if (view === ViewState.STORE_DETAIL) {
      setView(ViewState.HOME);
      setSelectedStore(null);
    } else if (view === ViewState.CHECKOUT) {
      setView(ViewState.CART);
    } else if (view === ViewState.ADMIN_DASHBOARD) {
      setView(ViewState.PROFILE);
    } else {
      setView(ViewState.HOME);
    }
  };

  // Logic Helpers
  const toggleSubscription = (storeId: string, storeName: string) => {
    if (subscriptions.includes(storeId)) {
      setSubscriptions(prev => prev.filter(id => id !== storeId));
      setToast({ msg: `Dejaste de seguir a ${storeName}`, type: 'info' });
    } else {
      setSubscriptions(prev => [...prev, storeId]);
      setToast({ msg: `¡Suscrito a ${storeName}!`, type: 'success' });
    }
  };

  const addToCart = (product: Product, store: Store, variant?: ProductVariant | null) => {
    setCart(prev => {
      // If variant exists, match by both product id and variant id
      const cartKey = variant ? `${product.id}-${variant.id}` : product.id;
      const existing = prev.find(item => {
        if (variant) {
          return item.id === product.id && item.selectedVariant?.id === variant.id;
        }
        return item.id === product.id && !item.selectedVariant;
      });

      if (existing) {
        return prev.map(item => {
          const itemKey = item.selectedVariant ? `${item.id}-${item.selectedVariant.id}` : item.id;
          return itemKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item;
        });
      }

      return [...prev, {
        ...product,
        storeId: store.id,
        storeName: store.name,
        quantity: 1,
        selectedVariant: variant || undefined,
      }];
    });
    setToast({ msg: 'Agregado al carrito', type: 'success' });
    setView(ViewState.STORE_DETAIL);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const clearCart = () => setCart([]);

  // Función de pago de prueba (sin MercadoPago)
  const handleTestPayment = async () => {
    // Validar formulario
    const shippingInfo: ShippingInfo = {
      fullName,
      address,
      city,
      region,
      zipCode,
      phone,
      email
    };

    const validationError = validateShippingInfo(shippingInfo);
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 1. Crear transacción pendiente
      const result = await createPendingTransaction({
        cartItems: cart,
        shippingInfo,
        totalAmount: cartTotal,
        storeSplits: {},
        isTest: true
      });

      if (!result) {
        Alert.alert('Error', 'No se pudo crear la transacción');
        return;
      }

      // 2. Simular pago aprobado
      await updateTransactionStatus(result.transactionId, 'approved');

      // 3. Crear órdenes de prueba en la DB (sin llamar a Shopify)
      await createTestOrders(result.transactionId, cart);

      // 4. Éxito
      setCurrentTransactionId(result.transactionId);
      setPaymentSuccess(true);
      clearCart();

      Alert.alert(
        '✅ Prueba Exitosa',
        `Transacción #${result.transactionId} creada.\n\nRevisa tu base de datos para ver las órdenes creadas.`
      );
    } catch (error) {
      console.error('Error in test payment:', error);
      Alert.alert('Error', 'Hubo un problema al procesar el pago de prueba');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Función de pago real con MercadoPago
  const handleRealPayment = async () => {
    // Validar formulario
    const shippingInfo: ShippingInfo = {
      fullName,
      address,
      city,
      region,
      zipCode,
      phone,
      email
    };

    const validationError = validateShippingInfo(shippingInfo);
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 1. Crear transacción pendiente
      const result = await createPendingTransaction({
        cartItems: cart,
        shippingInfo,
        totalAmount: cartTotal,
        storeSplits: {},
        isTest: false
      });

      if (!result) {
        Alert.alert('Error', 'No se pudo crear la transacción');
        setIsProcessingPayment(false);
        return;
      }

      setCurrentTransactionId(result.transactionId);

      // 2. Crear preferencia de MercadoPago
      const mpResult = await createMercadoPagoPreference(
        cart,
        {
          name: fullName,
          email: email,
          phone: phone
        },
        result.transactionId,
        false
      );

      if (!mpResult.success || !mpResult.initPoint) {
        Alert.alert('Error', mpResult.error || 'No se pudo iniciar el pago');
        setIsProcessingPayment(false);
        return;
      }

      // 3. Abrir checkout de MercadoPago
      const checkoutResult = await openMercadoPagoCheckout(mpResult.initPoint);

      if (!checkoutResult.success) {
        Alert.alert('Pago Cancelado', 'El pago fue cancelado');
        setIsProcessingPayment(false);
        return;
      }

      // 4. Verificar estado del pago
      // El webhook ya habrá actualizado el estado, pero lo verificamos
      const paymentStatus = await checkPaymentStatus(result.transactionId);

      if (paymentStatus.status === 'approved') {
        setPaymentSuccess(true);
        clearCart();
        Alert.alert('✅ Pago Exitoso', '¡Tu compra fue procesada correctamente!');
      } else if (paymentStatus.status === 'pending') {
        Alert.alert(
          'Pago Pendiente',
          'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
        );
        setView(ViewState.HOME);
      } else {
        Alert.alert('Pago Rechazado', 'El pago no pudo ser procesado');
      }
    } catch (error) {
      console.error('Error in real payment:', error);
      Alert.alert('Error', 'Hubo un problema al procesar el pago');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const cartTotal = cart.reduce((acc, item) => {
    const price = item.selectedVariant?.price || item.price;
    return acc + (price * item.quantity);
  }, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // --- Render Content ---

  const renderHome = () => (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4F46E5"
          colors={['#4F46E5']}
        />
      }
    >
      <View className="px-6 py-8 bg-indigo-600 rounded-b-[40px] shadow-xl mb-6">
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-indigo-100 text-sm font-medium mb-1">Bienvenido a</Text>
            <Text className="text-3xl font-bold text-white">ShopUnite</Text>
          </View>
          <View className="bg-white/20 p-2 rounded-full">
             <Bell color="white" size={20} />
             {subscriptions.length > 0 && <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
          </View>
        </View>
        <Text className="text-indigo-100 text-sm leading-relaxed">
          El Marketplace oficial para tiendas Shopify.
        </Text>
      </View>

      <View className="px-6 mb-24">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-bold text-gray-900 text-lg">Tiendas Disponibles</Text>
          <Text className="text-xs text-indigo-600 font-semibold">Ver todas</Text>
        </View>
        
        {stores.map((store) => (
          <TouchableOpacity
            key={store.id}
            onPress={() => goToStore(store)}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4"
          >
            <View className="h-32 w-full bg-gray-200 relative">
              <Image
                 source={{ uri: store.bannerUrl || (store.isRealStore ? "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80" : `https://picsum.photos/seed/${store.id}/800/300`) }}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-black/40 flex-row items-end p-4">
                 <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 rounded-full border-2 border-white items-center justify-center bg-gray-800 overflow-hidden">
                      {store.logoUrl ? (
                        <Image
                          source={{ uri: store.logoUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Text className="text-white font-bold text-sm">{store.name.substring(0, 2).toUpperCase()}</Text>
                      )}
                    </View>
                    <View>
                       <Text className="font-bold text-lg text-white">{store.name}</Text>
                       <Text className="text-xs text-gray-200">{store.category}</Text>
                    </View>
                 </View>
              </View>
            </View>
            <View className="p-4">
               <Text className="text-gray-500 text-sm mb-3" numberOfLines={2}>
                 {store.description || 'Tienda verificada en ShopUnite'}
               </Text>
               {store.products && store.products.length > 0 ? (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                    {store.products.slice(0, 3).map(p => {
                      const thumbImage = p.images && p.images.length > 0
                        ? p.images[0]
                        : p.imagePrompt
                          ? `https://picsum.photos/seed/${p.imagePrompt}/200`
                          : 'https://via.placeholder.com/200x200.png?text=P';

                      return (
                        <View key={p.id} className="w-16 h-16 rounded-lg bg-gray-50 overflow-hidden border border-gray-100 mr-2">
                          <Image
                            source={{ uri: thumbImage }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        </View>
                      );
                    })}
                 </ScrollView>
               ) : (
                 <Text className="text-gray-400 text-xs">Sin productos</Text>
               )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderStoreDetail = () => {
    if (!selectedStore) return null;
    const isSubscribed = subscriptions.includes(selectedStore.id);

    return (
      <View className="flex-1 bg-white">
        <ScrollView className="flex-1">
          <View className="relative h-64 w-full">
             <Image
              source={{ uri: selectedStore.bannerUrl || (selectedStore.isRealStore ? "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80" : `https://picsum.photos/seed/${selectedStore.id}/800/600`) }}
              className="w-full h-full"
              resizeMode="cover"
             />
             <TouchableOpacity
               onPress={goBack}
               className="absolute top-12 left-4 bg-white/30 p-2 rounded-full"
             >
               <ChevronLeft size={24} color="white" />
             </TouchableOpacity>

             <View className="absolute bottom-0 left-0 right-0 p-6">
                <View className="flex-row items-center gap-4">
                  <View className="w-16 h-16 rounded-2xl shadow-lg items-center justify-center bg-gray-900 border-2 border-white overflow-hidden">
                     {selectedStore.logoUrl ? (
                       <Image
                         source={{ uri: selectedStore.logoUrl }}
                         className="w-full h-full"
                         resizeMode="cover"
                       />
                     ) : (
                       <Text className="text-white text-2xl font-bold">{selectedStore.name.substring(0, 2)}</Text>
                     )}
                  </View>
                  <View>
                    <Text className="text-2xl font-bold text-white">{selectedStore.name}</Text>
                    <Text className="text-gray-300 text-sm">{selectedStore.category}</Text>
                  </View>
                </View>
             </View>
          </View>

          <View className="px-6 py-6 -mt-4 bg-white rounded-t-[30px]">
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-1 mr-4">
                 <Text className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-1">Acerca de la tienda</Text>
                 <Text className="text-gray-600 text-sm leading-relaxed">{selectedStore.description}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => toggleSubscription(selectedStore.id, selectedStore.name)}
                className={`items-center justify-center w-14 h-14 rounded-2xl ${isSubscribed ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                {isSubscribed ? <BellRing size={24} color="#4F46E5" /> : <Bell size={24} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            <View className="h-[1px] bg-gray-100 w-full mb-6" />

            <Text className="font-bold text-xl text-gray-900 mb-4">Catálogo</Text>
            {selectedStore.products && selectedStore.products.length > 0 ? (
              <View className="flex-row flex-wrap justify-between">
                {selectedStore.products.map(product => {
                  // Get image with fallback
                  const productImage = product.images && product.images.length > 0
                    ? product.images[0]
                    : product.imagePrompt
                      ? `https://picsum.photos/seed/${product.imagePrompt}/400`
                      : 'https://via.placeholder.com/400x400.png?text=Producto';

                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => goToProduct(product)}
                      className="w-[48%] mb-4"
                    >
                      <View className="aspect-square rounded-xl bg-gray-100 overflow-hidden mb-3 relative">
                        <Image
                          source={{ uri: productImage }}
                          className="w-full h-full"
                          resizeMode="cover"
                          onError={(e) => console.log('Error loading product image:', product.id)}
                        />
                      </View>
                      <Text className="font-medium text-gray-900 text-sm" numberOfLines={2}>
                        {product.name || 'Producto sin nombre'}
                      </Text>
                      <Text className="text-indigo-600 text-sm font-bold mt-1">
                        {formatCLP(product.price || 0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="py-12 items-center">
                <Text className="text-gray-400 text-sm">No hay productos disponibles</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderProductDetail = () => {
    if (!selectedProduct || !selectedStore) {
      return (
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-gray-500">No se encontró el producto</Text>
          <TouchableOpacity onPress={goBack} className="mt-4 bg-indigo-600 px-6 py-3 rounded-lg">
            <Text className="text-white font-bold">Volver</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Fallback image if no images
    const fallbackImage = selectedProduct.imagePrompt
      ? `https://picsum.photos/seed/${selectedProduct.imagePrompt}/800/800`
      : 'https://via.placeholder.com/800x800.png?text=Producto';

    // Clean description (remove HTML tags if any)
    const cleanDescription = selectedProduct.description
      ? selectedProduct.description.replace(/<[^>]*>/g, '').trim() || 'Producto de calidad disponible en nuestra tienda.'
      : 'Producto de calidad disponible en nuestra tienda.';

    // Get current price (from variant or product)
    const currentPrice = selectedVariant?.price || selectedProduct.price;

    return (
      <View className="flex-1 bg-white">
         <ScrollView className="flex-1">
           {/* Image Gallery with carousel */}
           <View className="relative">
              <ImageGallery
                images={selectedProduct.images || []}
                fallbackImage={fallbackImage}
              />
              <TouchableOpacity
                onPress={goBack}
                className="absolute top-12 left-4 bg-white/90 p-3 rounded-full shadow-lg"
              >
                <ChevronLeft size={24} color="black" />
              </TouchableOpacity>
           </View>

           <View className="bg-white p-6">
              <View className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 pr-4">
                  <Text className="text-2xl font-bold text-gray-900 mb-2">{selectedProduct.name}</Text>
                  <Text className="text-indigo-600 font-medium text-sm">de {selectedStore.name}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-gray-400 mb-1">Precio</Text>
                  <Text className="text-2xl font-bold text-gray-900">{formatCLP(currentPrice)}</Text>
                </View>
              </View>

              {/* Variant Selector */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <VariantSelector
                  variants={selectedProduct.variants}
                  selectedVariant={selectedVariant}
                  onVariantSelect={setSelectedVariant}
                />
              )}

              <View className="border-t border-gray-100 pt-4 mb-6">
                <Text className="text-xs uppercase font-bold text-gray-400 mb-2">Descripción</Text>
                <Text className="text-gray-600 text-sm leading-relaxed">
                  {cleanDescription}
                </Text>
              </View>

              {selectedStore.isRealStore && (
                <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex-row items-center gap-2">
                  <ShieldCheck size={16} color="#16A34A" />
                  <Text className="text-green-800 text-xs font-medium">Producto verificado de tienda oficial</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => addToCart(selectedProduct, selectedStore, selectedVariant)}
                className="w-full bg-indigo-600 py-4 rounded-xl shadow-lg flex-row items-center justify-center gap-2"
                disabled={selectedVariant && !selectedVariant.available}
              >
                <ShoppingBag size={20} color="white" />
                <Text className="text-white font-bold text-lg">Agregar al Carrito</Text>
              </TouchableOpacity>
           </View>
         </ScrollView>
      </View>
    );
  };

  const renderCart = () => (
    <View className="flex-1 bg-gray-50">
      <Header title="Mi Carrito" />
      
      {cart.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-24 h-24 bg-gray-200 rounded-full items-center justify-center mb-4">
            <ShoppingBag size={40} color="#9CA3AF" />
          </View>
          <Text className="text-lg font-bold text-gray-900 mb-2">Tu carrito está vacío</Text>
          <TouchableOpacity 
            onPress={() => setView(ViewState.HOME)}
            className="bg-indigo-600 px-6 py-3 rounded-full mt-4"
          >
            <Text className="text-white font-bold text-sm">Explorar Tiendas</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1">
          <ScrollView className="p-4 mb-20">
            {cart.map((item) => {
              const itemPrice = item.selectedVariant?.price || item.price;
              const cartKey = item.selectedVariant ? `${item.id}-${item.selectedVariant.id}` : item.id;

              return (
              <View key={cartKey} className="bg-white p-4 rounded-xl shadow-sm flex-row gap-4 mb-4 border border-gray-100">
                 <View className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                   <Image
                     source={{ uri: item.images && item.images.length > 0 ? item.images[0] : `https://picsum.photos/seed/${item.imagePrompt}/200` }}
                     className="w-full h-full"
                   />
                 </View>
                 <View className="flex-1 justify-between">
                   <View>
                     <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>{item.name}</Text>
                     {item.selectedVariant && (
                       <Text className="text-xs text-gray-600 mt-1">{item.selectedVariant.title}</Text>
                     )}
                     <Text className="text-xs text-gray-500 mt-1">Tienda: {item.storeName}</Text>
                   </View>
                   <View className="flex-row justify-between items-end mt-2">
                      <Text className="font-bold text-indigo-600">{formatCLP(itemPrice * item.quantity)}</Text>
                      <View className="flex-row items-center gap-3 bg-gray-50 rounded-lg px-2 py-1">
                        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}><Minus size={14} color="black" /></TouchableOpacity>
                        <Text className="text-xs font-bold w-4 text-center">{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}><Plus size={14} color="black" /></TouchableOpacity>
                      </View>
                   </View>
                 </View>
              </View>
              );
            })}
          </ScrollView>

          <View className="bg-white border-t border-gray-200 p-6 absolute bottom-0 left-0 right-0">
             <View className="flex-row justify-between mb-2">
               <Text className="text-gray-500 text-sm">Subtotal</Text>
               <Text className="font-bold text-gray-900 text-sm">{formatCLP(cartTotal)}</Text>
             </View>
             <View className="flex-row justify-between mb-4">
               <Text className="text-gray-500 text-sm">Envío</Text>
               <Text className="font-bold text-indigo-600 text-sm">Gratis</Text>
             </View>
             <View className="flex-row justify-between mb-6">
               <Text className="text-xl font-bold text-gray-900">Total</Text>
               <Text className="text-xl font-bold text-gray-900">{formatCLP(cartTotal)}</Text>
             </View>
             <TouchableOpacity 
               onPress={() => setView(ViewState.CHECKOUT)}
               className="w-full bg-black py-4 rounded-xl flex-row items-center justify-center gap-2"
             >
               <Text className="text-white font-bold text-lg">Ir a Pagar</Text>
               <ArrowRight size={18} color="white" />
             </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderCheckout = () => {
    if (paymentSuccess) {
      return (
        <View className="flex-1 items-center justify-center bg-white p-8">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
            <CheckCircle2 size={48} color="#16A34A" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2">¡Orden Exitosa!</Text>
          <Text className="text-center text-gray-500 mb-8">
            Tu pedido ha sido enviado.
          </Text>
          <TouchableOpacity 
            onPress={() => { setPaymentSuccess(false); setView(ViewState.HOME); }}
            className="bg-indigo-600 px-8 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Seguir Comprando</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-gray-50">
        <Header title="Finalizar Compra" canGoBack onBack={goBack} />
        
        <ScrollView className="p-4">
          {/* Summary */}
          <View className="bg-white p-4 rounded-xl shadow-sm mb-4">
            <Text className="font-bold text-gray-900 mb-2 text-sm">Resumen</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-600 text-sm">Productos ({cartCount})</Text>
              <Text className="text-gray-600 text-sm">{formatCLP(cartTotal)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-gray-100 mt-2">
              <Text className="font-bold text-gray-900 text-sm">Total a Pagar</Text>
              <Text className="font-bold text-gray-900 text-sm">{formatCLP(cartTotal)}</Text>
            </View>
          </View>

          {/* Shipping */}
          <View className="bg-white p-4 rounded-xl shadow-sm mb-4">
            <View className="flex-row items-center gap-2 mb-4">
              <User size={18} color="black" />
              <Text className="font-bold text-gray-900">Datos de Envío</Text>
            </View>
            <View className="gap-3">
              <TextInput
                placeholder="Nombre Completo"
                value={fullName}
                onChangeText={setFullName}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Dirección Completa"
                value={address}
                onChangeText={setAddress}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <View className="flex-row gap-3">
                 {/* Región Selector */}
                 <TouchableOpacity
                   onPress={() => {
                     setTempRegion(region);
                     setShowRegionPicker(true);
                   }}
                   className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 justify-center"
                 >
                   <Text className={region ? 'text-gray-900' : 'text-gray-400'}>
                     {region ? CHILEAN_REGIONS.find(r => r.code === region)?.name : 'Región'}
                   </Text>
                 </TouchableOpacity>

                 {/* Comuna Selector */}
                 <TouchableOpacity
                   onPress={() => {
                     if (availableComunas.length > 0) {
                       setTempComuna(city);
                       setShowComunaPicker(true);
                     }
                   }}
                   className={`flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 justify-center ${availableComunas.length === 0 ? 'opacity-50' : ''}`}
                   disabled={availableComunas.length === 0}
                 >
                   <Text className={city ? 'text-gray-900' : 'text-gray-400'}>
                     {city || 'Comuna'}
                   </Text>
                 </TouchableOpacity>
              </View>

              {/* Modal para Región */}
              <Modal
                visible={showRegionPicker}
                transparent={true}
                animationType="slide"
              >
                <View className="flex-1 justify-end bg-black/50">
                  <View className="bg-white rounded-t-3xl">
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                      <TouchableOpacity onPress={() => setShowRegionPicker(false)}>
                        <Text className="text-indigo-600 text-base">Cancelar</Text>
                      </TouchableOpacity>
                      <Text className="font-semibold text-base">Selecciona Región</Text>
                      <TouchableOpacity onPress={() => {
                        handleRegionChange(tempRegion);
                        setShowRegionPicker(false);
                      }}>
                        <Text className="text-indigo-600 text-base font-semibold">Listo</Text>
                      </TouchableOpacity>
                    </View>
                    <Picker
                      selectedValue={tempRegion}
                      onValueChange={setTempRegion}
                      style={{ height: 200 }}
                    >
                      <Picker.Item label="Selecciona una región" value="" />
                      {CHILEAN_REGIONS.map((r) => (
                        <Picker.Item key={r.code} label={r.name} value={r.code} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </Modal>

              {/* Modal para Comuna */}
              <Modal
                visible={showComunaPicker}
                transparent={true}
                animationType="slide"
              >
                <View className="flex-1 justify-end bg-black/50">
                  <View className="bg-white rounded-t-3xl">
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                      <TouchableOpacity onPress={() => setShowComunaPicker(false)}>
                        <Text className="text-indigo-600 text-base">Cancelar</Text>
                      </TouchableOpacity>
                      <Text className="font-semibold text-base">Selecciona Comuna</Text>
                      <TouchableOpacity onPress={() => {
                        setCity(tempComuna);
                        setShowComunaPicker(false);
                      }}>
                        <Text className="text-indigo-600 text-base font-semibold">Listo</Text>
                      </TouchableOpacity>
                    </View>
                    <Picker
                      selectedValue={tempComuna}
                      onValueChange={setTempComuna}
                      style={{ height: 200 }}
                    >
                      <Picker.Item label="Selecciona una comuna" value="" />
                      {availableComunas.map((comuna) => (
                        <Picker.Item key={comuna} label={comuna} value={comuna} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </Modal>
              <View className="flex-row gap-3">
                <TextInput
                  placeholder="Código Postal"
                  value={zipCode}
                  onChangeText={setZipCode}
                  keyboardType="numeric"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3"
                />
                <TextInput
                  placeholder="Teléfono"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3"
                />
              </View>
            </View>
          </View>

          {/* Payment Info */}
          <View className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <CreditCard size={18} color="#2563EB" />
              <Text className="font-bold text-blue-900">Método de Pago</Text>
            </View>
            <Text className="text-blue-700 text-sm">
              Serás redirigido a MercadoPago para completar el pago de forma segura.
            </Text>
          </View>

          {/* Test Payment Button */}
          <TouchableOpacity
            onPress={handleTestPayment}
            disabled={isProcessingPayment}
            className="w-full bg-orange-500 py-4 rounded-xl flex-row items-center justify-center gap-2 mb-3"
          >
            {isProcessingPayment ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
               <FlaskConical size={20} color="white" />
               <Text className="text-white font-bold text-lg">Pago de Prueba (Testing)</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Real Payment Button */}
          <TouchableOpacity
            onPress={handleRealPayment}
            disabled={isProcessingPayment}
            className="w-full bg-indigo-600 py-4 rounded-xl flex-row items-center justify-center gap-2 mb-10"
          >
            {isProcessingPayment ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
               <Text className="text-white font-bold text-lg">Pagar {formatCLP(cartTotal)}</Text>
               <ArrowRight size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderAdminDashboard = () => {
    // Need to reload configs when entering dashboard
    useEffect(() => {
       getRegisteredConfigs().then(setRegisteredConfigs);
    }, []);

    const handleAddStore = async () => {
       if(!domain || !token) return;
       await addStoreConfig({ domain, accessToken: token });
       setDomain('');
       setToken('');
       const updated = await getRegisteredConfigs();
       setRegisteredConfigs(updated);
       Alert.alert("Admin", "Tienda guardada en la consola");
    };

    const handleRemoveStore = async (domainToRemove: string) => {
      await removeStoreConfig(domainToRemove);
      const updated = await getRegisteredConfigs();
      setRegisteredConfigs(updated);
      Alert.alert("Admin", "Tienda eliminada");
    };

    return (
      <SafeAreaView className="flex-1 bg-slate-900">
        <View className="p-6 border-b border-slate-800 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Settings size={24} color="white" />
            <Text className="text-xl font-bold text-white">Consola Admin</Text>
          </View>
          <TouchableOpacity onPress={goBack}><LogOut size={24} color="#9CA3AF"/></TouchableOpacity>
        </View>

        <ScrollView className="p-6">
          {/* Add Store */}
          <View className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8">
            <View className="flex-row items-center gap-2 mb-4">
              <Plus size={20} color="#34D399" />
              <Text className="font-bold text-lg text-emerald-400">Agregar Nueva Tienda</Text>
            </View>
            <View className="gap-4">
              <View>
                <Text className="text-xs font-medium text-slate-400 mb-1 uppercase">Shopify Domain</Text>
                <TextInput 
                  value={domain}
                  onChangeText={setDomain}
                  placeholder="ejemplo.myshopify.com" 
                  placeholderTextColor="#64748B"
                  className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  autoCapitalize="none"
                />
              </View>
              <View>
                <Text className="text-xs font-medium text-slate-400 mb-1 uppercase">Storefront Token</Text>
                <TextInput 
                  value={token}
                  onChangeText={setToken}
                  placeholder="shpat_xxxxxxxx..." 
                  placeholderTextColor="#64748B"
                  className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  secureTextEntry
                />
              </View>
              <TouchableOpacity 
                onPress={handleAddStore}
                disabled={!domain || !token}
                className={`bg-emerald-600 py-3 rounded-lg items-center ${(!domain || !token) ? 'opacity-50' : ''}`}
              >
                <Text className="text-white font-bold">Registrar Tienda</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List Stores */}
          <View>
            <Text className="font-bold text-lg mb-4 text-gray-300">Tiendas Registradas ({registeredConfigs.length})</Text>
            {registeredConfigs.length === 0 ? (
              <Text className="text-slate-500 text-sm italic">No hay tiendas configuradas.</Text>
            ) : (
              <View className="gap-3">
                {registeredConfigs.map((conf, idx) => (
                  <View key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center">
                     <View className="flex-row items-center gap-3">
                        <View className="bg-slate-900 p-2 rounded-lg">
                          <Globe size={20} color="#60A5FA" />
                        </View>
                        <View>
                           <Text className="font-bold text-sm text-white">{conf.domain}</Text>
                           <Text className="text-xs text-slate-500">Token: •••••••••</Text>
                        </View>
                     </View>
                     <TouchableOpacity 
                       onPress={() => handleRemoveStore(conf.domain)}
                       className="p-2 bg-red-900/30 rounded-lg"
                     >
                       <Trash2 size={18} color="#F87171" />
                     </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="pt-8 pb-12">
             <Text className="text-xs text-slate-500 mb-4 text-center">
               Cambios se reflejan al recargar el marketplace.
             </Text>
             <TouchableOpacity 
               onPress={() => { loadMarketplace(); goBack(); }}
               className="bg-white py-3 rounded-xl items-center"
             >
               <Text className="text-black font-bold">Guardar y Volver</Text>
             </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderSearch = () => (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="p-4 bg-white shadow-sm">
         <Text className="text-2xl font-bold mb-4">Explorar</Text>
         <View className="relative">
           <View className="absolute left-3 top-3.5 z-10">
             <Search size={20} color="#9CA3AF" />
           </View>
           <TextInput 
            placeholder="Buscar tiendas o productos..." 
            className="bg-gray-100 rounded-xl py-3 pl-10 pr-4"
           />
         </View>
      </View>
      
      <ScrollView className="p-4">
        <Text className="font-bold text-gray-900 mb-3">Categorías Populares</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {['Moda', 'Tecnología', 'Hogar', 'Mascotas', 'Belleza', 'Deportes'].map(cat => (
            <View key={cat} className="px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
              <Text className="text-sm font-medium text-gray-600">{cat}</Text>
            </View>
          ))}
        </View>

        <Text className="font-bold text-gray-900 mb-3">Quizás te guste</Text>
        <View className="flex-row flex-wrap justify-between">
          {stores.flatMap(s => s.products).slice(0, 6).map(product => (
             <View key={`explore-${product.id}`} className="w-[48%] bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-4">
                <View className="aspect-square rounded-lg bg-gray-100 overflow-hidden mb-2">
                  <Image 
                    source={{ uri: product.images && product.images.length > 0 ? product.images[0] : `https://picsum.photos/seed/${product.imagePrompt}/300` }} 
                    className="w-full h-full"
                  />
                </View>
                <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>{product.name}</Text>
                <Text className="text-xs text-gray-500">{formatCLP(product.price)}</Text>
             </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderProfile = () => (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="p-4">
        <Text className="text-3xl font-bold mb-8 mt-4">Mi Perfil</Text>
        
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex-row items-center gap-4 mb-6">
          <View className="w-16 h-16 bg-indigo-100 rounded-full items-center justify-center">
            <Text className="text-indigo-600 font-bold text-xl">JP</Text>
          </View>
          <View>
            <Text className="font-bold text-lg">Usuario Demo</Text>
            <Text className="text-sm text-gray-500">usuario@shopunite.com</Text>
          </View>
        </View>

        <Text className="font-bold text-gray-900 mb-3 px-1">Mis Suscripciones</Text>
        {subscriptions.length === 0 ? (
           <View className="py-8 bg-white rounded-2xl border border-dashed border-gray-300 mb-8 items-center">
             <Text className="text-gray-400 text-sm">Aún no sigues ninguna tienda.</Text>
           </View>
        ) : (
          <View className="gap-3 mb-8">
            {stores.filter(s => subscriptions.includes(s.id)).map(store => (
              <View key={`sub-${store.id}`} className="bg-white p-3 rounded-xl flex-row items-center justify-between shadow-sm border border-gray-100">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full items-center justify-center bg-gray-800">
                    <Text className="text-white font-bold text-xs">{store.name.substring(0, 2)}</Text>
                  </View>
                  <View>
                    <Text className="font-medium text-gray-900">{store.name}</Text>
                    <View className="flex-row items-center gap-1">
                       <BellRing size={10} color="#16A34A"/> 
                       <Text className="text-[10px] text-green-600">Notificaciones activas</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => toggleSubscription(store.id, store.name)}
                  className="bg-gray-100 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-xs text-gray-600 font-medium">Dejar de seguir</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View className="gap-2 mb-8">
          {['Mis Pedidos', 'Direcciones', 'Métodos de Pago', 'Ayuda'].map(item => (
            <TouchableOpacity key={item} className="bg-white p-4 rounded-xl flex-row justify-between items-center shadow-sm border border-gray-100">
              <Text className="font-medium text-gray-700">{item}</Text>
              <ChevronLeft size={16} className="rotate-180" color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <View className="mt-8 mb-10">
           <TouchableOpacity 
              onPress={() => setView(ViewState.ADMIN_DASHBOARD)}
              className="w-full border-2 border-dashed border-gray-300 p-4 rounded-xl flex-row items-center justify-center gap-2"
           >
              <Settings size={18} color="#9CA3AF" />
              <Text className="font-bold text-sm text-gray-400">Acceso Administrativo</Text>
           </TouchableOpacity>
           <Text className="text-[10px] text-center text-gray-300 mt-2">ShopUnite Admin Console v1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-gray-500 font-medium mt-4">Cargando Marketplace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ExpoStatusBar style="dark" />
      <View className="flex-1 bg-gray-100">
          {/* Toast - using absolute view overlay for simplicity */}
          {toast && (
             <View className={`absolute top-14 left-4 right-4 z-50 px-4 py-3 rounded-full flex-row items-center justify-center gap-3 shadow-xl
                ${toast.type === 'admin' ? 'bg-slate-800' : 'bg-gray-900'}`}
             >
                {toast.type === 'success' && <CheckCircle2 size={18} color="#4ADE80" />}
                {toast.type === 'admin' && <Settings size={18} color="#34D399" />}
                <Text className="text-white text-sm font-medium">{toast.msg}</Text>
             </View>
          )}

          <View className="flex-1">
            {view === ViewState.HOME && renderHome()}
            {view === ViewState.STORE_DETAIL && renderStoreDetail()}
            {view === ViewState.PRODUCT_DETAIL && renderProductDetail()}
            {view === ViewState.CART && renderCart()}
            {view === ViewState.PROFILE && renderProfile()}
            {view === ViewState.SEARCH && renderSearch()}
            {view === ViewState.CHECKOUT && renderCheckout()}
            {view === ViewState.ADMIN_DASHBOARD && renderAdminDashboard()}
          </View>

          {/* Bottom Navigation */}
          {![ViewState.PRODUCT_DETAIL, ViewState.CHECKOUT, ViewState.ADMIN_DASHBOARD].includes(view) && (
             <BottomNav currentView={view} onChangeView={setView} cartCount={cartCount} />
          )}
      </View>
    </SafeAreaView>
  );
}

