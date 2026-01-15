import { Router, Response } from 'express';
import { pool } from '../db/client';
import { AuthRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/auth';
import logger from '../utils/logger';
import {
  postMenuSchema,
  voteSchema,
  suggestionSchema,
  decideTieSchema,
  updateMenuOptionSchema,
} from '../validators/cafe';

const router = Router();

// Helper: Get tomorrow's date in YYYY-MM-DD format
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Helper: Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper: Check if voting is closed (after 6 PM)
function isVotingClosed(): boolean {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 18; // 6 PM = 18:00
}

// Helper: Get time remaining until voting closes
function getTimeRemaining(): { hours: number; minutes: number } | null {
  if (isVotingClosed()) return null;
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(18, 0, 0, 0);
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

// ============================================
// PUBLIC ENDPOINTS (All Authenticated Users)
// ============================================

/**
 * GET /api/cafe/today
 * Get today's menu (the winner from yesterday's vote)
 */
router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM system.v_cafe_today_menu
    `);

    if (result.rows.length === 0) {
      return res.json({
        menu: null,
        message: 'No menu set for today',
      });
    }

    res.json({
      menu: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching today menu:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s menu' });
  }
});

/**
 * GET /api/cafe/tomorrow
 * Get tomorrow's options and voting status
 */
router.get('/tomorrow', async (req: AuthRequest, res: Response) => {
  try {
    const tomorrowDate = getTomorrowDate();
    const userId = req.user?.id;
    const votingClosed = isVotingClosed();

    // Get options
    const optionsResult = await pool.query(`
      SELECT 
        o.id,
        o.menu_date,
        o.option_number,
        o.dish_name,
        o.dish_name_ar,
        o.description,
        o.description_ar,
        o.image_path,
        o.created_at,
        ${votingClosed ? 'COUNT(v.id)::INTEGER AS vote_count' : '0 AS vote_count'}
      FROM system.cafe_menu_options o
      LEFT JOIN system.cafe_votes v ON v.option_id = o.id
      WHERE o.menu_date = $1
      GROUP BY o.id
      ORDER BY o.option_number
    `, [tomorrowDate]);

    // Get user's vote
    let userVote = null;
    if (userId) {
      const voteResult = await pool.query(`
        SELECT option_id FROM system.cafe_votes
        WHERE menu_date = $1 AND user_id = $2
      `, [tomorrowDate, userId]);
      userVote = voteResult.rows[0]?.option_id || null;
    }

    // Check if there's a result already (tie decided)
    const resultCheck = await pool.query(`
      SELECT * FROM system.cafe_menu_results
      WHERE menu_date = $1 AND finalized_at IS NOT NULL
    `, [tomorrowDate]);

    // Get total voters count
    const votersResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id)::INTEGER AS total_voters
      FROM system.cafe_votes
      WHERE menu_date = $1
    `, [tomorrowDate]);

    res.json({
      options: optionsResult.rows,
      user_vote: userVote,
      has_voted: !!userVote,
      voting_closed: votingClosed,
      voting_finalized: resultCheck.rows.length > 0,
      time_remaining: getTimeRemaining(),
      total_voters: votersResult.rows[0]?.total_voters || 0,
    });
  } catch (error) {
    logger.error('Error fetching tomorrow options:', error);
    res.status(500).json({ error: 'Failed to fetch tomorrow\'s options' });
  }
});

/**
 * POST /api/cafe/vote
 * Submit or change vote
 */
