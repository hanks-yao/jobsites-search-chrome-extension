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
  },

  // 将一个sheet转成最终的excel文件的blob对象，然后利用URL.createObjectURL下载
  sheet2blob: function (sheet, sheetName) {
      sheetName = sheetName || 'sheet1';
      var workbook = {
          SheetNames: [sheetName],
          Sheets: {}
      };
      workbook.Sheets[sheetName] = sheet;
      // 生成excel的配置项
      var wopts = {
          bookType: 'xlsx', // 要生成的文件类型
          bookSST: false, // 是否生成Shared String Table，官方解释是，如果开启生成速度会下降，但在低版本IOS设备上有更好的兼容性
          type: 'binary'
      };
      var wbout = XLSX.write(workbook, wopts);
      var blob = new Blob([s2ab(wbout)], {type:"application/octet-stream"});
      // 字符串转ArrayBuffer
      function s2ab(s) {
          var buf = new ArrayBuffer(s.length);
          var view = new Uint8Array(buf);
          for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
          return buf;
      }
      return blob;
  },

  /**
   * 通用的打开下载对话框方法，没有测试过具体兼容性
   * @param url 下载地址，也可以是一个blob对象，必选
   * @param saveName 保存文件名，可选
   */
  openDownloadDialog: function (url, saveName) {
    if(typeof url === 'object' && url instanceof Blob) {
      url = URL.createObjectURL(url); // 创建blob地址
    }
    var aLink = document.createElement('a');
    aLink.href = url;
    aLink.download = saveName || ''; // HTML5新增的属性，指定保存文件名，可以不要后缀，注意，file:///模式下不会生效

    var event;
    if(window.MouseEvent) {
      event = new MouseEvent('click');
    } else {
      event = document.createEvent('MouseEvents');
      event.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    }

    aLink.dispatchEvent(event);
  },

  downloadXlsx: function(data, fileName = 'jobsites-extension.xlsx') {
    const sheet = XLSX.utils.json_to_sheet(data);
    const sheet2blob = this.sheet2blob(sheet);
    this.openDownloadDialog(sheet2blob, fileName);
  },
};