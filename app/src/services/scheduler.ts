/**
 * Scheduler Service - Background Job Runner
 * 
 * Runs periodic tasks:
 * - Notification checks every 30 minutes
 * - Shipment status recalculation daily at 1:00 AM
 * - Cafe voting: 5:30 PM reminder, 6:00 PM voting close
 * - Future: Other scheduled tasks (cleanup, reports, etc.)
 */

import cron from 'node-cron';
import { notificationService } from './notificationService';
import { recalculateDateBasedStatuses } from './shipmentStatusEngine';
import { pool } from '../db/client';
import logger from '../utils/logger';

export function initializeScheduler() {
  logger.info('🕐 Initializing scheduler...');
  
  // Run notification check every 30 minutes
  // Cron format: minute hour day month weekday
  // */30 * * * * = Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    const timestamp = new Date().toISOString();
    logger.info(`\n🔔 [${timestamp}] Running scheduled notification check...`);
    
    try {
      await notificationService.checkAndGenerateNotifications();
      logger.info(`✅ [${timestamp}] Notification check completed successfully`);
    } catch (error) {
      logger.error(`❌ [${timestamp}] Notification check failed:`, error);
    }
  });
  
  // Run shipment status recalculation daily at 1:00 AM
  // This handles date-based status transitions:
  // - Planning → Delayed (when agreed_shipping_date passes)
  // - Sailed → Awaiting Clearance (when ETA arrives)
  cron.schedule('0 1 * * *', async () => {
    const timestamp = new Date().toISOString();
    logger.info(`\n📊 [${timestamp}] Running scheduled shipment status recalculation...`);
    
    try {
      const result = await recalculateDateBasedStatuses();
      logger.info(`✅ [${timestamp}] Status recalculation completed: ${result.updated}/${result.processed} updated, ${result.errors} errors`);
    } catch (error) {
      logger.error(`❌ [${timestamp}] Status recalculation failed:`, error);
    }
  }, {
    timezone: 'Asia/Riyadh'
  });
  
  // Also run status check every 6 hours during business hours for more responsive updates
  // Runs at 7 AM, 1 PM, 7 PM
  cron.schedule('0 7,13,19 * * *', async () => {
    const timestamp = new Date().toISOString();
    logger.info(`\n📊 [${timestamp}] Running periodic shipment status check...`);
    
    try {
      const result = await recalculateDateBasedStatuses();
      logger.info(`✅ [${timestamp}] Periodic status check completed: ${result.updated}/${result.processed} updated`);
    } catch (error) {
      logger.error(`❌ [${timestamp}] Periodic status check failed:`, error);
    }
  }, {
    timezone: 'Asia/Riyadh'
  });
  
  // Cafe: 5:30 PM reminder for users who haven't voted
  // Runs Monday-Friday (1-5)
  cron.schedule('30 17 * * 1-5', async () => {
    const timestamp = new Date().toISOString();
    logger.info(`\n🍽️ [${timestamp}] Running cafe voting reminder...`);
    
    try {
      await sendCafeVotingReminder();
      logger.info(`✅ [${timestamp}] Cafe voting reminder completed`);
    } catch (error) {
      logger.error(`❌ [${timestamp}] Cafe voting reminder failed:`, error);
    }
  }, {
    timezone: 'Asia/Riyadh'
  });
  
  // Cafe: 6:00 PM close voting and announce winner
  // Runs Monday-Friday (1-5)
  cron.schedule('0 18 * * 1-5', async () => {
    const timestamp = new Date().toISOString();
    logger.info(`\n🍽️ [${timestamp}] Closing cafe voting...`);
    
    try {
      await closeCafeVotingAndAnnounce();
      logger.info(`✅ [${timestamp}] Cafe voting closed and winner announced`);
    } catch (error) {
      logger.error(`❌ [${timestamp}] Cafe voting close failed:`, error);
    }
  }, {
    timezone: 'Asia/Riyadh'
  });
  
  logger.info('✅ Scheduler initialized');
  logger.info('   → Notifications: Every 30 minutes');
  logger.info('   → Shipment status: Daily at 1:00 AM + every 6 hours (7AM, 1PM, 7PM)');
  logger.info('   → Cafe reminder: 5:30 PM weekdays');
  logger.info('   → Cafe close: 6:00 PM weekdays');
  logger.info('   → Timezone: Asia/Riyadh');
  logger.info('   → Next notification run at: ' + getNextRunTime());
  
  // Run initial check on startup
  setTimeout(async () => {
    logger.info('\n🔔 Running initial notification check on startup...');
    try {
      await notificationService.checkAndGenerateNotifications();
      logger.info('✅ Initial notification check completed');
    } catch (error) {
      logger.error('❌ Initial notification check failed:', error);
    }
  }, 5000); // Wait 5 seconds after server startup
}

/**
 * Send reminder to users who haven't voted for tomorrow's lunch
 */
