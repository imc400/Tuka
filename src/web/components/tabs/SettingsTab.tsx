/**
 * Settings Tab Component
 *
 * Permite editar la configuración de la tienda
 */

import React, { useState } from 'react';
import { Settings, Save, Loader2, CheckCircle, AlertCircle, Key, Palette, Image } from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface SettingsTabProps {
  store: Store;
  onStoreUpdated: () => void;
}

export default function SettingsTab({ store, onStoreUpdated }: SettingsTabProps) {
  const [formData, setFormData] = useState({
    storeName: store.store_name || '',
    description: store.description || '',
    logoUrl: store.logo_url || '',
    bannerUrl: store.banner_url || '',
    themeColor: store.theme_color || '#000000',
    storefrontToken: '',
    adminToken: '',
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    setResult(null);

    try {
      const updateData: any = {
        store_name: formData.storeName,
        description: formData.description,
        logo_url: formData.logoUrl,
        banner_url: formData.bannerUrl,
        theme_color: formData.themeColor,
      };

      // Solo actualizar tokens si se proporcionaron nuevos
      if (formData.storefrontToken) {
        updateData.access_token = formData.storefrontToken;
      }
      if (formData.adminToken) {
        updateData.admin_api_token = formData.adminToken;
      }

      const { error } = await supabase
        .from('stores')
        .update(updateData)
        .eq('id', store.id);

      if (error) throw error;

      setResult({
        type: 'success',
        message: 'Configuración guardada correctamente',
      });

      // Limpiar tokens del formulario
      setFormData((prev) => ({
        ...prev,
        storefrontToken: '',
        adminToken: '',
      }));

      // Notificar al componente padre
      onStoreUpdated();
    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.message || 'Error al guardar',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-gray-600" />
          Configuración de la Tienda
        </h3>
      </div>

      {/* Result Message */}
      {result && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            result.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.type === 'success' ? (
            <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          ) : (
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          )}
          <p
            className={`text-sm ${
              result.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {result.message}
          </p>
        </div>
      )}

      {/* Form Sections */}
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Palette size={18} className="text-gray-600" />
            Información Básica
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Dominio Shopify
              </label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm bg-gray-100 cursor-not-allowed"
                value={store.domain}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">El dominio no se puede cambiar</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Nombre de la Tienda
              </label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder="Ej: Mi Tienda Online"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
                rows={3}
                placeholder="Descripción corta de la tienda..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Color del Tema
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  className="h-12 w-12 rounded cursor-pointer border-2 border-gray-300 p-1"
                  value={formData.themeColor}
                  onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                />
                <input
                  type="text"
                  className="flex-1 p-3 border-2 border-gray-300 rounded-lg text-sm font-mono"
                  value={formData.themeColor}
                  onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Image size={18} className="text-gray-600" />
            Imágenes
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                URL del Logo (Circular)
              </label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder="https://ejemplo.com/logo.png"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Dimensiones recomendadas: <strong>512x512 px</strong> (cuadrado, se mostrará circular). Formato: PNG o JPG. Máximo 1MB.
              </p>
              {formData.logoUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                    }}
                  />
                  <span className="text-sm text-gray-500">Vista previa del logo</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                URL del Banner
              </label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder="https://ejemplo.com/banner.jpg"
                value={formData.bannerUrl}
                onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Dimensiones recomendadas: <strong>1200x400 px</strong> (ratio 3:1). Formato: JPG o PNG. Máximo 2MB.
              </p>
              {formData.bannerUrl && (
                <div className="mt-3">
                  <img
                    src={formData.bannerUrl}
                    alt="Banner preview"
                    className="w-full max-w-md h-32 rounded-lg object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                    }}
                  />
                  <span className="text-sm text-gray-500 mt-1 block">Vista previa del banner</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API Tokens */}
        <div className="bg-white border-2 border-amber-200 rounded-xl p-6">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Key size={18} className="text-amber-600" />
            Tokens de API
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Storefront API Token
              </label>
              <input
                type="password"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="Dejar vacío para mantener el actual"
                value={formData.storefrontToken}
                onChange={(e) => setFormData({ ...formData, storefrontToken: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Token actual:{' '}
                {store.access_token ? (
                  <span className="text-green-600">Configurado</span>
                ) : (
                  <span className="text-red-600">No configurado</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Admin API Token
              </label>
              <input
                type="password"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="Dejar vacío para mantener el actual"
                value={formData.adminToken}
                onChange={(e) => setFormData({ ...formData, adminToken: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Token actual:{' '}
                {store.admin_api_token ? (
                  <span className="text-green-600">Configurado</span>
                ) : (
                  <span className="text-amber-600">No configurado</span>
                )}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <strong>Importante:</strong> Los tokens solo se actualizan si proporcionas un
                nuevo valor. Dejar vacío mantiene el token actual.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-grumo-dark hover:bg-black disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save size={20} />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}
