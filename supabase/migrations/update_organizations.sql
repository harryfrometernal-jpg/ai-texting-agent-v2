-- Add ghl_webhook_url column if it doesn't exist
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ghl_webhook_url TEXT;

-- Ensure RLS allows updates to organizations
-- (This policy enables ALL updates for demo purposes. For stricter security, checks against owner_email or auth.uid() should be added)
CREATE POLICY "Allow update for all users" ON public.organizations
FOR UPDATE USING (true) WITH CHECK (true);

-- If policy already exists, the above might fail, so we can try to drop receiving it first or rely on the user manually handling conflicts.
-- Safer simpler approach for user copy-paste:

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Enable update for users based on email'
    ) THEN
        CREATE POLICY "Enable update for users based on email" ON public.organizations
        FOR UPDATE
        USING (auth.jwt() ->> 'email' = owner_email)
        WITH CHECK (auth.jwt() ->> 'email' = owner_email);
    END IF;
END $$;

-- Fallback for demo: Allow anyone to update if no owner_email match (be careful in production)
-- CREATE POLICY "Allow public update" ON public.organizations FOR UPDATE USING (true);
