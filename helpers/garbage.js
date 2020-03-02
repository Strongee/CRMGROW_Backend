const Garbage = require('../models/garbage');

const get = async(user) => {
  const garbage = await Garbage.findOne({user: user._id})
  if(!garbage){
    let newGarbage = new Garbage({
      user: user._id
    });

    newGarbage.save().then((data) => {
      return data
    }).catch(err => {
      console.log('err', err);
      return false
    })
  }
  else {
    return garbage
  }
}

module.exports = {
  get
}