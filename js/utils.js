var ufn = {
  getUrlDomamin: function(url) {
    if (!url) {return;}

    let temp;

    if (url.indexOf("://") > -1) {
        temp = url.split('/')[2];
    }
    else {
        temp = url.split('/')[0];
    }

    //find & remove port number
    temp = temp.split(':')[0];
    //find & remove "?"
    temp = temp.split('?')[0];

    let splitArr = temp.split('.'),
        arrLen = splitArr.length;

    //extracting the root temp here
    //if there is a subtemp
    if (arrLen > 2) {
        temp = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
        //check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
        if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
            //this is using a ccTLD
            temp = splitArr[arrLen - 3] + '.' + temp;
        }
    }
    return temp;
  },
  exportCsv: function (obj) {

    // let datas = obj.data;
    //处理字符串中的, "
    // obj['data'] = obj['data'].map(function(elem) {

    //   if (elem['job_title'] && /[",\r\n]/g.test(elem['job_title'])) {
    //     elem['job_title'] = '"' + elem['job_title'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['company'] && /[",\r\n]/g.test(elem['company'])) {
    //     elem['company'] = '"' + elem['company'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['industry'] && /[",\r\n]/g.test(elem['industry'])) {
    //     elem['industry'] = '"' + elem['industry'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['location'] && /[",\r\n]/g.test(elem['location'])) {
    //     elem['location'] = '"' + elem['location'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['headquarters'] && /[",\r\n]/g.test(elem['headquarters'])) {
    //     elem['headquarters'] = '"' + elem['headquarters'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['date'] && /[",\r\n]/g.test(elem['date'])) {
    //     elem['date'] = '"' + elem['date'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['employees'] && /[",\r\n]/g.test(elem['employees'])) {
    //     elem['employees'] = '"' + elem['employees'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['revenue'] && /[",\r\n]/g.test(elem['revenue'])) {
    //     elem['revenue'] = '"' + elem['revenue'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['about_link'] && /[",\r\n]/g.test(elem['about_link'])) {
    //     elem['about_link'] = '"' + elem['about_link'].replace(/(")/g, '""') + '"';
    //   }

    //   if (elem['competitors'] && /[",\r\n]/g.test(elem['competitors'])) {
    //     elem['competitors'] = '"' + elem['competitors'].replace(/(")/g, '""') + '"';
    //   }

    //   return elem;
    // });

    // let KeyArray = ['job_title','company','industry','location','headquarters','date'，'employees'，'revenue'，'about_link'，'competitors'];

    //title ["","",""]
    let title = obj.title;
    //titleForKey ["","",""]
    let titleForKey = obj.titleForKey;
    let data = obj.data;
    let str = [],
        item = [];

    str.push(obj.title.join(",")+"\n");

    for(let i = 0, dLength = data.length; i < dLength; i++){

      item = [];

      for(let j = 0, tLength = titleForKey.length ; j < tLength; j++){

          let value = data[i][titleForKey[j]];

          if (value && /[",\r\n]/g.test(value)) {
            value = '"' + value.replace(/(")/g, '""') + '"';
          }

          item.push(value);
      }
      str.push(item.join(",")+"\n");
    }

    //let url = 'data:text/csv;charset=utf-8,' + encodeURIComponent("\uFEFF" + str.join(""));  //添加BOM头

    str = "\uFEFF" + str.join("")
    let blob = new Blob([str], {type: 'text/csv,charset=UTF-8'});
    let csvUrl = URL.createObjectURL(blob);

    let downloadLink = document.createElement("a");
    downloadLink.href = csvUrl;
    downloadLink.download = obj.fileName+".csv";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  },
  getIndustry: function() {
    let result = [],
        $lis = $('.flyout').children('li');

    for (let i = 0; i < $lis.length; i++) {
      let $li = $($lis[i]),
          $text = $li.children('.label'),
          element = {};

      element['id'] = $li.val();
      let temp = $text.text();

      let index = temp.indexOf('(');

      element['industry'] = temp.slice(0, index)

      result.push(element);

    }
    ufn.exportCsv({
      title:['ID','Industry',],
      titleForKey:['id', 'industry'],
      data: result,
      fileName: 'industry',
    });

    console.log(result);
  }
};