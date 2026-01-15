/**
 * Branch-Based Data Isolation Middleware
 * 
 * Provides helpers for filtering data based on user's assigned branches.
 * Uses shipment-centric approach: if user can see a shipment, they can see
 * all related data (contracts, finance, customs, transport).
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { AuthRequest, checkGlobalAccess } from './auth';
import { Role, hasGlobalAccess } from './permissions';
import logger from '../utils/logger';

/**
 * Extended request with branch context
 */
export interface BranchFilterRequest extends AuthRequest {
  // Array of branch IDs user can access, null = global access
  userBranchIds: string[] | null;
  // Whether user has global access (Admin/Exec)
  hasGlobalAccess: boolean;
}

/**
 * Middleware to load user's accessible branch IDs
 * Attaches userBranchIds to request for use in route handlers
 */
export async function loadUserBranches(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as BranchFilterRequest;
  
  if (!authReq.user) {
    authReq.userBranchIds = [];
    authReq.hasGlobalAccess = false;
    return next();
  }

  try {
    // Check for global access roles
    if (hasGlobalAccess(authReq.user.role as Role)) {
      authReq.userBranchIds = null; // null = no filtering needed
      authReq.hasGlobalAccess = true;
      return next();
    }

    // Get user's accessible branch IDs from database
    const result = await pool.query(
      `SELECT security.get_user_branch_ids($1) as branch_ids`,
      [authReq.user.id]
    );

    const branchIds = result.rows[0]?.branch_ids || [];
    authReq.userBranchIds = branchIds;
    authReq.hasGlobalAccess = false;

    next();
  } catch (error) {
    logger.error('Error loading user branches:', error);
    // On error, default to empty array (no access)
    authReq.userBranchIds = [];
    authReq.hasGlobalAccess = false;
    next();
  }
}

/**
 * Build SQL WHERE clause for branch filtering on shipments
 * Filters by final_destination.branch_id or final_destination.warehouse_id
 * NOTE: When using v_shipments_complete view, final_destination is available directly.
 *       When using base shipments table, need to join shipment_logistics.
 */
export function buildShipmentBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 's'
): { clause: string; params: any[] } {
  // Global access - no filtering
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }

  // No branches assigned - no access
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] }; // Returns no results
  }

  // Filter by branch_id or warehouse_id in final_destination JSONB
  // This assumes using v_shipments_complete view which has final_destination
  const clause = `(
    ${tableAlias}.final_destination->>'branch_id' = ANY($1::text[])
    OR ${tableAlias}.final_destination->>'warehouse_id' = ANY($1::text[])
  )`;

  return { clause, params: [req.userBranchIds] };
}

/**
 * Build SQL WHERE clause for branch filtering on contracts
 * 
 * NOTE: In the current data model, contracts and shipments are independent.
 * Shipments do not have contract_id set, so we cannot filter contracts by
 * linked shipments. Contracts are visible to all users who have contract
 * module access (controlled by role permissions, not branch filtering).
 * 
 * If in the future shipments are linked to contracts, this can be changed
 * to filter based on linked shipment destinations.
 */
export function buildContractBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'c'
): { clause: string; params: any[] } {
  // Contracts are not branch-filtered in the current data model
  // Access is controlled by role permissions (contracts module access)
  // All users with contract access can see all contracts
  return { clause: '1=1', params: [] };
}

/**
 * Build SQL WHERE clause for branch filtering on finance transactions
 * Uses shipment-centric approach: transaction visible if linked shipment is visible
 */
