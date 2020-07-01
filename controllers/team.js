const Team = require('../models/team');

const get = async (req, res) => {
  const { currentUser } = req;
  const query = { ...req.query };
  const contact = query['contact'];

  const data = await Note.find({ user: currentUser.id, contact });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const note = new Note({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  note
    .save()
    .then((_note) => {
      const activity = new Activity({
        content: 'added note',
        contacts: _note.contact,
        user: currentUser.id,
        type: 'notes',
        notes: _note.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        Contact.updateMany(
          { _id: _note.contact },
          { $set: { last_activity: _activity.id } }
        ).catch((err) => {
          console.log('err', err);
        });
        const myJSON = JSON.stringify(_note);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const { contacts, content } = req.body;
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    const note = new Note({
      content,
      contact,
      user: currentUser.id,
    });

    note
      .save()
      .then((_note) => {
        const activity = new Activity({
          content: 'added note',
          contacts: _note.contact,
          user: currentUser.id,
          type: 'notes',
          notes: _note.id,
        });

        activity
          .save()
          .then((_activity) => {
            Contact.findByIdAndUpdate(_note.contact, {
              $set: { last_activity: _activity.id },
            }).catch((err) => {
              console.log('err', err);
            });
            const myJSON = JSON.stringify(_note);
            const data = JSON.parse(myJSON);
            data.activity = _activity;
          })
          .catch((e) => {
            console.log('note creating Error', e);
            return res.status().send({
              status: false,
              error: e,
            });
          });
      })
      .catch((e) => {
        console.log('note creating Error', e);
        return res.status().send({
          status: false,
          error: e,
        });
      });
  }
  return res.send({
    status: true,
  });
};

module.exports = {
  get,
  create,
  bulkCreate,
};