router.post('/vote', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if voting is closed
    if (isVotingClosed()) {
      return res.status(400).json({ error: 'Voting has closed for today' });
    }

    const parseResult = voteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid vote data', details: parseResult.error.errors });
    }

    const { option_id } = parseResult.data;
    const tomorrowDate = getTomorrowDate();

    // Verify the option exists and is for tomorrow
    const optionCheck = await pool.query(`
      SELECT id FROM system.cafe_menu_options
      WHERE id = $1 AND menu_date = $2
    `, [option_id, tomorrowDate]);

    if (optionCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid option or option not for tomorrow' });
    }

    // Upsert vote (insert or update if exists)
    await pool.query(`
      INSERT INTO system.cafe_votes (menu_date, user_id, option_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (menu_date, user_id)
      DO UPDATE SET option_id = $3, updated_at = NOW()
    `, [tomorrowDate, userId, option_id]);

    res.json({ success: true, message: 'Vote recorded successfully' });
  } catch (error) {
    logger.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

/**
 * GET /api/cafe/my-vote
 * Get user's current vote for tomorrow
 */
router.get('/my-vote', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tomorrowDate = getTomorrowDate();
    const result = await pool.query(`
      SELECT v.option_id, o.dish_name, o.dish_name_ar, v.voted_at
      FROM system.cafe_votes v
      JOIN system.cafe_menu_options o ON o.id = v.option_id
      WHERE v.menu_date = $1 AND v.user_id = $2
    `, [tomorrowDate, userId]);

    res.json({
      vote: result.rows[0] || null,
    });
  } catch (error) {
    logger.error('Error fetching user vote:', error);
    res.status(500).json({ error: 'Failed to fetch your vote' });
  }
});

/**
 * GET /api/cafe/suggestions
 * Get active suggestions (sorted by upvotes)
 */
router.get('/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Check if suggestions are open
    const settingsResult = await pool.query(`
      SELECT value FROM system.cafe_settings WHERE key = 'suggestions_open'
    `);
    const suggestionsOpen = settingsResult.rows[0]?.value === 'true';

    // Get suggestions with upvote counts
    const suggestionsResult = await pool.query(`
      SELECT 
        s.id,
        s.suggestion_text,
        s.suggested_by,
        u.name AS suggested_by_name,
        s.created_at,
        COUNT(up.user_id)::INTEGER AS upvote_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM system.cafe_suggestion_upvotes 
          WHERE suggestion_id = s.id AND user_id = $1
        ) THEN TRUE ELSE FALSE END AS user_upvoted
      FROM system.cafe_suggestions s
      JOIN security.users u ON u.id = s.suggested_by
      LEFT JOIN system.cafe_suggestion_upvotes up ON up.suggestion_id = s.id
      WHERE s.is_active = TRUE
      GROUP BY s.id, s.suggestion_text, s.suggested_by, u.name, s.created_at
      ORDER BY upvote_count DESC, s.created_at DESC
    `, [userId]);

    res.json({
      suggestions_open: suggestionsOpen,
      suggestions: suggestionsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

/**
 * POST /api/cafe/suggestions
 * Submit a new suggestion
 */
router.post('/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if suggestions are open
    const settingsResult = await pool.query(`
      SELECT value FROM system.cafe_settings WHERE key = 'suggestions_open'
    `);
    if (settingsResult.rows[0]?.value !== 'true') {
      return res.status(400).json({ error: 'Suggestions are currently closed' });
    }

    const parseResult = suggestionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid suggestion', details: parseResult.error.errors });
    }

    const { suggestion_text } = parseResult.data;

    const result = await pool.query(`
      INSERT INTO system.cafe_suggestions (suggestion_text, suggested_by)
      VALUES ($1, $2)
      RETURNING id, suggestion_text, created_at
    `, [suggestion_text, userId]);

    res.status(201).json({
      success: true,
      suggestion: result.rows[0],
    });
  } catch (error) {
    logger.error('Error submitting suggestion:', error);
    res.status(500).json({ error: 'Failed to submit suggestion' });
  }
});

/**
 * POST /api/cafe/suggestions/:id/upvote
 * Upvote a suggestion
 */
