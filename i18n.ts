 
import NextI18Next from 'next-i18next'

export default new NextI18Next({
    defaultLanguage: 'en',
    otherLanguages: ['en', 'fr'],
    localeSubpaths: {
      fr: 'fr',
      en: 'en',
    },
    localePath : '/static/locales'
})

