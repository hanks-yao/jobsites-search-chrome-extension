console.log('content_scritp loaded!');

let fun = {
  getBasicInfo: function() {
    let $parents = $('#MainCol').find('.jl');
    let result = [];

    for (let i = 0; i < $parents.length; i++) {
      let $parent = $($parents[i]),
          element = {};

      element['company_id'] = $parent.data('emp-id');
      element['job_title'] = $parent.find('div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > a').text().trim();
      element['date'] = $parent.find('div:nth-child(2) span.hideHH').text().trim();

      let comAndLoc = $parent.find('div:nth-child(2) > div.flexbox.empLoc > div:nth-child(1)').text();
      let index = comAndLoc.indexOf(' – ');
      element['company'] = comAndLoc.substring(0, index).trim();
      element['location'] = comAndLoc.substring(index+3);


      result.push(element);
    }
    console.log(result);
    return result;
  },
  getPage: function() {
    let text = $('#ResultsFooter').children('.padVertSm').text().trim(),
        index = text.indexOf('of'),
        pages = parseInt(text.substring(index+3)),
        currentPage = parseInt(text.substring(5, index-1));

    return {
      current_page: currentPage,
      pages: pages
    };
  },
  isLastPage: function() {
    let pageRes = fun.getPage();

    return  pageRes['current_page'] == pageRes['pages'];
  }
};

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    if (request.crawlBasicInfo) { //新开的window监听backgournd发送抓取basis的请求
      console.log("crawlBasicInfo:");
      console.log(request);

      let res = {};
      res['data'] = fun.getBasicInfo(),
      res['current_page'] = fun.getPage()['current_page'],
      res['is_last'] = fun.isLastPage();

      sendResponse(res);
    } else if (request.gotoNextPage) {
      console.log('gotoNextPage:');
      console.log(request);

      if (fun.isLastPage()) {
        sendResponse(false);
      } else {
        $('#FooterPageNav').find('li.next > a')[0].click();
        sendResponse(true);
      }
    } else if (request.downloadFile) {
      console.log('downloadFile');
      console.log(request);

      let data = request.data;

      ufn.exportCsv({
        title:['Title','Company','Location','Date','Industry','Headquarters','Size','Revenue','Domain','Type','Founded','Competitors','Company ID'],
        titleForKey:['job_title','company','location','date','industry','headquarters','size','revenue','domain','type','founded','competitors','company_id'],
        data: data,
        fileName: 'Glassdoor-jobs',
      });

      sendResponse(true);
    }

});