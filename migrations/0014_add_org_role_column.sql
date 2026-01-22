-- Add org_role column to org_memberships table
-- The table was created with "role" but the schema expects "org_role"

-- Add the new org_role column
ALTER TABLE org_memberships ADD COLUMN IF NOT EXISTS org_role VARCHAR(50) NOT NULL DEFAULT 'MEMBER';

-- Copy data from role to org_role if role column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'org_memberships' AND column_name = 'role') THEN
    UPDATE org_memberships SET org_role = role WHERE org_role IS NULL OR org_role = '';
  END IF;
END $$;

-- Add invited_by and is_active columns if they don't exist
ALTER TABLE org_memberships ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255) REFERENCES users(id);
ALTER TABLE org_memberships ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index on org_role
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_role ON org_memberships(org_role);
