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
    SENDGRID_KEY: process.env.SENDGRID_KEY || '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',
    SENDGRID_APPOITMENT_TEMPLATE: process.env.SENDGRID_APPOITMENT_TEMPLATE || 'd-1ba80aa36c0548afb6b708ca2deb0081'
}

module.exports = config;