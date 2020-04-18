const config = {
    AWS: {
        AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_S3_REGION: process.env.AWS_S3_REGION,
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME
    },
    OUTLOOK_CLIENT: {
        OUTLOOK_CLIENT_ID: process.env.OUTLOOK_CLIENT_ID,
        OUTLOOK_CLIENT_SECRET: process.env.OUTLOOK_CLIENT_SECRET,
    },
    GMAIL_CLIENT: {
        GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET 
    },
    YAHOO_CLIENT: {
        YAHOO_CLIENT_ID: process.env.YAHOO_CLIENT_ID,
        YAHOO_CLIENT_CECRET: process.env.YAHOO_CLIENT_CECRET,  
    },
    JWT_SECRET: process.env.JWT_SECRET,
    SENDGRID: {
        SENDGRID_KEY: process.env.SENDGRID_KEY,
        SENDGRID_APPOITMENT_TEMPLATE: process.env.SENDGRID_APPOITMENT_TEMPLATE || 'd-6e29f70dd72b4667afea58314bfbc2a7',
        SENDGRID_NOTICATION_TEMPLATE: process.env.SENDGRID_NOTICATION_TEMPLATE || 'd-e8af9d714f7344cc8c847b5ab096ab14',
        SENDGRID_DAILY_REPORT_TEMPLATE: process.env.SENDGRID_DAILY_REPORT_TEMPLATE || 'd-4f6682ae1f1d4d1b94317cefa31e24d4',
        SENDGRID_WEEKLY_REPORT_TEMPLATE: process.env.SENDGRID_WEEKLY_REPORT_TEMPLATE || 'd-2573c1290cdd4cf9b4917561e4a9d1ae',
        SENDGRID_FOLLOWUP_REMINDER_TEMPLATE: process.env.SENDGRID_FOLLOWUP_REMINDER_TEMPLATE || 'd-9746307f64714c96860be74362a952af',
        SENDGRID_APPOINTMENT_REMINDER_TEMPLATE: process.env.SENDGRID_APPOINTMENT_REMINDER_TEMPLATE || 'd-54a3f51c073d49c1a0277903deb6520b',
        SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE: process.env.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE || 'd-0a022398ae784e2589e7815a75127ba9',
        SENDGRID_WELCOME_TEMPLATE: process.env.SENDGRID_WELCOME_TEMPLATE || 'd-8d02186ef9eb4606b07d554a105f56e2',
        SENDGRID_SIGNUP_FLOW_FIRST: process.env.SENDGRID_SIGNUP_FLOW_FIRST || 'd-5b173abe1ebc4a9eb8ccde097e1e3860',
        SENDGRID_SIGNUP_FLOW_SECOND: process.env.SENDGRID_SIGNUP_FLOW_SECOND || 'd-c044da37b4c94ec2bfa056149392d74d',
        SENDGRID_SIGNUP_FLOW_REACH: process.env.SENDGRID_SIGNUP_FLOW_REACH || 'd-5216f3be8efb41dcaef4ca69d0b6f6ca',
        SENDGRID_SIGNUP_FLOW_THIRD: process.env.SENDGRID_SIGNUP_FLOW_THIRD || 'd-ada9743225184690b6a14ca92df76cf7',
        SENDGRID_SIGNUP_FLOW_FORTH: process.env.SENDGRID_SIGNUP_FLOW_FORTH || 'd-12bb4db57b5b4107b7c9380825cb82ae',
        SENDGRID_SYSTEM_NOTIFICATION: process.env.SENDGRID_SYSTEM_NOTIFICATION || 'd-a829cc5764184be695de903030681eb5'
    },
    TWILIO: {
        TWILIO_SID: process.env.TWILIO_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        TWILIO_NUMBER: process.env.TWILIO_NUMBER || '+15104625516'
    },
    VAPID: {
        PUBLIC_VAPID_KEY: process.env.PUBLIC_VAPID_KEY,
        PRIVATE_VAPID_KEY: process.env.PRIVATE_VAPID_KEY
    },
    STRIPE: {
        SECRET_KEY: process.env.SECRET_KEY,
        BILLING_CYCLE: process.env.BILLING_CYCLE,
        PRODUCT_ID: process.env.PRODUCT_ID || 'prod_F7xnR0702SkcZR',
        PRIMARY_PLAN: process.env.PRIMARY_PLAN || 'plan_G5y3Wz6NbVZyQT',
        PRIOR_PLAN: process.env.PRIOR_PLAN || 'plan_FFnfPJc8bPYCZi',
        PRIMARY_PLAN_AMOUNT: process.env.PRIMARY_PLAN_AMOUNT || '39',
        PRIOR_PLAN_AMOUNT: process.env.PRIOR_PLAN_AMOUNT || '29',
        LIMIT: process.env.LIMIT || 50
    },
    MAX_CONTACT_LIMIT: process.env.MAX_CONTACT_LIMIT || 15,
    MAX_EMAIL: process.env.MAX_EMAIL || 50,
    MAX_CONTACT: process.env.MAX_CONTACT || 3000,
    DEFAULT_PASS: process.env.DEFAULT_PASS || 'admin123'
}

module.exports = config;