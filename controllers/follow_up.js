const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const FollowUp = require('../models/follow_up');

const getAll = async(req, res) => {
  const { currentUser } = req
  const followUp = await FollowUp.findOne({ user: currentUser.id })
    .exec();  

  if (!followUp) {
    return res.status(401).json({
      status: false,
      error: 'FollowUp doesn`t exist'
    })
  }


}
module.exports = {
    getAll,
}