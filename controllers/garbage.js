const Garbage = require('../models/garbage');
const { removeFile } = require('../helpers/fileUpload');
const urls = require('../constants/urls');

const get = async (req, res) => {
  const data = await Garbage.find({ _id: req.params.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Garbage doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const garbage = new Garbage({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });
  garbage
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const edit = async (req, res) => {
  const user = req.currentUser;
  const editData = req.body;
  const garbage = await Garbage.findOne({ user: user._id });
  if (!garbage) {
    const newGarbage = new Garbage({
      ...editData,
      user: user._id,
    });

    newGarbage
      .save()
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err.message);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  } else {
    for (const key in editData) {
      garbage[key] = editData[key];
    }

    garbage
      .save()
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  }
};

const uploadIntroVideo = async (req, res) => {
  const { currentUser } = req;
  const introVideoObject = req.file;
  const introVideo = introVideoObject.location;
  try {
    const currentGarbage = await Garbage.findOne({ user: currentUser._id });
    if (currentGarbage) {
      if (currentGarbage.intro_video) {
        try {
          const key = currentGarbage.intro_video.slice(
            urls.STORAGE_BASE.length + 1
          );
          await removeFile(key);
        } catch (err) {
          console.log('Remove the Intro Video: ', err);
        }
      }
      currentGarbage.intro_video = introVideo;
      Garbage.updateOne(
        { user: currentUser._id },
        { $set: { intro_video: introVideo } }
      )
        .then(() => {
          return res.send({
            status: true,
            data: { intro_video: introVideo },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            data: err.message,
          });
        });
    } else {
      const newGarbage = new Garbage({
        intro_video: introVideo,
        user: currentUser._id,
      });
      newGarbage.save().then((_garbage) => {
        return res.send({
          status: true,
          data: _garbage,
        });
      });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ status: false, error: err.message || 'Internal server error' });
  }
};

module.exports = {
  get,
  create,
  edit,
  uploadIntroVideo,
};
