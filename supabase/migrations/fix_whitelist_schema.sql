-- Add org_id column to whitelisted_numbers linked to organizations
ALTER TABLE public.whitelisted_numbers 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Enable RLS
ALTER TABLE public.whitelisted_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow organization owners to manage their whitelist
-- We check if the current user's email matches the owner_email of the organization linked to the whitelist entry

-- SELECT (View)
create policy "Owners can view their organization's whitelist"
on public.whitelisted_numbers for select
using (
  exists (
    select 1 from organizations 
    where organizations.id = whitelisted_numbers.org_id 
    and organizations.owner_email = (auth.jwt() ->> 'email')
  )
);

-- INSERT (Add)
create policy "Owners can add numbers to their organization"
on public.whitelisted_numbers for insert
with check (
  exists (
    select 1 from organizations 
    where organizations.id = whitelisted_numbers.org_id 
    and organizations.owner_email = (auth.jwt() ->> 'email')
  )
);

-- DELETE (Remove)
create policy "Owners can delete numbers from their organization"
on public.whitelisted_numbers for delete
using (
  exists (
    select 1 from organizations 
    where organizations.id = whitelisted_numbers.org_id 
    and organizations.owner_email = (auth.jwt() ->> 'email')
  )
);