router.post('/suggestions/:id/upvote', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const suggestionId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify suggestion exists and is active
    const checkResult = await pool.query(`
      SELECT id FROM system.cafe_suggestions WHERE id = $1 AND is_active = TRUE
    `, [suggestionId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suggestion not found or inactive' });
    }

    // Insert upvote (ignore if already exists)
    await pool.query(`
      INSERT INTO system.cafe_suggestion_upvotes (suggestion_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (suggestion_id, user_id) DO NOTHING
    `, [suggestionId, userId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error upvoting suggestion:', error);
    res.status(500).json({ error: 'Failed to upvote suggestion' });
  }
});

/**
 * DELETE /api/cafe/suggestions/:id/upvote
 * Remove upvote from a suggestion
 */
router.delete('/suggestions/:id/upvote', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const suggestionId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await pool.query(`
      DELETE FROM system.cafe_suggestion_upvotes
      WHERE suggestion_id = $1 AND user_id = $2
    `, [suggestionId, userId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing upvote:', error);
    res.status(500).json({ error: 'Failed to remove upvote' });
  }
});

/**
 * GET /api/cafe/status
 * Get overall cafe system status (for widget)
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const todayDate = getTodayDate();
    const tomorrowDate = getTomorrowDate();

    // Get today's menu
    const todayMenu = await pool.query(`
      SELECT * FROM system.v_cafe_today_menu
    `);

    // Get tomorrow's options count
    const tomorrowOptions = await pool.query(`
      SELECT COUNT(*)::INTEGER AS count FROM system.cafe_menu_options
      WHERE menu_date = $1
    `, [tomorrowDate]);

    // Check if suggestions are open
    const settingsResult = await pool.query(`
      SELECT value FROM system.cafe_settings WHERE key = 'suggestions_open'
    `);

    // Check if there's a tie waiting to be decided
    const tieCheck = await pool.query(`
      WITH vote_counts AS (
        SELECT option_id, COUNT(*) AS votes
        FROM system.cafe_votes
        WHERE menu_date = $1
        GROUP BY option_id
      ),
      max_votes AS (
        SELECT MAX(votes) AS max_count FROM vote_counts
      )
      SELECT COUNT(*) AS tied_count
      FROM vote_counts, max_votes
      WHERE votes = max_count
    `, [tomorrowDate]);

    const hasTomorrowOptions = (tomorrowOptions.rows[0]?.count || 0) > 0;
    const isTied = isVotingClosed() && (tieCheck.rows[0]?.tied_count || 0) > 1;

    // Check if result is finalized
    const resultCheck = await pool.query(`
      SELECT id FROM system.cafe_menu_results
      WHERE menu_date = $1 AND finalized_at IS NOT NULL
    `, [tomorrowDate]);

    res.json({
      today_menu: todayMenu.rows[0] || null,
      has_tomorrow_options: hasTomorrowOptions,
      tomorrow_options_count: tomorrowOptions.rows[0]?.count || 0,
      voting_open: hasTomorrowOptions && !isVotingClosed(),
      voting_closed: isVotingClosed(),
      result_finalized: resultCheck.rows.length > 0,
      has_tie: isTied && resultCheck.rows.length === 0,
      suggestions_open: settingsResult.rows[0]?.value === 'true',
      time_remaining: getTimeRemaining(),
    });
  } catch (error) {
    logger.error('Error fetching cafe status:', error);
    res.status(500).json({ error: 'Failed to fetch cafe status' });
  }
});

// ============================================
// CHEF ONLY ENDPOINTS (Cafe Role)
// ============================================

/**
 * POST /api/cafe/menu
 * Post 3 options for tomorrow
 */
router.post('/menu', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const parseResult = postMenuSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid menu data', details: parseResult.error.errors });
    }

    const { menu_date, options } = parseResult.data;

    // Delete existing options for this date (if any)
    await pool.query(`
      DELETE FROM system.cafe_menu_options WHERE menu_date = $1
    `, [menu_date]);

    // Insert new options
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await pool.query(`
        INSERT INTO system.cafe_menu_options 
        (menu_date, option_number, dish_name, dish_name_ar, description, description_ar, image_path, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        menu_date,
        i + 1,
        opt.dish_name,
        opt.dish_name_ar || null,
        opt.description || null,
        opt.description_ar || null,
        opt.image_path || null,
        userId,
      ]);
    }

    res.status(201).json({ success: true, message: 'Menu posted successfully' });
  } catch (error) {
    logger.error('Error posting menu:', error);
    res.status(500).json({ error: 'Failed to post menu' });
  }
});

/**
 * PUT /api/cafe/menu/:id
 * Update a menu option
 */
router.put('/menu/:id', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const optionId = req.params.id;
    
    const parseResult = updateMenuOptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid update data', details: parseResult.error.errors });
    }

    const updates = parseResult.data;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.dish_name !== undefined) {
      setClauses.push(`dish_name = $${paramIndex++}`);
      values.push(updates.dish_name);
    }
    if (updates.dish_name_ar !== undefined) {
      setClauses.push(`dish_name_ar = $${paramIndex++}`);
      values.push(updates.dish_name_ar);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.description_ar !== undefined) {
      setClauses.push(`description_ar = $${paramIndex++}`);
      values.push(updates.description_ar);
    }
    if (updates.image_path !== undefined) {
      setClauses.push(`image_path = $${paramIndex++}`);
      values.push(updates.image_path);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(optionId);
    const result = await pool.query(`
      UPDATE system.cafe_menu_options
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Option not found' });
    }

    res.json({ success: true, option: result.rows[0] });
  } catch (error) {
    logger.error('Error updating menu option:', error);
    res.status(500).json({ error: 'Failed to update menu option' });
  }
});

