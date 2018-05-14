
// When the extension is installed or upgraded ...
chrome.runtime.onInstalled.addListener(function() {
  // Replace all rules ...
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    // With a new rule ...
    chrome.declarativeContent.onPageChanged.addRules([
      {
        // That fires when a page's URL contains a 'g' ...
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostContains: 'glassdoor' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostContains: 'indeed' },
          })
        ],
        // And shows the extension's page action.
        actions: [ new chrome.declarativeContent.ShowPageAction() ]
      }
    ]);
  });
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.getJobsInfo) {
      console.log('getJobsInfo');
      console.log(request);

      let pages = request.pages;

      getJobsInfo(pages).then(function(res){
        console.log(res);
        hidePopupTips();
      });
    }
  }
);

// common
async function getJobsInfo(pages) {
  let result = await getBasicInfo(pages);
  let tabId = result.tab_id,
      tabUrl = result.tab_url,
      jobs = result.data,
      jobsLength = jobs.length;
  console.log(jobs);
  if (tabUrl.indexOf('indeed.com') > -1) {
    jobs = await appendDetail(jobs);
  } else if (tabUrl.indexOf('glassdoor.com') > -1) {
    jobs = await glAppendDetail(jobs);
  } else {
    return;
  }

  console.log(jobs);
  // let res = await requestDownload(tabId, jobs);
  return res;
}

// common
async function getBasicInfo(pages) {
  let tab,
      temp,
      records = [],
      currentPage,
      isLastPage;

  // do {
  //   await delayXSeconds(2);

  //   tab = await getCurrentTab();
  // } while (!tab.id);

  for (let i = 1 ; i <= pages; i++) {
    setPopupTips(`Getting jobs : ${i}/${pages}`);

    do {
      await delayXSeconds(2);

      tab = await getCurrentTab();
    } while (!tab);


    temp = await requestBasis(tab.id, i);

    records = records.concat(temp.data);

    let isNext = await gotoNextPage(tab.id);
    console.log(isNext);
    if (!isNext) {
      break;
    }
  }

  return {
    tab_id: tab.id,
    tab_url: tab.url,
    data: records
  };
}

//indeed
async function appendDetail(jobs){
  const interval = 5;
  let jobsLength = jobs.length,
      quotient = parseInt(jobsLength/interval),
      remainder = jobsLength%interval;

  let windows,length,linkArray;

  for (let m = 0; m <= quotient; m++) {
    linkArray = [];

    if (m == quotient) {
      length = quotient;
    } else {
      length = interval;
    }

    for (let n = 0; n < length; n++) {
      console.log(m, interval, n);

      console.log(m*interval + n);
      if (jobs[m*interval + n]['about_link']) {
        linkArray.push(jobs[m*interval + n]['about_link']);
      } else {
        continue;
      }
    }

    console.log(linkArray);
    windows = await createWindow(linkArray);

    let i = 0;
    for (let n = 0; n < length; n++) {
      if (jobs[m*interval + n]['about_link']) {
        let tabId = windows['tabs'][i]['id'];
        let detail = await getDetailFromTab(tabId);
        Object.assign(jobs[m*interval + n], detail);
        i++;
      } else {
        continue;
      }
    }

    chrome.windows.remove(windows.id);
  }

  console.log(jobs);

  return jobs;

  // for (var i = 0; i < jobsLength; i++) {
  //   setPopupTips(`Getting companies : ${i+1}/${jobsLength}`);

  //   let link = jobs[i]['about_link'];
  //   if (!link) {continue;}

  //   let tabId = await createWindow(link);

  //   let detail = await getDetailFromTab(tabId);
  //   Object.assign(jobs[i], detail);
  // }

  // return jobs;
}

//glassdoor
async function glAppendDetail(jobs){
  let jobsLength = jobs.length;

  for (var i = 0; i < jobsLength; i++) {
    setPopupTips(`Getting companies : ${i+1}/${jobsLength}`);

    let companyId = jobs[i]['company_id'];
    if (!companyId) {continue;}

    try {
      let detail = await glGetCompanyInfo(companyId);
      Object.assign(jobs[i], detail);
    } catch (e) {
      continue;
    }

  }

  return jobs;
}

