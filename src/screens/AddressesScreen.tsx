import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, Plus, Trash2, Star, MapPin } from 'lucide-react-native';
import { UserAddress } from '../types';
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  CreateAddressInput,
} from '../services/addressService';
import { CHILEAN_REGIONS, getComunasByRegion } from '../data/chileanRegions';
import { Picker } from '@react-native-picker/picker';

interface AddressesScreenProps {
  userId: string;
  onBack: () => void;
}

const AddressesScreen: React.FC<AddressesScreenProps> = ({ userId, onBack }) => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Form fields
  const [label, setLabel] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [instructions, setInstructions] = useState('');

  // Pickers
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showComunaPicker, setShowComunaPicker] = useState(false);
  const [tempRegion, setTempRegion] = useState('');
  const [tempComuna, setTempComuna] = useState('');

  const availableComunas = region ? getComunasByRegion(region) : [];

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    console.log('[AddressesScreen] loadAddresses - Starting for user:', userId);
    setLoading(true);
    try {
      const { addresses: userAddresses, error } = await getUserAddresses(userId);
      console.log('[AddressesScreen] loadAddresses - Result:', { count: userAddresses.length, error });
      if (error) {
        Alert.alert('Error', 'No se pudieron cargar las direcciones');
      } else {
        setAddresses(userAddresses);
      }
    } catch (err) {
      console.error('[AddressesScreen] loadAddresses - Exception:', err);
      Alert.alert('Error', 'Error inesperado al cargar direcciones');
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setCity(''); // Reset city when region changes
  };

  const openAddModal = () => {
    // Reset form
    setLabel('');
    setRecipientName('');
    setStreet('');
    setStreetNumber('');
    setApartment('');
    setCity('');
    setRegion('');
    setZipCode('');
    setPhone('');
    setInstructions('');
    setEditingAddress(null);
    setShowAddModal(true);
  };

  const openEditModal = (addr: UserAddress) => {
    setLabel(addr.label);
    setRecipientName(addr.recipient_name || '');
    setStreet(addr.street);
    setStreetNumber(addr.street_number || '');
    setApartment(addr.apartment || '');
    setCity(addr.city);
    setRegion(addr.region);
    setZipCode(addr.zip_code || '');
    setPhone(addr.phone || '');
    setInstructions(addr.instructions || '');
    setEditingAddress(addr);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    // Validación básica
    if (!label || !recipientName || !street || !city || !region || !phone) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const addressData: CreateAddressInput = {
      label,
      recipientName,
      street,
      streetNumber: streetNumber || undefined,
      apartment: apartment || undefined,
      city,
      region,
      zipCode: zipCode || undefined,
      phone,
      instructions: instructions || undefined,
    };

    if (editingAddress) {
      // Actualizar dirección existente
      const { error } = await updateAddress(editingAddress.id, addressData);
      if (error) {
        Alert.alert('Error', 'No se pudo actualizar la dirección');
      } else {
        setShowAddModal(false);
        loadAddresses();
      }
    } else {
      // Crear nueva dirección
      const isFirstAddress = addresses.length === 0;
      const { error } = await createAddress(userId, addressData, isFirstAddress);
      if (error) {
        Alert.alert('Error', 'No se pudo guardar la dirección');
      } else {
        setShowAddModal(false);
        loadAddresses();
      }
    }
  };

  const handleSetDefault = async (addressId: number) => {
    const { error } = await setDefaultAddress(userId, addressId);
    if (error) {
      Alert.alert('Error', 'No se pudo establecer como dirección por defecto');
    } else {
      loadAddresses();
    }
  };

  const handleDelete = async (addressId: number) => {
    Alert.alert(
      'Eliminar Dirección',
      '¿Estás seguro que deseas eliminar esta dirección?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteAddress(addressId);
            if (error) {
              Alert.alert('Error', 'No se pudo eliminar la dirección');
            } else {
              loadAddresses();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#9333EA" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold flex-1">Mis Direcciones</Text>
        <TouchableOpacity onPress={openAddModal} className="bg-purple-600 p-2 rounded-lg">
          <Plus size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Addresses List */}
      <ScrollView className="flex-1 p-4">
        {addresses.length === 0 ? (
          <View className="bg-white p-8 rounded-xl items-center">
            <MapPin size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 mb-2">
              No tienes direcciones guardadas
            </Text>
            <Text className="text-gray-400 text-sm text-center mb-6">
              Agrega una dirección para que tus compras sean más rápidas
            </Text>
            <TouchableOpacity
              onPress={openAddModal}
              className="bg-purple-600 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold">Agregar Dirección</Text>
            </TouchableOpacity>
          </View>
        ) : (
          addresses.map((addr) => (
            <View
              key={addr.id}
              className={`bg-white p-4 rounded-xl mb-3 ${
                addr.is_default ? 'border-2 border-purple-600' : 'border border-gray-200'
              }`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="font-bold text-gray-900">{addr.label}</Text>
                    {addr.is_default && (
                      <View className="bg-purple-100 px-2 py-0.5 rounded">
                        <Text className="text-purple-600 text-xs font-semibold">Por defecto</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-gray-600 text-sm">{addr.recipient_name}</Text>
                  <Text className="text-gray-600 text-sm">
                    {addr.street}
                    {addr.street_number ? ` ${addr.street_number}` : ''}
                    {addr.apartment ? `, ${addr.apartment}` : ''}
                  </Text>
                  <Text className="text-gray-600 text-sm">
                    {addr.city}, {addr.region}
                  </Text>
                  {addr.zip_code && (
                    <Text className="text-gray-600 text-sm">CP: {addr.zip_code}</Text>
                  )}
                  <Text className="text-gray-600 text-sm mt-1">{addr.phone}</Text>
                  {addr.instructions && (
                    <Text className="text-gray-500 text-xs mt-1 italic">
                      Instrucciones: {addr.instructions}
                    </Text>
                  )}
                </View>
              </View>

              <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
                {!addr.is_default && (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(addr.id)}
                    className="flex-1 bg-gray-100 py-2 rounded-lg flex-row items-center justify-center gap-1"
                  >
                    <Star size={16} color="#9333EA" />
                    <Text className="text-purple-600 font-medium text-sm">Por Defecto</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => openEditModal(addr)}
                  className="flex-1 bg-purple-600 py-2 rounded-lg"
                >
                  <Text className="text-white font-medium text-center text-sm">Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(addr.id)}
                  className="bg-red-100 px-3 py-2 rounded-lg"
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          {/* Modal Header */}
          <View className="bg-white px-4 py-4 flex-row items-center border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowAddModal(false)} className="mr-3">
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold flex-1">
              {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
            </Text>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="bg-white p-4 rounded-xl gap-3">
              <TextInput
                placeholder="Nombre de dirección (ej: Casa Nacho) *"
                value={label}
                onChangeText={setLabel}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Nombre del destinatario *"
                value={recipientName}
                onChangeText={setRecipientName}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Calle *"
                value={street}
                onChangeText={setStreet}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <View className="flex-row gap-3">
                <TextInput
                  placeholder="Número"
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-1"
                />
                <TextInput
                  placeholder="Depto/Oficina"
                  value={apartment}
                  onChangeText={setApartment}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-1"
                />
              </View>

              {/* Región Selector */}
              <TouchableOpacity
                onPress={() => {
                  setTempRegion(region);
                  setShowRegionPicker(true);
                }}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <Text className={region ? 'text-gray-900' : 'text-gray-400'}>
                  {region
                    ? CHILEAN_REGIONS.find((r) => r.code === region)?.name
                    : 'Región *'}
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
                className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${
                  availableComunas.length === 0 ? 'opacity-50' : ''
                }`}
                disabled={availableComunas.length === 0}
              >
                <Text className={city ? 'text-gray-900' : 'text-gray-400'}>
                  {city || 'Comuna *'}
                </Text>
              </TouchableOpacity>

              <TextInput
                placeholder="Código Postal (opcional)"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Teléfono *"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
              <TextInput
                placeholder="Instrucciones de entrega (opcional)"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              className="bg-purple-600 py-4 rounded-xl mt-4"
            >
              <Text className="text-white font-bold text-center">
                {editingAddress ? 'Actualizar' : 'Guardar Dirección'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Región Picker Modal */}
        <Modal
          visible={showRegionPicker}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl">
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowRegionPicker(false)}>
                  <Text className="text-purple-600 text-base">Cancelar</Text>
                </TouchableOpacity>
                <Text className="font-semibold text-base">Selecciona Región</Text>
                <TouchableOpacity
                  onPress={() => {
                    handleRegionChange(tempRegion);
                    setShowRegionPicker(false);
                  }}
                >
                  <Text className="text-purple-600 text-base font-semibold">Listo</Text>
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

        {/* Comuna Picker Modal */}
        <Modal
          visible={showComunaPicker}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl">
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowComunaPicker(false)}>
                  <Text className="text-purple-600 text-base">Cancelar</Text>
                </TouchableOpacity>
                <Text className="font-semibold text-base">Selecciona Comuna</Text>
                <TouchableOpacity
                  onPress={() => {
                    setCity(tempComuna);
                    setShowComunaPicker(false);
                  }}
                >
                  <Text className="text-purple-600 text-base font-semibold">Listo</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={tempComuna}
                onValueChange={setTempComuna}
                style={{ height: 200 }}
              >
                <Picker.Item label="Selecciona una comuna" value="" />
                {availableComunas.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
};

export default AddressesScreen;
