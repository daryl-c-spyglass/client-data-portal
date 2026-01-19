-- Seed script to set initial super admin roles
-- Run with: psql $DATABASE_URL -f scripts/seed-super-admins.sql

-- Update hardcoded super admin emails to have super_admin role
UPDATE users SET role = 'super_admin' WHERE email IN (
  'ryan@spyglassrealty.com',
  'daryl@spyglassrealty.com',
  'caleb@spyglassrealty.com'
);

-- Show results
SELECT id, email, role, "firstName", "lastName", "createdAt" 
FROM users 
WHERE role = 'super_admin' 
ORDER BY email;
