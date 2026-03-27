import React, { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';

interface LightboxImageProps {
  src: string;
  alt?: string;
  /** Classes for the outer wrapper div (size + shape, e.g. "w-8 h-8 rounded-md") */
  thumbnailClassName?: string;
  title?: string;
}

export const LightboxImage: React.FC<LightboxImageProps> = ({ 
  src, 
  alt,
  title,
  thumbnailClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className={`${thumbnailClassName} overflow-hidden flex items-center justify-center cursor-zoom-in shrink-0 transition-transform duration-300 hover:scale-105`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={title || alt || 'View Full Image'}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <ImageLightbox
        src={src}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};
