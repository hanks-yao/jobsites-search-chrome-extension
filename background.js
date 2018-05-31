
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
      console.log('request.getJobsInfo:');
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
  let result = await getBasis(pages);
  let tabId = result.tab_id,
      tabUrl = result.tab_url,
      jobs = result.data;

  if (tabUrl.indexOf('indeed.com') > -1) {
    jobs = await appendDetail(jobs);
  } else if (tabUrl.indexOf('glassdoor.com') > -1) {
    jobs = await glAppendDetail(jobs);
  } else {
    return;
  }

  console.log(jobs);
  let res = await requestDownload(tabId, jobs);
  return res;
}

// common
async function getBasis(pages) {
  console.log('getBasis');

  let config = getConfig();

  if (config) {
    return await getBasisByConfig(pages, config);
  } else {
    return await getBasisByDefault(pages);
  }
}

// common
async function getBasisByDefault(pages) {
  console.log('getBasisByDefault');

  let tab,
      temp,
      records = [];

  for (let i = 1 ; i <= pages; i++) {
    setPopupTips(`Getting jobs : ${i}/${pages}`);

    do {
      await delayXSeconds(2);

      tab = await getCurrentTab();
    } while (!tab);


    temp = await requestBasis(tab.id);

    records = records.concat(temp.data);

    let isNext = await gotoNextPage(tab.id);
    //console.log(isNext);
    if (!isNext) {
      break;
    }
  }

  console.log(records);
  return {
    tab_id: tab.id,
    tab_url: tab.url,
    data: records
  };
}

// common
async function getBasisByConfig(pages, config) {
  console.log('getBasisByConfig:');
  console.log(config);

  let tab = await getCurrentTab(),
      records = [];

  while(!tab) {
    await delayXSeconds(2);

    tab = await getCurrentTab();
  }

  let tabUrl = tab.url,
      tabId  = tab.id;

  if (tabUrl.indexOf('indeed.com') > -1) {
    //发送配置信息给content script
    //遍历设置location, 并抓取对应页数的jobs

    let locationArray = config.location;

    for (let n in locationArray) {
      if(await sendConfig(tabId, {location: locationArray[n]})) {
        let temp = await getBasisByDefault(pages);

        records = records.concat(temp.data);
      }

    }


  } else if (tabUrl.indexOf('glassdoor.com') > -1) {
    let locationArray = config.location,
        industryArray = config.industry,
        sizeArray     = config.size;

    let locationDef = await getLocationDef();

    for (let i = 0; i < locationArray.length; i++) {

      // 在页面中设置location,然后跳转下一页, 获取所需的url
      let key = locationArray[i],
          location = {
            type: locationDef[key]['location_type'],
            id: locationDef[key]['location_id']
          };

      let url = await getUrlByLoc(tabId, location);

      for (let m = 0; m < industryArray.length; m++) {

        for (let n = 0; n < sizeArray.length; n++) {
          console.log(tabId, locationArray[i], industryArray[m], sizeArray[n]);

          await setConfig(tabId, url, industryArray[m], sizeArray[n]);

          let temp = await getBasisByDefault(pages);

          records = records.concat(temp.data);
        }
      }
    }

  } else {
    return;
  }

  console.log(records);

  return {
    tab_id: tab.id,
    tab_url: tab.url,
    data: records
  };
}

// common
// 根据tabid, 发送抓取basis信息请求
function requestBasis(tabId) {
  console.log('requestBasis');

  let keywords = getConfig('keywords');

  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {crawlBasicInfo: true, filter: keywords}, function(response) {
        resolve(response);
    });
  });
}

// indeed
// 获取company信息
async function appendDetail(jobs){
  const interval = 5;
  let jobsLength = jobs.length,
      quotient = parseInt(jobsLength/interval),
      remainder = jobsLength%interval;

  let windows,length,linkArray;

  for (let m = 0; m <= quotient; m++) {
    linkArray = [];

    if (m == quotient) {
      length = remainder;
    } else {
      length = interval;
    }

    for (let n = 0; n < length; n++) {
      console.log(m, interval, n, m*interval + n);

      if (jobs[m*interval + n]['about_link']) {
        linkArray.push(jobs[m*interval + n]['about_link']);
      } else {
        continue;
      }
    }

    windows = await createWindow(linkArray);

    let i = 0;
    for (let n = 0; n < length; n++) {
      let index = m*interval + n;

      setPopupTips(`Getting companies : ${index+1}/${jobsLength}`);

      if (jobs[index]['about_link']) {
        let tabId = windows['tabs'][i]['id'];
        let detail = await getDetailFromTab(tabId);
        Object.assign(jobs[index], detail);
        i++;
      } else {
        continue;
      }
    }

    chrome.windows.remove(windows.id);
  }

  return jobs;
}

