-- Migration: 154_fix_weight_ton_from_lines.sql
-- Purpose: Fix weight_ton to use computed value from shipment_lines when available
-- Issue: The Edit Wizard saves quantity to shipment_lines.quantity_mt, but the view
--        displays weight from shipment_cargo.weight_ton - causing a mismatch

-- Also sync the existing shipment_cargo.weight_ton from lines for immediate fix
UPDATE logistics.shipment_cargo c
SET weight_ton = COALESCE(
    (SELECT SUM(sl.quantity_mt) FROM logistics.shipment_lines sl WHERE sl.shipment_id = c.shipment_id),
    c.weight_ton
)
WHERE EXISTS (SELECT 1 FROM logistics.shipment_lines sl WHERE sl.shipment_id = c.shipment_id);

-- Create a trigger function to sync weight_ton when shipment_lines are modified
CREATE OR REPLACE FUNCTION logistics.sync_cargo_weight_from_lines()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shipment_cargo.weight_ton with sum of lines quantity_mt
    UPDATE logistics.shipment_cargo
    SET weight_ton = COALESCE(
        (SELECT SUM(sl.quantity_mt) FROM logistics.shipment_lines sl WHERE sl.shipment_id = NEW.shipment_id),
        weight_ton
    )
    WHERE shipment_id = NEW.shipment_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE on shipment_lines
DROP TRIGGER IF EXISTS sync_cargo_weight_on_line_change ON logistics.shipment_lines;
CREATE TRIGGER sync_cargo_weight_on_line_change
    AFTER INSERT OR UPDATE OF quantity_mt ON logistics.shipment_lines
    FOR EACH ROW
    EXECUTE FUNCTION logistics.sync_cargo_weight_from_lines();

-- Create trigger function for DELETE
CREATE OR REPLACE FUNCTION logistics.sync_cargo_weight_on_line_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shipment_cargo.weight_ton with sum of remaining lines
    UPDATE logistics.shipment_cargo
    SET weight_ton = COALESCE(
        (SELECT SUM(sl.quantity_mt) FROM logistics.shipment_lines sl WHERE sl.shipment_id = OLD.shipment_id),
        0
    )
    WHERE shipment_id = OLD.shipment_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for DELETE on shipment_lines
DROP TRIGGER IF EXISTS sync_cargo_weight_on_line_delete ON logistics.shipment_lines;
CREATE TRIGGER sync_cargo_weight_on_line_delete
    AFTER DELETE ON logistics.shipment_lines
    FOR EACH ROW
    EXECUTE FUNCTION logistics.sync_cargo_weight_on_line_delete();

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 154: Fixed weight_ton sync from shipment_lines';
END $$;
