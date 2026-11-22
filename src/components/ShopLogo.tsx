import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

interface ShopLogoProps {
  logoDataUrl?: string;
  shopName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ShopLogoProps['size']>, { box: string; icon: string }> = {
  xs: { box: 'w-6 h-6 rounded-md', icon: 'w-3.5 h-3.5' },
  sm: { box: 'w-9 h-9 rounded-lg', icon: 'w-5 h-5' },
  md: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6' },
  lg: { box: 'w-16 h-16 rounded-2xl', icon: 'w-8 h-8' },
  xl: { box: 'w-20 h-20 rounded-2xl', icon: 'w-10 h-10' },
};

export const ShopLogo: React.FC<ShopLogoProps> = ({
  logoDataUrl,
  shopName,
  size = 'sm',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoDataUrl]);

  const dim = SIZE_CLASSES[size];
  const hasLogo = Boolean(logoDataUrl && logoDataUrl.startsWith('data:image/') && !imgError);

  if (hasLogo) {
    return (
      <div
        className={`${dim.box} bg-white/95 dark:bg-slate-100 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs ${className}`}
      >
        <img
          src={logoDataUrl}
          alt={shopName ? `Logo ${shopName}` : 'Logo Usaha'}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim.box} bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-2xs ${className}`}
      aria-label={shopName ? `Ikon ${shopName}` : 'Logo PrintDesk'}
    >
      <Printer className={dim.icon} />
    </div>
  );
};
