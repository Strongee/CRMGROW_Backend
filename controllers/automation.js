const Automation = require('../models/automation')
const TimeLine = require('../models/time_line')
const Contact = require('../models/contact')
const mongoose = require('mongoose')
const garbageHelper = require('../helpers/garbage')

const get = (req, res) => {
    const id = req.params.id;

    Automation.findOne({_id: id}).then(data => {
        res.send({
            status: false,
            data
        })
    }).catch(err => {
        res.status(500).send({
            status: false,
            error: err.message || 'Automation reading is failed.'
        })
    })
}

const getStatus = async (req, res) => {
    const id = req.params.id;
    const { contacts } = req.body;
    let assignedContacts = await Contact.find({_id: {$in: contacts}}, '_id first_name last_name email cell_phone').catch(err => {
        console.log("Error", err);
    })
    TimeLine.find({automation: id}).populate().then(data => {
        res.send({
            status: true,
            data: {
                timelines: data,
                contacts: assignedContacts
            }
        })
    }).catch(err => {
        res.status(500).send({
            status: false,
            error: err.message || 'Automation reading is failed.'
        })
    })
}

const getPage = async (req, res) => {
    const {currentUser} = req;
    const page = req.params.page;

    const garbage = await garbageHelper.get(currentUser);
    // let editedAutomations = [];
    // if(garbage) {
    //     editedAutomations = garbage['edited_automation']
    // }
    
    const automations = await Automation.find({
        $or: [
            {user: currentUser.id},
            {role: 'admin'}
        ]
    }).skip((page-1) * 10).limit(10);
    let automation_array = []
    for(let i=0; i<automations.length; i++){
        const automation = automations[i]
        contacts = await TimeLine.aggregate([
            {
              $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id), "automation":mongoose.Types.ObjectId(automation._id) }] }
            },           
            {
              $group: {
                _id: { contact: "$contact"},
              }
            },
            {
                $group: {
                  _id: "$_id.contact"
                }
            },
            {
              $project: { "_id": 1 }
            }
          ])
         myJSON = JSON.stringify(automation)
         const data = JSON.parse(myJSON);
         const automation_detail = await Object.assign(data, {"contacts": contacts})
         automation_array.push(automation_detail)
    }

    const total = await Automation.countDocuments({
        user: currentUser.id
    })

    return res.json({
        status: true,
        data: automation_array,
        total: total
    })
}

const create = (req, res) => {
    const { currentUser } = req;
    const automation = new Automation({
        ...req.body,
        user: currentUser.id,
        created_at: new Date(),
        updated_at: new Date()
    })

    automation.save().then(_automation => {
        res.send({
            status: true,
            data: _automation
        })
    }).catch(err => {
        res.status(500).send({
            status: false,
            error: err.message || 'Automation creating is failed.'
        })
    })
}

const update = (req, res) => {
    const id = req.params.id;
    const data = req.body;
    Automation.find({_id: id}).update({$set: data}).then(() => {
        res.send({
            status: true
        })
    }).catch(err => {
        res.status(400).send({
            status: false,
            error: err.message || 'Automation Updating is failed.'
        })
    })
}

const remove = async(req, res) => {
    const id = req.params.id;

    await Automation.deleteOne({_id: req.params.id}).catch(err => {
        res.status(400).send({
            status: false
        })
    })

    res.send({
        status: false
    })
}

const search = async(req, res) => {
    const condition = req.body;
    const { currentUser } = req;    
    Automation.find(
    {$and: [
        {
            $or: [
                {'user': currentUser.id,},
                {'role': 'admin'}
              ]
            },
        {
            'title': { '$regex': '.*' + condition.search + '.*', '$options': 'i' }
        }
    ]}).then((data) => {
        return res.send({
            status: true,
            data
        })
    }).catch(err => {
    return res.status(400).send({
            status: false
        })
    })    
}

const updateDefault = async (req, res) => {
    const {automation, id} = req.body
    let thumbnail;
    let { currentUser } = req

    const defaultAutomation= await Video.findOne({_id: id, role: 'admin'}).catch(err=>{
      console.log('err', err)
    })
    if (!defaultAutomation) {
      return res.status(400).json({
        status: false,
        error: 'This Default automation not exists'
      })
    }
    // Update Garbage
    const garbage = await garbageHelper.get(currentUser);
    if(!garbage) {
      return res.status(400).send({
        status: false,
        error: `Couldn't get the Garbage`
      })
    }
    if(garbage['edited_automation']) {
      garbage['edited_automation'].push(id);
    }
    else {
      garbage['edited_automation'] = [id]
    }
    
    await garbage.save().catch(err => {
      return res.status.json({
        status: false,
        error: 'Update Garbage Error.'
      })
    })
  
    for (let key in automation) {
        defaultAutomation[key] = automation[key]
    }
    if( thumbnail ){
        defaultAutomation['thumbnail'] = thumbnail
    }
    
    defaultAutomation['updated_at'] = new Date()
    const defaultAutomationJSON = JSON.parse(JSON.stringify(defaultAutomation))
    delete defaultAutomationJSON['_id'];
    delete defaultAutomationJSON['role'];
    let newAutomation = new Automation({
      ...defaultAutomationJSON,
      user: currentUser._id,
      default_edited: true
    })
    const _automation = await newAutomation.save().then().catch(err=>{
      console.log('err', err)
    })  
    
    return res.send({
      status: true,
      data: _automation
    })
  }

module.exports = {
  get,
  getStatus,
  getPage,
  create,
  update,
  remove,
  updateDefault,
  search
}