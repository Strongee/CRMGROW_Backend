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

  await Tag.findAndModify({
    query: { content: req.body.content},
    update: {
      $setOnInsert: {
        ...req.body,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      }
    },
    new: true,   // return new doc if one is upserted
    upsert: true // insert the document if it does not exist
  })
  .then(_res => {
    console.log('+res', _res)
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

module.exports = {
    get,
    create,
}