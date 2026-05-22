type Props = {
    text: string | undefined | null;
    className?: string;
};

// Renders a product description as a list of paragraphs. Splits the input on
// blank lines (paragraph breaks) and preserves single newlines inside each
// paragraph via whitespace-pre-line. This gives the visual structure of a
// professional product page (e.g. Shopify) without pulling in a markdown lib.
export const ProductDescription = ({ text, className = '' }: Props) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return null;

    const paragraphs = trimmed
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean);

    return (
        <div className={`space-y-3 ${className}`}>
            {paragraphs.map((para, i) => (
                <p key={i} className="text-base font-medium text-gray-800 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {para}
                </p>
            ))}
        </div>
    );
};
