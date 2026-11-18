import { EN } from './en';
import { ES } from './es';

export type Language = 'es' | 'en';
export type TranslationKey = keyof typeof ES;

export const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { es: ES, en: EN };
