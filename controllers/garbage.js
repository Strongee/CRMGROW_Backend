const Garbage = require('../models/garbage');

const get = async(req, res) => {
  const data = await Garbage.find({_id: req.params.id});
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Garbage doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
  const { currentUser } = req

  const garbage = new Garbage({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  garbage.save().then(()=>{
    return res.send({
      status: true,
    })
  }).catch(err=>{
    console.log('err', err)
    return res.status(500).json({
      status: false,
      error: err.message || 'Internal server error'
    })
  })
}

const edit = async(req, res) => {
  const user = req.currentUser;
  const editData = req.body
  console.log(editData);
  const garbage = await Garbage.findOne({user: user._id})
  if(!garbage){
    let newGarbage = new Garbage({
      ...editData,
      user: user._id
    });

    newGarbage.save().then(() => {
      return res.send({
        status: true,
      })
    }).catch(err => {
      console.log('err', err);
      return res.status(500).json({
        status: false,
        error: err.message || 'Internal server error'
      })
    })
  }
  else {
    for (let key in editData) {
      garbage[key] = editData[key]
    }
    
    garbage.save()
      .then(()=>{
        return res.send({
          status: true,
        })
      }).catch(err=>{
        console.log('err', err)
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error'
        })
      })
  }
}

module.exports = {
    get,
    create,
    edit
}