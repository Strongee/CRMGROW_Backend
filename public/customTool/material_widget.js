const materialData = $("#material-detail").val() + '';
const material = JSON.parse(materialData);
const material_type = $("#material-type").val() + '';



let materialHTML = ''
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

$(".material-wrapper").html(materialHTML);


