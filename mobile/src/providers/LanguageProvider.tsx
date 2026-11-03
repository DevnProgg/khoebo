import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'st';

const LANGUAGE_KEY = 'khoebo_language';

type TranslationKey = keyof typeof translations.en;

const translations = {
  en: {
    home: 'Home',
    sell: 'Sell',
    stock: 'Stock',
    more: 'More',
    settings: 'Settings',
    settingsSubtitle: 'Make Khoebo feel like yours.',
    account: 'Account',
    personalInformation: 'Personal information',
    personalInformationSubtitle: 'Your name and account email',
    passwordSecurity: 'Password & security',
    passwordSecuritySubtitle: 'Change your password',
    business: 'Business',
    businessProfile: 'Business profile',
    noBusinessSelected: 'No business selected',
    teamRoles: 'Team & roles',
    teamRolesSubtitle: 'Manage who has access',
    support: 'Support',
    aboutKhoebo: 'About Khoebo',
    signOut: 'Sign out',
    signOutPrompt: 'Sign out?',
    cancel: 'Cancel',
    signOutAgain: 'You can sign back in at any time.',
    signOutBody: 'Your data stays safe and ready for next time.',
    language: 'Language',
    languageSubtitle: 'Choose the language for Khoebo',
    english: 'English',
    sesotho: 'Sesotho',
    personalInformationSubtitleFull: 'How you appear in Khoebo.',
    fullName: 'Full name',
    yourName: 'Your name',
    emailAddress: 'Email address',
    emailLocked: 'Your email is used to sign in and cannot be changed here.',
    saveChanges: 'Save changes',
    changePassword: 'Change your password',
    keepAccountSecure: 'Keep your account secure.',
    passwordSecuritySubtitleFull: 'Keep your account protected.',
    chooseStrongPassword: 'Choose a strong password',
    passwordChangeWarning: 'Changing your password signs out other devices where you are logged in.',
    currentPassword: 'Current password',
    yourCurrentPassword: 'Your current password',
    newPassword: 'New password',
    atLeastEight: 'At least 8 characters',
    confirmNewPassword: 'Confirm new password',
    repeatPassword: 'Repeat your new password',
    containsLetter: 'Contains a letter',
    containsNumber: 'Contains a number',
    passwordsMatch: 'Passwords match',
    updatePassword: 'Update password',
    welcomeBack: 'Welcome back',
    signInSubtitle: 'Sign in to pick up where you left off.',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    newToKhoebo: 'New to Khoebo?',
    createAccount: 'Create an account',
    getStarted: 'Get started',
    alreadyHaveAccount: 'I already have an account',
    sales: 'Sales',
    insights: 'Insights',
    books: 'Books',
    businessSimplified: 'BUSINESS, SIMPLIFIED',
    knowYourNumbers: 'Know your numbers.',
    growWithConfidence: 'Grow with confidence.',
    welcomeSubtitle: 'Sell, track stock, and keep clean books, all in one calm, connected place.',
    madeForSmallBusinesses: 'Made for small businesses that do big things.',
    profileUpdated: 'Profile updated',
    nameCannotBeEmpty: 'Your name cannot be empty.',
    passwordChanged: 'Password updated',
    enterCurrentPassword: 'Enter your current password.',
    passwordRequirements: 'Your new password does not meet the requirements.',
    passwordsDoNotMatch: 'Those passwords do not match.',
    couldNotSignIn: 'Could not sign in. Please try again.',
    businessDetails: 'Business details',
    businessName: 'Business name',
    yourBusiness: 'Your business',
    currencyCode: 'Currency code',
    onlyOwnersAdmins: 'Only owners and admins can edit business details.',
    noBusinessYet: 'No business yet',
    yourBusinesses: 'Your businesses',
    active: 'Active',
    switchBusiness: 'Switch',
    noBusinesses: 'No businesses',
    createAnotherBusiness: 'Create another business',
    dangerZone: 'Danger zone',
    deleteThisBusiness: 'Delete this business',
    deleteBusiness: 'Delete business',
  },
  st: {
    home: 'Lapeng',
    sell: 'Rekisa',
    stock: 'Thepa',
    more: 'Tse ling',
    settings: 'Litlhophiso',
    settingsSubtitle: 'Etsa Khoebo ea hao.',
    account: 'Akhaonto',
    personalInformation: 'Litaba tsa botho',
    personalInformationSubtitle: 'Lebitso la hao le imeile ea akhaonto',
    passwordSecurity: 'Lekunutu le tšireletso',
    passwordSecuritySubtitle: 'Fetola lekunutu la hao',
    business: 'Khoebo',
    businessProfile: 'Boemo ba khoebo',
    noBusinessSelected: 'Ha ho khoebo e khethiloeng',
    teamRoles: 'Sehlopha le mesebetsi',
    teamRolesSubtitle: 'Laola ba nang le tumello',
    support: 'Thuso',
    aboutKhoebo: 'Ka Khoebo',
    signOut: 'Tsoa',
    signOutPrompt: 'Tsoa?',
    cancel: 'Hlakola',
    signOutAgain: 'U ka kena hape neng kapa neng.',
    signOutBody: 'Lintlha tsa hao li bolokehile ebile li tla be li lokile nakong e tlang.',
    language: 'Puo',
    languageSubtitle: 'Khetha puo ea Khoebo',
    english: 'Senyesemane',
    sesotho: 'Sesotho',
    personalInformationSubtitleFull: 'Kamoo u hlahang kateng ho Khoebo.',
    fullName: 'Lebitso le felletseng',
    yourName: 'Lebitso la hao',
    emailAddress: 'Imeile',
    emailLocked: 'Imeile ea hao e sebelisoa ho kena ebile e ke ke ea fetoloa mona.',
    saveChanges: 'Boloka liphetoho',
    changePassword: 'Fetola lekunutu la hao',
    keepAccountSecure: 'Sireletsa akhaonto ea hao.',
    passwordSecuritySubtitleFull: 'Boloka akhaonto ea hao e sireletsehile.',
    chooseStrongPassword: 'Khetha lekunutu le matla',
    passwordChangeWarning: 'Ho fetola lekunutu ho tla ntša lisebelisoa tse ling tseo u keneng ho tsona.',
    currentPassword: 'Lekunutu la hajoale',
    yourCurrentPassword: 'Lekunutu la hao la hajoale',
    newPassword: 'Lekunutu le lecha',
    atLeastEight: 'Bonyane litlhaku tse 8',
    confirmNewPassword: 'Netefatsa lekunutu le lecha',
    repeatPassword: 'Pheta lekunutu la hao le lecha',
    containsLetter: 'Le na le tlhaku',
    containsNumber: 'Le na le nomoro',
    passwordsMatch: 'Makhunutu aa tšoana',
    updatePassword: 'Ntlafatsa lekunutu',
    welcomeBack: 'Rea u amohela hape',
    signInSubtitle: 'Kena ho tsoela pele moo u qetetseng teng.',
    email: 'Imeile',
    password: 'Lekunutu',
    signIn: 'Kena',
    newToKhoebo: 'U mocha ho Khoebo?',
    createAccount: 'Theha akhaonto',
    getStarted: 'Qala',
    alreadyHaveAccount: 'Ke se ke na le akhaonto',
    sales: 'Lithekiso',
    insights: 'Tsebo',
    books: 'Libuka',
    businessSimplified: 'KHOEBO E BONOLO',
    knowYourNumbers: 'Tseba lipalo tsa hao.',
    growWithConfidence: 'Hola ka sebete.',
    welcomeSubtitle: 'Rekisa, sala morao thepa, u boloke libuka tse hlakileng sebakeng se le seng.',
    madeForSmallBusinesses: 'E etselitsoe likhoebo tse nyenyane tse etsang lintho tse kholo.',
    profileUpdated: 'Boemo bo ntlafalitsoe',
    nameCannotBeEmpty: 'Lebitso la hao le ke ke la hloka letho.',
    passwordChanged: 'Lekunutu le ntlafalitsoe',
    enterCurrentPassword: 'Kenya lekunutu la hao la hajoale.',
    passwordRequirements: 'Lekunutu la hao le lecha ha le fihlelle litlhoko.',
    passwordsDoNotMatch: 'Makhunutu ha a tšoane.',
    couldNotSignIn: 'Ho sitiloe ho kena. Ka kopo leka hape.',
    businessDetails: 'Lintlha tsa khoebo',
    businessName: 'Lebitso la khoebo',
    yourBusiness: 'Khoebo ea hao',
    currencyCode: 'Khoutu ea chelete',
    onlyOwnersAdmins: 'Ke beng le batsamaisi feela ba ka fetolang lintlha tsa khoebo.',
    noBusinessYet: 'Ha ho khoebo hajoale',
    yourBusinesses: 'Likhoebo tsa hao',
    active: 'E sebetsa',
    switchBusiness: 'Fetola',
    noBusinesses: 'Ha ho likhoebo',
    createAnotherBusiness: 'Theha khoebo e ’ngoe',
    dangerZone: 'Sebaka sa kotsi',
    deleteThisBusiness: 'Hlakola khoebo ena',
    deleteBusiness: 'Hlakola khoebo',
  },
} as const;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'st') setLanguageState(stored);
    });
  }, []);

  const setLanguage = async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: (key) => translations[language][key] }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
