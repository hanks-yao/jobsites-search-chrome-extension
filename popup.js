var fun = {
  refreshConfigDiv: function(){
    let config = JSON.parse(localStorage.getItem('config'));
    let html = '';

    if (config) {
      $('#resetBtn').show();
      $('#uploadDiv').hide();

      for (let key in config) {
        config[key] = config[key].split(',').join(', ');
        html += `<div class="form-group"><label>${key}:</label><p style="">${config[key]}</p></div>`;
      }
      $('#setting-wrap').html(html);
    } else {
      $('#setting-wrap').empty();
      $('#resetBtn').hide();
      $('#uploadDiv').show()

      let h = $('.wrapper').height();
      $('body').height(h);
      $('html').height(h);
    }

  },
};

(function(){
  console.log(123);
  fun.refreshConfigDiv();
})();


$(document).ready(function() {
  $('#startBtn').on('click', function(event) {
    event.preventDefault();

    let $this = $(this),
      pages = parseInt($('#pages').val());

    if (pages >= 0) {
      $this.prop('disabled', true);
      $('#tipsDiv').show();

      chrome.runtime.sendMessage({getJobsInfo:true, pages:pages}, function(response){
        console.log(response);
      });
    } else {
      alert('Invalid Page Number!');
      return;
    }
  });

  $('#resetBtn').on('click', function(event) {
    localStorage.clear();
    fun.refreshConfigDiv();
  });

  $('#file').on('change', function(event) {
    event.preventDefault();
    var file = this.files[0];
    var reader = new FileReader();

    reader.readAsText(file);

    reader.onload = function() {
      let content = this.result;

      let config = JSON.stringify(JSON.parse(content));
      console.log(config);
      localStorage.setItem('config',config);

      fun.refreshConfigDiv();
    };

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