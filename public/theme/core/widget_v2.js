let hasCapture = false;
let captured = false;
let isTrackMaterial = false;

if ($("#capture-dialog").val() === 'true') {
  hasCapture = true;
}
if($("#activity").val() != 'undefined' && $("#contact").val() != 'undefined') {
  isTrackMaterial = true;
}

$(".widget-action.interesting").click(function() {
  if (hasCapture && captured) {
    likeWithContact()  
    // API Update
  }
  if (hasCapture && !captured) {
    $("#interestModal").modal({backdrop: 'static', keyboard: false})
  }
  if (!hasCapture) {
    if (isTrackMaterial) {
      likeWithContact()
    } else {
      $("#interestModal").modal({backdrop: 'static', keyboard: false})
    }
  }
});

function likeWithContact() {
  let contact = $('#contact').val();
  let material = $('#material').val();
  let materialType = $('#material-type').val();
  let user = $('#user').val();

  $(".widget-action.interesting").addClass('loading');
  $.ajax({
    type: 'POST',
    url: 'api/contact/interest-submit',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({contact, material, materialType, user}),
    success: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      const response = data.data;
      delay(250).then(() => check())
      delay(150).then(() => check())
      delay(500).then(() => check())
      if (response) {
        if(!socket) {
          var siteAddr = location.protocol + '//' + location.hostname;
          // var siteAddr = "http://localhost:3000";
          socket = io.connect(siteAddr);
        }
      }
    },
    error: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          alert(response['error']);
        } else {
          alert('Internal Server Error');
        }
      } else {
        alert('Internal Server Error');
      }
    },
  });
}


$('#interest-form').submit((e) => {
  e.preventDefault();
  var formData = $("#interest-form").serializeArray();
  var data = {};
  formData.forEach((e) => {
    data[e['name']] = e['value'];
  });
  let materialType = $('#material-type').val();
  data['materialType'] = materialType;
  $('#interest-form .btn').addClass('loading');
  $('#interest-form .btn').text('Please wait...');

  $.ajax({
    type: 'POST',
    url: 'api/contact/interest',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    success: function (data) {
      const response = data.data;
      delay(250).then(() => check())
      delay(150).then(() => check())
      delay(500).then(() => check())
      if (response) {
        $('#contact').val(response.contact);
        $('#activity').val(response.activity);
        if(!socket) {
          var siteAddr = location.protocol + '//' + location.hostname;
          // var siteAddr = "http://localhost:3000";
          socket = io.connect(siteAddr);
        }
      }
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      $('#interestModal').modal('hide');
      captured = true;
    },
    error: function (data) {
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          alert(response['error']);
        } else {
          alert('Internal Server Error');
        }
      } else {
        alert('Internal Server Error');
      }
    },
  });
})



var brd = document.createElement("DIV");
brd.classList.add("rate-board");
document.body.insertBefore(brd, document.getElementById("board"));

const genDur = 3000;
const speed = 0.5;
const cursorXOffset = 0;
const cursorYOffset = -5;

var hearts = [];
		
function generateHeart(x, y, xBound, xStart, scale)
{
	var heart = document.createElement("DIV");
	heart.setAttribute('class', 'heart');
	brd.appendChild(heart);
	heart.time = genDur;
	heart.x = x;
	heart.y = y;
	heart.bound = xBound;
	heart.direction = xStart;
	heart.style.left = heart.x + "px";
	heart.style.top = heart.y + "px";
	heart.scale = scale;
	heart.style.transform = "scale(" + scale + "," + scale + ")";
	if(hearts == null)
		hearts = [];
	hearts.push(heart);
	return heart;
}

var down = false;
var event = null;

document.onmousedown = function(e) {
	down = true;
	event = e;
}

document.ontouchmove = function(e) {
	event = e.touches[0];
}

var before = Date.now();
var id = setInterval(frame, 5);
// var gr = setInterval(check, 100);

function frame()
{
	var current = Date.now();
	var deltaTime = current - before;
	before = current;
	for(i in hearts)
	{
		var heart = hearts[i];
		heart.time -= deltaTime;
		if(heart.time > 0)
		{
			heart.y -= speed;
			heart.style.top = heart.y + "px";
			heart.style.left = heart.x + heart.direction * heart.bound * Math.sin(heart.y * heart.scale / 30) / heart.y * 100 + "px";
    }
		else
		{
			heart.parentNode.removeChild(heart);
			hearts.splice(i, 1);
		}
	}
}

function check()
{
		var start = 1 - Math.round(Math.random()) * 2;
		var scale = Math.random() * Math.random() * 0.8 + 0.2;
    var bound = 30 + Math.random() * 20;
    let button = document.querySelector(".widget-action.interesting");
    if(button) {
      let x = document.querySelector(".widget-action.interesting").offsetLeft;
      let y = document.querySelector(".widget-action.interesting").offsetTop;
      generateHeart(x - brd.offsetLeft + cursorXOffset, y - brd.offsetTop + cursorYOffset, bound, start, scale);
    }
}

delay = (ms) => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, ms);
});