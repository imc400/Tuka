/**
 * Script para ejecutar la migración de get_store_subscribers_with_email
 * Usa la service role key para poder acceder a auth.users
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('EXPO_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.error('\nPlease add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  console.error('You can find it in Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running subscribers migration...\n');

  const sql = `
    -- Drop existing function if it exists
    DROP FUNCTION IF EXISTS public.get_store_subscribers_with_email(TEXT);

    -- Create the function
    CREATE OR REPLACE FUNCTION public.get_store_subscribers_with_email(
      p_store_domain TEXT
    )
    RETURNS TABLE (
      subscription_id BIGINT,
      user_id UUID,
      subscribed_at TIMESTAMP WITH TIME ZONE,
      full_name TEXT,
      avatar_url TEXT,
      email TEXT,
      platform TEXT,
      push_token_active BOOLEAN
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        ss.id AS subscription_id,
        ss.user_id,
        ss.subscribed_at,
        up.full_name,
        up.avatar_url,
        au.email,
        upt.platform,
        COALESCE(upt.is_active, false) AS push_token_active
      FROM public.store_subscriptions ss
      LEFT JOIN public.user_profiles up ON up.id = ss.user_id
      LEFT JOIN auth.users au ON au.id = ss.user_id
      LEFT JOIN LATERAL (
        SELECT platform, is_active
        FROM public.user_push_tokens
        WHERE user_id = ss.user_id AND is_active = true
        ORDER BY last_used_at DESC NULLS LAST
        LIMIT 1
      ) upt ON true
      WHERE ss.store_domain = p_store_domain
        AND ss.unsubscribed_at IS NULL
      ORDER BY ss.subscribed_at DESC;
    END;
    $$;

    -- Grant execute to authenticated users
    GRANT EXECUTE ON FUNCTION public.get_store_subscribers_with_email(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_store_subscribers_with_email(TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.get_store_subscribers_with_email(TEXT) TO anon;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct SQL execution via PostgreSQL functions
      console.log('RPC not available, trying direct approach...');

      // Try to execute statements one by one using supabase-js
      const statements = sql.split(';').filter(s => s.trim());

      for (const stmt of statements) {
        if (stmt.trim()) {
          const { error: stmtError } = await supabase.from('_migrations').select('*').limit(0);
          // This won't work - we need to use the Supabase Dashboard SQL editor
          console.log('Statement:', stmt.substring(0, 50) + '...');
        }
      }

      console.error('❌ Cannot execute raw SQL from client.');
      console.error('\n📋 Please run this SQL in Supabase Dashboard > SQL Editor:\n');
      console.log('================== COPY FROM HERE ==================');
      console.log(sql);
      console.log('================== COPY TO HERE ====================');
      return;
    }

    console.log('✅ Migration completed successfully!');

    // Test the function
    const { data: testData, error: testError } = await supabase
      .rpc('get_store_subscribers_with_email', { p_store_domain: 'grumo-coffee.myshopify.com' });

    if (testError) {
      console.log('\n⚠️  Function test failed:', testError.message);
    } else {
      console.log('\n✅ Function test successful!');
      console.log('Subscribers found:', testData?.length || 0);
      if (testData?.length > 0) {
        console.log('Sample:', JSON.stringify(testData[0], null, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\n📋 Please run the SQL manually in Supabase Dashboard > SQL Editor');
  }
}

runMigration();
