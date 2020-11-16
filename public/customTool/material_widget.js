const materialData = $("#material-detail").val() + '';
const material = JSON.parse(materialData);
const material_type = $("#material-type").val() + '';

const userData = $("#user-detail").val() + '';
const user = JSON.parse(userData);
const socialData = $("#social-links").val() + '';
const socials = JSON.parse(socialData);

let materialHTML = ''
let materialTitle = material.title;
let materialDescription = material.description;
let userAvatar = `<img src="${user.picture_profile}" style="width: 100%; height: 100%; object-fit: cover;"/>`;
let userName = user.user_name;
let userEmail = user.email;
let userPhone = user.cell_phone;
let userFacebook = socials.facebook;
let userTwitter = socials.twitter;
let userLinked = socials.linkedin;
if(material_type === 'video') {
  if(material.type === 'youtube' || material.type === 'vimeo') {
    materialHTML = `
      <div class="video-player-wrapper">
        <div id="player" data-plyr-provider="${material.type}" data-plyr-embed-id="${material.url}"></div>
      </div>
      `
  } else {
    materialHTML = `
      <div class="video-player-wrapper">
        <video id="player" poster="${material.thumbnail}" controls playsinline name="media">
          <source src="${material.url}" type="video/mp4"></source>
        </video>
      </div>
    `
  }
}

if(material_type === 'pdf') {
  materialHTML = `
   <div class="pdf-wrapper">
    <div id="pdf-container">
      <img src="${material.preview}" />
    </div>
   </div>
   <input id="pdfpath" type="hidden" value="${material.url}" />
  `
}

if(material_type === 'image') {
  let imageHTML = ''
  material.url.forEach(e => {
    imageHTML += `
      <a href="${e}>
        <img src=${e} />
      </a>
    `
  });
  materialHTML = `
    <div class="gallery-wrapper">
      <div id="galleria">
        ${imageHTML}      
      </div>
    </div>
    <div class="d-none" id="gallery-container">
      ${imageHTML}
    </div>
  `
}

$(".unlayer-material-viewer").html(materialHTML);
$(".unlayer-material-viewer").addClass("material-wrapper");
$(".unlayer-material-title").html(materialTitle);
$(".unlayer-material-description").html(materialDescription);
$(".your-avatar-field").html(userAvatar);
$(".your-name-field").html(userName);
$(".your-phone-field").html(userPhone);
$(".your-email-field").html(userEmail);
$(".your-social-field").html(userFacebook + userTwitter + userLinked);


