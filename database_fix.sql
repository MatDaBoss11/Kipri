-- Fix for unique constraint issue
-- This script removes the overly restrictive unique constraint on product_name
-- and optionally adds a better constraint that allows same products in different stores

-- Step 1: Remove the current unique constraint on product_name
ALTER TABLE products DROP CONSTRAINT IF EXISTS unique_product_name;

-- Step 2: Optional - Add a composite unique constraint that allows same product names
-- but prevents exact duplicates (same product name + store + price combination)
-- Uncomment the line below if you want to prevent exact duplicates:
-- ALTER TABLE products ADD CONSTRAINT unique_product_store_price UNIQUE (product, store, price);

-- Step 3: Optional - Add a less restrictive constraint that only prevents
-- exact duplicates within the same store (same product name + store combination)
-- Uncomment the line below if you want this behavior:
-- ALTER TABLE products ADD CONSTRAINT unique_product_per_store UNIQUE (product, store);

-- Note: You can choose one of the options above, or no constraint at all
-- to allow complete flexibility (same product, same store, different prices)

-- Check the current constraints (optional verification)
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'products'::regclass
AND contype = 'u'; -- unique constraints only