import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Get auth header
function getAuthHeader() {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Types
export interface MenuOption {
  id: string;
  menu_date: string;
  option_number: number;
  dish_name: string;
  dish_name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  image_path?: string | null;
  created_at: string;
  vote_count?: number;
}

export interface TodayMenu {
  menu_date: string;
  total_votes: number;
  was_tie: boolean;
  finalized_at: string;
  option_id: string;
  dish_name: string;
  dish_name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  image_path?: string | null;
  decided_by_name?: string | null;
}

export interface TomorrowResponse {
  options: MenuOption[];
  user_vote: string | null;
  has_voted: boolean;
  voting_closed: boolean;
  voting_finalized: boolean;
  time_remaining: { hours: number; minutes: number } | null;
  total_voters: number;
}

export interface CafeStatus {
  today_menu: TodayMenu | null;
  has_tomorrow_options: boolean;
  tomorrow_options_count: number;
  voting_open: boolean;
  voting_closed: boolean;
  result_finalized: boolean;
  has_tie: boolean;
  suggestions_open: boolean;
  time_remaining: { hours: number; minutes: number } | null;
}

export interface Suggestion {
  id: string;
  suggestion_text: string;
  suggested_by: string;
  suggested_by_name: string;
  created_at: string;
  upvote_count: number;
  user_upvoted: boolean;
}

export interface SuggestionsResponse {
  suggestions_open: boolean;
  suggestions: Suggestion[];
}

export interface VoteCountOption {
  id: string;
  option_number: number;
  dish_name: string;
  dish_name_ar?: string | null;
  vote_count: number;
}

export interface VoteCountsResponse {
  options: VoteCountOption[];
  total_votes: number;
  voting_closed: boolean;
}

export interface MenuHistoryItem {
  menu_date: string;
  total_votes: number;
  was_tie: boolean;
  finalized_at: string;
  dish_name: string;
  dish_name_ar?: string | null;
  decided_by_name?: string | null;
}

export interface MenuHistoryResponse {
  history: MenuHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PostMenuOption {
  dish_name: string;
  dish_name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  image_path?: string | null;
}

// API Functions

// Get today's menu (winner)
export async function getTodayMenu(): Promise<{ menu: TodayMenu | null }> {
  const response = await axios.get(`${API_BASE_URL}/cafe/today`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Get tomorrow's options and voting status
export async function getTomorrowOptions(): Promise<TomorrowResponse> {
  const response = await axios.get(`${API_BASE_URL}/cafe/tomorrow`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Get cafe status (for widget)
export async function getCafeStatus(): Promise<CafeStatus> {
  const response = await axios.get(`${API_BASE_URL}/cafe/status`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Submit or change vote
export async function submitVote(optionId: string): Promise<{ success: boolean }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/vote`,
    { option_id: optionId },
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Get user's current vote
export async function getMyVote(): Promise<{ vote: { option_id: string; dish_name: string; dish_name_ar?: string; voted_at: string } | null }> {
  const response = await axios.get(`${API_BASE_URL}/cafe/my-vote`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Get suggestions
export async function getSuggestions(): Promise<SuggestionsResponse> {
  const response = await axios.get(`${API_BASE_URL}/cafe/suggestions`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Submit a suggestion
export async function submitSuggestion(suggestionText: string): Promise<{ success: boolean; suggestion: Suggestion }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/suggestions`,
    { suggestion_text: suggestionText },
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Upvote a suggestion
export async function upvoteSuggestion(suggestionId: string): Promise<{ success: boolean }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/suggestions/${suggestionId}/upvote`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Remove upvote
export async function removeUpvote(suggestionId: string): Promise<{ success: boolean }> {
  const response = await axios.delete(
    `${API_BASE_URL}/cafe/suggestions/${suggestionId}/upvote`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

// ============================================
// CHEF ONLY ENDPOINTS
// ============================================

// Post menu (3 options)
export async function postMenu(menuDate: string, options: PostMenuOption[]): Promise<{ success: boolean }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/menu`,
    { menu_date: menuDate, options },
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Update a menu option
export async function updateMenuOption(optionId: string, updates: Partial<PostMenuOption>): Promise<{ success: boolean; option: MenuOption }> {
  const response = await axios.put(
    `${API_BASE_URL}/cafe/menu/${optionId}`,
    updates,
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Delete a menu option
export async function deleteMenuOption(optionId: string): Promise<{ success: boolean }> {
  const response = await axios.delete(`${API_BASE_URL}/cafe/menu/${optionId}`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Get vote counts (chef only)
export async function getVoteCounts(): Promise<VoteCountsResponse> {
  const response = await axios.get(`${API_BASE_URL}/cafe/votes/count`, {
    headers: getAuthHeader(),
  });
  return response.data;
}

// Close voting manually
export async function closeVoting(): Promise<{ success: boolean; is_tie?: boolean; tied_options?: VoteCountOption[]; winner?: VoteCountOption }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/close-voting`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Decide tie
export async function decideTie(menuDate: string, winningOptionId: string): Promise<{ success: boolean; winner: MenuOption }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/decide-tie`,
    { menu_date: menuDate, winning_option_id: winningOptionId },
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Get menu history
export async function getMenuHistory(limit = 30, offset = 0): Promise<MenuHistoryResponse> {
  const response = await axios.get(`${API_BASE_URL}/cafe/history`, {
    headers: getAuthHeader(),
    params: { limit, offset },
  });
  return response.data;
}

// Open suggestions mode
export async function openSuggestions(): Promise<{ success: boolean }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/suggestions/open`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Close suggestions mode
export async function closeSuggestions(): Promise<{ success: boolean }> {
  const response = await axios.post(
    `${API_BASE_URL}/cafe/suggestions/close`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
}

// Delete/deactivate a suggestion (chef only)
export async function deleteSuggestion(suggestionId: string): Promise<{ success: boolean }> {
  const response = await axios.delete(`${API_BASE_URL}/cafe/suggestions/${suggestionId}`, {
    headers: getAuthHeader(),
  });
  return response.data;
}



