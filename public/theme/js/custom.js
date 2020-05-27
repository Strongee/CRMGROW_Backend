$('.highlights').slick({
  // normal options...
  dots: true,
  slidesToShow: 3,
  infinite: true,

  // the magic
  responsive: [
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 2,
        vertical: false,
      },
    },
    {
      breakpoint: 575,
      settings: {
        slidesToShow: 3,
        vertical: true,
        dots: false,
        verticalSwiping: true,
      },
    },
  ],
});
