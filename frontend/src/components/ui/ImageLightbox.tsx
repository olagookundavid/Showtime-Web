import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, isOpen, onClose }) => {
  // Prevent scrolling when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-10 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[101]"
      >
        <XMarkIcon className="w-8 h-8" />
      </button>

      <div 
        className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {src.includes('default_football.png') ? (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-900/80 rounded-[2rem] border border-white/10 backdrop-blur-xl max-w-sm text-center shadow-2xl">
            <img src={src} className="w-40 h-40 object-contain mb-6 opacity-80" alt="No image" />
            <p className="text-white font-black uppercase tracking-widest text-lg italic">No Image Selected</p>
            <p className="text-gray-400 text-xs mt-3 font-medium">A profile or logo image has not been provided yet.</p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt || 'Full view'}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl transition-transform"
          />
        )}
        {alt && (
          <div className="absolute -bottom-10 left-0 right-0 text-center text-white/70 text-sm font-medium px-4 truncate">
            {alt}
          </div>
        )}
      </div>
    </div>
  );
};
