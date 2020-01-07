$(function() {

setInterval(() => {
    reportTime();
}, 1000);

$(function() {
    $(".fade").slick({
      dots: true,
      infinite: true,
      speed: 500,
      fade: true,
      cssEase: 'linear'
    });
  });
  

const image = document.querySelector("#image").value
const user = document.querySelector("#user").value
const contact = document.querySelector("#contact").value
const activity =document.querySelector("#activity").value
  var socket;
  var report = {
      image,
      user,
      contact,
      activity,
      duration: 0
  }
  var registered_flag = false
  var reported = false;
  if( contact && activity ){
      socket = io.connect('https://app.crmgrow.com');
  }

  function reportTime() {
      if( total != 0 && socket ){
          if( total * 1000 < total_pages * 10000){
              if (!registered_flag){
                  registered_flag = true;
                  socket.emit('init_image', report)
              }
              else {
                  socket.emit('update_image', total * 1000)
              }
          }
          else{
              if( !reported ){
                  console.log("disconnecting the image");
                  socket.emit('update_image', duration * 1000)
                  socket.emit('close')
                  reported = true;
              }            
          }
      }
      total++;
  }

});
