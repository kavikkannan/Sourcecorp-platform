-- Quick fix migration: Make description and monthly_emi nullable in obligation_items
-- This is needed because we're now using item_data (JSONB) instead

DO $$
BEGIN
    -- Make description nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_items'
        AND column_name = 'description'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE finance_schema.obligation_items 
        ALTER COLUMN description DROP NOT NULL;
        RAISE NOTICE 'Made description column nullable';
    END IF;

    -- Make monthly_emi nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_items'
        AND column_name = 'monthly_emi'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE finance_schema.obligation_items 
        ALTER COLUMN monthly_emi DROP NOT NULL;
        RAISE NOTICE 'Made monthly_emi column nullable';
    END IF;
END $$;

