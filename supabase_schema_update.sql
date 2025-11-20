-- Update existing table with new columns
alter table stores 
add column if not exists store_name text,
add column if not exists description text,
add column if not exists logo_url text,
add column if not exists theme_color text default '#000000';

-- Update the policy to ensure public read access is still valid (it should be, but good to verify)
-- (Existing policies are fine)

