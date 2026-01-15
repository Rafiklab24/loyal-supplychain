import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon, 
  LanguageIcon,
  Bars3Icon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

const LANGUAGES = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
] as const;

export function Header({ onMenuClick }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { userName, logout } = useAuth();

  const changeLanguage = (langCode: string) => {
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (lang) {
      i18n.changeLanguage(langCode);
      document.documentElement.lang = langCode;
      document.documentElement.dir = lang.dir;
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 z-10 flex-shrink-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Mobile menu button + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label={t('nav.toggleMenu', 'Toggle navigation menu')}
              aria-expanded="false"
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex items-center">
              {/* Language-based Logo */}
              <img 
                src={i18n.language === 'ar' ? '/images/Logo-ar.png' : '/images/Logo-en.png'}
                alt={t('app.title', 'Loyal International')}
                className="h-10 w-auto object-contain transition-opacity duration-300"
                onError={(e) => {
                  console.error('Logo failed to load');
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Right: Notifications + Language toggle + User menu */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationBell />
            
            {/* Language Selector */}
            <Menu as="div" className="relative">
              <Menu.Button 
                className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={t('nav.selectLanguage', 'Select language')}
              >
                <LanguageIcon className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium hidden sm:block">{currentLang.flag} {currentLang.name}</span>
                <span className="text-sm font-medium sm:hidden">{currentLang.flag}</span>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute end-0 mt-2 w-40 origin-top-end rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50" role="menu">
                  <div className="py-1">
                    {LANGUAGES.map((lang) => (
                      <Menu.Item key={lang.code}>
                        {({ active }) => (
                          <button
                            onClick={() => changeLanguage(lang.code)}
                            className={`${
                              active ? 'bg-gray-100' : ''
                            } ${
                              i18n.language === lang.code ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                            } group flex w-full items-center gap-3 px-4 py-2 text-sm focus:outline-none focus:bg-gray-100`}
                            role="menuitem"
                          >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.name}</span>
                            {i18n.language === lang.code && (
                              <span className="ms-auto text-primary-600">✓</span>
                            )}
                          </button>
                        )}
                      </Menu.Item>
                    ))}
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            {/* User Menu */}
            <Menu as="div" className="relative">
              <Menu.Button 
                className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={t('nav.userMenu', 'User menu')}
                aria-haspopup="true"
              >
                <UserCircleIcon className="h-6 w-6" aria-hidden="true" />
                <span className="text-sm font-medium hidden sm:block">{userName || 'User'}</span>
                <span className="sr-only">{userName || 'User'}</span>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute end-0 mt-2 w-48 origin-top-end rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={logout}
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } group flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:bg-gray-100`}
                          role="menuitem"
                          aria-label={t('nav.logout', 'Logout')}
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
                          {t('nav.logout')}
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}

