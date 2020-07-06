const system_settings = {
  SUBSCRIPTION_MONTHLY_PLAN: {
    BASIC: '29',
    TEAM: '25',
  },
  EMAIL_DAILY_LIMIT: {
    BASIC: 300,
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
  LEAD: 'Lead',
};

module.exports = system_settings;