const config = {
    AWS: {
        AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'AKIAIPDV6KY3JESFG6WQ',
        AWS_SECRET_ACCESS_KEY: '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',
        AWS_S3_REGION: AWS_S3_REGION || 'Ohio',
        AWS_S3_BUCKET_NAME: AWS_S3_BUCKET_NAME || 'teamgrow'
    },
    OUTLOOK_CLIENT: {
        OUTLOOK_CLIENT_ID: process.env.OUTLOOK_CLIENT_ID ||'cf34076b-4bb2-4eef-8fdb-a7d7f2376095',
        OUTLOOK_CLIENT_SECRET: process.env.OUTLOOK_CLIENT_SECRET || 'pzckCYYXIL27}-]snkJ059)',
        OUTLOOK_CLIENT_EMAIL_AUTHORIZE_URL: process.env.OUTLOOK_CLIENT_EMAIL_AUTHORIZE_URL || 'http://localhost:3000/api/user/authorize-outlook'
    },
    JWT_SECRET: process.env.JWT_SECRET || 'THIS IS USED TO SIGN AND VERIFY JWT TOKENS',
    SENDGRID_KEY: process.env.SENDGRID_KEY || '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',
    
   
}

module.exports = config;