/**
 * DELETE /api/cafe/menu/:id
 * Delete a menu option
 */
router.delete('/menu/:id', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const optionId = req.params.id;

    const result = await pool.query(`
      DELETE FROM system.cafe_menu_options WHERE id = $1 RETURNING id
    `, [optionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Option not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting menu option:', error);
    res.status(500).json({ error: 'Failed to delete menu option' });
  }
});

/**
 * GET /api/cafe/votes/count
 * Get current vote counts (chef only)
 */
router.get('/votes/count', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const tomorrowDate = getTomorrowDate();

    const result = await pool.query(`
      SELECT 
        o.id,
        o.option_number,
        o.dish_name,
        o.dish_name_ar,
        COUNT(v.id)::INTEGER AS vote_count
      FROM system.cafe_menu_options o
      LEFT JOIN system.cafe_votes v ON v.option_id = o.id
      WHERE o.menu_date = $1
      GROUP BY o.id, o.option_number, o.dish_name, o.dish_name_ar
      ORDER BY o.option_number
    `, [tomorrowDate]);

    const totalVotes = result.rows.reduce((sum, row) => sum + row.vote_count, 0);

    res.json({
      options: result.rows,
      total_votes: totalVotes,
      voting_closed: isVotingClosed(),
    });
  } catch (error) {
    logger.error('Error fetching vote counts:', error);
    res.status(500).json({ error: 'Failed to fetch vote counts' });
  }
});

/**
 * POST /api/cafe/close-voting
 * Manually close voting and determine winner
 */
router.post('/close-voting', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const tomorrowDate = getTomorrowDate();

    // Get vote counts
    const voteCountsResult = await pool.query(`
      SELECT 
        o.id,
        o.dish_name,
        COUNT(v.id)::INTEGER AS vote_count
      FROM system.cafe_menu_options o
      LEFT JOIN system.cafe_votes v ON v.option_id = o.id
      WHERE o.menu_date = $1
      GROUP BY o.id, o.dish_name
      ORDER BY vote_count DESC
    `, [tomorrowDate]);

    if (voteCountsResult.rows.length === 0) {
      return res.status(400).json({ error: 'No menu options for tomorrow' });
    }

    const topVotes = voteCountsResult.rows[0].vote_count;
    const topOptions = voteCountsResult.rows.filter(r => r.vote_count === topVotes);

    if (topOptions.length > 1) {
      // Tie - chef needs to decide
      return res.json({
        success: false,
        is_tie: true,
        tied_options: topOptions,
        message: 'There is a tie. Please decide the winner.',
      });
    }

    // Single winner - finalize
    const winner = topOptions[0];
    await pool.query(`
      INSERT INTO system.cafe_menu_results 
      (menu_date, winning_option_id, total_votes, was_tie, finalized_at)
      VALUES ($1, $2, $3, FALSE, NOW())
      ON CONFLICT (menu_date) DO UPDATE SET
        winning_option_id = $2,
        total_votes = $3,
        was_tie = FALSE,
        finalized_at = NOW()
    `, [tomorrowDate, winner.id, winner.vote_count]);

    res.json({
      success: true,
      winner: winner,
      total_votes: winner.vote_count,
    });
  } catch (error) {
    logger.error('Error closing voting:', error);
    res.status(500).json({ error: 'Failed to close voting' });
  }
});

/**
 * POST /api/cafe/decide-tie
 * Pick winner when there's a tie
 */
