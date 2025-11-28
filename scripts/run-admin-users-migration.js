/**
 * Run admin_users migration directly via Supabase client
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
// Use service role key for admin operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.log('Note: Running with anon key. Some operations may fail.');
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk'
);

async function runMigration() {
  console.log('Creating admin_users table...');

  // Check if table exists
  const { data: existingTable, error: checkError } = await supabase
    .from('admin_users')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('Table admin_users already exists. Checking for super admin...');

    // Check if super admin exists
    const { data: superAdmin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', 'hola@grumo.app')
      .single();

    if (superAdmin) {
      console.log('Super admin already exists:', superAdmin.email);
      console.log('Role:', superAdmin.role);
      console.log('Active:', superAdmin.is_active);
      return;
    }
  }

  // Insert super admin
  console.log('Inserting super admin (hola@grumo.app)...');

  const { data, error } = await supabase
    .from('admin_users')
    .upsert({
      email: 'hola@grumo.app',
      full_name: 'Super Admin',
      role: 'super_admin',
      is_active: true,
      assigned_stores: []
    }, {
      onConflict: 'email'
    })
    .select();

  if (error) {
    console.error('Error inserting super admin:', error);
    console.log('\nPlease run the SQL migration manually in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/sql/new');
    console.log('\nSQL to run:');
    console.log(`
-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'store_owner',
  is_active BOOLEAN DEFAULT false,
  assigned_stores TEXT[] DEFAULT '{}',
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read admin_users (simplified for now)
CREATE POLICY "Enable read access for all users" ON admin_users FOR SELECT USING (true);

-- Policy: Anyone can insert pending records
CREATE POLICY "Enable insert for signup" ON admin_users FOR INSERT WITH CHECK (true);

-- Policy: Super admins can update
CREATE POLICY "Enable update for super admins" ON admin_users FOR UPDATE USING (true);

-- Insert super admin
INSERT INTO admin_users (email, full_name, role, is_active, assigned_stores)
VALUES ('hola@grumo.app', 'Super Admin', 'super_admin', true, '{}')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', is_active = true;
    `);
  } else {
    console.log('Super admin created successfully!');
    console.log(data);
  }
}

runMigration();
