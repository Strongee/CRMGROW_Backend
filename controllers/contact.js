const { validationResult } = require('express-validator/check')
const mongoose = require('mongoose')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const Note = require('../models/note')
const Tag = require('../models/tag')
const sgMail = require('@sendgrid/mail')
const fs = require('fs')
const csv = require('csv-parser')
const config = require('../config/config')



const getAll = async(req, res) => {
  const { currentUser } = req
  const data = await Contact.find({user: currentUser.id})

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  return res.send({
    status: true,
    data
  })
}

const get = async(req, res) => {
  const { currentUser } = req
  const _contact = await Contact.findOne({user: currentUser.id, _id: req.params.id })

  if (!_contact) {
    return res.status(401).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  const _follow_up = await FollowUp.find({user: currentUser.id, contact: req.params.id }).sort({due_date: 1})
  const _activity_list = await Activity.find({user: currentUser.id, contacts: req.params.id }).sort({updated_at : 1 })
  let _activity_detail_list = [];
  
  for(let i = 0; i < _activity_list.length; i ++){
    const _activity_detail = await Activity.aggregate([
        {
         $lookup:
            {
             from:  _activity_list[i].type,
             localField: _activity_list[i].type,
             foreignField: '_id',
             as: "activity_detail"
            }
       },
       {
        $match: { "_id": _activity_list[i]._id }
        }
     ])

     _activity_detail_list.push(_activity_detail[0])
  }
    
    myJSON = JSON.stringify(_contact)
    const contact = JSON.parse(myJSON);
    const data = await Object.assign(contact, {"follow_up": _follow_up}, {"activity": _activity_detail_list});
    
    res.send({
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

  let contact_old
  if(typeof req.body['email'] != 'undefined'){
    contact_old = await Contact.findOne({user: currentUser.id, email: req.body['email']}) 
    if(contact_old != null){
      return res.status(400).send({
        status: false,
        error: 'Email must be unique!'
      })
    }
  }

  if(typeof req.body['cell_phone'] != 'undefined'){
    contact_old = await Contact.findOne({user: currentUser.id, cell_phone: req.body['cell_phone']}) 
    if(contact_old != null){
      return res.status(400).send({
        status: false,
        error: 'Phone number must be unique!'
      })
    }
  }

  let cell_phone = req.body.cell_phone
  let cleaned = ('' + cell_phone).replace(/\D/g, '')
  let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
      let intlCode = (match[1] ? '+1 ' : '')
      cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  }

  const contact = new Contact({
    ...req.body,
    cell_phone: cell_phone,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  })
  
  contact.save()
  .then(_contact => {
      const activity = new Activity({
        content: currentUser.user_name + ' added contact',
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        myJSON = JSON.stringify(_contact)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        res.send({
          status: true,
          data
        })
      })   
  })
  .catch(e => {
    console.log(e)
      let errors
    if (e.errors) {
      errors = e.errors.map(err => {      
        delete err.instance
        return err
      })
    }
    if (e.code = 11000){
      errors = "Email and Phone number must be unique!"
    }
    return res.status(500).send({
      status: false,
      error: errors || e
    })
  });
}

const remove = async(req, res) => {

  const {currentUser} = req
  const data = await Contact.findOne({user: currentUser.id, _id: req.params.id })

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  await Contact.deleteOne({_id: req.params.id})
  await Activity.deleteMany({contacts: req.params.id})
  await FollowUp.deleteMany({contact: req.params.id})
  await Appointment.deleteMany({contact: req.params.id})

  res.send({
    status: true
  })
}

const edit = async(req, res) => {
  const {currentUser} = req
  const editData = req.body
  const contact = await Contact.findOne({user: currentUser.id, _id: req.params.id})

  if (!contact) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  for (let key in editData) {
    contact[key] = editData[key]
  }

  if(typeof req.body.cell_phone != 'undefined'){
    let cell_phone = req.body.cell_phone
    let cleaned = ('' + cell_phone).replace(/\D/g, '')
    let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
    if (match) {
        let intlCode = (match[1] ? '+1 ' : '')
        cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    }
    contact["cell_phone"] = cell_phone
  }

  contact["updated_at"] = new Date()
 
  contact.save()
  .then(_res => {
      myJSON = JSON.stringify(_res)
      const data = JSON.parse(myJSON);
      delete data.password
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

const sendBatch = async(req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const {currentUser} = req
  const {cc, bcc, to, subject, content, contacts} = req.body
  
  if(typeof subject == 'undefined' || subject == ""){
    return res.status(400).send({
      status: false,
      error: 'Subject email must be specified'
    })
  }
  if(to.length == 0){
    for(let i=0; i<bcc.length; i++){
      const msg = {
        from: currentUser.email,
        subject: subject,
        to: bcc[i],
        cc: cc,
        html: '<html><head><title>Email</title></head><body><p>'+content + '</p><br/><br/>' + currentUser.email_signature+'</body></html>',
      }
      sgMail.send(msg).then().catch(err =>{
        console.log('err', err)
      })
    }
  }else{
    const msg = {
      from: currentUser.email,
      subject: subject,
      to: to,
      cc: cc,
      bcc: bcc,
      html: '<html><head><title>Email</title></head><body><p>'+content + '</p><br/><br/>' + currentUser.email_signature+'</body></html>',
    };
        
    sgMail.send(msg).then().catch(err =>{
      console.log('err', err)
    })
  }
    const email = new Email({
      ...req.body,
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date()
    })
  
    const _email = await email.save().then().catch(err =>{
      console.log('err', err)
    })
    let data_list = []
    for(let i = 0; i < contacts.length; i ++){
      const activity = new Activity({
        content: currentUser.user_name + ' sent email',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'emails',
        emails: _email.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      
      const _activity = await activity.save().then()
      myJSON = JSON.stringify(_email)
      const data = JSON.parse(myJSON);
      data.activity = _activity
      data_list.push(data)
    }
          
    return res.send({
      status: true,
      data: data_list
    })      
}

const sendEmail = async(req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)

  const {currentUser} = req
  const {contact, content, attachments} = req.body
  const _contact = await Contact.findOne({_id: contact})
  const msg = {
    from: currentUser.email,
    to: _contact.email,
    subject: currentUser.user_name + ' sent email',
    attachments: attachments,
    html: content + '<br/><br/>' + currentUser.email_signature
  };
      
  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      const email = new Email({
        ...req.body,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      })
      
      email.save()
      .then(_email => {

        const activity = new Activity({
          content: currentUser.user_name + ' sent email',
          contacts: _contact.id,
          user: currentUser.id,
          type: 'emails',
          emails: _email.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
  
        activity.save().then(_activity => {
          myJSON = JSON.stringify(_email)
          const data = JSON.parse(myJSON);
          data.activity = _activity
          res.send({
            status: true,
            data
          })
        })   
      })   
    }else {
      return res.status(404).send({
        status: false,
        error: _res[0].statusCode
      })
    }
  }).catch ((e) => {
    console.error(e)
    return res.status(500).send({
      status: false,
      error: 'internal_server_error'
    })
  })
}

const importCSV = async(req, res) => {
  let file = req.file
  const {currentUser} = req
  let csv_id = 1;
  let failure = []
  fs.createReadStream(file.path).pipe(csv())
      .on('data', async(data) => {
        new Promise(async(resolve, rejected)=>{
          let contact_old_email = null
          let contact_old_phone = null
          let cell_phone = data['phone']
          csv_id +=1
          if(!data['email']){
            data['email'] = ''
          }
          if(!data['phone']){
            data['phone'] = ''
          }
          if(data['email'] != ''){
            contact_old_email = await Contact.findOne({user: currentUser.id, email: data['email']})
          }
          if(data['phone'] !=''){
            let cleaned = ('' + cell_phone).replace(/\D/g, '')
            let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
            if (match) {
                let intlCode = (match[1] ? '+1 ' : '')
                cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
            }
            contact_old_phone =await Contact.findOne({user: currentUser.id, cell_phone: cell_phone}) 
          }
          if((data['first_name'] != null && data['email'] == '' && data['phone'] == '') || (data['first_name'] != 'first_name' && contact_old_email == null && contact_old_phone == null)){
            if(data['tag'] != '' && typeof data['tag'] != 'undefined'){  
              const tags = data['tag'].split(' ')
              await new Promise((resolve, reject) =>{
                const array_tag = []
                for(let i=0; i<tags.length; i++){
                  Tag.findOrCreate({ content: tags[i] }, {
                    content: tags[i],
                    user: currentUser.id,
                    updated_at: new Date(),
                    created_at: new Date()
                  })
                  .then(_res => {
                    array_tag.push(_res.doc['_id'])
                    if(i == tags.length-1){
                      resolve(array_tag)
                    }
                  })
              } 
            }).then((res)=>{
              data['tag'] = res 
              const contact = new Contact({
                ...data,
                cell_phone: cell_phone,
                user: currentUser.id,
                created_at: new Date(),
                updated_at: new Date(),
              })
              
            contact.save().then(_contact=>{
              const activity = new Activity({
                content: currentUser.user_name + ' added contact',
                contacts: _contact.id,
                user: currentUser.id,
                type: 'contacts',
                created_at: new Date(),
                updated_at: new Date(),
              })
              activity.save()
              if(data['note'] != null){
                const note = new Note({
                  content: data['note'],
                  contact: _contact.id,
                  user: currentUser.id,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                note.save().then((_note)=>{
                  const _activity = new Activity({
                    content: currentUser.user_name + ' added note',
                    contacts: _contact.id,
                    user: currentUser.id,
                    type: 'notes',
                    notes: _note.id,
                    created_at: new Date(),
                    updated_at: new Date(),
                  })
                  _activity.save().catch(err=>{
                    console.log('error', err)
                  })
                  resolve()
                })
              }
             }).catch(err=>{
               console.log('err', err)
             })
            })
          }else{
            delete data.tag
            console.log('data', data)
            const contact = new Contact({
              ...data,
              cell_phone: cell_phone,
              user: currentUser.id,
              created_at: new Date(),
              updated_at: new Date(),
            })
            
          contact.save().then(_contact=>{
            const activity = new Activity({
              content: currentUser.user_name + ' added contact',
              contacts: _contact.id,
              user: currentUser.id,
              type: 'contacts',
              created_at: new Date(),
              updated_at: new Date(),
            })
            activity.save()
            if(data['note'] != null){
              const note = new Note({
                content: data['note'],
                contact: _contact.id,
                user: currentUser.id,
                created_at: new Date(),
                updated_at: new Date(),
              })
              note.save().then((_note)=>{
                const _activity = new Activity({
                  content: currentUser.user_name + ' added note',
                  contacts: _contact.id,
                  user: currentUser.id,
                  type: 'notes',
                  notes: _note.id,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                _activity.save().catch(err=>{
                  console.log('error', err)
                })
                resolve()
              })
            }
           }).catch(err=>{
             console.log('err', err)
           })
          }          
          }else{
            const field = {
              id: csv_id,
              email: data['email'],
              phone: data['phone']
            }
            failure.push(field)
            resolve()
          }
        })
      }).on('end', () => {
        console.log('failure', failure)
        return res.send({
          status: true,
          failure
        })             
    });
}

const exportCSV = async(req, res) =>{
  const { currentUser } = req
  const { contacts } = req.body

  let data = []
  for(let i = 0; i < contacts.length; i ++){
    let _data={
      contact: contacts[i],
      note: [],
      tag: []
    }
    const _note = await Note.find({user :currentUser.id, contact: contacts[i]})
    const _contact = await Contact.findOne({_id: contacts[i]})
    const tag = _contact["tag"]
    let tag_array = []
    for(let j=0; j<tag.length; j++){
      const _tag = await Tag.findOne({_id :tag[j]})
      if( _tag ){
        tag_array.push(_tag.content)
      }      
    }
    
    
    if(_note.length!= 0){
     _data["note"] =_note
    }
    if(tag_array.length != 0){
      _data["tag"] = tag_array
    }
    data.push(_data)
  }
  
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Note doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const search = async(req, res) =>{
  const { currentUser } = req
  let search = req.body.search
  let activity = []
  if(!search.split(" ")[1]){
    contacts = await Contact.find({
      $or: [
        {first_name: {'$regex': search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {email: {'$regex': '.*'+search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {last_name: {'$regex': search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {cell_phone: {'$regex': '.*' + search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id}
      ]}).sort({first_name: 1})
    }else{
      contacts = await Contact.find({
        $or: [
         {first_name: {'$regex': search.split(" ")[0], '$options': 'i'}, last_name: {'$regex': search.split(" ")[1], '$options': 'i'}, user: currentUser.id},
         {cell_phone: search, user: currentUser.id} 
        ]
      }).sort({first_name: 1})
    }

    for(let i=0; i<contacts.length; i++){
      const _activity = await Activity.find({contacts :contacts[i].id}).sort({'updated_at': -1}).limit(1);
      myJSON = JSON.stringify(_activity[0])
      const __activity = JSON.parse(myJSON)
      delete __activity.contacts
      __activity.contacts = contacts[i]
      activity.push(__activity)
    }

    return res.send({
      status: true,
      data:{
        activity,
        search: search
      }

    })
}

const searchEasy = async(req, res) =>{
  const { currentUser } = req
  let search = req.body.search
  if(!search.split(" ")[1]){
    data = await Contact.find({
      $or: [
        {first_name: {'$regex': search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {email: {'$regex': '.*'+search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {last_name: {'$regex': search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id},
        {cell_phone: {'$regex': '.*' + search.split(" ")[0]+'.*', '$options': 'i'}, user: currentUser.id}
      ]}).sort({first_name: 1}).limit(8)
    }else{
      data = await Contact.find({
        $or: [
         {first_name: search.split(" ")[0], last_name: search.split(" ")[1], user: currentUser.id},
         {cell_phone: {'$regex': search+'.*', '$options': 'i'}, user: currentUser.id} 
        ]
      }).sort({first_name: 1}).limit(8)
    }

    return res.send({
      status: true,
      data
      })
}

const getById = async (req, res) => {
    const { currentUser } = req
    const _contact = await Contact.findOne({ user: currentUser.id, _id: req.params.id })

    if (!_contact) {
        return res.status(401).json({
            status: false,
            error: 'Contact doesn`t exist'
        })
    }

    res.send({
        status: true,
        data: _contact
    })
}

const getByIds = async(req, res) => {
  const { ids } = req.body
  let contact_ids = []
  ids.forEach( e => {
    contact_ids.push( mongoose.Types.ObjectId(e.ref_id) );
  })
  const _contacts = await Contact.find({
    _id: {$in: contact_ids}
  })

  res.send({
    status: true,
    data: _contacts
  })  
}

module.exports = {
    getAll,
    get,
    create,
    search,
    searchEasy,
    remove,
    edit,
    sendBatch,
    sendEmail,
    importCSV,
    exportCSV,
    getById,
    getByIds
}