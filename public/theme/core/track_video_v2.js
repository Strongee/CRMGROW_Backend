var deviceType;
var first_seekable = false;
var registered_flag = false;
var reported = false;
var socket;
var vPlayer = new Plyr('#player');
var trackingTimes = [];
var startOverlapFlag = false;
var endOverlapFlag = false;
var currentTrackerIndex = 0;
var seek_flag = false;
var watched_time = 0;
var duration = document.querySelector('#duration').value;
let limit = duration

if(duration > 600) {
  limit = duration - 5
}
else {
  limit = duration - 3
}

// Set the Material Start Time From end of the previous watch activity
var material_start = 0;
if(document.querySelector('#material-start')) {
  material_start = parseFloat(document.querySelector('#material-start').value);
  if(material_start + 5 < duration) {
    vPlayer.currentTime = material_start;
  }
}

// Update Start Time in Watched Video time tracking
function updateStartTime() {
  const contact = document.querySelector('#contact').value;
  const activity = document.querySelector('#activity').value;
  if (contact && activity) {
    if (!socket) {
      var siteAddr = location.protocol + '//' + location.hostname;
      // var siteAddr = 'http://localhost:3000'
      socket = io.connect(siteAddr);
    }
  }
  let currentTime = vPlayer.currentTime;
  for (let i = 0; i < trackingTimes.length; i++) {
    if (
      trackingTimes[i][0] <= currentTime &&
      currentTime <= trackingTimes[i][1]
    ) {
      currentTrackerIndex = i;
      startOverlapFlag = true;
      return;
    }
  }
  trackingTimes.push([currentTime]);
  currentTrackerIndex = trackingTimes.length - 1;
  startOverlapFlag = false;
}

// Update End time of the Watched Time Tracking list
function updateEndTime() {
  let currentTime = vPlayer.currentTime;
  // Seeking Check
  // if( trackingTimes[currentTrackerIndex] && trackingTimes[currentTrackerIndex][1] != null && trackingTimes[currentTrackerIndex][1] != undefined && ( trackingTimes[currentTrackerIndex][1] < currentTime - 0.6 || currentTime < trackingTimes[currentTrackerIndex][1]) ) {
  //     return;
  // }

  if (startOverlapFlag == false) {
    // TODO : Can update the start index as current tracker for Better algorithm
    for (let i = 0; i < trackingTimes.length; i++) {
      if (i != currentTrackerIndex && trackingTimes[i][1]) {
        if (
          trackingTimes[i][0] <= currentTime &&
          currentTime <= trackingTimes[i][1] &&
          i != currentTrackerIndex
        ) {
          trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
          trackingTimes.splice(i, 1);
          if (i < currentTrackerIndex) {
            currentTrackerIndex--;
          }
          return;
        }
      }
    }
    if (
      trackingTimes[currentTrackerIndex] &&
      trackingTimes[currentTrackerIndex][1] != null &&
      trackingTimes[currentTrackerIndex][1] != undefined
    ) {
      trackingTimes[currentTrackerIndex][1] = currentTime;
    } else if (trackingTimes[currentTrackerIndex]) {
      trackingTimes[currentTrackerIndex].push(currentTime);
    }
  } else {
    if (currentTime <= trackingTimes[currentTrackerIndex][1]) {
      return;
    } else {
      for (let i = 0; i < trackingTimes.length; i++) {
        if (i != currentTrackerIndex && trackingTimes[i][1]) {
          if (
            trackingTimes[i][0] <= currentTime &&
            currentTime <= trackingTimes[i][1] &&
            i != currentTrackerIndex
          ) {
            trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
            trackingTimes.splice(i, 1);
            if (i < currentTrackerIndex) {
              currentTrackerIndex--;
            }
            return;
          }
        }
      }
      if (
        trackingTimes[currentTrackerIndex][1] != null &&
        trackingTimes[currentTrackerIndex][1] != undefined
      ) {
        trackingTimes[currentTrackerIndex][1] = currentTime;
      } else if (trackingTimes[currentTrackerIndex]) {
        trackingTimes[currentTrackerIndex].push(currentTime);
      }
    }
  }
}

