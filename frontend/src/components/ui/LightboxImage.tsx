import React, { useState, useEffect } from 'react';
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
  const [imgSrc, setImgSrc] = useState(src || '/images/default_football.png');

  useEffect(() => {
    setImgSrc(src || '/images/default_football.png');
  }, [src]);

  const handleError = () => {
    setImgSrc('/images/default_football.png');
  };

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
          src={imgSrc}
          alt={alt}
          onError={handleError}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <ImageLightbox
        src={imgSrc}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};
