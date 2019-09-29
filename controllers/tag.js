const { validationResult } = require('express-validator/check')
const Tag = require('../models/tag');

const get = async(req, res) => {
  const { currentUser } = req
  const data = await Tag.find({user :currentUser.id});
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Tag doesn`t exist'
    })
  }

  return res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
  const { currentUser } = req
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }


  await Tag.findOrCreate({ content: req.body.content }, {
     ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date()
  })
  .then(_res => {
      const data = _res
      res.send({
        status: true,
        data
      })
  })
  .catch(e => {
      let errors
    if (e.errors) {
      errors = e.errors.map(err => {      
        delete err.instance
        return err
      })
    }
    return res.status(500).send({
      status: false,
      error: errors || e
    })
  });
}

const search = async(req, res) =>{
  const { currentUser } = req
  let search = req.body.search
  data = await Tag.find({content: {'$regex': search+'.*', '$options': 'i'}, user: currentUser.id}).sort({content: 1})

  return res.send({
      status: true,
      data
    })
}

module.exports = {
    get,
    create,
    search
}