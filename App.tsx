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
import { ShippingSection } from './src/components/ShippingSection';
import {
  createPendingTransaction,
  updateTransactionStatus,
  createTestOrders,
  validateShippingInfo,
  type ShippingInfo
} from './src/services/orderService';
import {
  validateShippingSelection,
  type SelectedShippingRates
} from './src/services/shippingService';
import {
  createMercadoPagoPreference,
  openMercadoPagoCheckout,
  checkPaymentStatus
} from './src/services/mercadopagoService';
import { CHILEAN_REGIONS, getComunasByRegion } from './src/data/chileanRegions';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import { UserOrder } from './src/services/ordersService';
import { getDefaultAddress, saveCheckoutAddress } from './src/services/addressService';
import AddressesScreen from './src/screens/AddressesScreen';
import NotificationsAdminScreen from './src/screens/NotificationsAdminScreen';
import * as cartService from './src/services/cartService';
import { WelcomeFlow } from './src/components/WelcomeFlow';
import { SplashScreen } from './src/components/SplashScreen';
import {
  getUserSubscriptions,
  subscribeToStore,
  unsubscribeFromStore
} from './src/services/subscriptionsService';
import {
  configureNotifications,
  registerForPushNotifications
} from './src/services/pushNotificationService';
import { configureGoogleSignIn } from './src/services/authService';

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
    { id: ViewState.HOME, icon: StoreIcon, label: 'Inicio' },
    { id: ViewState.EXPLORE, icon: Search, label: 'Explorar' },
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

// --- Main App Content ---

