const { validationResult } = require('express-validator/check');
const mongoose = require('mongoose');
const Tag = require('../models/tag');
const Contact = require('../models/contact');

const get = async (req, res) => {
  const { currentUser } = req;
  const data = await Tag.find({ user: currentUser.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Tag doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  await Tag.findOrCreate(
    { content: req.body.content, user: currentUser.id },
    {
      ...req.body,
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    }
  )
    .then((_res) => {
      const data = _res;
      res.send({
        status: true,
        data,
      });
    })
    .catch((e) => {
      let errors;
      if (e.errors) {
        errors = e.errors.map((err) => {
          delete err.instance;
          return err;
        });
      }
      return res.status(500).send({
        status: false,
        error: errors || e,
      });
    });
};

const search = async (req, res) => {
  const { currentUser } = req;
  const { search } = req.body;
  const limit = search ? 10 : 10000;
  // data = await Tag.find({content: {'$regex': search+'.*', '$options': 'i'}, user: currentUser.id}).sort({content: 1})
  const data = await Tag.aggregate([
    {
      $match: {
        content: { $regex: `${search}.*`, $options: 'i' },
        user: mongoose.Types.ObjectId(currentUser.id),
      },
    },
    { $group: { _id: '$content', id: { $first: '$_id' } } },
    { $sort: { _id: 1 } },
    { $project: { content: '$_id', _id: '$id' } },
    { $limit: limit },
  ]).catch((err) => {
    console.log('err', err);
  });

  return res.send({
    status: true,
    data,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    {
      $unwind: {
        path: '$tags',
      },
    },
    {
      $group: {
        _id: '$tags',
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  res.send({
    status: true,
    data,
  });
};

const getTagsDetail = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    {
      $unwind: {
        path: '$tags',
      },
    },
    {
      $group: {
        _id: '$tags',
        count: { $sum: 1 },
        contacts: {
          $push: {
            first_name: '$$ROOT.first_name',
            last_name: '$$ROOT.last_name',
            _id: '$$ROOT._id',
            email: '$$ROOT.email',
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  res.send({
    status: true,
    data,
  });
};

module.exports = {
  get,
  create,
  search,
  getAll,
  getTagsDetail,
};
