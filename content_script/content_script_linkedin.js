console.log('linkedin content_scritp loaded!');

const fun = {
  result: [],
  getJobsMaster: async function(pages, filter){
    const target = this.getCurrentPage() + pages - 1; // 抓到的页数， 10就是抓到第10页，linkedin最多40页
    let result = [];
    // let current = this.getCurrentPage();

    while(this.getCurrentPage() <= target) {
      const isBottom = await this.scrollToBottom();
      if (!isBottom) {
        break;
      };

      this.result = this.result.concat(this.getJobsInfo());

      if(this.goToNextPage()) {
        do{
          await this.delayXSeconds(1);
        } while (this.isPageLoading())
      } else {
        // 没有下一页跳出循环
        break;
      }
    }

    console.log(this.result);
    return this.result;
  },
  getJobsInfo: function() {
    const $items = $('ul.jobs-search-results__list > li');
    let result = [];

    if (!$items.length) {return []}

    for (let i = 0; i < $items.length; i++) {
      let $item = $($items[i]),
        element = {};

      const $wrapper = $item.find('.job-card-search__content-wrapper');

      element['job_title'] = $wrapper.find('.job-card-search__title > a').contents().filter(function (index, content) {return content.nodeType === 3;}).text().trim(); // 过滤子元素文本文本;
      element['company'] = $wrapper.find('.job-card-search__company-name').text().trim();
      element['company_link'] = $wrapper.find('.job-card-search__company-name > a').attr('href');
      element['about_link'] = fun.changeLinkToAbout(element['company_link']);
      element['location'] = $wrapper.find('.job-card-search__location').text().trim();

      result.push(element);
    }

    console.log(result);
    return result;
  },
  scrollToBottom: async function(){
    const $scrollDom = $('.jobs-search-results');
    const scrollDom = $scrollDom[0];
    if (!scrollDom) return false;

    const scrollHeight = scrollDom.scrollHeight; // 异步加载更多数据会变化
    const clientHeight = scrollDom.clientHeight;
    // scrollHeight = clientHeight + srollTop时，滚动到最底部;

    scrollDom.scrollTop = 0;
    await this.delayXSeconds(1);

    while(Math.ceil(scrollDom.scrollTop + scrollDom.clientHeight) < scrollDom.scrollHeight) {
      console.log('scrolling');

      // $scrollDom.animate({scrollTop: (scrollDom.scrollHeight - clientHeight) }, 1000);
      scrollDom.scrollTop = scrollDom.scrollTop + 500;
      await this.delayXSeconds(1);
    }

    return true;
  },
  goToNextPage: function() {
    const $current = $('.artdeco-pagination__pages > .artdeco-pagination__indicator.active');
    const $next = $current.next();

    if ($next.length) {
      $next.children('button').click();
      return true;
    }

    return false;
  },
  getTotalPage: function() {
    const total  = $('.artdeco-pagination__pages > .artdeco-pagination__indicator:last > span:first').text().trim();

    console.log('total: ', total);
    return parseInt(total, 10) || 1;
  },
  getCurrentPage: function() {
    const current = $('.artdeco-pagination__pages > .artdeco-pagination__indicator.active > span:first').text().trim();

    return parseInt(current, 10) || 1;
  },
  isPageLoading: function() {
    return $('.job-search-ext').hasClass('job-search-ext--loading');
  },
  isLastPage: function() {
    return this.getTotalPage() === this.getCurrentPage();
  },
  delayXSeconds(x) {
    return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, x*1000);
    });
  },
  includeKeywords: function(target, keywords) {
    let t = target.toLocaleLowerCase();

    for ( let n in keywords) {
      let k = keywords[n].toLocaleLowerCase();

      if (t.indexOf(k) > -1) {return true}
    }

    return false;
  },
  changeLinkToAbout:function(link) {
    if (!link || link === '#') {return;}

    let a = link,
      index = a.indexOf('?');

    if (index !== -1) {
      a = a.substring(0, index);
    }

    if (a.indexOf('http') === -1) {
      a = 'https://www.linkedin.com' + a + 'about';
    } else {
      a = a + 'about';
    }

    return a;
  },

  getCompanyInfo: function(){
    let res = {};
    let $detialBlock = $('.org-grid__core-rail--no-margin-left > section > dl');
    // let $detialBlock2 = $('#company-details-section');

    if ($detialBlock.length) {
    let items = $detialBlock.children('dt');

    for (let i = 0; i < items.length; i++) {
      let $item = $(items[i]),
        key = $item.text().trim().toLowerCase().replace(' ', '_'),
        value = $item.next('dd').text().trim();

      if (key == 'website') {
      // const website = $item.next('dd').children('a').attr('href');
      // res['website'] = website;

      res['domain'] = ufn.getUrlDomamin(value);
      } else {
      res[key] = value;
      }
    }
    }

    console.log(res);
    return res;
  },
};



$(document).ready(function() {
  console.log('document ready!');
});


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

  if (request.crawlJobsInfo) { //新开的window监听backgournd发送抓取detail的请求
    console.log("crawlJobsInfo:");
    console.log(request);

    let {pages, filter} = request;

    fun.getJobsMaster(pages, filter).then((res) => {
      console.log(res);
      sendResponse(res);
    });
  } else if(request.crawlCompanyInfo) { //新开的window监听backgournd发送抓取basis的请求
    console.log("crawlCompanyInfo:");
    console.log(request);

    let res = fun.getCompanyInfo();

    console.log(res);
    sendResponse(res);
  } else if (request.downloadFile) {
    console.log('downloadFile');
    console.log(request);

    let data = request.data;
    for (var i = 0; i < data.length; i++) {
      delete data[i].id;
    }

    ufn.downloadXlsx(data, 'jobsites-linkedin.xlsx');

    // ufn.exportCsv({
    //   // title:['Title','Company','Location','Industry','Headquarters','Employees','Type','Founded','Specialties','Domain','AboutLink'],
    //   // titleForKey:['job_title','company','location','industry','headquarters','company_size','type','founded','specialties','domain','about_link'],
    //   title:['Title','Company','Location','AboutLink'],
    //   titleForKey:['job_title','company','location','about_link'],
    //   data: data,
    //   fileName: 'Linkedin-jobs',
    // });

    sendResponse(true);
  }

  return true;

});