async function sendCafeVotingReminder() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  // Check if there are menu options for tomorrow
  const optionsCheck = await pool.query(`
    SELECT COUNT(*) AS count FROM system.cafe_menu_options WHERE menu_date = $1
  `, [tomorrowDate]);
  
  if (parseInt(optionsCheck.rows[0].count) === 0) {
    logger.info('   No menu options for tomorrow, skipping reminder');
    return;
  }
  
  // Get users who haven't voted
  const usersResult = await pool.query(`
    SELECT u.id, u.name
    FROM security.users u
    WHERE u.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM system.cafe_votes v
      WHERE v.user_id = u.id AND v.menu_date = $1
    )
  `, [tomorrowDate]);
  
  logger.info(`   Found ${usersResult.rows.length} users who haven't voted`);
  
  // Create notification for each user
  for (const user of usersResult.rows) {
    await pool.query(`
      INSERT INTO security.notifications 
      (user_id, title, title_ar, message, message_ar, type, priority, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      user.id,
      "🍽️ Don't forget to vote!",
      "🍽️ لا تنسى التصويت!",
      "Voting for tomorrow's lunch closes in 30 minutes",
      "التصويت لغداء الغد يغلق خلال 30 دقيقة",
      'cafe_reminder',
      'medium',
      '/'
    ]);
  }
}

/**
 * Close voting and announce winner
 */
async function closeCafeVotingAndAnnounce() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  // Check if there are menu options for tomorrow
  const optionsCheck = await pool.query(`
    SELECT COUNT(*) AS count FROM system.cafe_menu_options WHERE menu_date = $1
  `, [tomorrowDate]);
  
  if (parseInt(optionsCheck.rows[0].count) === 0) {
    logger.info('   No menu options for tomorrow, skipping close');
    return;
  }
  
  // Check if result already finalized
  const resultCheck = await pool.query(`
    SELECT id FROM system.cafe_menu_results 
    WHERE menu_date = $1 AND finalized_at IS NOT NULL
  `, [tomorrowDate]);
  
  if (resultCheck.rows.length > 0) {
    logger.info('   Voting already finalized for tomorrow');
    return;
  }
  
  // Get vote counts
  const voteCountsResult = await pool.query(`
    SELECT 
      o.id,
      o.dish_name,
      o.dish_name_ar,
      COUNT(v.id)::INTEGER AS vote_count
    FROM system.cafe_menu_options o
    LEFT JOIN system.cafe_votes v ON v.option_id = o.id
    WHERE o.menu_date = $1
    GROUP BY o.id, o.dish_name, o.dish_name_ar
    ORDER BY vote_count DESC
  `, [tomorrowDate]);
  
  if (voteCountsResult.rows.length === 0) {
    logger.info('   No options found for tomorrow');
    return;
  }
  
  const topVotes = voteCountsResult.rows[0].vote_count;
  const topOptions = voteCountsResult.rows.filter((r: { vote_count: number }) => r.vote_count === topVotes);
  
  if (topOptions.length > 1 && topVotes > 0) {
    // There's a tie - notify cafe staff to decide
    logger.info(`   Tie detected between ${topOptions.length} options`);
    
    // Notify all Cafe role users
    const cafeUsers = await pool.query(`
      SELECT id FROM security.users WHERE role = 'Cafe' AND is_active = TRUE
    `);
    
    for (const user of cafeUsers.rows) {
      await pool.query(`
        INSERT INTO security.notifications 
        (user_id, title, title_ar, message, message_ar, type, priority, action_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        user.id,
        "🎯 Tie Breaker Needed",
        "🎯 مطلوب فاصل للتعادل",
        "There's a tie in tomorrow's lunch vote. Please decide the winner.",
        "هناك تعادل في تصويت غداء الغد. الرجاء تحديد الفائز.",
        'cafe_tie',
        'high',
        '/cafe'
      ]);
    }
    return;
  }
  
  // Single winner or no votes - finalize
  const winner = voteCountsResult.rows[0];
  
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
  
  logger.info(`   Winner: ${winner.dish_name} with ${winner.vote_count} votes`);
  
  // Announce to all users
  const allUsers = await pool.query(`
    SELECT id FROM security.users WHERE is_active = TRUE
  `);
  
  for (const user of allUsers.rows) {
    await pool.query(`
      INSERT INTO security.notifications 
      (user_id, title, title_ar, message, message_ar, type, priority, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      user.id,
      "🎉 Tomorrow's Lunch",
      "🎉 غداء الغد",
      `${winner.dish_name} won with ${winner.vote_count} votes!`,
      `${winner.dish_name_ar || winner.dish_name} فاز بـ ${winner.vote_count} صوت!`,
      'cafe_result',
      'low',
      '/'
    ]);
  }
}

/**
 * Calculate next run time (for logging purposes)
 */
function getNextRunTime(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const nextRun = new Date(now);
  
  // Next run is at 0 or 30 minutes
  if (minutes < 30) {
    nextRun.setMinutes(30, 0, 0);
  } else {
    nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
  }
  
  return nextRun.toLocaleString('en-US', {
    timeZone: 'Asia/Riyadh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

