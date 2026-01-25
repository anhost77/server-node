import { createI18n } from 'vue-i18n';
import en from './locales/en';
import fr from './locales/fr';
import de from './locales/de';
import es from './locales/es';
import it from './locales/it';

// Get saved language or detect from browser
function getDefaultLocale(): string {
    const saved = localStorage.getItem('locale');
    if (saved && ['en', 'fr', 'de', 'es', 'it'].includes(saved)) {
        return saved;
    }

    const browserLang = navigator.language.split('-')[0];
    if (['en', 'fr', 'de', 'es', 'it'].includes(browserLang)) {
        return browserLang;
    }

    return 'en';
}

export const i18n = createI18n({
    legacy: false,
    locale: getDefaultLocale(),
    fallbackLocale: 'en',
    messages: {
        en,
        fr,
        de,
        es,
        it
    }
});

export const availableLocales = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
];

type SupportedLocale = 'en' | 'fr' | 'de' | 'es' | 'it';

export function setLocale(locale: string) {
    if (['en', 'fr', 'de', 'es', 'it'].includes(locale)) {
        i18n.global.locale.value = locale as SupportedLocale;
        localStorage.setItem('locale', locale);
        document.documentElement.lang = locale;
    }
}

export default i18n;
