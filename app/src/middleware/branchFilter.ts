/**
 * Branch-Based Data Isolation Middleware
 * 
 * Provides helpers for filtering data based on user's assigned branches.
 * Uses shipment-centric approach: if user can see a shipment, they can see
 * all related data (contracts, finance, customs, transport).
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { AuthRequest } from './auth';
import { Role, hasGlobalAccess, hasConditionalGlobalAccess } from './permissions';
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
    const userRole = authReq.user.role as Role;
    
    if (hasGlobalAccess(userRole)) {
      authReq.userBranchIds = null;
      authReq.hasGlobalAccess = true;
      return next();
    }

    const result = await pool.query(
      'SELECT security.get_user_branch_ids($1) as branch_ids',
      [authReq.user.id]
    );

    const branchIds = result.rows[0]?.branch_ids || [];
    
    if (hasConditionalGlobalAccess(userRole)) {
      if (branchIds.length === 0) {
        authReq.userBranchIds = null;
        authReq.hasGlobalAccess = true;
        return next();
      }
      authReq.userBranchIds = branchIds;
      authReq.hasGlobalAccess = false;
      return next();
    }
    
    authReq.userBranchIds = branchIds;
    authReq.hasGlobalAccess = false;
    next();
  } catch (error) {
    logger.error('Error loading user branches:', error);
    authReq.userBranchIds = [];
    authReq.hasGlobalAccess = false;
    next();
  }
}

export function buildShipmentBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 's'
): { clause: string; params: any[] } {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }
  const clause = '(' + tableAlias + ".final_destination->>'branch_id' = ANY($1::text[]) OR " + tableAlias + ".final_destination->>'warehouse_id' = ANY($1::text[]))";
  return { clause, params: [req.userBranchIds] };
}

export function buildContractBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'c'
): { clause: string; params: any[] } {
  return { clause: '1=1', params: [] };
}

export function buildFinanceBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 't'
): { clause: string; params: any[] } {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }
  const clause = '(EXISTS (SELECT 1 FROM logistics.shipments ship JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id WHERE ship.id = ' + tableAlias + ".shipment_id AND ship.is_deleted = false AND (sl.final_destination->>'branch_id' = ANY($1::text[]) OR sl.final_destination->>'warehouse_id' = ANY($1::text[]))) OR EXISTS (SELECT 1 FROM logistics.shipments ship JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id WHERE ship.contract_id = " + tableAlias + ".contract_id AND ship.is_deleted = false AND (sl.final_destination->>'branch_id' = ANY($1::text[]) OR sl.final_destination->>'warehouse_id' = ANY($1::text[]))) OR (" + tableAlias + '.shipment_id IS NULL AND ' + tableAlias + '.contract_id IS NULL))';
  return { clause, params: [req.userBranchIds] };
}

export function buildCustomsBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'cc'
): { clause: string; params: any[] } {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }
  const clause = "EXISTS (SELECT 1 FROM logistics.shipments ship JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id WHERE ship.id = " + tableAlias + ".shipment_id AND ship.is_deleted = false AND (sl.final_destination->>'branch_id' = ANY($1::text[]) OR sl.final_destination->>'warehouse_id' = ANY($1::text[])))";
  return { clause, params: [req.userBranchIds] };
}

export function buildTransportBranchFilter(
  req: BranchFilterRequest,
  tableAlias: string = 'd'
): { clause: string; params: any[] } {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [] };
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [] };
  }
  const clause = "EXISTS (SELECT 1 FROM logistics.shipments ship JOIN logistics.shipment_logistics sl ON sl.shipment_id = ship.id WHERE ship.id = " + tableAlias + ".shipment_id AND ship.is_deleted = false AND (sl.final_destination->>'branch_id' = ANY($1::text[]) OR sl.final_destination->>'warehouse_id' = ANY($1::text[])))";
  return { clause, params: [req.userBranchIds] };
}

export async function canAccessShipment(
  req: BranchFilterRequest,
  shipmentId: string
): Promise<boolean> {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return true;
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return false;
  }
  const result = await pool.query(
    "SELECT 1 FROM logistics.shipments s JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id WHERE s.id = $1 AND s.is_deleted = false AND (sl.final_destination->>'branch_id' = ANY($2::text[]) OR sl.final_destination->>'warehouse_id' = ANY($2::text[]))",
    [shipmentId, req.userBranchIds]
  );
  return result.rows.length > 0;
}

export async function canAccessContract(
  req: BranchFilterRequest,
  contractId: string
): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM logistics.contracts c WHERE c.id = $1 AND c.is_deleted = false',
    [contractId]
  );
  return result.rows.length > 0;
}

export async function getUserBranchNames(userId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT b.name, b.name_ar FROM security.user_branches ub JOIN master_data.branches b ON b.id = ub.branch_id WHERE ub.user_id = $1 ORDER BY b.sort_order',
    [userId]
  );
  return result.rows.map(r => r.name);
}

/**
 * Build SQL WHERE clause for branch filtering on antrepo inventory
 */
export function buildAntrepoBranchFilter(
  req: BranchFilterRequest,
  lotsTableAlias: string = 'al'
): { clause: string; params: any[]; paramStartIndex: number } {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    return { clause: '1=1', params: [], paramStartIndex: 1 };
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return { clause: '1=0', params: [], paramStartIndex: 1 };
  }
  const clause = lotsTableAlias + '.antrepo_id = ANY($1::uuid[])';
  return { clause, params: [req.userBranchIds], paramStartIndex: 2 };
}

/**
 * Get user's assigned antrepo (warehouse) branches
 */
export async function getUserAntrepoBranches(
  req: BranchFilterRequest
): Promise<Array<{ id: string; name: string; name_ar: string }>> {
  if (req.hasGlobalAccess || req.userBranchIds === null) {
    const result = await pool.query(
      "SELECT id, name, name_ar FROM master_data.branches WHERE branch_type = 'warehouse' AND is_active = TRUE ORDER BY sort_order, name"
    );
    return result.rows;
  }
  if (!req.userBranchIds || req.userBranchIds.length === 0) {
    return [];
  }
  const result = await pool.query(
    "SELECT id, name, name_ar FROM master_data.branches WHERE id = ANY($1::uuid[]) AND branch_type = 'warehouse' AND is_active = TRUE ORDER BY sort_order, name",
    [req.userBranchIds]
  );
  return result.rows;
}
