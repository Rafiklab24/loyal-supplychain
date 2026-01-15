import { z } from 'zod';

// Menu option schema (for creating/updating)
export const menuOptionSchema = z.object({
  dish_name: z.string().min(1, 'Dish name is required').max(200),
  dish_name_ar: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  description_ar: z.string().max(500).optional().nullable(),
  image_path: z.string().max(500).optional().nullable(),
});

// Post menu (3 options) schema
export const postMenuSchema = z.object({
  menu_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  options: z.array(menuOptionSchema).length(3, 'Exactly 3 menu options are required'),
});

// Vote schema
export const voteSchema = z.object({
  option_id: z.string().uuid('Invalid option ID'),
});

// Suggestion schema
export const suggestionSchema = z.object({
  suggestion_text: z.string().min(2, 'Suggestion must be at least 2 characters').max(200),
});

// Decide tie schema
export const decideTieSchema = z.object({
  winning_option_id: z.string().uuid('Invalid option ID'),
  menu_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// Update menu option schema
export const updateMenuOptionSchema = menuOptionSchema.partial();

// Types
export type MenuOption = z.infer<typeof menuOptionSchema>;
export type PostMenuInput = z.infer<typeof postMenuSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type SuggestionInput = z.infer<typeof suggestionSchema>;
export type DecideTieInput = z.infer<typeof decideTieSchema>;



