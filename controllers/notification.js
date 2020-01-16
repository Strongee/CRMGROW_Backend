const Notification = require('../models/notification');

const get = async(req, res) => {
  const { currentUser } = req
  let data = []
  if(currentUser.subscription.is_failed){
    const payment_notification = await Notification.findOne({type: 'urgent', criteria: 'subscription_failed'})
    data.push({
      type: 'urgent',
      content: payment_notification['content']
    })
  }

  const notifications = await Notification.find({type: 'static', del: false});
  
  if(notifications){
    for(let i = 0; i <notifications.length; i++){
      const notification = notifications[i]
      data.push({
        type: 'static',
        content: notification['content']
      })
    }
  }
  res.send({
    status: true,
    data
  })
}

module.exports = {
    get,
}