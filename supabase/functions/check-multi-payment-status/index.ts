/**
 * Edge Function: check-multi-payment-status
 *
 * Verifica el estado de todos los pagos de una transacción multi-payment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const transactionId = parseInt(url.searchParams.get('transaction_id') || '');

    if (!transactionId) {
      throw new Error('transaction_id is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener la transacción
    const { data: transaction, error: txError } = await supabaseClient
      .from('transactions')
      .select('status, total_payments, completed_payments, failed_payments, payment_mode')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Obtener pagos por tienda
    const { data: payments, error: paymentsError } = await supabaseClient
      .from('store_payments_v2')
      .select('store_domain, status, gross_amount, net_to_store, mp_payment_id, paid_at')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });

    if (paymentsError) {
      throw new Error(`Error fetching payments: ${paymentsError.message}`);
    }

    const stores = (payments || []).map(p => ({
      domain: p.store_domain,
      status: p.status,
      amount: p.gross_amount,
      netToStore: p.net_to_store,
      mpPaymentId: p.mp_payment_id,
      paidAt: p.paid_at,
    }));

    return new Response(
      JSON.stringify({
        status: transaction.status as 'pending' | 'approved' | 'partial' | 'rejected',
        paymentMode: transaction.payment_mode,
        completedPayments: transaction.completed_payments || 0,
        totalPayments: transaction.total_payments || stores.length,
        failedPayments: transaction.failed_payments || 0,
        stores,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
