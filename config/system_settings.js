const system_settings = {
  SUBSCRIPTION_MONTHLY_PLAN: {
    BASIC: '29',
    TEAM: '25',
  },
  EMAIL_DAILY_LIMIT: {
    BASIC: 500,
    GMAIL: 500,
    GSUIT: 2000,
    OUTLOOK: 300,
    MICROSOFT: 1000,
  },
  TEXT_MONTHLY_LIMIT: {
    BASIC: 250,
  },
  CONTACT_UPLOAD_LIMIT: {
    BASIC: 3000,
  },
  MATERIAL_UPLOAD_LIMIT: {
    BASIC: 15,
  },
  PASSWORD: {
    USER: process.env.DEFAULT_PASS || 'admin123',
    ADMIN: process.env.ADMIN_DEFAULT_PASS || 'admin123',
  },
  COMPANY: {
    DEFAULT: 'eXp Realty',
  },
  ADMIN_ACCOUNT: 'support@crmgrow.com',
  LEAD: '5f16d58d0af09220208b6e11',
  AUTO_FOLLOW_UP: 'has reviewed material',
  THUMBNAIL: {
    WIDTH: 400,
    HEIGHT: 220,
  },
};

module.exports = system_settings;
