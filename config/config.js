const config = {
    AWS: {
        AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'AKIAIPDV6KY3JESFG6WQ',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '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',
        AWS_S3_REGION: process.env.AWS_S3_REGION || 'us-east-2',
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || 'teamgrow'
    },
    OUTLOOK_CLIENT: {
        OUTLOOK_CLIENT_ID: process.env.OUTLOOK_CLIENT_ID ||'cf34076b-4bb2-4eef-8fdb-a7d7f2376095',
        OUTLOOK_CLIENT_SECRET: process.env.OUTLOOK_CLIENT_SECRET || 'pzckCYYXIL27}-]snkJ059)',
    },
    GMAIL_CLIENT: {
        GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ||'1041066082390-tu3lr856iut1ldd7ohrs33cdc4kubfb9.apps.googleusercontent.com',
        GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || 't3jCOrRag5Kxf3JCOAWWE6Gt'  
    },
    JWT_SECRET: process.env.JWT_SECRET || 'THIS IS USED TO SIGN AND VERIFY JWT TOKENS',
    SENDGRID: {
        SENDGRID_KEY: process.env.SENDGRID_KEY || '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',
        SENDGRID_APPOITMENT_TEMPLATE: process.env.SENDGRID_APPOITMENT_TEMPLATE || 'd-6e29f70dd72b4667afea58314bfbc2a7',
        SENDGRID_NOTICATION_TEMPLATE: process.env.SENDGRID_NOTICATION_TEMPLATE || 'd-e8af9d714f7344cc8c847b5ab096ab14',
        SENDGRID_DAILY_REPORT_TEMPLATE: process.env.SENDGRID_DAILY_REPORT_TEMPLATE || 'd-4f6682ae1f1d4d1b94317cefa31e24d4',
        SENDGRID_WEEKLY_REPORT_TEMPLATE: process.env.SENDGRID_WEEKLY_REPORT_TEMPLATE || 'd-2573c1290cdd4cf9b4917561e4a9d1ae',
        SENDGRID_WELCOME_TEMPLATE: process.env.SENDGRID_WELCOME_TEMPLATE || 'd-8d02186ef9eb4606b07d554a105f56e2'
    },
    TWILIO: {
        TWILIO_SID: process.env.TWILIO_SID || 'ACf60a9a0d964ade6dec9ee157f261523d',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '5e45d2cf4b6c71c79c806106f65f7639',
        TWILIO_NUMBER: process.env.TWILIO_NUMBER || '+15104625516'
    },
    VAPID: {
        PUBLIC_VAPID_KEY: process.env.PUBLIC_VAPID_KEY || 'BP1lfE5RpD6bwz5FrLMc0uY1DAbPC-oOVZuk8kv6NHUKrqlYarEk8AOG-8wWCIp0gSzKjSNRnKlYC6kBjAEASJc',
        PRIVATE_VAPID_KEY: process.env.PRIVATE_VAPID_KEY || 'sN8sRQRkMxc7G1VWbuXT4FsV99Z0oEaEkUTliOZAVNY'
    },
    STRIPE: {
        SECRET_KEY: process.env.SECRET_KEY || 'sk_test_M5ZibSlzCut26ZvhKgfeYY5x00oAOM4Bx9',
        BILLING_CYCLE: process.env.BILLING_CYCLE || 'month',
        PRODUCT_ID: process.env.PRODUCT_ID || 'prod_F7xnR0702SkcZR',
        PRIMARY_PLAN: process.env.PRIMARY_PLAN || 'plan_F7xoMy4Dh4YVXw',
        SUPER_PLAN: process.env.SUPER_PLAN || 'plan_F7xpLy2LZf6Yay',
        PRIMARY_PLAN_AMOUNT: process.env.PRIMARY_PLAN_AMOUNT || '29',
        SUPER_PLAN_AMOUNT: process.env.SUPER_PLAN_AMOUNT || '59'
    }
}

module.exports = config;