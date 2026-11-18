import { useState } from 'react';
import { Award as AwardIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className, fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-gradient-to-br from-[#0B192C] via-[#132844] to-[#1E3A5F] text-white/80 p-4 text-center',
          className
        )}
        role="img"
        aria-label={alt}
      >
        <AwardIcon className="h-8 w-8 text-[#C59B27] mb-2" />
        {fallbackTitle && (
          <span className="text-xs font-medium tracking-wide text-slate-200 line-clamp-2 max-w-[18ch]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
