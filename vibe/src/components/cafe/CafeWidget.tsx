import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { useCafeStatus, useTomorrowOptions, useSubmitVote, useSuggestions } from '../../hooks/useCafe';
import CafeSuggestionsModal from './CafeSuggestionsModal';

export default function CafeWidget() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const { data: status, isLoading: statusLoading } = useCafeStatus();
  const { data: tomorrow, isLoading: tomorrowLoading } = useTomorrowOptions();
  const { data: suggestionsData } = useSuggestions();
  const submitVote = useSubmitVote();

  // Set selected option when we get the user's vote
  useEffect(() => {
    if (tomorrow?.user_vote) {
      setSelectedOption(tomorrow.user_vote);
    }
  }, [tomorrow?.user_vote]);

  const handleVote = async (optionId: string) => {
    setSelectedOption(optionId);
    try {
      await submitVote.mutateAsync(optionId);
    } catch (error) {
      console.error('Failed to submit vote:', error);
      // Revert selection on error
      setSelectedOption(tomorrow?.user_vote || null);
    }
  };

  const formatTimeRemaining = (time: { hours: number; minutes: number } | null) => {
    if (!time) return '';
    if (time.hours > 0) {
      return `${time.hours}h ${time.minutes}m`;
    }
    return `${time.minutes}m`;
  };

  // Don't render if no status yet
  if (statusLoading || !status) {
    return null;
  }

  const todayMenu = status.today_menu;
  const hasVoted = tomorrow?.has_voted || false;
  const votingClosed = status.voting_closed;

  return (
    <>
      {/* Floating Widget */}
      <div
        className={`fixed bottom-4 ${isRtl ? 'left-4' : 'right-4'} z-50 transition-all duration-300 ease-in-out`}
        style={{ maxWidth: isExpanded ? '320px' : '200px' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header - Always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="font-semibold text-sm">
                {isExpanded ? t('cafe.title', 'Cafeteria') : (todayMenu?.dish_name || t('cafe.noMenu', 'No menu'))}
              </span>
            </div>
            {isExpanded ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronUpIcon className="w-5 h-5" />
            )}
          </button>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="p-4 space-y-4">
              {/* Today's Menu Section */}
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t('cafe.todayLunch', "Today's Lunch")}</span>
                </div>
                {todayMenu ? (
                  <div>
                    <p className="font-bold text-emerald-900 text-lg">{todayMenu.dish_name}</p>
                    {todayMenu.dish_name_ar && (
                      <p className="text-emerald-700 text-sm">{todayMenu.dish_name_ar}</p>
                    )}
                    {todayMenu.was_tie && (
                      <p className="text-xs text-emerald-600 mt-1">
                        {t('cafe.decidedByChef', 'Decided by chef')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-emerald-600 text-sm italic">
                    {t('cafe.noMenuToday', 'No menu set for today')}
                  </p>
                )}
              </div>

              {/* Tomorrow's Voting Section */}
              <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <SparklesIcon className="w-5 h-5" />
                    <span className="font-semibold text-sm">{t('cafe.voteForTomorrow', 'Vote for Tomorrow')}</span>
                  </div>
                  {status.time_remaining && (
                    <div className="flex items-center gap-1 text-indigo-600 text-xs">
                      <ClockIcon className="w-4 h-4" />
                      <span>{formatTimeRemaining(status.time_remaining)}</span>
                    </div>
                  )}
                </div>

                {tomorrowLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                  </div>
                ) : !status.has_tomorrow_options ? (
                  <p className="text-indigo-600 text-sm italic text-center py-2">
                    {t('cafe.chefPreparing', 'Chef is preparing options...')}
                  </p>
                ) : status.has_tie ? (
                  <p className="text-amber-600 text-sm italic text-center py-2">
                    {t('cafe.tieWaiting', "It's a tie! Waiting for chef...")}
                  </p>
                ) : votingClosed && status.result_finalized ? (
                  <div className="space-y-2">
                    {tomorrow?.options.map((option) => (
                      <div
                        key={option.id}
                        className={`p-2 rounded-lg text-sm ${
                          tomorrow.options.reduce((max, o) => 
                            (o.vote_count || 0) > (max.vote_count || 0) ? o : max
                          ).id === option.id
                            ? 'bg-violet-100 border border-violet-300'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{option.dish_name}</span>
                          <span className="text-violet-600 font-bold">
                            {option.vote_count || 0} {t('cafe.votes', 'votes')}
                          </span>
                        </div>
                      </div>
                    ))}
                    <p className="text-center text-violet-600 text-xs mt-2">
                      🎉 {t('cafe.votingEnded', 'Voting has ended!')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tomorrow?.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleVote(option.id)}
                        disabled={votingClosed || submitVote.isPending}
                        className={`w-full p-2 rounded-lg text-sm transition-all ${
                          selectedOption === option.id
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                        } ${votingClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedOption === option.id
                                ? 'border-white bg-white'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedOption === option.id && (
                              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                            )}
                          </div>
                          <span className="font-medium">{option.dish_name}</span>
                        </div>
                        {option.dish_name_ar && (
                          <p className={`text-xs mt-1 ${isRtl ? 'text-right' : 'text-left'} ${
                            selectedOption === option.id ? 'text-indigo-100' : 'text-gray-500'
                          }`}>
                            {option.dish_name_ar}
                          </p>
                        )}
                      </button>
                    ))}
                    
                    {hasVoted && (
                      <p className="text-center text-indigo-600 text-xs flex items-center justify-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        {t('cafe.votedSuccessfully', 'Vote recorded!')}
                      </p>
                    )}
                    
                    {votingClosed && (
                      <p className="text-center text-gray-500 text-xs">
                        {t('cafe.votingClosed', 'Voting is closed')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Suggestions Button (if open) */}
              {suggestionsData?.suggestions_open && (
                <button
                  onClick={() => setShowSuggestions(true)}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <LightBulbIcon className="w-5 h-5" />
                  {t('cafe.suggestDish', 'Suggest a dish')}
                </button>
              )}

              {/* Stats */}
              {tomorrow && tomorrow.total_voters > 0 && (
                <p className="text-center text-gray-400 text-xs">
                  {tomorrow.total_voters} {t('cafe.peopleVoted', 'people have voted')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Modal */}
      <CafeSuggestionsModal
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
      />
    </>
  );
}



