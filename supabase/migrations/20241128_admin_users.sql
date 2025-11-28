-- =====================================================
-- Migration: Admin Users for Dashboard Access Control
-- Creates admin_users table for managing dashboard access
-- Super Admin: hola@grumo.app
-- Store Owners: Assigned by Super Admin
-- =====================================================

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'store_owner',
  -- Roles: 'super_admin', 'store_owner'
  is_active BOOLEAN DEFAULT false,
  -- false = pending approval, true = approved
  assigned_stores TEXT[] DEFAULT '{}',
  -- Array of store domains this user can access
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own record
CREATE POLICY "Users can read own admin record"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Super admins can read all records
CREATE POLICY "Super admins can read all admin records"
  ON admin_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

-- Policy: Super admins can insert records
CREATE POLICY "Super admins can insert admin records"
  ON admin_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
    OR NOT EXISTS (SELECT 1 FROM admin_users) -- Allow first insert
  );

-- Policy: Super admins can update records
CREATE POLICY "Super admins can update admin records"
  ON admin_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

-- Policy: Super admins can delete records
CREATE POLICY "Super admins can delete admin records"
  ON admin_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

-- Policy: Anyone can insert their own pending record (for signup)
CREATE POLICY "Anyone can create pending admin record"
  ON admin_users FOR INSERT
  WITH CHECK (
    is_active = false
    AND role = 'store_owner'
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- =====================================================
-- Insert Super Admin (hola@grumo.app)
-- Note: This will be linked when the user signs up
-- =====================================================

-- We'll create a placeholder that gets updated when the user registers
-- For now, create the super admin entry without user_id
INSERT INTO admin_users (email, full_name, role, is_active, assigned_stores)
VALUES ('hola@grumo.app', 'Super Admin', 'super_admin', true, '{}')
ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  is_active = true;

-- =====================================================
-- Function to auto-link user_id when super admin signs up
-- =====================================================

CREATE OR REPLACE FUNCTION link_admin_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this email exists in admin_users without a user_id
  UPDATE admin_users
  SET user_id = NEW.id
  WHERE email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS trigger_link_admin_user ON auth.users;
CREATE TRIGGER trigger_link_admin_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_admin_user_on_signup();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE admin_users IS 'Dashboard access control for Grumo admin panel';
COMMENT ON COLUMN admin_users.role IS 'User role: super_admin (full access) or store_owner (assigned stores only)';
COMMENT ON COLUMN admin_users.is_active IS 'Whether the user has been approved for dashboard access';
COMMENT ON COLUMN admin_users.assigned_stores IS 'Array of store domains this user can manage';
