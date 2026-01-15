import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChartBarIcon,
  CalendarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { DateInput } from '../components/common/DateInput';
import {
  useTomorrowOptions,
  useVoteCounts,
  useMenuHistory,
  useSuggestions,
  usePostMenu,
  useCloseVoting,
  useDecideTie,
  useOpenSuggestions,
  useCloseSuggestions,
  useDeleteSuggestion,
} from '../hooks/useCafe';
import type { PostMenuOption } from '../services/cafe';

export default function CafeDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const [activeTab, setActiveTab] = useState<'menu' | 'voting' | 'suggestions' | 'history'>('menu');
  const [menuOptions, setMenuOptions] = useState<PostMenuOption[]>([
    { dish_name: '', dish_name_ar: '', description: '' },
    { dish_name: '', dish_name_ar: '', description: '' },
    { dish_name: '', dish_name_ar: '', description: '' },
  ]);
  const [menuDate, setMenuDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  // Queries
  const { data: _tomorrowOptions } = useTomorrowOptions();
  const { data: voteCounts, isLoading: voteCountsLoading } = useVoteCounts();
  const { data: history } = useMenuHistory();
  const { data: suggestionsData } = useSuggestions();

  // Mutations
  const postMenu = usePostMenu();
  const closeVoting = useCloseVoting();
  const decideTie = useDecideTie();
  const openSuggestions = useOpenSuggestions();
  const closeSuggestionsM = useCloseSuggestions();
  const deleteSuggestion = useDeleteSuggestion();

  const handleMenuOptionChange = (index: number, field: keyof PostMenuOption, value: string) => {
    const newOptions = [...menuOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setMenuOptions(newOptions);
  };

  const handlePostMenu = async () => {
    // Validate all options have names
    if (menuOptions.some(o => !o.dish_name.trim())) {
      alert(t('cafe.allOptionsRequired', 'All 3 options must have a name'));
      return;
    }

    try {
      await postMenu.mutateAsync({ menuDate, options: menuOptions });
      alert(t('cafe.menuPosted', 'Menu posted successfully!'));
      // Reset form
      setMenuOptions([
        { dish_name: '', dish_name_ar: '', description: '' },
        { dish_name: '', dish_name_ar: '', description: '' },
        { dish_name: '', dish_name_ar: '', description: '' },
      ]);
    } catch (error) {
      console.error('Failed to post menu:', error);
      alert(t('cafe.menuPostFailed', 'Failed to post menu'));
    }
  };

  const handleCloseVoting = async () => {
    try {
      const result = await closeVoting.mutateAsync();
      if (result.is_tie) {
        alert(t('cafe.tieDetected', 'There is a tie! Please select a winner.'));
      } else if (result.winner) {
        alert(t('cafe.winnerAnnounced', `Winner: ${result.winner.dish_name}`));
      }
    } catch (error) {
      console.error('Failed to close voting:', error);
    }
  };

  const handleDecideTie = async (winningOptionId: string) => {
    try {
      await decideTie.mutateAsync({ menuDate, winningOptionId });
      alert(t('cafe.tieDecided', 'Winner selected!'));
    } catch (error) {
      console.error('Failed to decide tie:', error);
    }
  };

  const handleToggleSuggestions = async () => {
    try {
      if (suggestionsData?.suggestions_open) {
        await closeSuggestionsM.mutateAsync();
      } else {
        await openSuggestions.mutateAsync();
      }
    } catch (error) {
      console.error('Failed to toggle suggestions:', error);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    try {
      await deleteSuggestion.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 p-4 sm:p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span className="text-3xl">🍳</span>
            {t('cafe.chefDashboard', 'Chef Dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('cafe.manageCafeteria', 'Manage the cafeteria menu and voting')}
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex overflow-x-auto">
            {[
              { id: 'menu', label: t('cafe.postMenu', 'Post Menu'), icon: PlusIcon },
              { id: 'voting', label: t('cafe.votingStatus', 'Voting Status'), icon: ChartBarIcon },
              { id: 'suggestions', label: t('cafe.suggestions', 'Suggestions'), icon: LightBulbIcon },
              { id: 'history', label: t('cafe.history', 'History'), icon: CalendarIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Post Menu Tab */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('cafe.postTomorrowMenu', "Post Tomorrow's Menu")}
                </h2>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <DateInput
                    value={menuDate}
                    onChange={(val) => setMenuDate(val)}
                    className="border-gray-300 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Menu Options */}
              <div className="grid gap-4">
                {menuOptions.map((option, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-700">
                        {t('cafe.option', 'Option')} {index + 1}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder={t('cafe.dishName', 'Dish Name (English)')}
                        value={option.dish_name}
                        onChange={(e) => handleMenuOptionChange(index, 'dish_name', e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder={t('cafe.dishNameAr', 'اسم الطبق (عربي)')}
                        value={option.dish_name_ar || ''}
                        onChange={(e) => handleMenuOptionChange(index, 'dish_name_ar', e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        dir="rtl"
                      />
                      <textarea
                        placeholder={t('cafe.description', 'Description (optional)')}
                        value={option.description || ''}
                        onChange={(e) => handleMenuOptionChange(index, 'description', e.target.value)}
                        className="sm:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handlePostMenu}
                disabled={postMenu.isPending}
                className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {postMenu.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <PlusIcon className="w-5 h-5" />
                )}
                {t('cafe.publishMenu', 'Publish Menu')}
              </button>
            </div>
          )}

          {/* Voting Status Tab */}
          {activeTab === 'voting' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('cafe.currentVoting', 'Current Voting Status')}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ClockIcon className="w-5 h-5" />
                  {t('cafe.closesAt6PM', 'Closes at 6:00 PM')}
                </div>
              </div>

              {voteCountsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                </div>
              ) : voteCounts?.options && voteCounts.options.length > 0 ? (
                <>
                  <div className="grid gap-4">
                    {voteCounts.options.map((option) => {
                      const percentage = voteCounts.total_votes > 0
                        ? Math.round((option.vote_count / voteCounts.total_votes) * 100)
                        : 0;
                      
                      return (
                        <div
                          key={option.id}
                          className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-gray-900">{option.dish_name}</span>
                              {option.dish_name_ar && (
                                <span className="text-gray-500 mx-2">|</span>
                              )}
                              {option.dish_name_ar && (
                                <span className="text-gray-600">{option.dish_name_ar}</span>
                              )}
                            </div>
                            <span className="font-bold text-indigo-600">
                              {option.vote_count} {t('cafe.votes', 'votes')}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <p className="text-right text-sm text-gray-500 mt-1">{percentage}%</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="text-gray-600">
                      {t('cafe.totalVotes', 'Total Votes')}: <strong>{voteCounts.total_votes}</strong>
                    </p>
                    <button
                      onClick={handleCloseVoting}
                      disabled={closeVoting.isPending}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      {t('cafe.closeVotingNow', 'Close Voting Now')}
                    </button>
                  </div>

                  {/* Tie Breaker Section */}
                  {voteCounts.voting_closed && (
                    <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 mb-3">
                        <ExclamationTriangleIcon className="w-5 h-5" />
                        <span className="font-semibold">{t('cafe.tieBreaker', 'Tie Breaker Needed')}</span>
                      </div>
                      <p className="text-amber-600 text-sm mb-4">
                        {t('cafe.selectWinner', 'Multiple options have the same votes. Select the winner:')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {voteCounts.options
                          .filter(o => o.vote_count === Math.max(...voteCounts.options.map(x => x.vote_count)))
                          .map((option) => (
                            <button
                              key={option.id}
                              onClick={() => handleDecideTie(option.id)}
                              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                            >
                              {option.dish_name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <ChartBarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('cafe.noVotingActive', 'No active voting session')}</p>
                </div>
              )}
            </div>
          )}

          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('cafe.foodSuggestions', 'Food Suggestions')}
                </h2>
                <button
                  onClick={handleToggleSuggestions}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    suggestionsData?.suggestions_open
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {suggestionsData?.suggestions_open
                    ? t('cafe.closeSuggestions', 'Close Suggestions')
                    : t('cafe.openSuggestions', 'Open Suggestions')}
                </button>
              </div>

              {suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
                <div className="grid gap-3">
                  {suggestionsData.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{suggestion.suggestion_text}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('cafe.suggestedBy', 'by')} {suggestion.suggested_by_name} • 
                          <span className="text-indigo-600 font-medium mx-1">
                            {suggestion.upvote_count}
                          </span>
                          {t('cafe.upvotes', 'upvotes')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSuggestion(suggestion.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <LightBulbIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('cafe.noSuggestions', 'No suggestions yet')}</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('cafe.menuHistory', 'Menu History')}
              </h2>

              {history?.history && history.history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          {t('cafe.date', 'Date')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          {t('cafe.winner', 'Winner')}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t('cafe.votes', 'Votes')}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t('cafe.tie', 'Tie?')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.history.map((item) => (
                        <tr key={item.menu_date} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(item.menu_date).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-900">{item.dish_name}</span>
                            {item.dish_name_ar && (
                              <span className="text-gray-500 text-sm mx-2">({item.dish_name_ar})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-sm font-medium">
                              {item.total_votes}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.was_tie ? (
                              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs">
                                {t('cafe.yes', 'Yes')}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('cafe.noHistory', 'No menu history yet')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



