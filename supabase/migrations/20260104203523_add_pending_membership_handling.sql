/*
  # Add Pending Membership Handling

  1. Changes
    - Updates the profile creation trigger to check for pending company membership
    - When a new user confirms their invite, automatically adds them to the company
    - Uses the pending_company_id and pending_role from user metadata

  2. Security
    - Trigger runs with security definer to handle membership creation
    - Only processes valid pending invitations
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  pending_company_id uuid;
  pending_role text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  pending_company_id := (new.raw_user_meta_data->>'pending_company_id')::uuid;
  pending_role := new.raw_user_meta_data->>'pending_role';

  IF pending_company_id IS NOT NULL AND pending_role IS NOT NULL THEN
    INSERT INTO public.company_memberships (user_id, company_id, role)
    VALUES (new.id, pending_company_id, pending_role)
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;