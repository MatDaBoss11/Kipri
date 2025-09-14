# Database Constraint Fix

## Problem
The database has a unique constraint `unique_product_name` that prevents the same product name from being used across different stores. This is too restrictive and causes errors when trying to add the same product (e.g., "MILK") to different stores.

## Solution
Remove the overly restrictive unique constraint to allow the same products in multiple stores.

## Steps to Fix

### 1. Run the SQL Fix
Open your Supabase SQL Editor and run the commands from `database_fix.sql`:

```sql
-- Remove the restrictive unique constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS unique_product_name;
```

### 2. Choose Your Constraint Strategy (Optional)

You have three options:

#### Option A: No Constraints (Recommended for flexibility)
- Allows same product in multiple stores
- Allows different prices for same product in same store
- Maximum flexibility

#### Option B: Prevent Exact Duplicates Per Store
```sql
-- Same product name can exist in different stores, but not duplicated within same store
ALTER TABLE products ADD CONSTRAINT unique_product_per_store UNIQUE (product, store);
```

#### Option C: Prevent Exact Product/Store/Price Combinations
```sql  
-- Allows same product in same store but with different prices
ALTER TABLE products ADD CONSTRAINT unique_product_store_price UNIQUE (product, store, price);
```

## What Changed in the App

### ✅ **Removed duplicate checking logic**
- No more pre-checking for duplicates before saving
- Simplified error handling
- Cleaner code flow

### ✅ **Removed duplicate error messages**
- No more "Product Already Exists" dialogs
- No more special handling for constraint violations
- Standard error handling for all cases

### ✅ **Benefits after fix:**
- Same product can exist in multiple stores (e.g., "MILK" in both "SuperU" and "Carrefour")
- No more confusing constraint error messages
- Faster product addition (no pre-checks needed)
- More flexible data model

## Testing
After running the SQL fix:
1. Try adding the same product to different stores ✅
2. Try adding the same product to the same store (behavior depends on constraint option chosen)
3. Verify no error logs appear for normal operations ✅

## Files Modified
- `database_fix.sql` - SQL commands to fix the database
- `app/(tabs)/scanner.tsx` - Removed duplicate checking logic
- `services/SupabaseService.ts` - Removed duplicate error handling
- `DATABASE_CONSTRAINT_FIX.md` - This documentation

## Recommendation
Use **Option A** (no constraints) for maximum flexibility. You can always add business logic in the app later if needed, but database constraints are harder to change once you have data.