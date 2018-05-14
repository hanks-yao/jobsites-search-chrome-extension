$(document).ready(function() {
  $('#startBtn').on('click', function(event) {
    event.preventDefault();

    let $this = $(this),
      pages = parseInt($('#pages').val());

    if (pages <= 0) {
      alter('Invalid Page Number!');
    } else {
      $this.prop('disabled', true);
      $('#tipsDiv').show();

      chrome.runtime.sendMessage({getJobsInfo:true, pages:pages}, function(response){
        console.log(response);
      });
    }
  });
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.hidePopupTips) {
      console.log(request);
      $('#tipsDiv').hide();
      $('#startBtn').prop('disabled', false);
    } else if (request.showPopupTips) {
      console.log(request);
      $('#tipsDiv').show();
      $('#startBtn').prop('disabled', false);
    } else if (request.setPopupTips) {
      $('#tips').text(request.text);
    }
  }
);