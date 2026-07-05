-- Add market_type to competitors table
alter table competitors
  add column if not exists market_type text
  check (market_type in ('local', 'regional', 'international'))
  default 'international';

-- Add competitor_market_types preference to businesses table
alter table businesses
  add column if not exists competitor_market_types text[] default array[]::text[];
