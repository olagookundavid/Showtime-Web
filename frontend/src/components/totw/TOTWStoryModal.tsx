import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
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
import { Button, Field, Input, Modal, Textarea } from '../ui';
import { ImageUploadField } from '../ui/ImageUploadField';
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
    <>
      <Modal
        open
        onClose={onClose}
        title={initialStory ? 'Edit Gameweek Editorial Breakdown' : 'Author Gameweek Breakdown'}
        subtitle={`Attached to ${totwWeekTitle} • Displayed inline below the Starting XIV pitch`}
        maxWidth="4xl"
        footer={
          <>
            <Button variant="secondary" disabled={isSaving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="totw-story-form" loading={isSaving}>
              {isSaving ? 'Saving Story…' : 'Save Editorial Story'}
            </Button>
          </>
        }
      >
        {/* Form Body */}
        <form id="totw-story-form" onSubmit={requestSubmit} className="space-y-6">
          {/* Article Title */}
          <Field label={<>Headline Title <span className="text-sffl-red">*</span></>} htmlFor="totw-title">
            <Input
              id="totw-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 4: Dynamic Duos and Defensive Shutouts"
              required
            />
          </Field>

          {/* Lead Excerpt */}
          <Field label="Lead Summary / Excerpt" htmlFor="totw-excerpt">
            <Textarea
              id="totw-excerpt"
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A high-impact 1-2 sentence lead highlighting key match storylines..."
            />
          </Field>

          {/* Byline Author */}
          <Field label="Byline / Author" htmlFor="totw-author">
            <Input
              id="totw-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Showtime Editorial"
            />
          </Field>

          {/* Featured Media */}
          <div className="space-y-3 bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Featured Cover Media (Optional)
              </label>
              <div className="inline-flex rounded-lg bg-gray-200 dark:bg-gray-600 p-0.5">
                <Button
                  size="sm"
                  variant={featuredMediaType === 'image' ? 'secondary' : 'ghost'}
                  icon={PhotoIcon}
                  onClick={() => setFeaturedMediaType('image')}
                >
                  Image
                </Button>
                <Button
                  size="sm"
                  variant={featuredMediaType === 'youtube' ? 'secondary' : 'ghost'}
                  icon={PlayCircleIcon}
                  onClick={() => setFeaturedMediaType('youtube')}
                >
                  YouTube
                </Button>
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
                <Input
                  type="url"
                  aria-label="Featured YouTube URL"
                  value={featuredYoutubeUrl}
                  onChange={(e) => setFeaturedYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
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
      </Modal>

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
    </>
  );
};