export function buildFinanceBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 't'
): { clause: string; params: any[] } {
  // Global access - no filtering
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }

  // No branches assigned - no access
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }

  // Transaction is visible if:
  // 1. Linked to a shipment in user's branches, OR
  // 2. Linked to a contract that has shipments in user's branches, OR
  // 3. Not linked to any shipment/contract (general transactions)
  // NOTE: final_destination is in shipment_logistics table
  const clause = `(
    -- Linked to accessible shipment
    EXISTS (
      SELECT 1 FROM logistics.shipments ship
      JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id
      WHERE ship.id = ${tableAlias}.shipment_id
      AND ship.is_deleted = false
      AND (
        sl.final_destination->>'branch_id' = ANY($1::text[])
        OR sl.final_destination->>'warehouse_id' = ANY($1::text[])
      )
    )
    OR
    -- Linked to contract with accessible shipments
    EXISTS (
      SELECT 1 FROM logistics.shipments ship
      JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id
      WHERE ship.contract_id = ${tableAlias}.contract_id
      AND ship.is_deleted = false
      AND (
        sl.final_destination->>'branch_id' = ANY($1::text[])
        OR sl.final_destination->>'warehouse_id' = ANY($1::text[])
      )
    )
    OR
    -- Not linked to shipment or contract (general company transactions)
    (${tableAlias}.shipment_id IS NULL AND ${tableAlias}.contract_id IS NULL)
  )`;

  return { clause, params: [req.userBranchIds] };
}

/**
 * Build SQL WHERE clause for branch filtering on customs clearing costs
 * Uses shipment-centric approach
 */
export function buildCustomsBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'cc'
): { clause: string; params: any[] } {
  // Global access - no filtering
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }

  // No branches assigned - no access
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }

  // Custom costs visible if linked shipment is in user's branches
  // NOTE: final_destination is in shipment_logistics table
  const clause = `EXISTS (
    SELECT 1 FROM logistics.shipments ship
    JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id
    WHERE ship.id = ${tableAlias}.shipment_id
    AND ship.is_deleted = false
    AND (
      sl.final_destination->>'branch_id' = ANY($1::text[])
      OR sl.final_destination->>'warehouse_id' = ANY($1::text[])
    )
  )`;

  return { clause, params: [req.userBranchIds] };
}

/**
 * Build SQL WHERE clause for branch filtering on land transport deliveries
 * Uses shipment-centric approach
 */
export function buildTransportBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'd'
): { clause: string; params: any[] } {
  // Global access - no filtering
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }

  // No branches assigned - no access
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }

  // Delivery visible if linked shipment is in user's branches
  // NOTE: final_destination is in shipment_logistics table
  const clause = `EXISTS (
    SELECT 1 FROM logistics.shipments ship
    JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id
    WHERE ship.id = ${tableAlias}.shipment_id
    AND ship.is_deleted = false
    AND (
      sl.final_destination->>'branch_id' = ANY($1::text[])
      OR sl.final_destination->>'warehouse_id' = ANY($1::text[])
    )
  )`;

  return { clause, params: [req.userBranchIds] };
}

/**
 * Check if user can access a specific shipment
 */
export async function canAccessShipment(
  req: BranchFilterRequest,
  shipmentId: string
): Promise<boolean> {
  // Global access
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return true;
  }

  // No branches assigned
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return false;
  }

  // NOTE: final_destination is in shipment_logistics table
  const result = await pool.query(
    `SELECT 1 FROM logistics.shipments s
     JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
     WHERE s.id = $1
     AND s.is_deleted = false
     AND (
       sl.final_destination->>'branch_id' = ANY($2::text[])
       OR sl.final_destination->>'warehouse_id' = ANY($2::text[])
     )`,
    [shipmentId, req.userBranchIds]
  );

  return result.rows.length > 0;
}

/**
 * Check if user can access a specific contract
 * 
 * NOTE: Contracts are not branch-filtered. Access is controlled by role
 * permissions. All authenticated users with contract access can view contracts.
 */
export async function canAccessContract(
  req: BranchFilterRequest,
  contractId: string
): Promise<boolean> {
  // Contracts are accessible to all authenticated users with contract permissions
  // Role-based access is handled by the route middleware
  const result = await pool.query(
    `SELECT 1 FROM logistics.contracts c
     WHERE c.id = $1
     AND c.is_deleted = false`,
    [contractId]
  );

  return result.rows.length > 0;
}

/**
 * Get branch name(s) for display
 */
export async function getUserBranchNames(userId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT b.name, b.name_ar
     FROM security.user_branches ub
     JOIN master_data.branches b ON b.id = ub.branch_id
     WHERE ub.user_id = $1
     ORDER BY b.sort_order`,
    [userId]
  );

  return result.rows.map(r => r.name);
}