// Report the time 
function reportTime() {
  var total = 0;
  trackingTimes.forEach((e) => {
    if (e[1]) {
      total += e[1] - e[0];
    }
  });
  watched_time = total;
  if (total != 0 && socket) {
    if (watched_time < limit) {
      if (!registered_flag) {
        const video = document.querySelector('#material').value;
        const user = document.querySelector('#user').value;
        const contact = document.querySelector('#contact').value;
        const activity = document.querySelector('#activity').value;
        var report = {
          video,
          user,
          contact,
          activity,
          duration: 0,
          material_last: vPlayer.currentTime
        };
        registered_flag = true;
        socket.emit('init_video', report);
      } else {
        socket.emit('update_video', {
          duration: total * 1000,
          material_last: vPlayer.currentTime
        });
      }
    } else {
      if (!reported) {
        let currentTime = vPlayer.currentTime;
        if(currentTime > limit - 2 ) {
          currentTime = 0;
        }
        socket.emit('update_video', {
          duration: duration * 1000,
          material_last: currentTime
        });
        socket.emit('close');
        reported = true;
      }
    }
  }
  let watched_sec = Math.floor(watched_time % 60);
  let watched_min = Math.floor(watched_time / 60);
  let watched_min_s = watched_min < 10 ? '0' + watched_min : watched_min;
  let watched_sec_s = watched_sec < 10 ? '0' + watched_sec : watched_sec;
  if (document.querySelector('.watched-time')) {
    document.querySelector(
      '.watched-time'
    ).innerText = `${watched_min_s}:${watched_sec_s}`;
  }
}

// Player Update Time
vPlayer.on('loadeddata', () => {
  if(material_start) {
    first_seekable = true;
    if(material_start + 5 < vPlayer.duration) {
      vPlayer.currentTime = material_start;
    }
  }
})
vPlayer.on('ready', () => {
  first_seekable = true;
})
vPlayer.on('playing', function () {
  if(first_seekable) {
    if(material_start + 5 < vPlayer.duration) {
      vPlayer.currentTime = material_start;
    }
    first_seekable = false;
  }
  if (seek_flag || watched_time == 0) {
    updateStartTime();
    seek_flag = false;
  }
});
vPlayer.on('timeupdate', function () {
  if (vPlayer.seeking || seek_flag) {
    seek_flag = true;
  } else {
    seek_flag = false;
    updateEndTime();
    reportTime();
  }
});
vPlayer.on('seeking', () => {
  seek_flag = true;
});

function initRecord() {
  registered_flag = false;
  reported = false;
  socket = undefined;
  trackingTimes = [];
  startOverlapFlag = false;
  endOverlapFlag = false;
  currentTrackerIndex = 0;
  seek_flag = false;
  watched_time = 0;
}

// Document View and Hide activity
function handleVisibilityChange() {
  if (document.hidden) {
    // Close the Socket on mobile
    if(deviceType === 'mobile') {
      if(socket) {
        socket.emit('close');
      }
    }
  } else  {
    // Restart the Socket on mobile
    if(deviceType === 'mobile') {
      initRecord();
      var siteAddr = location.protocol + '//' + location.hostname;
      // var siteAddr = 'http://localhost:3000'
      socket = io.connect(siteAddr);
    }
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange, false);


if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
  deviceType = 'mobile'
} else { 
  deviceType = 'desktop'
}
// setInterval(() => {
//   if (socket && socket.connected) {
//     if (document.querySelector('.watched-time')) {
//       document.querySelector('.watched-time').classList.add('connected');
//     }
//   } else {
//     if (document.querySelector('.watched-time')) {
//       document.querySelector('.watched-time').classList.remove('connected');
//     }
//   }
// }, 1000);