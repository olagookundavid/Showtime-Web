import React, { useState, useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  // 'cover' (default) crops to fill the box — good for thumbnails & heroes.
  // 'contain' fits the whole image without cropping — good for product
  // photography where the edges (sleeves, neckline) matter.
  objectFit?: "cover" | "contain";
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  objectFit = "cover",
  ...props
}) => {
  const [imageState, setImageState] = useState<{
    src: string;
    status: "loading" | "loaded" | "error";
  }>({ src, status: "loading" });

  const isLoaded = imageState.src === src && imageState.status === "loaded";
  const isError = imageState.src === src && imageState.status === "error";

  useEffect(() => {
    const img = new Image();
    let isCurrent = true;
    img.src = src;
    img.onload = () => {
      if (isCurrent) setImageState({ src, status: "loaded" });
    };
    img.onerror = () => {
      if (isCurrent) setImageState({ src, status: "error" });
    };

    return () => {
      isCurrent = false;
    };
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900/40 ${placeholderClassName}`}
    >
      {/* Pulsing premium skeleton loader overlay before image completes loading */}
      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-linear-to-r from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse flex items-center justify-center">
          {/* Tiny decorative logo or spinner overlay */}
          <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin opacity-60"></div>
        </div>
      )}

      {/* Error state fallback */}
      {isError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 p-4 text-center select-none">
          <ExclamationTriangleIcon
            className="w-7 h-7 mb-1"
            aria-hidden="true"
          />
          <span className="text-[10px] font-black uppercase tracking-wider">
            Image Unavailable
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full ${objectFit === "contain" ? "object-contain" : "object-cover"} transition-all duration-700 ease-out select-none ${
            isLoaded
              ? "opacity-100 scale-100 filter blur-0"
              : "opacity-0 scale-95 filter blur-md"
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};