router.post('/decide-tie', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const parseResult = decideTieSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid data', details: parseResult.error.errors });
    }

    const { winning_option_id, menu_date } = parseResult.data;

    // Verify the option exists for this date
    const optionCheck = await pool.query(`
      SELECT id, dish_name FROM system.cafe_menu_options
      WHERE id = $1 AND menu_date = $2
    `, [winning_option_id, menu_date]);

    if (optionCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid option for this date' });
    }

    // Get total votes for the winner
    const votesResult = await pool.query(`
      SELECT COUNT(*)::INTEGER AS vote_count
      FROM system.cafe_votes
      WHERE option_id = $1
    `, [winning_option_id]);

    // Finalize result
    await pool.query(`
      INSERT INTO system.cafe_menu_results 
      (menu_date, winning_option_id, total_votes, was_tie, decided_by, finalized_at)
      VALUES ($1, $2, $3, TRUE, $4, NOW())
      ON CONFLICT (menu_date) DO UPDATE SET
        winning_option_id = $2,
        total_votes = $3,
        was_tie = TRUE,
        decided_by = $4,
        finalized_at = NOW()
    `, [menu_date, winning_option_id, votesResult.rows[0].vote_count, userId]);

    res.json({
      success: true,
      winner: optionCheck.rows[0],
      decided_by_chef: true,
    });
  } catch (error) {
    logger.error('Error deciding tie:', error);
    res.status(500).json({ error: 'Failed to decide tie' });
  }
});

/**
 * GET /api/cafe/history
 * View past menus (chef only)
 */
router.get('/history', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(`
      SELECT 
        r.menu_date,
        r.total_votes,
        r.was_tie,
        r.finalized_at,
        o.dish_name,
        o.dish_name_ar,
        u.name AS decided_by_name
      FROM system.cafe_menu_results r
      JOIN system.cafe_menu_options o ON o.id = r.winning_option_id
      LEFT JOIN security.users u ON u.id = r.decided_by
      ORDER BY r.menu_date DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*)::INTEGER AS total FROM system.cafe_menu_results
    `);

    res.json({
      history: result.rows,
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching menu history:', error);
    res.status(500).json({ error: 'Failed to fetch menu history' });
  }
});

/**
 * POST /api/cafe/suggestions/open
 * Open suggestions mode
 */
router.post('/suggestions/open', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    await pool.query(`
      UPDATE system.cafe_settings 
      SET value = 'true', updated_by = $1, updated_at = NOW()
      WHERE key = 'suggestions_open'
    `, [userId]);

    res.json({ success: true, message: 'Suggestions are now open' });
  } catch (error) {
    logger.error('Error opening suggestions:', error);
    res.status(500).json({ error: 'Failed to open suggestions' });
  }
});

/**
 * POST /api/cafe/suggestions/close
 * Close suggestions mode
 */
router.post('/suggestions/close', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    await pool.query(`
      UPDATE system.cafe_settings 
      SET value = 'false', updated_by = $1, updated_at = NOW()
      WHERE key = 'suggestions_open'
    `, [userId]);

    // Optionally deactivate all current suggestions
    await pool.query(`
      UPDATE system.cafe_suggestions SET is_active = FALSE
    `);

    res.json({ success: true, message: 'Suggestions are now closed' });
  } catch (error) {
    logger.error('Error closing suggestions:', error);
    res.status(500).json({ error: 'Failed to close suggestions' });
  }
});

/**
 * DELETE /api/cafe/suggestions/:id
 * Delete/deactivate a suggestion (chef only)
 */
router.delete('/suggestions/:id', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  try {
    const suggestionId = req.params.id;

    await pool.query(`
      UPDATE system.cafe_suggestions SET is_active = FALSE WHERE id = $1
    `, [suggestionId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting suggestion:', error);
    res.status(500).json({ error: 'Failed to delete suggestion' });
  }
});

/**
 * POST /api/cafe/menu/upload-image
 * Upload an image for a menu option
 */
router.post('/menu/upload-image', authorizeRoles('Admin', 'Cafe'), async (req: AuthRequest, res: Response) => {
  // This would integrate with the existing document upload system
  // For now, return a placeholder response
  res.status(501).json({ error: 'Image upload not yet implemented - use image URLs for now' });
});

export default router;



