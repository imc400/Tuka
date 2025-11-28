/**
 * Users Management Tab - Super Admin Dashboard
 *
 * Gestión de usuarios del dashboard:
 * - Ver usuarios pendientes de aprobación
 * - Aprobar/rechazar acceso
 * - Asignar tiendas a store owners
 * - Desactivar usuarios
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Store,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  Loader2,
  RefreshCw,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../../lib/supabaseWeb';
import type { Store as StoreType } from '../../../types';
import type { AdminUser } from '../../../context/WebAuthContext';

interface UsersManagementTabProps {
  stores: StoreType[];
}

export default function UsersManagementTab({ stores }: UsersManagementTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('all');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveUser(user: AdminUser) {
    setActionLoading(user.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: true })
        .eq('id', user.id);

      if (error) throw error;
      await loadUsers();
    } catch (err) {
      console.error('Error approving user:', err);
      alert('Error al aprobar usuario');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectUser(user: AdminUser) {
    if (!confirm(`¿Estás seguro de rechazar a ${user.full_name || user.email}?`)) return;

    setActionLoading(user.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
      await loadUsers();
    } catch (err) {
      console.error('Error rejecting user:', err);
      alert('Error al rechazar usuario');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivateUser(user: AdminUser) {
    if (!confirm(`¿Estás seguro de desactivar a ${user.full_name || user.email}?`)) return;

    setActionLoading(user.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: false })
        .eq('id', user.id);

      if (error) throw error;
      await loadUsers();
    } catch (err) {
      console.error('Error deactivating user:', err);
      alert('Error al desactivar usuario');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveStoreAssignments() {
    if (!editingUser) return;

    setActionLoading(editingUser.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ assigned_stores: selectedStores })
        .eq('id', editingUser.id);

      if (error) throw error;

      setEditingUser(null);
      setSelectedStores([]);
      await loadUsers();
    } catch (err) {
      console.error('Error saving store assignments:', err);
      alert('Error al guardar asignaciones');
    } finally {
      setActionLoading(null);
    }
  }

  function openEditStores(user: AdminUser) {
    setEditingUser(user);
    setSelectedStores(user.assigned_stores || []);
  }

  function toggleStore(domain: string) {
    setSelectedStores((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    // Search filter
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesFilter = true;
    if (filter === 'pending') matchesFilter = !user.is_active && user.role !== 'super_admin';
    if (filter === 'active') matchesFilter = user.is_active;
    if (filter === 'inactive') matchesFilter = !user.is_active && user.role !== 'super_admin';

    return matchesSearch && matchesFilter;
  });

  const pendingCount = users.filter((u) => !u.is_active && u.role !== 'super_admin').length;
  const activeCount = users.filter((u) => u.is_active).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500">
            {activeCount} activos · {pendingCount} pendientes
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              {pendingCount} usuario{pendingCount !== 1 ? 's' : ''} esperando aprobación
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Revisa las solicitudes pendientes y aprueba o rechaza el acceso.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' && 'Todos'}
              {f === 'pending' && `Pendientes (${pendingCount})`}
              {f === 'active' && 'Activos'}
              {f === 'inactive' && 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Sin usuarios</h4>
            <p className="text-gray-500">No se encontraron usuarios con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  !user.is_active && user.role !== 'super_admin' ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                        user.role === 'super_admin'
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                          : user.is_active
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    >
                      {user.role === 'super_admin' ? (
                        <Shield size={20} />
                      ) : (
                        (user.full_name || user.email).substring(0, 2).toUpperCase()
                      )}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {user.full_name || 'Sin nombre'}
                        </p>
                        {user.role === 'super_admin' && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            Super Admin
                          </span>
                        )}
                        {!user.is_active && user.role !== 'super_admin' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            Pendiente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail size={14} />
                        {user.email}
                      </p>
                      {user.assigned_stores && user.assigned_stores.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Store size={12} className="text-gray-400" />
                          <p className="text-xs text-gray-500">
                            {user.assigned_stores.length} tienda{user.assigned_stores.length !== 1 ? 's' : ''} asignada{user.assigned_stores.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Pending user actions */}
                    {!user.is_active && user.role !== 'super_admin' && (
                      <>
                        <button
                          onClick={() => handleApproveUser(user)}
                          disabled={actionLoading === user.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === user.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <UserCheck size={14} />
                          )}
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectUser(user)}
                          disabled={actionLoading === user.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          <UserX size={14} />
                          Rechazar
                        </button>
                      </>
                    )}

                    {/* Active user actions */}
                    {user.is_active && user.role !== 'super_admin' && (
                      <>
                        <button
                          onClick={() => openEditStores(user)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                        >
                          <Store size={14} />
                          Asignar tiendas
                        </button>
                        <button
                          onClick={() => handleDeactivateUser(user)}
                          disabled={actionLoading === user.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          <UserX size={14} />
                          Desactivar
                        </button>
                      </>
                    )}

                    {/* Last login info */}
                    {user.last_login_at && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(user.last_login_at).toLocaleDateString('es-CL')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store Assignment Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Asignar tiendas a {editingUser.full_name || editingUser.email}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Selecciona las tiendas que este usuario podrá administrar.
              </p>
            </div>

            <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
              {stores.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay tiendas registradas</p>
              ) : (
                stores.map((store) => (
                  <label
                    key={store.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedStores.includes(store.domain)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStores.includes(store.domain)}
                      onChange={() => toggleStore(store.domain)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {store.store_name || store.domain}
                      </p>
                      <p className="text-xs text-gray-500">{store.domain}</p>
                    </div>
                    {store.logo_url && (
                      <img
                        src={store.logo_url}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    )}
                  </label>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setSelectedStores([]);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStoreAssignments}
                disabled={actionLoading === editingUser.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === editingUser.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle size={18} />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
