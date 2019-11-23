$(function() {
    let pdf_url = document.querySelector("#pdf").value;
    var total_pages;
    let total = 0;
    const displayControls = (e) => {
        let totalPages = $("#viewer").pdf("getTotalPages");
        total_pages = totalPages
        $(".pdf-controls").addClass("enable");
        $(".page-status .total-page").text(totalPages);
        $(window).resize();
        setTimeout(() => {
            resetHeight();
        }, 500);
        setInterval(() => {
            reportTime();
        }, 1000);
    }

    const changeControls = (e) => {
        let currentPage = $("#viewer").pdf("getPageNumber");
        $(".page-status .current-page").text(currentPage);
    }

    const resetHeight = () => {
        let pdfDOM = document.querySelector(".pdf-outerdiv");
        let realHeight = window.getComputedStyle(pdfDOM).height;
        let transform = window.getComputedStyle(pdfDOM).transform;
        let scale = transform.replace('matrix(', '').replace(')', '').split(',')[0];
        scale = parseFloat(scale);
        scale = scale == 0 ? 1 : scale;
        document.querySelector("#viewer").style.height = parseFloat(realHeight) * scale + 30 + 'px';
    }

    $(".pdf-controls .prev").click(function(){
        $(".pdf-loading").show();
        $("#viewer").pdf("previous");
    })

    $(".pdf-controls .next").click(function(){
        $(".pdf-loading").show();
        $("#viewer").pdf("next");
    })

    $("#viewer").pdf( {
    source: pdf_url,
    title:"",
    tabs: [],
    tabsColor:"beige",
    disableSwipe:false,
    disableLinks:false,
    disableKeys:false,
    loadingHeight: 300,
    loadingWidth: 1000,
    loadingHTML:"<div class='loader'></div>",
    loaded: displayControls,
    changed: changeControls
  } );

  $(window).resize(
      function(){
        document.querySelector("#viewer").style.height = '';
        setTimeout(() => {resetHeight()}, 500 );
      }
  );
  
  const pdf = document.querySelector("#pdf").value
  const user = document.querySelector("#user").value
  const contact = document.querySelector("#contact").value
  const activity =document.querySelector("#activity").value
    var socket;
    var report = {
        pdf,
        user,
        contact,
        activity,
        duration: 0
    }
    var registered_flag = false
    if( contact && activity ){
        socket = io.connect('https://app.crmgrow.com');
    }

    function reportTime() {
        if( total != 0 && socket ){
            if( total * 1000 < total_pages * 10000){
                if (!registered_flag){
                    registered_flag = true;
                    socket.emit('init_pdf', report)
                }
                else {
                    socket.emit('update_pdf', total * 1000)
                }
            }
            else{
                if( !reported ){
                    console.log("disconnecting the video");
                    socket.emit('update_pdf', duration * 1000)
                    socket.emit('close')
                    reported = true;
                }            
            }                
        }
        total++;
    }

});
