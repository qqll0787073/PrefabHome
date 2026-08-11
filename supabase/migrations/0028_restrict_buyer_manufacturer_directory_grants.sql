-- Establish the intended authenticated-only, read-only directory contract.
revoke all privileges
on table public.buyer_manufacturer_directory
from public;

revoke all privileges
on table public.buyer_manufacturer_directory
from anon;

revoke all privileges
on table public.buyer_manufacturer_directory
from authenticated;

grant select
on table public.buyer_manufacturer_directory
to authenticated;
