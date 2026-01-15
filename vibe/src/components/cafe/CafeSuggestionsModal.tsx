import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XMarkIcon,
  LightBulbIcon,
  HandThumbUpIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolidIcon } from '@heroicons/react/24/solid';
import {
  useSuggestions,
  useSubmitSuggestion,
  useUpvoteSuggestion,
  useRemoveUpvote,
} from '../../hooks/useCafe';

interface CafeSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CafeSuggestionsModal({ isOpen, onClose }: CafeSuggestionsModalProps) {
  const { t } = useTranslation();
  const [newSuggestion, setNewSuggestion] = useState('');
  
  const { data, isLoading } = useSuggestions();
  const submitSuggestion = useSubmitSuggestion();
  const upvote = useUpvoteSuggestion();
  const removeUpvote = useRemoveUpvote();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.trim()) return;
    
    try {
      await submitSuggestion.mutateAsync(newSuggestion.trim());
      setNewSuggestion('');
    } catch (error) {
      console.error('Failed to submit suggestion:', error);
    }
  };

  const handleUpvoteToggle = async (suggestionId: string, isUpvoted: boolean) => {
    try {
      if (isUpvoted) {
        await removeUpvote.mutateAsync(suggestionId);
      } else {
        await upvote.mutateAsync(suggestionId);
      }
    } catch (error) {
      console.error('Failed to toggle upvote:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <LightBulbIcon className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="font-bold text-lg text-gray-900">
              {t('cafe.suggestions', 'Food Suggestions')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : data?.suggestions && data.suggestions.length > 0 ? (
            data.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-gray-50 rounded-xl p-3 border border-gray-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{suggestion.suggestion_text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('cafe.suggestedBy', 'by')} {suggestion.suggested_by_name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpvoteToggle(suggestion.id, suggestion.user_upvoted)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      suggestion.user_upvoted
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {suggestion.user_upvoted ? (
                      <HandThumbUpSolidIcon className="w-4 h-4" />
                    ) : (
                      <HandThumbUpIcon className="w-4 h-4" />
                    )}
                    <span>{suggestion.upvote_count}</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <LightBulbIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {t('cafe.noSuggestions', 'No suggestions yet. Be the first!')}
              </p>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSuggestion}
              onChange={(e) => setNewSuggestion(e.target.value)}
              placeholder={t('cafe.suggestionPlaceholder', 'What would you like to eat?')}
              className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              maxLength={200}
            />
            <button
              type="submit"
              disabled={!newSuggestion.trim() || submitSuggestion.isPending}
              className="p-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitSuggestion.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



