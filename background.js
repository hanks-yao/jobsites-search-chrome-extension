
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

      getJobsMain(pages).then(function(res){
        console.log('Finally:');
        console.log(res);
        hidePopupTips();
      });
    }
  }
);


//全局变量
//停止运行
let pause = 0;

const glFields = ['foundedYear', 'hq', 'industry', 'industryId', 'revenue', 'sector', 'sectorId', 'size', 'stock', 'type', 'website'];

// common
// Main一共分为3个步骤
async function getJobsMain(pages) {
  //1.获取页面job信息
  let result = await getBasis(pages);
  let tabId = result.tab_id,
      tabUrl = result.tab_url,
      jobs;

  //2.获取company信息
  //从indexDB获取抓取company的参数，再通过新开页面或api获取信息
  if (tabUrl.indexOf('indeed.com') > -1) {
    jobs = await appendDetail2();
  } else if (tabUrl.indexOf('glassdoor.com') > -1) {
    jobs = await glAppendDetail2();
  } else {
    return;
  }

  console.log(jobs);
  //3.下载抓取的结果
  let res = await requestDownload(tabId, jobs);
  return res;
}

// common
// 根据是否有配置文件，对应不同的抓取方式
async function getBasis(pages) {

  let tab = await getCurrentTab(),
      db;

  //清空indexDB保存的数据
  if (tab.url.indexOf('indeed.com') > -1) {
    db = 'indeed_store';
  } else if (tab.url.indexOf('glassdoor.com') > -1) {
    db = 'glassdoor_store';
  }
  sql.clearData(db);

  let config = getConfig();
  if (config) {
    return await getBasisByConfig(tab, pages, config);
  } else {
    return await getBasisByDefault(tab, pages, db);
  }
}

// common
async function getBasisByDefault(tab, pages, db) {
  console.log('getBasisByDefault');

  let tabId = tab.id,
      temp,
      records = [];

  let keywords = getConfig('keywords');

  for (let i = 1 ; i <= pages; i++) {
    setPopupTips(`Getting jobs : ${i}/${pages}`);

    await isTabComplete(tabId);

    temp = await requestBasis(tabId, keywords);

    while(!temp){
      await reloadTab(tabId);
      await isTabComplete(tabId);

      temp = await requestBasis(tabId, keywords);
    }

    records = records.concat(temp.data);

    let isNext = await gotoNextPage(tabId);
    //console.log(isNext);
    if (!isNext) {
      break;
    }
  }

  console.log(records);
  sql.addData(db, records);

  return {
    tab_id: tab.id,
    tab_url: tab.url,
    data: records
  };
}

// common
async function getBasisByConfig(tab, pages, config) {
  console.log('getBasisByConfig:');
  console.log(config);

  let tabUrl = tab.url,
      tabId  = tab.id,
      records = [];

  await isTabComplete(tabId);

  if (tabUrl.indexOf('indeed.com') > -1) {

    //发送配置信息给content script
    //遍历设置location, 并抓取对应页数的jobs

    let locationArray = config.location,
        temp;

    for (let i = 0, l = locationArray.length; i < l; i++) {

      if(await sendConfig(tabId, {location: locationArray[i]})) {
        temp = await getBasisByDefault(tab, pages, 'indeed_store');

        records = records.concat(temp.data);
      }

      localStorage.setItem('last_config', locationArray[i]);
    }
  } else if (tabUrl.indexOf('glassdoor.com') > -1) {

    let locationArray = config.location,
        industryArray = config.industry,
        sizeArray     = config.size;

    console.log(industryArray.length*sizeArray.length);

    let configArray = [];

    for (let i = 0, lLength = locationArray.length; i < lLength; i++) {
      for (let j = 0, iLength = industryArray.length; j < iLength; j++) {
        for (let k = 0, sLength = sizeArray.length; k < sLength; k++) {
          configArray.push(locationArray[i] + ',' + industryArray[j] + ',' + sizeArray[k]);
        }
      }
    }

    console.log(configArray);
    localStorage.setItem('glassdoor_config',configArray);

    let locationDef = await getLocationDef(),
        lastLoc, lastUrl;

    for (let i = 0, cLength = configArray.length; i < cLength; i++) {
      console.log(configArray[i]);

      let currentConfig = configArray[i].split(','),
          locKey = currentConfig[0],
          indKey = currentConfig[1],
          sizeKey = currentConfig[2],
          location = {
            type: locationDef[locKey]['location_type'],
            id: locationDef[locKey]['location_id']
          };

      let url, temp;


      if (lastLoc != locKey) {
        url = lastUrl = await getUrlByLoc(tabId, location);
      } else {
        url = lastUrl;
      }
      lastLoc = locKey;

      //只有一页数据, 不需要设置industry和company size
      if (url === 1) {
        i = i + industryArray.length*sizeArray.length - 1; //跳过该location的抓取
      } else if (url === 0) {
        continue;
      } else {
        await setConfig(tabId, url, indKey, sizeKey);
      }

      temp = await getBasisByDefault(tab, pages, 'glassdoor_store');

      records = records.concat(temp.data);

      //保存当前抓取进度
      localStorage.setItem('last_config', configArray[i]);
    }
  } else {
    return;
  }

  console.log(records);

  return {
    tab_id: tabId,
    tab_url: tabUrl,
    data: records
  };
}

