import { supabase } from '../lib/supabase';
import { UserAddress } from '../types';

/**
 * Servicio para gestionar direcciones de envío del usuario
 */

export interface CreateAddressInput {
  label: string; // Ej: "Casa Nacho", "Oficina", "Casa Cami"
  recipientName: string;
  street: string;
  streetNumber?: string;
  apartment?: string;
  city: string;
  region: string;
  zipCode?: string;
  phone: string;
  instructions?: string;
}

/**
 * Obtener todas las direcciones del usuario
 */
export async function getUserAddresses(userId: string): Promise<{ addresses: UserAddress[]; error?: string }> {
  try {
    console.log('[AddressService] getUserAddresses - Starting for user:', userId);
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    console.log('[AddressService] getUserAddresses - Result:', { count: data?.length || 0, error });

    if (error) {
      console.error('[AddressService] Error fetching addresses:', error);
      return { addresses: [], error: error.message };
    }

    return { addresses: data || [] };
  } catch (error) {
    console.error('[AddressService] Exception fetching addresses:', error);
    return { addresses: [], error: 'Error al cargar direcciones' };
  }
}

/**
 * Obtener la dirección por defecto del usuario
 */
export async function getDefaultAddress(userId: string): Promise<{ address: UserAddress | null; error?: string }> {
  try {
    console.log('[AddressService] getDefaultAddress - Starting for user:', userId);
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    console.log('[AddressService] getDefaultAddress - Result:', { hasData: !!data, error: error?.code });

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('[AddressService] Error fetching default address:', error);
      return { address: null, error: error.message };
    }

    return { address: data };
  } catch (error) {
    console.error('[AddressService] Exception fetching default address:', error);
    return { address: null, error: 'Error al cargar dirección por defecto' };
  }
}

/**
 * Crear una nueva dirección
 */
export async function createAddress(
  userId: string,
  addressData: CreateAddressInput,
  isDefault: boolean = false
): Promise<{ address: UserAddress | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: userId,
        label: addressData.label,
        recipient_name: addressData.recipientName,
        street: addressData.street,
        street_number: addressData.streetNumber || null,
        apartment: addressData.apartment || null,
        city: addressData.city,
        region: addressData.region,
        zip_code: addressData.zipCode || null,
        phone: addressData.phone,
        instructions: addressData.instructions || null,
        is_default: isDefault,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[AddressService] Error creating address:', error);
      return { address: null, error: error.message };
    }

    return { address: data };
  } catch (error) {
    console.error('[AddressService] Exception creating address:', error);
    return { address: null, error: 'Error al guardar dirección' };
  }
}

/**
 * Actualizar una dirección existente
 */
export async function updateAddress(
  addressId: number,
  addressData: Partial<CreateAddressInput>
): Promise<{ address: UserAddress | null; error?: string }> {
  try {
    const updateData: any = {};

    if (addressData.label) updateData.label = addressData.label;
    if (addressData.recipientName) updateData.recipient_name = addressData.recipientName;
    if (addressData.street) updateData.street = addressData.street;
    if (addressData.streetNumber !== undefined) updateData.street_number = addressData.streetNumber;
    if (addressData.apartment !== undefined) updateData.apartment = addressData.apartment;
    if (addressData.city) updateData.city = addressData.city;
    if (addressData.region) updateData.region = addressData.region;
    if (addressData.zipCode !== undefined) updateData.zip_code = addressData.zipCode;
    if (addressData.phone) updateData.phone = addressData.phone;
    if (addressData.instructions !== undefined) updateData.instructions = addressData.instructions;

    const { data, error } = await supabase
      .from('user_addresses')
      .update(updateData)
      .eq('id', addressId)
      .select()
      .single();

    if (error) {
      console.error('[AddressService] Error updating address:', error);
      return { address: null, error: error.message };
    }

    return { address: data };
  } catch (error) {
    console.error('[AddressService] Exception updating address:', error);
    return { address: null, error: 'Error al actualizar dirección' };
  }
}

/**
 * Establecer una dirección como por defecto
 */
export async function setDefaultAddress(
  userId: string,
  addressId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[AddressService] setDefaultAddress - Setting address', addressId, 'as default for user', userId);

    // Paso 1: Desmarcar todas las direcciones del usuario como no-default
    const { error: unsetError } = await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (unsetError) {
      console.error('[AddressService] Error unsetting previous default:', unsetError);
      return { success: false, error: unsetError.message };
    }

    // Paso 2: Marcar la nueva dirección como default
    const { error: setError } = await supabase
      .from('user_addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('user_id', userId);

    if (setError) {
      console.error('[AddressService] Error setting new default address:', setError);
      return { success: false, error: setError.message };
    }

    console.log('[AddressService] setDefaultAddress - Successfully set address', addressId, 'as default');
    return { success: true };
  } catch (error) {
    console.error('[AddressService] Exception setting default address:', error);
    return { success: false, error: 'Error al establecer dirección por defecto' };
  }
}

/**
 * Eliminar una dirección
 */
export async function deleteAddress(addressId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', addressId);

    if (error) {
      console.error('[AddressService] Error deleting address:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[AddressService] Exception deleting address:', error);
    return { success: false, error: 'Error al eliminar dirección' };
  }
}

/**
 * Guardar dirección del checkout como dirección guardada
 * (Si no existe ya una dirección con los mismos datos)
 */
export async function saveCheckoutAddress(
  userId: string,
  addressData: CreateAddressInput
): Promise<{ address: UserAddress | null; error?: string }> {
  try {
    // Verificar si el usuario ya tiene direcciones
    const { addresses } = await getUserAddresses(userId);

    // Si no tiene direcciones, esta será la primera y la ponemos por defecto
    const isFirst = addresses.length === 0;

    // Verificar si ya existe una dirección igual
    const existingAddress = addresses.find(
      (addr) =>
        addr.street === addressData.street &&
        addr.street_number === addressData.streetNumber &&
        addr.city === addressData.city &&
        addr.region === addressData.region
    );

    if (existingAddress) {
      console.log('[AddressService] Address already exists, not creating duplicate');
      return { address: existingAddress };
    }

    // Crear nueva dirección
    return await createAddress(userId, addressData, isFirst);
  } catch (error) {
    console.error('[AddressService] Exception saving checkout address:', error);
    return { address: null, error: 'Error al guardar dirección' };
  }
}
