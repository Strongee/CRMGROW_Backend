const mongoose = require('mongoose');
const Activity = require('../models/activity');
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from

const migrate = async() => {
  const video_trackers = await Activity.find({type: 'video_trackers'}).populate('video_trackers')
  
  for(let i=0; i<video_trackers.length; i++){
    console.log('video_trackers', video_trackers[i])
    const video_tracker = video_trackers[i]
    video_tracker.videos = video_tracker.video_trackers.id
    video_tracker.save()
  }
}
migrate();