// common
// 根据tabid, 发送抓取basis信息请求
function requestBasis(tabId, keywords) {
  console.log('requestBasis');

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

async function appendDetail2() {
  let jobs = await getDataFromIndexDB('indeed_store');
  console.log(jobs);

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

    console.log(linkArray);
    windows = await createWindow(linkArray);

    let i = 0;
    for (let n = 0; n < length; n++) {
      let index = m*interval + n;

      setPopupTips(`Getting companies : ${index+1}/${jobsLength}`);

      if (jobs[index]['about_link']) {
        let tabId = windows['tabs'][i]['id'];
        let detail = await getDetailFromTab(tabId);
        Object.assign(jobs[index], detail);
        sql.updateData('indeed_store', jobs[index]);
        i++;
      } else {
        continue;
        localStorage.setItem('last_jobs_id', jobs[index]['id']);
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
  console.log("getDetailFromTab: ", tabId);
  console.log(res);

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
    console.log('requestDetail');
    chrome.tabs.sendMessage(tabId, {crawlDetailedInfo: true}, function(response) {
        resolve(response);
    });
  });
}

// glassdoor
// 获取指定location的url
async function getUrlByLoc(tabId, location){
  console.log("getUrlByLoc:");

  await sendConfig(tabId, {location: location});

  await isTabComplete(tabId);

  //获取下一页的链接, 并处理url, ?industryId=1011&employerSizes=1
  let res = await getNextPageUrl(tabId),
      url = res['url'];

  if (res['only_page']) {
    return 1;
  } else if (res['is_last']) {
    return 0;
  } else {
    while (!url) {
      await reloadTab(tabId);
      await isTabComplete(tabId);

      url = await getNextPageUrl(tabId);
    }
  }


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

async function glAppendDetail2() {
  let jobs = await getDataFromIndexDB('glassdoor_store');

  for (var i = 0, jLength = jobs.length; i < jLength; i++) {
    setPopupTips(`Getting companies : ${i+1}/${jLength}`);

    let jobListingId = jobs[i]['joblist_id'];
    if (!jobListingId) {continue;}

    try {
      let detail = await glGetCompanyInfo(jobListingId);
      Object.assign(jobs[i], detail);
      sql.updateData('glassdoor_store', jobs[i]);
    } catch (e) {
      continue;
      localStorage.setItem('last_jobs_id', jobs[i]['id']);
    }
  }

  return jobs;
}

// glassdoor
// 异步获取company信息
function glGetCompanyInfo(id) {
  let url = 'https://www.glassdoor.com/Job/json/details.htm',
      params = {
        jobListingId: id
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
function glProcessDom(res) {
  const { overview, header, map } = res;
  const { employerName: company} = header
  const { address, postalCode } = map

  // const keys = Object.keys(overview);

  if (overview.website) {
    overview.domain = ufn.getUrlDomamin(overview.website);
  }

  return {company, address, postalCode, ...overview};
}

function getDataFromIndexDB(storeName) {
  return new Promise(function(resolve, reject){
    sql.getAllData(storeName, resolve);
  });
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

// 重载指定id的tab
function reloadTab(tabid){
  return new Promise(function(resolve, reject){
    chrome.tabs.reload(tabid, {bypassCache: true}, function(res){
      console.log(res);
      resolve(res);
    })
  });
}

// 指定tabId的页面是否加载完成
async function isTabComplete(tabId){
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
      resolve(response);
    });
  });
}

/**
 * 创建并下载文件
 * @param  {String} fileName 文件名
 * @param  {String} content  文件内容
 */
function createAndDownloadFile(content) {
  let fileName = "test.json";
  content = JSON.stringify(content);

  var aTag = document.createElement('a');
  var blob = new Blob([content]);

  aTag.download = fileName;
  aTag.href = URL.createObjectURL(blob);
  aTag.click();
  URL.revokeObjectURL(blob);
}

function test() {
  console.log(1);

  throw new Error('pause!');

  console.log(2);

}