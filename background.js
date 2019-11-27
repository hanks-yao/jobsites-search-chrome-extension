// 取消 popup的弹窗
// 增加setting页面
// 保存查询进度，防止报错导致抓取中断，能够根据中断点继续后续的抓取
//


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
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostContains: 'linkedin' },
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

      mainFn.getMain(pages).then(function(res){
        console.log('Finally:');
        console.log(res);
        popFn.hidePopupTips();
      });
    }
  }
);

const mainFn = {
  //全局变量
  pause: 0, //停止运行
  tabId: 0,
  tabDomain: '',

  glFields: ['foundedYear', 'hq', 'industry', 'industryId', 'revenue', 'sector', 'sectorId', 'size', 'stock', 'type', 'website'],

  // common
  // Main一共分为3个步骤
  getMain: async function(pages) {
    const tab = await tabFn.getCurrentTab(); // TODO 需要判断加载完成
    this.tabDomain = ufn.getUrlDomamin(tab.url);
    this.tabId = tab.id;
    console.log(tab, this.tabDomain, this.tabId);

    //1.获取页面job信息
    let result = await this.getJobs(pages);


    let companies;
    //2.获取company信息
    //从indexDB获取抓取company的参数，再通过新开页面或api获取信息
    if (this.tabDomain === 'indeed.com') {
      companies = await inFn.appendDetail();
    } else if (this.tabDomain === 'glassdoor.com') {
      companies = await glFn.glAppendDetail();
    } else if(this.tabDomain === 'linkedin.com') {
      // companies = await liFn.appendDetail(); //linkedin 暂停抓取company
    }
    // console.log(companies);

    //3.下载抓取的结果
    const dbStore = this.tabDomain.replace('.com', '_store');
    companies = await dbFn.getDataFromIndexDB(dbStore);

    let res = await tabFn.requestDownload(this.tabId, companies);
    return res;
  },

  // common
  // 根据是否有配置文件，对应不同的抓取方式
  getJobs: async function(pages) {
    let db;

    //清空indexDB保存的数据
    if (this.tabDomain === 'indeed.com') {
      db = 'indeed_store';
    } else if (this.tabDomain === 'glassdoor.com') {
      db = 'glassdoor_store';
    } else if (this.tabDomain === 'linkedin.com') {
      db = 'linkedin_store';
    }
    sql.clearData(db);

    if (this.tabDomain === 'linkedin.com') {
      return await liFn.getLinkedinJobs(pages, db);
    } else {
      let config = this.getConfig();

      if (config) {
        return await this.getJobsByConfig(pages, config);
      } else {
        return await this.getJobsByDefault(pages, db);
      }
    }

  },

  // common
  getJobsByDefault: async function(pages, db) {
    console.log('getJobsByDefault');

    const { tabId } = this;
    let temp,
        records = [];

    let keywords = this.getConfig('keywords');

    for (let i = 1 ; i <= pages; i++) {
      popFn.setPopupTips(`Getting jobs : ${i}/${pages}`);

      await tabFn.isTabComplete(tabId);

      temp = await tabFn.requestBasis(tabId, keywords);

      while(!temp){
        await tabFn.reloadTab(tabId);
        await tabFn.isTabComplete(tabId);

        temp = await tabFn.requestBasis(tabId, keywords);
      }

      records = records.concat(temp.data);

      let isNext = await tabFn.gotoNextPage(tabId);
      //console.log(isNext);
      if (!isNext) {
        break;
      }
    }

    console.log(records);
    sql.addData(db, records);

    return {
      data: records
    };
  },

  // common
  getJobsByConfig: async function(pages, config) {
    console.log('getJobsByConfig:');
    console.log(config);

    const { tabId, tabDomain } = this;
    let records = [];

    await tabFn.isTabComplete(tabId);

    if (tabDomain === 'indeed.com') {

      //发送配置信息给content script
      //遍历设置location, 并抓取对应页数的jobs

      let locationArray = config.location,
          temp;

      for (let i = 0, l = locationArray.length; i < l; i++) {

        if(await tabFn.sendConfig(tabId, {location: locationArray[i]})) {
          temp = await this.getJobsByDefault(pages, 'indeed_store');

          records = records.concat(temp.data);
        }

        localStorage.setItem('last_config', locationArray[i]);
      }
    } else if (tabDomain === 'glassdoor.com') {
      const {
        location: locationArray = [],
        industry: industryArray = [],
        size: sizeArray = []
      }  = config;

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

      let locationDef = await this.getLocationDef(),
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
          url = lastUrl = await glFn.getUrlByLoc(tabId, location);
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
          await glFn.setConfig(tabId, url, indKey, sizeKey);
        }

        temp = await this.getJobsByDefault(pages, 'glassdoor_store');

        records = records.concat(temp.data);

        //保存当前抓取进度
        localStorage.setItem('last_config', configArray[i]);
      }
    } else {
      return;
    }

    console.log(records);

    return {
      data: records
    };
  },

  // 延时函数,延时s
  delayXSeconds: function(x) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, x*1000);
    });
  },

  // 获取localstorage中保存的config, 并处理成js对象格式
  getConfig: function(key) {
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
  },

  // 获取location.json文件
  getLocationDef: function() {
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
  },

};