function AppContent() {
  const { user, profile, isLoading: authLoading, isAuthenticated, signOut } = useAuth();
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedStoreForNotifications, setSelectedStoreForNotifications] = useState<{ id: string; name: string } | null>(null);

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

  // Shipping rates state
  const [selectedShippingRates, setSelectedShippingRates] = useState<SelectedShippingRates>({});
  const [shippingTotal, setShippingTotal] = useState(0);

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
    // Configurar notificaciones al iniciar la app
    configureNotifications();

    // Configurar Google Sign In
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (webClientId) {
      configureGoogleSignIn(webClientId);
      console.log('✅ [App] Google Sign In configurado');
    } else {
      console.warn('⚠️  [App] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no está configurado en .env.local');
    }
  }, []);

  // Cargar suscripciones del usuario cuando inicie sesión
  useEffect(() => {
    if (user) {
      loadUserSubscriptions();
      // Registrar para notificaciones push
      registerPushNotifications(user.id);
    } else {
      // Si no hay usuario, limpiar suscripciones
      setSubscriptions([]);
    }
  }, [user]);

  // Función para registrar notificaciones push
  const registerPushNotifications = async (userId: string) => {
    console.log('[App] Registering push notifications for user:', userId);
    const result = await registerForPushNotifications(userId);

    if (result.success) {
      console.log('[App] Push notifications registered successfully:', result.token);
      setToast({ msg: '🔔 Notificaciones activadas', type: 'success' });
    } else {
      console.log('[App] Failed to register push notifications:', result.error);
      // No mostrar error al usuario si falla (puede ser que esté en simulador)
    }
  };

  // Cargar carrito del usuario desde la DB cuando inicie sesión
  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      // Si no hay usuario, limpiar carrito
      setCart([]);
    }
  }, [user]);

  // Pre-llenar email del usuario en el checkout (el nombre y dirección se cargan en loadDefaultAddress)
  useEffect(() => {
    if (user) {
      // Solo pre-llenar email (siempre)
      if (user.email) {
        setEmail(user.email);
      }
    } else {
      // Si no hay usuario, limpiar campos del checkout (el carrito ya se limpia en el useEffect anterior)
      setFullName('');
      setEmail('');
      setAddress('');
      setCity('');
      setRegion('');
      setZipCode('');
      setPhone('');
      console.log('[App] Usuario deslogueado - checkout limpiado');
    }
  }, [user]);

  // Cargar dirección por defecto cuando el usuario va al checkout
  useEffect(() => {
    if (view === ViewState.CHECKOUT && user) {
      loadDefaultAddress();
    }
  }, [view, user]);

  const loadDefaultAddress = async () => {
    if (!user) return;

    const { address: defaultAddr, error } = await getDefaultAddress(user.id);

    if (defaultAddr) {
      // Usuario tiene dirección guardada - usar esa
      console.log('[App] Loading default address for user:', user.id);

      if (defaultAddr.recipient_name) {
        setFullName(defaultAddr.recipient_name);
      }

      if (defaultAddr.street) {
        // Construir dirección completa desde los campos separados
        let fullAddress = defaultAddr.street;
        if (defaultAddr.street_number) fullAddress += ' ' + defaultAddr.street_number;
        if (defaultAddr.apartment) fullAddress += ', ' + defaultAddr.apartment;
        setAddress(fullAddress);
      }

      if (defaultAddr.city) setCity(defaultAddr.city);

      if (defaultAddr.region) {
        setRegion(defaultAddr.region);
        handleRegionChange(defaultAddr.region);
      }

      if (defaultAddr.zip_code) setZipCode(defaultAddr.zip_code);
      if (defaultAddr.phone) setPhone(defaultAddr.phone);

      console.log('[App] Default address loaded successfully');
    } else {
      // Usuario NO tiene dirección guardada - usar datos del perfil
      console.log('[App] No saved address, using profile data for user:', user.id);

      if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }
      // Email ya está pre-llenado por el useEffect anterior
    }
  };

  const loadUserSubscriptions = async () => {
    if (!user) return;

    const { subscriptions: userSubs, error } = await getUserSubscriptions(user.id);
    if (error) {
      console.error('Error cargando suscripciones:', error);
    } else {
      setSubscriptions(userSubs);
    }
  };

  const loadCart = async () => {
    if (!user) return;

    console.log('[App] Loading cart from DB for user:', user.id);
    const { cart: userCart, error } = await cartService.getCart(user.id);
    if (error) {
      console.error('[App] Error loading cart:', error);
    } else {
      setCart(userCart);
      console.log('[App] Cart loaded:', userCart.length, 'items');
    }
  };

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
    setProductSearchQuery(''); // Limpiar búsqueda de productos al entrar a una tienda
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
    } else if (view === ViewState.NOTIFICATIONS_ADMIN) {
      setView(ViewState.ADMIN_DASHBOARD);
      setSelectedStoreForNotifications(null);
    } else {
      setView(ViewState.HOME);
    }
  };

  // Logic Helpers
  const toggleSubscription = async (storeId: string, storeName: string) => {
    if (!user) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para seguir tiendas');
      return;
    }

    // Limpiar el prefijo "real-" si existe (storeId viene como "real-domain.myshopify.com")
    const storeDomain = storeId.replace(/^real-/, '');

    const isCurrentlySubscribed = subscriptions.includes(storeDomain);

    if (isCurrentlySubscribed) {
      // Desuscribirse
      const { success, error } = await unsubscribeFromStore(user.id, storeDomain);
      if (success) {
        setSubscriptions(prev => prev.filter(id => id !== storeDomain));
        setToast({ msg: `Dejaste de seguir a ${storeName}`, type: 'info' });
      } else {
        Alert.alert('Error', error || 'No se pudo desuscribir');
      }
    } else {
      // Suscribirse
      const { success, error } = await subscribeToStore(user.id, storeDomain, storeName);
      if (success) {
        setSubscriptions(prev => [...prev, storeDomain]);
        setToast({ msg: `¡Suscrito a ${storeName}!`, type: 'success' });
      } else {
        Alert.alert('Error', error || 'No se pudo suscribir');
      }
    }
  };

  const addToCart = async (product: Product, store: Store, variant?: ProductVariant | null) => {
    if (!user) {
      // Usuario no logueado - agregar al carrito local (memoria)
      setCart(prev => {
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
    } else {
      // Usuario logueado - guardar en DB
      await cartService.addToCart(user.id, product, store.name, store.id, variant);
      await loadCart();
    }
    setToast({ msg: 'Agregado al carrito', type: 'success' });
    setView(ViewState.STORE_DETAIL);
  };

  const updateQuantity = async (productId: string, delta: number, variantId?: string) => {
    if (!user) {
      // Usuario no logueado - actualizar en memoria
      setCart(prev => prev.map(item => {
        if (item.id === productId && (!variantId || item.selectedVariant?.id === variantId)) {
          return { ...item, quantity: Math.max(0, item.quantity + delta) };
        }
        return item;
      }).filter(item => item.quantity > 0));
    } else {
      // Usuario logueado - actualizar en DB
      const item = cart.find(i => i.id === productId && (!variantId || i.selectedVariant?.id === variantId));
      if (item) {
        const newQuantity = item.quantity + delta;
        await cartService.updateCartItemQuantity(user.id, productId, variantId || null, newQuantity);
        await loadCart();
      }
    }
  };

  const clearCart = async () => {
    if (!user) {
      // Usuario no logueado - limpiar memoria
      setCart([]);
    } else {
      // Usuario logueado - limpiar DB
      await cartService.clearCart(user.id);
      setCart([]);
    }
  };

  // Handler para cuando se calculan/cambian los envíos
  const handleShippingCalculated = (rates: SelectedShippingRates, total: number) => {
    setSelectedShippingRates(rates);
    setShippingTotal(total);
  };

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

    // Validar que se hayan seleccionado envíos
    const shippingValidation = validateShippingSelection(cart, selectedShippingRates);
    if (!shippingValidation.valid) {
      Alert.alert(
        'Selecciona métodos de envío',
        `Falta seleccionar envío para: ${shippingValidation.missingStores?.join(', ')}`
      );
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Total incluye productos + envíos
      const grandTotal = cartTotal + shippingTotal;

      // 1. Crear transacción pendiente
      const result = await createPendingTransaction({
        cartItems: cart,
        shippingInfo,
        totalAmount: grandTotal,
        storeSplits: {},
        shippingCosts: selectedShippingRates,
        isTest: true,
        userId: user?.id, // Asociar a usuario si está logueado
      });

      if (!result) {
        Alert.alert('Error', 'No se pudo crear la transacción');
        return;
      }

      // 2. Simular pago aprobado
      await updateTransactionStatus(result.transactionId, 'approved');

      // 3. Crear órdenes de prueba en la DB (sin llamar a Shopify)
      await createTestOrders(result.transactionId, cart);

      // 3.5 Guardar dirección del checkout si el usuario está logueado
      if (user) {
        await saveCheckoutAddress(user.id, {
          label: 'Mi dirección',
          recipientName: fullName,
          street: address,
          city,
          region,
          zipCode: zipCode || undefined,
          phone,
        });
        console.log('[App] Checkout address saved successfully');
      }

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

    // Validar que se hayan seleccionado envíos
    const shippingValidation = validateShippingSelection(cart, selectedShippingRates);
    if (!shippingValidation.valid) {
      Alert.alert(
        'Selecciona métodos de envío',
        `Falta seleccionar envío para: ${shippingValidation.missingStores?.join(', ')}`
      );
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Total incluye productos + envíos
      const grandTotal = cartTotal + shippingTotal;

      // 1. Crear transacción pendiente
      const result = await createPendingTransaction({
        cartItems: cart,
        shippingInfo,
        totalAmount: grandTotal,
        storeSplits: {},
        shippingCosts: selectedShippingRates,
        isTest: false,
        userId: user?.id, // Asociar a usuario si está logueado
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
        // Guardar dirección del checkout si el usuario está logueado
        if (user) {
          await saveCheckoutAddress(user.id, {
            label: 'Mi dirección',
            recipientName: fullName,
            street: address,
            city,
            region,
            zipCode: zipCode || undefined,
            phone,
          });
          console.log('[App] Checkout address saved successfully after real payment');
        }

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

  const renderHome = () => {
    const subscribedStores = stores.filter(store => {
      const storeDomain = store.id.replace(/^real-/, '');
      return subscriptions.includes(storeDomain);
    });

    return (
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
          {subscribedStores.length > 0
            ? `Tienes ${subscribedStores.length} ${subscribedStores.length === 1 ? 'tienda favorita' : 'tiendas favoritas'}`
            : 'Descubre y suscríbete a tus tiendas favoritas'}
        </Text>
      </View>

      <View className="px-6 mb-24">
        {subscribedStores.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center shadow-sm border border-gray-100">
            <StoreIcon size={48} color="#9CA3AF" strokeWidth={1.5} />
            <Text className="font-bold text-gray-900 text-lg mt-4 mb-2">No tienes tiendas suscritas</Text>
            <Text className="text-gray-500 text-sm text-center mb-6">
              Explora tiendas y suscríbete para recibir notificaciones de nuevos productos y ofertas
            </Text>
            <TouchableOpacity
              onPress={() => setView(ViewState.EXPLORE)}
              className="bg-indigo-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-bold">Explorar Tiendas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-gray-900 text-lg">Mis Tiendas</Text>
              <TouchableOpacity onPress={() => setView(ViewState.EXPLORE)}>
                <Text className="text-xs text-indigo-600 font-semibold">Explorar más</Text>
              </TouchableOpacity>
            </View>

            {subscribedStores.map((store) => (
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
              {/* Badge de cantidad de productos */}
              <View className="absolute top-3 right-3 bg-white/90 px-3 py-1.5 rounded-full shadow-lg">
                <Text className="text-indigo-600 text-xs font-bold">
                  {store.products?.length || 0} productos
                </Text>
              </View>
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
          </>
        )}
      </View>
    </ScrollView>
  );
};

  const renderExplore = () => {
    // Filtrar tiendas por búsqueda
    const filteredStores = stores.filter(store =>
      store.name.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
      store.category.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
      (store.description && store.description.toLowerCase().includes(storeSearchQuery.toLowerCase()))
    );

    return (
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
          <View className="mb-4">
            <Text className="text-indigo-100 text-sm font-medium mb-1">Descubre</Text>
            <Text className="text-3xl font-bold text-white">Todas las Tiendas</Text>
          </View>
          <Text className="text-indigo-100 text-sm leading-relaxed">
            {stores.length} {stores.length === 1 ? 'tienda disponible' : 'tiendas disponibles'}
          </Text>
        </View>

        <View className="px-6 mb-24">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-bold text-gray-900 text-lg">Explorar Tiendas</Text>
            <Text className="text-xs text-gray-500">{subscriptions.length} suscripciones</Text>
          </View>

          {/* Buscador de tiendas */}
          <View className="bg-white rounded-xl shadow-sm border border-gray-100 flex-row items-center px-4 py-3 mb-4">
            <Search size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-gray-900"
              placeholder="Buscar tiendas por nombre o categoría..."
              placeholderTextColor="#9CA3AF"
              value={storeSearchQuery}
              onChangeText={setStoreSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {storeSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setStoreSearchQuery('')}>
                <Text className="text-gray-400 text-lg ml-2">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Resultados de búsqueda */}
          {filteredStores.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm border border-gray-100">
              <Search size={48} color="#9CA3AF" strokeWidth={1.5} />
              <Text className="font-bold text-gray-900 text-lg mt-4 mb-2">No se encontraron tiendas</Text>
              <Text className="text-gray-500 text-sm text-center">
                Intenta con otro término de búsqueda
              </Text>
            </View>
          ) : (
            <>
              {filteredStores.map((store) => {
            const storeDomain = store.id.replace(/^real-/, '');
            const isSubscribed = subscriptions.includes(storeDomain);

            return (
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
                  {/* Badge de cantidad de productos */}
                  <View className="absolute top-3 right-3 bg-white/90 px-3 py-1.5 rounded-full shadow-lg">
                    <Text className="text-indigo-600 text-xs font-bold">
                      {store.products?.length || 0} productos
                    </Text>
                  </View>
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
                      <View className="flex-1">
                        <Text className="font-bold text-lg text-white">{store.name}</Text>
                        <Text className="text-xs text-gray-200">{store.category}</Text>
                      </View>
                      {isSubscribed && (
                        <View className="bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">Suscrito</Text>
                        </View>
                      )}
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
            );
          })}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStoreDetail = () => {
    if (!selectedStore) return null;
    // Limpiar el prefijo "real-" para comparar con suscripciones
    const storeDomain = selectedStore.id.replace(/^real-/, '');
    const isSubscribed = subscriptions.includes(storeDomain);

    // Filtrar productos por búsqueda
    const filteredProducts = selectedStore.products?.filter(product =>
      product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(productSearchQuery.toLowerCase()))
    ) || [];

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

            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-xl text-gray-900">Catálogo</Text>
              <Text className="text-xs text-gray-500">{selectedStore.products?.length || 0} productos</Text>
            </View>

            {/* Buscador de productos */}
            <View className="bg-gray-50 rounded-xl border border-gray-200 flex-row items-center px-4 py-3 mb-4">
              <Search size={20} color="#9CA3AF" />
              <TextInput
                className="flex-1 ml-3 text-gray-900"
                placeholder="Buscar productos..."
                placeholderTextColor="#9CA3AF"
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {productSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                  <Text className="text-gray-400 text-lg ml-2">✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredProducts.length > 0 ? (
              <View className="flex-row flex-wrap justify-between">
                {filteredProducts.map(product => {
                  // Get image with fallback
                  const productImage = product.images && product.images.length > 0
                    ? product.images[0]
                    : product.imagePrompt
                      ? `https://picsum.photos/seed/${product.imagePrompt}/400`
                      : 'https://via.placeholder.com/400x400.png?text=Producto';

                  return (
                    <View key={product.id} className="w-[48%] mb-4">
                      <TouchableOpacity
                        onPress={() => goToProduct(product)}
                        activeOpacity={0.7}
                      >
                        <View className="aspect-square rounded-xl bg-gray-100 overflow-hidden mb-3 relative">
                          <Image
                            source={{ uri: productImage }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onError={(e) => console.log('Error loading product image:', product.id)}
                          />
                          {/* Botón agregar al carrito */}
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              addToCart(product, selectedStore, product.variants?.[0] || null);
                              setToast({ msg: 'Agregado al carrito', type: 'success' });
                            }}
                            className="absolute bottom-2 right-2 bg-indigo-600 p-2.5 rounded-full shadow-lg"
                            activeOpacity={0.8}
                          >
                            <Plus size={20} color="white" strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                        <Text className="font-medium text-gray-900 text-sm" numberOfLines={2}>
                          {product.name || 'Producto sin nombre'}
                        </Text>
                        <Text className="text-indigo-600 text-sm font-bold mt-1">
                          {formatCLP(product.price || 0)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="py-12 items-center">
                {productSearchQuery.length > 0 ? (
                  <>
                    <Search size={48} color="#9CA3AF" strokeWidth={1.5} />
                    <Text className="font-bold text-gray-900 text-lg mt-4 mb-2">No se encontraron productos</Text>
                    <Text className="text-gray-500 text-sm text-center">
                      Intenta con otro término de búsqueda
                    </Text>
                  </>
                ) : (
                  <Text className="text-gray-400 text-sm">No hay productos disponibles</Text>
                )}
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
          <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 220 }}>
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
                        <TouchableOpacity onPress={() => updateQuantity(item.id, -1, item.selectedVariant?.id)}><Minus size={14} color="black" /></TouchableOpacity>
                        <Text className="text-xs font-bold w-4 text-center">{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, 1, item.selectedVariant?.id)}><Plus size={14} color="black" /></TouchableOpacity>
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
            {shippingTotal > 0 && (
              <View className="flex-row justify-between mb-1">
                <Text className="text-gray-600 text-sm">Envíos</Text>
                <Text className="text-gray-600 text-sm">{formatCLP(shippingTotal)}</Text>
              </View>
            )}
            <View className="flex-row justify-between pt-2 border-t border-gray-100 mt-2">
              <Text className="font-bold text-gray-900 text-sm">Total a Pagar</Text>
              <Text className="font-bold text-gray-900 text-sm">{formatCLP(cartTotal + shippingTotal)}</Text>
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

          {/* Shipping Methods Section */}
          <ShippingSection
            cartItems={cart}
            shippingAddress={{
              address: address,
              city: city,
              region: region,
              zipCode: zipCode,
            }}
            onShippingCalculated={handleShippingCalculated}
            autoCalculate={true}
          />

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
            disabled={isProcessingPayment || shippingTotal === 0}
            className={`w-full py-4 rounded-xl flex-row items-center justify-center gap-2 mb-3 ${
              isProcessingPayment || shippingTotal === 0 ? 'bg-gray-400' : 'bg-orange-500'
            }`}
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
            disabled={isProcessingPayment || shippingTotal === 0}
            className={`w-full py-4 rounded-xl flex-row items-center justify-center gap-2 mb-10 ${
              isProcessingPayment || shippingTotal === 0 ? 'bg-gray-400' : 'bg-indigo-600'
            }`}
          >
            {isProcessingPayment ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
               <Text className="text-white font-bold text-lg">Pagar {formatCLP(cartTotal + shippingTotal)}</Text>
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
                  <View key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                     <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center gap-3 flex-1">
                           <View className="bg-slate-900 p-2 rounded-lg">
                             <Globe size={20} color="#60A5FA" />
                           </View>
                           <View className="flex-1">
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

                     {/* Notification Button */}
                     <TouchableOpacity
                       onPress={() => {
                         setSelectedStoreForNotifications({
                           id: conf.domain,
                           name: conf.domain.replace('.myshopify.com', ''),
                         });
                         setView(ViewState.NOTIFICATIONS_ADMIN);
                       }}
                       className="bg-indigo-600 py-2.5 rounded-lg flex-row items-center justify-center gap-2"
                     >
                       <Bell size={16} color="white" />
                       <Text className="text-white font-semibold text-sm">Enviar Notificaciones</Text>
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
          {stores.flatMap(s => s.products.map(p => ({ ...p, storeId: s.id, storeName: s.name }))).slice(0, 6).map(product => {
            const productStore = stores.find(s => s.id === product.storeId);
            return (
             <View key={`explore-${product.id}`} className="w-[48%] bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-4">
                <TouchableOpacity
                  onPress={() => {
                    if (productStore) {
                      setSelectedStore(productStore);
                      goToProduct(product);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View className="aspect-square rounded-lg bg-gray-100 overflow-hidden mb-2 relative">
                    <Image
                      source={{ uri: product.images && product.images.length > 0 ? product.images[0] : `https://picsum.photos/seed/${product.imagePrompt}/300` }}
                      className="w-full h-full"
                    />
                    {/* Botón agregar al carrito */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        if (productStore) {
                          addToCart(product, productStore, product.variants?.[0] || null);
                          setToast({ msg: 'Agregado al carrito', type: 'success' });
                        }
                      }}
                      className="absolute bottom-2 right-2 bg-indigo-600 p-2 rounded-full shadow-lg"
                      activeOpacity={0.8}
                    >
                      <Plus size={18} color="white" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>{product.name}</Text>
                  <Text className="text-xs text-gray-500">{formatCLP(product.price)}</Text>
                </TouchableOpacity>
             </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderProfile = () => {
    // Si no está autenticado, mostrar pantalla de bienvenida
    if (!isAuthenticated) {
      return (
        <SafeAreaView className="flex-1 bg-gray-50">
          <ScrollView className="p-4">
            <Text className="text-3xl font-bold mb-4 mt-4">Mi Perfil</Text>

            <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 items-center">
              <View className="w-20 h-20 bg-gray-200 rounded-full items-center justify-center mb-4">
                <User size={40} color="#9CA3AF" />
              </View>
              <Text className="font-bold text-lg mb-2">¡Bienvenido a ShopUnite!</Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                Inicia sesión para acceder a tu perfil, pedidos y más
              </Text>

              <TouchableOpacity
                onPress={() => setView(ViewState.LOGIN)}
                className="w-full bg-blue-600 py-3 rounded-xl mb-3"
              >
                <Text className="text-white text-center font-semibold">Iniciar Sesión</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setView(ViewState.SIGNUP)}
                className="w-full border-2 border-blue-600 py-3 rounded-xl"
              >
                <Text className="text-blue-600 text-center font-semibold">Crear Cuenta</Text>
              </TouchableOpacity>
            </View>

            <View className="gap-2 mb-8">
              <Text className="font-bold text-gray-900 mb-2 px-1">Explora sin cuenta</Text>
              {['Explorar Tiendas', 'Buscar Productos', 'Ayuda'].map(item => (
                <TouchableOpacity key={item} className="bg-white p-4 rounded-xl flex-row justify-between items-center shadow-sm border border-gray-100">
                  <Text className="font-medium text-gray-700">{item}</Text>
                  <ChevronLeft size={16} className="rotate-180" color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Usuario autenticado - mostrar perfil completo
    const getUserInitials = () => {
      if (profile?.full_name) {
        const names = profile.full_name.split(' ');
        return names.length > 1
          ? `${names[0][0]}${names[1][0]}`.toUpperCase()
          : names[0].substring(0, 2).toUpperCase();
      }
      return profile?.email?.substring(0, 2).toUpperCase() || 'U';
    };

    return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="p-4">
        <Text className="text-3xl font-bold mb-8 mt-4">Mi Perfil</Text>

        <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex-row items-center gap-4 mb-6">
          <View className="w-16 h-16 bg-indigo-100 rounded-full items-center justify-center">
            <Text className="text-indigo-600 font-bold text-xl">{getUserInitials()}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-lg">{profile?.full_name || 'Usuario'}</Text>
            <Text className="text-sm text-gray-500">{profile?.email}</Text>
            {profile && profile.total_orders > 0 && (
              <Text className="text-xs text-green-600 mt-1">
                {profile.total_orders} pedidos • {formatCLP(profile.total_spent)}
              </Text>
            )}
          </View>
        </View>

        <Text className="font-bold text-gray-900 mb-3 px-1">Mis Suscripciones</Text>
        {subscriptions.length === 0 ? (
           <View className="py-8 bg-white rounded-2xl border border-dashed border-gray-300 mb-8 items-center">
             <Text className="text-gray-400 text-sm">Aún no sigues ninguna tienda.</Text>
           </View>
        ) : (
          <View className="gap-3 mb-8">
            {stores.filter(s => subscriptions.includes(s.id.replace(/^real-/, ''))).map(store => (
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
          <TouchableOpacity
            onPress={() => setView(ViewState.ORDERS)}
            className="bg-white p-4 rounded-xl flex-row justify-between items-center shadow-sm border border-gray-100"
          >
            <Text className="font-medium text-gray-700">Mis Pedidos</Text>
            <ChevronLeft size={16} className="rotate-180" color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setView(ViewState.ADDRESSES)}
            className="bg-white p-4 rounded-xl flex-row justify-between items-center shadow-sm border border-gray-100"
          >
            <Text className="font-medium text-gray-700">Direcciones</Text>
            <ChevronLeft size={16} className="rotate-180" color="#9CA3AF" />
          </TouchableOpacity>

          {['Métodos de Pago', 'Ayuda'].map(item => (
            <TouchableOpacity key={item} className="bg-white p-4 rounded-xl flex-row justify-between items-center shadow-sm border border-gray-100">
              <Text className="font-medium text-gray-700">{item}</Text>
              <ChevronLeft size={16} className="rotate-180" color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button (for authenticated users) */}
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            setToast({ msg: 'Sesión cerrada correctamente', type: 'success' });
            setView(ViewState.HOME);
          }}
          className="bg-red-50 p-4 rounded-xl flex-row items-center justify-center gap-2 mb-4"
        >
          <LogOut size={18} color="#DC2626" />
          <Text className="font-bold text-sm text-red-600">Cerrar Sesión</Text>
        </TouchableOpacity>

        <View className="mt-4 mb-10">
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
  };

  // =====================================================
  // AUTH FLOW: Mostrar WelcomeFlow si no está autenticado
  // =====================================================

  // Loading: Mostrar SplashScreen
  if (authLoading || loading) {
    return <SplashScreen />;
  }

  // No autenticado: Mostrar WelcomeFlow
  if (!isAuthenticated) {
    return <WelcomeFlow />;
  }

  // Autenticado: Mostrar Marketplace
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
            {view === ViewState.EXPLORE && renderExplore()}
            {view === ViewState.STORE_DETAIL && renderStoreDetail()}
            {view === ViewState.PRODUCT_DETAIL && renderProductDetail()}
            {view === ViewState.CART && renderCart()}
            {view === ViewState.PROFILE && renderProfile()}
            {view === ViewState.SEARCH && renderSearch()}
            {view === ViewState.CHECKOUT && renderCheckout()}
            {view === ViewState.ADMIN_DASHBOARD && renderAdminDashboard()}
            {view === ViewState.LOGIN && <LoginScreen onNavigate={setView} />}
            {view === ViewState.SIGNUP && <SignUpScreen onNavigate={setView} />}
            {view === ViewState.ORDERS && (
              <OrdersScreen
                onBack={() => setView(ViewState.PROFILE)}
                onSelectOrder={(order) => {
                  setSelectedOrder(order);
                  setView(ViewState.ORDER_DETAIL);
                }}
              />
            )}
            {view === ViewState.ORDER_DETAIL && selectedOrder && (
              <OrderDetailScreen
                order={selectedOrder}
                onBack={() => setView(ViewState.ORDERS)}
                onRepeatOrder={(items) => {
                  setCart(items);
                  setView(ViewState.CART);
                  Alert.alert('¡Listo!', `${items.length} productos agregados al carrito`);
                }}
              />
            )}
            {view === ViewState.ADDRESSES && user && (
              <AddressesScreen
                userId={user.id}
                onBack={() => setView(ViewState.PROFILE)}
              />
            )}
            {view === ViewState.NOTIFICATIONS_ADMIN && selectedStoreForNotifications && (
              <NotificationsAdminScreen
                storeId={selectedStoreForNotifications.id}
                storeName={selectedStoreForNotifications.name}
                onBack={goBack}
              />
            )}
          </View>

          {/* Bottom Navigation */}
          {![ViewState.PRODUCT_DETAIL, ViewState.CHECKOUT, ViewState.ADMIN_DASHBOARD, ViewState.LOGIN, ViewState.SIGNUP, ViewState.ORDERS, ViewState.ORDER_DETAIL, ViewState.ADDRESSES, ViewState.NOTIFICATIONS_ADMIN].includes(view) && (
             <BottomNav currentView={view} onChangeView={setView} cartCount={cartCount} />
          )}
      </View>
    </SafeAreaView>
  );
}

// --- App Wrapper with AuthProvider ---

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