// common
// 获取当前status='complete'的tab的id
function getCurrentTab(){
  return new Promise(function(resolve, reject){
    chrome.tabs.query({active:true, status:'complete'}, function(tabs){
      if (tabs[0]) {
        resolve(tabs[0]);
      } else {
        resolve(false);
      }
    })
  });
}

// common
// 获取指定id的tab
function getTab(id){
  return new Promise(function(resolve, reject){
    chrome.tabs.get(id, function(tab){
      if (tab) {
        resolve(tab);
      } else {
        resolve(false);
      }
    })
  });
}

//indeed
//创建window, 并返回对应的tabId
function createWindow(link){
  if (link) {
    return new Promise(function(resolve, reject){
      chrome.windows.create({
        url:link,
        left: 0,
        top: 80,
        width: 600,
        height: 200
      }, function(window) {
        // let tabId = window['tabs'][0]['id'];
        // let windowId = window['id'];
        resolve(window);
      });
    });
  } else {
    return;
  }
}

//indeed
async function getDetailFromTab(tabId) {
  await delayXSeconds(2);
  let res = await requestDetail(tabId);

  if (res) {
    // console.info('remove window');
    // chrome.tabs.remove(tabId);
    return res;
  } else {
    console.info('try again');
    await delayXSeconds(1);
    return await getDetailFromTab(tabId);
  }
}

//common
function gotoNextPage(tabId) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {gotoNextPage: true}, function(response) {
        resolve(response);
    });
  });
}

//common
//根据tabid, 发送抓取basis信息请求
function requestBasis(tabId, pages) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {crawlBasicInfo: true, pages:pages}, function(response) {
        resolve(response);
    });
  });
}

//indeed
//根据tabid, 发送抓取detail信息请求
function requestDetail(tabId) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {crawlDetailedInfo: true}, function(response) {
        resolve(response);
    });
  });
}

//common
//延时函数,延时s
function delayXSeconds(x) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, x*1000);
  });
}


//glassdoor
//异步获取company信息
function glGetCompanyInfo(id) {
  let url = 'https://www.glassdoor.com/Job/overview/companyOverviewBasicInfoAjax.htm',
      params = {
        employerId: id,
        title: 'Overview',
        linkCompetitors: 'true',
      };

  return new Promise(function(resolve, reject){
    $.ajax({
      url: url,
      type: 'GET',
      // dataType: 'default: Intelligent Guess (Other values: xml, json, script, or html)',
      data: params,
    })
    .done(function(res) {
      resolve(glProcessDom(res));
    })
    .fail(function() {
      console.log("ajax error:companyid " + id);
      reject('ajax error');
    });
  });
}

//glassdoor
//从异步获取的数据中提取出需要的信息
function glProcessDom(dom) {
  let res = {};
  let $html = $(dom);
      $items = $html.find('.infoEntity');

  for (let i = 0; i < $items.length; i++) {
    let $item= $($items[i]),
        key = $item.children('label').text().toLowerCase(),
        value = $item.children('.value').text().trim();

    if (key == 'type') {
      value = value.replace(/\s/g,"");
    }

    res[key] = value;
  }

  let website = $html.find('.website').children('a').attr('href');
  if (website) {
    res['domain'] = ufn.getUrlDomamin(website);
  }

  return res;
}

//common
//
function requestDownload(tabId, jobs) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {downloadFile: true,data:jobs}, function(response) {
      console.log(response);
      resolve(response);
    });
  });
}

function hidePopupTips() {
  chrome.runtime.sendMessage({hidePopupTips: true});
}

function showPopupTips() {
  chrome.runtime.sendMessage({showPopupTips: true});
}

function setPopupTips(text) {
  chrome.runtime.sendMessage({setPopupTips: true, text:text});
}

function createNotification() {
  chrome.notifications.create(notificationId, NotificationOptions, function(res) {
    console.log('notifications');
  });
}