const liFn = {
  getLinkedinJobs: async function(pages, db) {
    console.log('getLinkedinJobs');
    let records = [];

    const keywords = mainFn.getConfig('keywords');

    records = await this.requestLinkedinJobs(mainFn.tabId, pages, keywords);

    console.log(records);
    console.log(db);
    sql.addData(db, records);

    return {
      data: records
    };
  },

  // 获取Linkedin Jobs
  requestLinkedinJobs: function (tabId, pages, keywords) {
    console.log('requestLinkedinJobs');

    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {crawlJobsInfo: true, pages, filter: keywords}, function(response) {
          console.log(response);
          resolve(response);
      });
    });
  },


  // linkedin
  // 获取company信息
  appendDetail: async function() {
    let jobs = await dbFn.getDataFromIndexDB('linkedin_store');
    console.log(jobs);

    const interval = 5;
    let jobsLength = jobs.length,
        quotient = parseInt(jobsLength/interval),
        remainder = jobsLength%interval;

    let windows, length, linkArray;

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
      windows = await this.createWindow(linkArray);

      let i = 0;
      for (let n = 0; n < length; n++) {
        let index = m*interval + n;

        popFn.setPopupTips(`Getting companies : ${index+1}/${jobsLength}`);

        if (jobs[index]['about_link']) {
          let tabId = windows['tabs'][i]['id'];
          let detail = await this.getDetailFromTab(tabId);
          Object.assign(jobs[index], detail);
          sql.updateData('linkedin_store', jobs[index]);
          i++;
        } else {
          continue;
          localStorage.setItem('last_jobs_id', jobs[index]['id']);
        }
      }

      chrome.windows.remove(windows.id);
    }

    return jobs;
  },

  // indeed
  // 创建window, 并返回对应的tabId
  createWindow: function(link){
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
  },

  // indeed
  // 从指定tabId的页面中获取company信息
  getDetailFromTab: async function(tabId) {
    await mainFn.delayXSeconds(2);
    let res = await this.requestDetail(tabId);
    console.log("getDetailFromTab: ", tabId);
    console.log(res);

    if (res) {
      // console.info('remove window');
      // chrome.tabs.remove(tabId);
      return res;
    } else {
      console.info('try again');
      await mainFn.delayXSeconds(1);
      return await this.getDetailFromTab(tabId);
    }
  },

  // indeed
  // 根据tabid, 发送抓取detail信息请求
  requestDetail: function(tabId) {
    return new Promise(function(resolve, reject){
      console.log('requestDetail');
      chrome.tabs.sendMessage(tabId, {crawlCompanyInfo: true}, function(response) {
          resolve(response);
      });
    });
  },
};


const inFn = {
  // indeed
  // 获取company信息
  appendDetail: async function() {
    let jobs = await dbFn.getDataFromIndexDB('indeed_store');
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
      windows = await this.createWindow(linkArray);

      let i = 0;
      for (let n = 0; n < length; n++) {
        let index = m*interval + n;

        popFn.setPopupTips(`Getting companies : ${index+1}/${jobsLength}`);

        if (jobs[index]['about_link']) {
          let tabId = windows['tabs'][i]['id'];
          let detail = await this.getDetailFromTab(tabId);
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
  },

  // indeed
  // 创建window, 并返回对应的tabId
  createWindow: function(link){
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
  },

  // indeed
  // 从指定tabId的页面中获取company信息
  getDetailFromTab: async function(tabId) {
    await mainFn.delayXSeconds(2);
    let res = await this.requestDetail(tabId);
    console.log("getDetailFromTab: ", tabId);
    console.log(res);

    if (res) {
      // console.info('remove window');
      // chrome.tabs.remove(tabId);
      return res;
    } else {
      console.info('try again');
      await mainFn.delayXSeconds(1);
      return await this.getDetailFromTab(tabId);
    }
  },

  // indeed
  // 根据tabid, 发送抓取detail信息请求
  requestDetail: function(tabId) {
    return new Promise(function(resolve, reject){
      console.log('requestDetail');
      chrome.tabs.sendMessage(tabId, {crawlDetailedInfo: true}, function(response) {
          resolve(response);
      });
    });
  },

};

const glFn = {
  // glassdoor
  // 获取指定location的url
  getUrlByLoc: async function(tabId, location){
    console.log("getUrlByLoc:");

    await tabFn.sendConfig(tabId, {location: location});

    await tabFn.isTabComplete(tabId);

    //获取下一页的链接, 并处理url, ?industryId=1011&employerSizes=1
    let res = await tabFn.getNextPageUrl(tabId),
        url = res['url'];

    if (res['only_page']) {
      return 1;
    } else if (res['is_last']) {
      return 0;
    } else {
      while (!url) {
        await tabFn.reloadTab(tabId);
        await tabFn.isTabComplete(tabId);

        url = await tabFn.getNextPageUrl(tabId);
      }
    }


    let index = url.lastIndexOf('_IP2');

    url = url.slice(0, index) + '.htm';

    return url;
  },

  // glassdoor
  // 根据confi中的industry和size, 指定页面跳转到对应的页面
  setConfig: async function(tabId, url, industryId, sizeId){
    console.log("setConfig:");
    console.log(arguments);

    let url2 = url +'?industryId=' + industryId + '&employerSizes=' + sizeId;

    await tabFn.sendConfig(tabId, {url:url2});

    await tabFn.isTabComplete(tabId);

    return true;
  },

  glAppendDetail: async function() {
    let jobs = await dbFn.getDataFromIndexDB('glassdoor_store');

    for (var i = 0, jLength = jobs.length; i < jLength; i++) {
      popFn.setPopupTips(`Getting companies : ${i+1}/${jLength}`);

      let jobListingId = jobs[i]['joblist_id'];
      if (!jobListingId || jobs[i]['company']) {continue;}

      try {
        let detail = await this.glGetCompanyInfo(jobListingId);
        Object.assign(jobs[i], detail);
        sql.updateData('glassdoor_store', jobs[i]);
      } catch (e) {
        continue;
        localStorage.setItem('last_jobs_id', jobs[i]['id']);
      }
    }

    return jobs;
  },

  // glassdoor
  // 异步获取company信息
  // TODO 超时跳过
  glGetCompanyInfo: function(id) {
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
        resolve(glFn.glProcessDom(res));
      })
      .fail(function() {
        console.log("ajax error:companyid " + id);
        reject('ajax error');
      });
    });
  },

  // glassdoor
  // 从异步获取的数据中提取出需要的信息
  glProcessDom: function(res) {
    const { overview, header, map } = res;
    const { employerName: company} = header
    const { address, postalCode } = map

    // const keys = Object.keys(overview);

    if (overview.website) {
      overview.domain = ufn.getUrlDomamin(overview.website);
    }

    return {company, address, postalCode, ...overview};
  },
};

