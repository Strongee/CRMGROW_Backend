const url = new URL(location.href)
const query_params = new URLSearchParams(url.search)
const video = query_params.get("video")
const user = query_params.get("user")
const contact = query_params.get("contact")
const activity = query_params.get("activity")
var socket;
var report = {
    video,
    user,
    contact,
    activity,
    duration: 0
}
var registered_flag = false
if( contact && activity ){
    socket = io.connect('https://app.crmgrow.com')
}

var vPlayer = new Plyr('#material-video');
// var timer;
var trackingTimes = [];
var startOverlapFlag = false;
var endOverlapFlag = false;
var currentTrackerIndex = 0;
var seek_flag = false;
var watched_time = 0;
var duration = document.querySelector("#video-duration").value
function updateStartTime() {
    let currentTime = vPlayer.currentTime
    for( let i = 0; i < trackingTimes.length; i++ ){
        if( trackingTimes[i][0] <= currentTime && currentTime <= trackingTimes[i][1] ){
            currentTrackerIndex = i;
            startOverlapFlag = true;
            return;
        }
    }
    trackingTimes.push([currentTime])
    currentTrackerIndex = trackingTimes.length - 1;
    startOverlapFlag = false;
}

function updateEndTime(){
    let currentTime = vPlayer.currentTime
    // Seeking Check
    if( trackingTimes[currentTrackerIndex] && trackingTimes[currentTrackerIndex][1] != null && trackingTimes[currentTrackerIndex][1] != undefined && ( trackingTimes[currentTrackerIndex][1] < currentTime - 0.6 || currentTime < trackingTimes[currentTrackerIndex][1]) ) {
        return;
    }
    
    if( startOverlapFlag == false ){
        // TODO : Can update the start index as current tracker for Better algorithm
        for( let i = 0 ; i < trackingTimes.length; i++ ){
            if( i != currentTrackerIndex && trackingTimes[i][1] ){
                if( trackingTimes[i][0] <= currentTime && currentTime <= trackingTimes[i][1] && i != currentTrackerIndex ){
                    trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1]
                    trackingTimes.splice(i, 1);
                    if( i < currentTrackerIndex ) { currentTrackerIndex --;}
                    return;
                }
            }            
        }
        if( trackingTimes[currentTrackerIndex] && trackingTimes[currentTrackerIndex][1] != null && trackingTimes[currentTrackerIndex][1] != undefined ){
                trackingTimes[currentTrackerIndex][1] =  currentTime
        }
        else if(trackingTimes[currentTrackerIndex]){
            trackingTimes[currentTrackerIndex].push(currentTime)
        }  
    }
    else {
        if( currentTime <= trackingTimes[currentTrackerIndex][1] ){
            return;
        }
        else {
            for( let i = 0 ; i < trackingTimes.length; i++ ){
                if( i != currentTrackerIndex && trackingTimes[i][1] ){
                    if( trackingTimes[i][0] <= currentTime && currentTime <= trackingTimes[i][1] && i != currentTrackerIndex){
                        trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1]
                        trackingTimes.splice(i, 1);
                        if( i < currentTrackerIndex ) { currentTrackerIndex --;}
                        return;
                    }
                }
            }
            if( trackingTimes[currentTrackerIndex][1] != null && trackingTimes[currentTrackerIndex][1] != undefined ){
                trackingTimes[currentTrackerIndex][1] =  currentTime
            }
            else if(trackingTimes[currentTrackerIndex]){
                trackingTimes[currentTrackerIndex].push(currentTime)
            }
        }
    }
}

function reportTime() {
    var total = 0;
    trackingTimes.forEach(e => {
        if ( e[1] ) {
            total += (e[1] - e[0])
        }
    })
    watched_time = total;
    if( total != 0 && socket ){
        if( watched_time < duration){
            if (!registered_flag){
                registered_flag = true;
                socket.emit('init_video', report)
            }
            else {
                socket.emit('update_video', total * 1000)
            }
        }
        else{
            socket.emit('update_video', duration * 1000)
            socket.emit('disconnect')
        }                
    }
}

vPlayer.on("play", function() {
    if ( seek_flag || watched_time == 0 ){
        updateStartTime()
    }
})

vPlayer.on("timeupdate", function() {
    if( vPlayer.seeking ){
        seek_flag = true
    }
    else {
        seek_flag = false
        updateEndTime()
        reportTime()
    }
})