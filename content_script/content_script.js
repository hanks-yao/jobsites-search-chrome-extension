console.log('content_scritp loaded!');

let fun = {
  getBasicInfo: function(filter){
    let $parents = $('.clickcard');
    let result = [];

    for (let i = 0; i < $parents.length; i++) {
      let $parent = $($parents[i]),
          element = {};

      element['job_title'] = $parent.find('[data-tn-element="jobTitle"]').text().trim();

      //过滤title中不包含keywords的job
      if (filter && (filter.length > 0) && (!fun.includeKeywords(element['job_title'], filter))) {
        continue;
      }

      element['location'] = $parent.find('.location').text().trim();
      element['date'] = $parent.find('.date').text().trim();

      let $element_company = $parent.find('.company');
      let $element_company_a = $element_company.children('a');

      element['company'] = $element_company.text().trim();

      if ($element_company_a.length) {
        element['about_link'] = fun.changeLinkToAbout($element_company_a.attr('href'));
      }

      result.push(element);
    }

    console.log(result);
    return result;
  },
  getDetailedInfo: function(){
    let res = {};
    let $detialBlock1 = $('#cmp-company-details-sidebar');
    // let $detialBlock2 = $('#company-details-section');

    if ($detialBlock1.length) {
      let items = $detialBlock1.children('dt');

      for (let i = 0; i < items.length; i++) {
        let $item = $(items[i]),
            key = $item.text().toLowerCase(),
            value = $item.next('dd').text();

        if (key == 'links') {
          let links = $item.next('dd').children('a');

          for (var n = 0; n < links.length; n++) {
            let $a = $(links[n]);

            if($a.text().indexOf('website') != -1){
              res['domain'] = ufn.getUrlDomamin($a.attr('href'));
            }
          }
        } else {
          res[key] = value;
        }
      }
    }

    console.log(res);
    return res;
  },
  changeLinkToAbout:function(link) {
    let a = link,
        index = a.indexOf('?');

    if (index !== -1) {
      a = a.substring(0, index);
    }

    if (a.indexOf('http') === -1) {
      a = 'https://www.indeed.com' + a + '/about';
    } else {
      a = a + '/about';
    }

    return a;
  },
  getCurrentPage: function() {
    return parseInt($('.pagination').children('b').text());
    // let pageText = $('#searchCount').text();
    // let page =
  },
  isLastPage: function() {
    return $('.pagination').children('a:last').text().trim() != 'Next »';
  },
  includeKeywords: function(target, keywords) {
    let t = target.toLocaleLowerCase();

    for ( let n in keywords) {
      let k = keywords[n].toLocaleLowerCase();

      if (t.indexOf(k) > -1) {return true}
    }

    return false;
  },
};


$(document).ready(function() {
  console.log('document ready!');
  const parents_class = 'clickcard';
  const elements_class = {
    'job_title': 'jobtitle',
    'company': 'company',
    'location': 'location',
    'date': 'date',
    'headquarters': '',
    'revenue': '',
    'employees': '',
    'industry': '',
    'website': '',
  };
  let result = [];
});



chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    if (request.setParameters) {
      console.log("setParameters");
      console.log(request);

      let location = request.config.location;

      $('#where').val(location);
      $('#fj').click();

      sendResponse(true);
    } else if (request.crawlDetailedInfo) { //新开的window监听backgournd发送抓取detail的请求
      console.log("crawlDetailedInfo:");
      console.log(request);

      let res = fun.getDetailedInfo();

      console.log(res);
      sendResponse(res);
    } else if(request.crawlBasicInfo) { //新开的window监听backgournd发送抓取basis的请求
      console.log("crawlBasicInfo:");
      console.log(request);

      // let pages = request.pages,
      //     res = {};
      let filter = request.filter,
          res = {};

      res['data'] = fun.getBasicInfo(filter),
      //res['current_page'] = fun.getCurrentPage(),//TO DEl
      //res['is_last'] = fun.isLastPage();//TO DEl

      sendResponse(res);
    } else if (request.gotoNextPage) {
      console.log('gotoNextPage:');
      console.log(request);

      if (fun.isLastPage()) {
        sendResponse(false);
      } else {
        $('.pagination').children('a:last')[0].click();
        sendResponse(true);
      }
    } else if (request.downloadFile) {
      console.log('downloadFile');
      console.log(request);

      let data = request.data;

      ufn.exportCsv({
        title:['Title','Company','Location','Date','Industry','Headquarters','Employees','Revenue','Domain','AboutLink'],
        titleForKey:['job_title','company','location','date','industry','headquarters','employees','revenue','domain','about_link'],
        data: data,
        fileName: 'Indeed-jobs',
      });

      sendResponse(true);
    }

});