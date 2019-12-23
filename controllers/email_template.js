const EmailTemplate = require('../models/email_template');

const get = async(req, res) => {

  const id = req.params.id;

  const data = await EmailTemplate.findOne({_id: id});
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

const getTemplates = async(req, res) => {
  const { currentUser } = req;
  const page = req.params.page;
  const params = {...req.body};
  const templates = await EmailTemplate.find(params).skip((page-1) * 10).limit(10);
  const total = await EmailTemplate.countDocuments(params);
  return res.json({
    status: true,
    data: templates,
    total: total
  })
}

const create = async(req, res) => {
  const { currentUser } = req
  // const errors = validationResult(req)
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({
  //     status: false,
  //     error: errors.array()
  //   })
  // }

  const template = new EmailTemplate({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })

  await template.save();
  return res.send({
    status: true
  })  
}

const update = async(req, res) => {
  const id = req.params.id;  
  EmailTemplate.find({_id: id}).updateOne({$set: {...req.body}}).then(() => {
    res.send({
      status: true
    })
  }).catch(err => {
    res.status(500).send({
      status: false,
      error: err.message || 'Update Error'
    })
  })
}

const remove = async (req, res) => {
  const id = req.params.id;

  EmailTemplate.deleteOne({_id: id}).then(() => {
    return res.send({
      status: true
    })
  }).catch(err => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Remove Template Error'
    })
  })
}

const bulkRemove = (req, res) => {
  const {ids} = req.body;

  EmailTemplate.deleteMany({_id: {$in: ids}}).then(() => {
    res.send({
      status: true
    })
  }).catch(err => {
    res.status(500).send({
      status: false,
      error: err.message || 'Remove Template Error'
    })
  })
}

const search = async (req, res) => {
  const { currentUser } = req;
  const str = req.query.q;
  const option = {...req.body};

  const templates = await EmailTemplate.find({
    $and: [
      option,
      {
        $or: [
          { title: { '$regex': '.*' + str + '.*', '$options': 'i' } },
          { subject: { '$regex': '.*' + str + '.*', '$options': 'i' } },
          { content: { '$regex': '.*' + str + '.*', '$options': 'i' } },
        ]
      },
      {user: currentUser.id}
    ]
  });

  return res.send({
    status: true,
    data: templates
  })
}

module.exports = {
    create,
    get,
    update,
    remove,
    getTemplates,
    bulkRemove,
    search
}