// indeed
// 创建window, 并返回对应的tabId
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

// indeed
// 从指定tabId的页面中获取company信息
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

// indeed
// 根据tabid, 发送抓取detail信息请求
function requestDetail(tabId) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {crawlDetailedInfo: true}, function(response) {
        resolve(response);
    });
  });
}

// glassdoor
// 获取指定location的url
async function getUrlByLoc(tabId, location){
  console.log("getUrlByLoc:");
  console.log(arguments);

  await sendConfig(tabId, {location: location});

  await isTabComplete(tabId);

  //获取下一页的链接, 并处理url, ?industryId=1011&employerSizes=1
  let url = await getNextPageUrl(tabId);
  let index = url.lastIndexOf('_IP2');

  url = url.slice(0, index) + '.htm';

  return url;
}

// glassdoor
// 根据confi中的industry和size, 指定页面跳转到对应的页面
async function setConfig(tabId, url, industryId, sizeId){
  console.log("setConfig:");
  console.log(arguments);

  let url2 = url +'?industryId=' + industryId + '&employerSizes=' + sizeId;

  await sendConfig(tabId, {url:url2});

  await isTabComplete(tabId);

  return true;
}

// glassdoor
// 获取company信息
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

// glassdoor
// 异步获取company信息
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

// glassdoor
// 从异步获取的数据中提取出需要的信息
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

// common
// 操作pop.html中提示信息的方法
function hidePopupTips() {
  chrome.runtime.sendMessage({hidePopupTips: true});
}

function showPopupTips() {
  chrome.runtime.sendMessage({showPopupTips: true});
}

function setPopupTips(text) {
  chrome.runtime.sendMessage({setPopupTips: true, text:text});
}

// TODO
function createNotification() {
  chrome.notifications.create(notificationId, NotificationOptions, function(res) {
    console.log('notifications');
  });
}

// 延时函数,延时s
function delayXSeconds(x) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, x*1000);
  });
}

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

// 指定tabId的页面是否加载完成
async function isTabComplete(tabId){
  console.log("isTabComplete:");

  let tab;

  do{
    await delayXSeconds(2);
    tab = await getTab(tabId);
  }while(tab.status != 'complete')

  return true;
}

// 获取localstorage中保存的config, 并处理成js对象格式
function getConfig(key) {
  console.log('getConfig:', key);
  let config = JSON.parse(localStorage.getItem('config'));

  if (!config) {return;}

  //TODO, 处理配置文件, 将参数处理成js对象格式
  for (let key in config) {
    config[key] = config[key].split(',')

    for ( let n in config[key]) {
      config[key][n] = config[key][n].trim();
    }
  }

  if (key && config[key]) {
    return config[key];
  } else {
    return config;
  }
}

// 发送config给conten script, 页面按要求设置参数
function sendConfig(tabId, config){
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {setParameters: true, config: config}, function(response) {
        resolve(response);
    });
  });
}

// 获取location.json文件
function getLocationDef() {
  return new Promise(function(resolve, reject){
    $.ajax({
      url: '/location.json',
      type: 'GET',
      dataType: 'json',
    })
    .done(function(res) {
      // console.log(res);
      resolve(res);
    })
    .fail(function() {
      console.error("ajax error: get industry.json error");
      reject('ajax error');
    });
  });
}

// 指定对应tabId页面跳转到下一页
function gotoNextPage(tabId) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {gotoNextPage: true}, function(response) {
        resolve(response);
    });
  });
}

// 获取对应tabId页面下一页的链接地址
function getNextPageUrl(tabId) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {getNextPageUrl: true}, function(response) {
        console.log("getNextPageUrl:",response);
        resolve(response);
    });
  });
}

function requestDownload(tabId, jobs) {
  return new Promise(function(resolve, reject){
    chrome.tabs.sendMessage(tabId, {downloadFile: true,data:jobs}, function(response) {
      console.log(response);
      resolve(response);
    });
  });
}

function test(){
  let a = 'abc ABC ccc, efg',
      b = 'abc',
      c = 'Ccc';
  console.log(a.search(b));
  console.log(a.search(c));
}