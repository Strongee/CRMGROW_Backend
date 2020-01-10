const moment = require('moment')
const Notification = require('../models/notification');

const get = async(req, res) => {
  const { currentUser } = req
  const query = {...req.query}
  const contact = query['contact']

  const data = await Notification.find({type: 'static', del: false});
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Notification doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

module.exports = {
    get,
}