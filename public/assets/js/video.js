// let phone = document.querySelector(".cell_phone span").innerText 
// let newStr = phone.replace(/\D/g, '');
// if (newStr.length < 10) {
//     while (newStr.length < 10) {
//         newStr = "0" + newStr;
//     }
// }
// newStr = newStr.slice(newStr.length - 10, newStr.length);
// let result = "";
// result = "(" + newStr.slice(0, 3) + ") " + newStr.slice(3, 6) + "-" + newStr.slice(6, 10);
// document.querySelector(".cell_phone span").innerText = result

// var vPlayer = videojs('material-video');


(function($) {
    $(document).ready(function() {

        var cleave = new Cleave('.phone-info', {
            numericOnly: true,
            blocks: [0, 3, 3, 4],
            delimiters: ["(", ") ", "-"]
        });

        $("#info-form").submit((e) => {
            e.preventDefault();
            var formData = $("#info-form").serializeArray();
            var data = {};
            formData.forEach(e => {
                data[e['name']] = e['value']
            })
            $("#info-form .btn").addClass('loading')
            $("#info-form .btn").text('Please wait...')
            $.ajax({
                type: 'POST',
                url: 'api/contact/lead',
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(data),
                success: function(data) {
                    console.log('data', data)
                    // $("#myModal").addClass('thank-step')
                    const response = data.data
                    if(response){
                        $("#contact").val(response.contact)
                        $("#activity").val(response.activity)
                    }
                    // $("#thank-btn").click(() => {
                    //     $("body").removeClass("is_protected");
                    //     $(".modal-backdrop").removeClass('show');
                    //     $("#myModal").removeClass('show');
                    // })
                    $("#info-form .btn").removeClass('loading')
                    $("#info-form .btn").text('Submit')
                    $("body").removeClass("is_protected");
                    $(".modal-backdrop").removeClass('show');
                    $("#myModal").removeClass('show');
                },
                error: function(data) {
                    $("#info-form .btn").removeClass('loading')
                    $("#info-form .btn").text('Submit')
                    alert('Error is occured. Error:', data);
                }
            })
        })
    })
})(jQuery)