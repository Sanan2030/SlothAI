import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind sinif adlarını birləşdirir və üst-üstə düşən utility-ləri
 * (məs. iki fərqli padding dəyəri) düzgün şəkildə həll edir.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
