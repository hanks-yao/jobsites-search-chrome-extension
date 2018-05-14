var ufn = {
  getUrlDomamin: function(url) {

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

    // var datas = obj.data;
    //处理字符串中的, "
    obj['data'] = obj['data'].map(function(elem) {

      if (elem['job_title'] && /[",\r\n]/g.test(elem['job_title'])) {
        elem['job_title'] = '"' + elem['job_title'].replace(/(")/g, '""') + '"';
      }

      if (elem['company'] && /[",\r\n]/g.test(elem['company'])) {
        elem['company'] = '"' + elem['company'].replace(/(")/g, '""') + '"';
      }

      if (elem['industry'] && /[",\r\n]/g.test(elem['industry'])) {
        elem['industry'] = '"' + elem['industry'].replace(/(")/g, '""') + '"';
      }

      if (elem['location'] && /[",\r\n]/g.test(elem['location'])) {
        elem['location'] = '"' + elem['location'].replace(/(")/g, '""') + '"';
      }

      if (elem['headquarters'] && /[",\r\n]/g.test(elem['headquarters'])) {
        elem['headquarters'] = '"' + elem['headquarters'].replace(/(")/g, '""') + '"';
      }

      if (elem['date'] && /[",\r\n]/g.test(elem['date'])) {
        elem['date'] = '"' + elem['date'].replace(/(")/g, '""') + '"';
      }

      if (elem['employees'] && /[",\r\n]/g.test(elem['employees'])) {
        elem['employees'] = '"' + elem['employees'].replace(/(")/g, '""') + '"';
      }

      if (elem['revenue'] && /[",\r\n]/g.test(elem['revenue'])) {
        elem['revenue'] = '"' + elem['revenue'].replace(/(")/g, '""') + '"';
      }

      if (elem['about_link'] && /[",\r\n]/g.test(elem['about_link'])) {
        elem['about_link'] = '"' + elem['about_link'].replace(/(")/g, '""') + '"';
      }

      if (elem['competitors'] && /[",\r\n]/g.test(elem['competitors'])) {
        elem['competitors'] = '"' + elem['competitors'].replace(/(")/g, '""') + '"';
      }

      return elem;
    });

      //title ["","",""]
      var title = obj.title;
      //titleForKey ["","",""]
      var titleForKey = obj.titleForKey;
      var data = obj.data;
      var str = [];
      str.push(obj.title.join(",")+"\n");

      for(var i=0;i<data.length;i++){
          var temp = [];
          for(var j=0;j<titleForKey.length;j++){
              temp.push(data[i][titleForKey[j]]);
        }
        str.push(temp.join(",")+"\n");
    }

    var url = 'data:text/csv;charset=utf-8,' + encodeURIComponent("\uFEFF" + str.join(""));  //添加BOM头
    var downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = obj.fileName+".csv";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  },
};