const Contact = require('../models/contact');
const Payment = require('../models/payment')
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from
const migrate = async() => {
  const payments = await Payment.find({}).catch(err=>{
    console.log('err', err)
  })
  for(let i=0; payments.length; i++){
    const payment = payments[i]
    if(payment['card']){
      payment['card_id'] = payment['card']
      payment.save().catch(err=>{
        console.log('err', err)
      })
    }
  }
}
migrate();