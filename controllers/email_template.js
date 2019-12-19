const EmailTemplate = require('../models/email_template');

const get = async(req, res) => {
  const { currentUser } = req

  const data = await EmailTemplate.find({_id: id});
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const getAll = async(req, res) => {
  
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

  const note = new Note({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  
  note.save()
  .then(_note => {

    const activity = new Activity({
      content: currentUser.user_name + ' added note',
      contacts: _note.contact,
      user: currentUser.id,
      type: 'notes',
      notes: _note.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      Contact.findByIdAndUpdate( _note.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
        console.log('err', err)
      })
      myJSON = JSON.stringify(_note)
      const data = JSON.parse(myJSON);
      data.activity = _activity
      res.send({
        status: true,
        data
      })
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