const dbFn = {
  getDataFromIndexDB: function(storeName) {
    return new Promise(function(resolve, reject){
      sql.getAllData(storeName, resolve);
    });
  },
}

const popFn = {
  // common
  // 操作pop.html中提示信息的方法
  hidePopupTips: function() {
    chrome.runtime.sendMessage({hidePopupTips: true});
  },

  showPopupTips: function() {
    chrome.runtime.sendMessage({showPopupTips: true});
  },

  setPopupTips: function(text) {
    chrome.runtime.sendMessage({setPopupTips: true, text:text});
  },
};

const tabFn = {
  // common
  // 根据tabid, 发送抓取basis信息请求
  requestBasis: function (tabId, keywords) {
    console.log('requestBasis');

    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {crawlBasicInfo: true, filter: keywords}, function(response) {
          console.log(response);
          resolve(response);
      });
    });
  },

  // 发送config给conten script, 页面按要求设置参数
  sendConfig: function(tabId, config){
    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {setParameters: true, config: config}, function(response) {
          resolve(response);
      });
    });
  },

  requestDownload: function(tabId, jobs) {
    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {downloadFile: true,data:jobs}, function(response) {
        resolve(response);
      });
    });
  },

  // 获取当前status='complete'的tab的id
  getCurrentTab: function(){
    return new Promise(function(resolve, reject){
      chrome.tabs.query({active:true, status:'complete'}, function(tabs){
        if (tabs[0]) {
          resolve(tabs[0]);
        } else {
          resolve(false);
        }
      })
    });
  },

  // 获取指定id的tab
  getTab: function(tabId){
    return new Promise(function(resolve, reject){
      chrome.tabs.get(tabId, function(tab){
        if (tab) {
          resolve(tab);
        } else {
          resolve(false);
        }
      })
    });
  },

  // 重载指定id的tab
  reloadTab: function(tabid){
    console.log('reloadTab');
    return new Promise(function(resolve, reject){
      chrome.tabs.reload(tabid, {bypassCache: true}, function(res){
        resolve(res);
      })
    });
  },

  // 指定tabId的页面是否加载完成
  isTabComplete: async function(tabId){
    let tab;

    do{
      await mainFn.delayXSeconds(2);
      tab = await this.getTab(tabId);
    }while(tab.status != 'complete')

    return true;
  },

  // 指定对应tabId页面跳转到下一页
  gotoNextPage: function(tabId) {
    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {gotoNextPage: true}, function(response) {
          resolve(response);
      });
    });
  },

  // 获取对应tabId页面下一页的链接地址
  getNextPageUrl: function(tabId) {
    return new Promise(function(resolve, reject){
      chrome.tabs.sendMessage(tabId, {getNextPageUrl: true}, function(response) {
          console.log("getNextPageUrl:",response);
          resolve(response);
      });
    });
  },
};






// TODO
function createNotification() {
  chrome.notifications.create(notificationId, NotificationOptions, function(res) {
    console.log('notifications');
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