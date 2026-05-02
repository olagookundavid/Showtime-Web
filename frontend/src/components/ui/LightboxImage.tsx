import React, { useState, useEffect } from 'react';
import { ImageLightbox } from './ImageLightbox';

interface LightboxImageProps {
  src: string;
  alt?: string;
  /** Classes for the outer wrapper div (size + shape, e.g. "w-8 h-8 rounded-md") */
  thumbnailClassName?: string;
  /** Classes for the inner img tag (e.g. "object-cover", "w-full h-full") */
  imgClassName?: string;
  title?: string;
}

export const LightboxImage: React.FC<LightboxImageProps> = ({ 
  src, 
  alt,
  title,
  thumbnailClassName = '',
  imgClassName = 'max-w-full max-h-full object-contain',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  return (
    <>
      <div 
        className={`${thumbnailClassName} overflow-hidden flex items-center justify-center cursor-zoom-in shrink-0 transition-transform duration-300 hover:scale-105 bg-gray-50 dark:bg-gray-900/40 rounded-md`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!hasError) setIsOpen(true);
        }}
        title={hasError ? 'No image available' : title || alt || 'View Full Image'}
      >
        {hasError ? (
          <svg viewBox="0 0 100 100" className="w-1/2 h-1/2 text-[#8B4513] dark:text-[#A56B46] fill-current drop-shadow-sm">
            <path d="M15 85 C40 105, 105 40, 85 15 C60 -5, -5 60, 15 85 Z" />
            <line x1="30" y1="70" x2="70" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
            <line x1="38" y1="52" x2="48" y2="62" stroke="white" strokeWidth="2.5" />
            <line x1="45" y1="45" x2="55" y2="55" stroke="white" strokeWidth="2.5" />
            <line x1="52" y1="38" x2="62" y2="48" stroke="white" strokeWidth="2.5" />
          </svg>
        ) : (
          <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className={imgClassName}
          />
        )}
      </div>
      {!hasError && (
        <ImageLightbox
          src={src}
          alt={alt}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
