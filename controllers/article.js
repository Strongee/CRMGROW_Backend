"use strict";
const dbConnection = require('../config/database');

const connection = dbConnection();

const insert = async (req, res) => {

    let today = new Date();
    let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let currentTime = date + ' ' + time;
    let queryObject = Object.assign({dateAdded: currentTime}, req.body);

    connection.query('INSERT INTO articles SET ? ',
        queryObject
    , (err) => {
        res.send({
            status: true
        })
    });
  }

const getAll = async (req, res) => {
    connection.query('SELECT * FROM articles', (err, result) => {
        console.log('result',result);
        res.send({
            status: true,
            data: result
          })
      })
  }

const get = async (req, res) =>{
    console.log('req.query',req.query);
    connection.query('SELECT * FROM articles WHERE id ='+req.query.id, (err, result) =>{
        console.log('result', result),
        res.send({
            status: true,
            data: result
        })
    })
}

const update = async (req, res) => {
    
    let query = 'UPDATE articles SET title = ?, dateAdded =?, text =?, author=?, categoryId=?, WHERE id=?';
    let queryObject = req.body;

    connection.query(query,[queryObject.title,queryObject.dateAdded,queryObject.text,queryObject.author,queryObject.categoryId,], (error, result) => {  
        res.send({
            status: true,
            data: articles
          })
      })
  }

const del = async (req, res) => {
    connection.query('SELECT * FROM articles', (err, result) => {
        res.send({
            status: true,
            data: articles
          })
      })
  }

module.exports = {
    insert,
    getAll,
    get,
    update,
    del
}
 