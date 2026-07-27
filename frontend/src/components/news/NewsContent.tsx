import { Link } from 'react-router-dom';
import { LightboxImage } from '../ui';
import { YouTubeEmbed } from './YouTubeEmbed';
import { NewsReferenceCard } from './NewsReferenceCard';
import {
    parseNewsContent, parseInlineMentions,
    type InlinePart,
} from '../../utils/newsContent';

// Renders article body text authored with the news tag grammar (see
// utils/newsContent.ts). Tags are parsed into React elements — no raw HTML is
// ever injected.

const MENTION_STYLES: Record<'team' | 'player', string> = {
    team: 'bg-sffl-navy/10 text-sffl-navy dark:bg-blue-400/15 dark:text-blue-300',
    player: 'bg-sffl-red/10 text-sffl-red dark:bg-red-400/15 dark:text-red-300',
};

const InlineText = ({ text }: { text: string }) => {
    const parts: InlinePart[] = parseInlineMentions(text);
    return (
        <>
            {parts.map((part, i) =>
                part.type === 'text' ? (
                    <span key={i}>{part.text}</span>
                ) : (
                    <Link
                        key={i}
                        to={`/${part.kind}s/${part.id}`}
                        className={`inline-flex items-baseline font-bold px-1.5 py-0.5 rounded-md hover:underline transition ${MENTION_STYLES[part.kind]}`}
                    >
                        {part.name}
                    </Link>
                )
            )}
        </>
    );
};

export const NewsContent = ({ content }: { content: string }) => {
    const segments = parseNewsContent(content);

    return (
        <>
            {segments.map((segment, i) => {
                if (segment.type === 'image') {
                    return (
                        <figure key={i} className="my-8">
                            <div className="rounded-xl overflow-hidden">
                                <LightboxImage
                                    src={segment.url}
                                    alt={segment.caption || 'Article image'}
                                    thumbnailClassName="w-full"
                                    imgClassName="w-full h-auto object-cover"
                                />
                            </div>
                            {segment.caption && (
                                <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                                    {segment.caption}
                                </figcaption>
                            )}
                        </figure>
                    );
                }
                if (segment.type === 'youtube') {
                    return (
                        <div key={i} className="my-8 aspect-video rounded-xl overflow-hidden">
                            <YouTubeEmbed videoId={segment.videoId} title="Embedded video" />
                        </div>
                    );
                }
                if (segment.type === 'news_ref') {
                    return (
                        <NewsReferenceCard
                            key={i}
                            url={segment.url}
                            isInternal={segment.isInternal}
                            slug={segment.slug}
                            domain={segment.domain}
                            title={segment.title}
                        />
                    );
                }
                return segment.text
                    .split(/\n{2,}/)
                    .filter(p => p.trim())
                    .map((paragraph, j) => (
                        <p key={`${i}-${j}`}>
                            <InlineText text={paragraph} />
                        </p>
                    ));
            })}
        </>
    );
};
