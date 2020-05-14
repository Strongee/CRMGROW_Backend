// $(function() {
//   $(".regular").slick({
//     dots: true,
//     infinite: true,
//     speed: 500,
//     adaptiveHeight: true,
//     slidesToShow: 3,
//     cssEase: 'linear'
//   });
// });

(function($){
  if($('.gallery img').length > 1) {
    $('.gallery').tjGallery({
      row_min_height: 180,
      margin: 10,
      selector: 'a'
    })
  }
  else {
    $('.gallery img').addClass('single');
  }
  
  var lightbox = new SimpleLightbox('.gallery a', { /* options */ });
})(jQuery)
