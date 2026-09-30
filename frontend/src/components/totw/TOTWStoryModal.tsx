import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  SparklesIcon,
  PhotoIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import {
  saveTOTWArticle,
  type TeamOfTheWeek,
  type News,
  type CreateNewsPayload,
} from '../../services/api';
import { NewsContentEditor } from '../admin/NewsContentEditor';
import { ImageUploadField } from '../ui/ImageUploadField';
import { Spinner } from '../ui/Spinner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfirmSummary } from '../ui/ConfirmSummary';
import { getApiErrorMessage } from '../../utils/apiError';

interface TOTWStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  totwId: string;
  totwWeekTitle: string;
  initialStory?: News | null;
  onSaved: (updatedTotw: TeamOfTheWeek) => void;
}

export const TOTWStoryModal: React.FC<TOTWStoryModalProps> = ({
  isOpen,
  onClose,
  totwId,
  totwWeekTitle,
  initialStory,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [featuredMediaType, setFeaturedMediaType] = useState<'image' | 'youtube'>('image');
  const [featuredImage, setFeaturedImage] = useState('');
  const [featuredYoutubeUrl, setFeaturedYoutubeUrl] = useState('');
  const [author, setAuthor] = useState('Showtime Editorial');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialStory) {
        setTitle(initialStory.title || '');
        setExcerpt(initialStory.excerpt || '');
        setContent(initialStory.content || '');
        setFeaturedMediaType(initialStory.featured_media_type || 'image');
        setFeaturedImage(initialStory.featured_image || '');
        setFeaturedYoutubeUrl(initialStory.featured_youtube_url || '');
        setAuthor(initialStory.author || 'Showtime Editorial');
      } else {
        setTitle(`${totwWeekTitle} Editorial Breakdown`);
        setExcerpt('');
        setContent('');
        setFeaturedMediaType('image');
        setFeaturedImage('');
        setFeaturedYoutubeUrl('');
        setAuthor('Showtime Editorial');
      }
    }
  }, [isOpen, initialStory, totwWeekTitle]);

  if (!isOpen) return null;

  const requestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Article title is required');
      return;
    }
    if (!content.trim()) {
      toast.error('Article story content is required');
      return;
    }
    setConfirmingSave(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      const payload: CreateNewsPayload = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        content: content.trim(),
        featured_image: featuredMediaType === 'image' ? featuredImage.trim() : undefined,
        featured_media_type: featuredMediaType,
        featured_youtube_url: featuredMediaType === 'youtube' ? featuredYoutubeUrl.trim() : undefined,
        author: author.trim() || 'Showtime Editorial',
        category: 'Team of the Week',
        comments_enabled: true,
      };

      const updated = await saveTOTWArticle(totwId, payload);
      toast.success('Gameweek editorial breakdown saved!');
      setConfirmingSave(false);
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save story'));
      setConfirmingSave(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sffl-red/10 text-sffl-red flex items-center justify-center font-bold">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tight text-sffl-navy dark:text-white">
                {initialStory ? 'Edit Gameweek Editorial Breakdown' : 'Author Gameweek Breakdown'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Attached to {totwWeekTitle} • Displayed inline below the Starting XIV pitch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="totw-story-form" onSubmit={requestSubmit} className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Article Title */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Headline Title <span className="text-sffl-red">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 4: Dynamic Duos and Defensive Shutouts"
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-sffl-red focus:ring-sffl-red outline-none"
              required
            />
          </div>

          {/* Lead Excerpt */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Lead Summary / Excerpt
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A high-impact 1-2 sentence lead highlighting key match storylines..."
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm font-medium focus:border-sffl-red focus:ring-sffl-red outline-none"
            />
          </div>

          {/* Byline Author */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Byline / Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Showtime Editorial"
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-sffl-red focus:ring-sffl-red outline-none"
            />
          </div>

          {/* Featured Media */}
          <div className="space-y-3 bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Featured Cover Media (Optional)
              </label>
              <div className="inline-flex rounded-lg bg-gray-200 dark:bg-gray-600 p-0.5">
                <button
                  type="button"
                  onClick={() => setFeaturedMediaType('image')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition ${
                    featuredMediaType === 'image'
                      ? 'bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <PhotoIcon className="w-3.5 h-3.5" />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeaturedMediaType('youtube')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition ${
                    featuredMediaType === 'youtube'
                      ? 'bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <PlayCircleIcon className="w-3.5 h-3.5" />
                  <span>YouTube</span>
                </button>
              </div>
            </div>

            {featuredMediaType === 'image' ? (
              <ImageUploadField
                label="Featured Cover Photo"
                value={featuredImage}
                onChange={setFeaturedImage}
                folder="news"
                helperText="High-resolution landscape hero banner (recommended 16:9 or 21:9)"
              />
            ) : (
              <div>
                <input
                  type="url"
                  value={featuredYoutubeUrl}
                  onChange={(e) => setFeaturedYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-sffl-red focus:ring-sffl-red outline-none"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Paste the full YouTube match highlights or breakdown video URL.
                </p>
              </div>
            )}
          </div>

          {/* Story Body via NewsContentEditor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Editorial Story Body <span className="text-sffl-red">*</span>
              </label>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Supports player mentions (@player), team mentions (@team), images & video tags
              </span>
            </div>
            <NewsContentEditor
              value={content}
              onChange={setContent}
              rows={12}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="totw-story-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>Saving Story...</span>
              </>
            ) : (
              <span>Save Editorial Story</span>
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingSave}
        title={initialStory ? 'Save changes to this editorial story?' : 'Publish this editorial story?'}
        confirmLabel={initialStory ? 'Save Changes' : 'Publish Story'}
        tone="info"
        icon={SparklesIcon}
        body={
          <ConfirmSummary
            rows={[
              ['Attached to', totwWeekTitle],
              ['Title', title],
              ['Author', author.trim() || 'Showtime Editorial'],
            ]}
          />
        }
        pending={isSaving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmingSave(false)}
      />
    </div>
  );
};
