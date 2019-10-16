
var DB = function() {
  this.DB_NAME = 'Jobsites';
  this.Indeed_STORE_NAME = 'indeed_store';
  this.Glassdoor_STORE_NAME = 'glassdoor_store';
  this.Linkedin_STORE_NAME = 'linkedin_store';
  this.DB_VERSION = 1; //使用正整数，别用浮点型
  this.db;
  this.READ_WRITE = 'readwrite';
  this.READ_ONLY = 'readonly';
};

DB.prototype = {
  constructor: DB, //DB
  initDb: function(dbName, version) {
    console.log("initDb ...");
    console.log(this);
    console.log(dbName, version);
    var req = indexedDB.open(dbName, version);

    req.onsuccess = function (evt) {
      this.db = evt.target.result;
      // console.log(this);
      // console.log(this.db);
      console.log("initDb opened");
    }.bind(this);
    req.onerror = function (evt) {
      console.error("initDb error:", evt.target.errorCode || evt.target.error);
    };

    //增加数据库版本号时,会触发onupgradeneeded事件(会在onsuccess之前被调用)
    req.onupgradeneeded = function (evt) {
      console.log("initDb.onupgradeneeded");
      console.log(evt);
      this.db = evt.currentTarget.result;
      //ObjectStore必须在onupgradeneeded里创建，其他地方将会创建失败
      // var usersStore = this.db.createObjectStore("users", { keyPath : "id" });

      let stores = this.db.objectStoreNames;

      if (stores.contains(this.Indeed_STORE_NAME)) {
        console.log(1);
        this.db.deleteObjectStore(this.Indeed_STORE_NAME);
      }

      if (stores.contains(this.Glassdoor_STORE_NAME)) {
        console.log(2);

        this.db.deleteObjectStore(this.Glassdoor_STORE_NAME);
      }

      if (stores.contains(this.Linkedin_STORE_NAME)) {
        console.log(2);

        this.db.deleteObjectStore(this.Linkedin_STORE_NAME);
      }

      var indeedStore = this.db.createObjectStore(
        this.Indeed_STORE_NAME,
        { keyPath: 'id', autoIncrement: true }
      );

      var glassdoorStore = this.db.createObjectStore(
        this.Glassdoor_STORE_NAME,
        { keyPath: 'id', autoIncrement: true }
      );

      var glassdoorStore = this.db.createObjectStore(
        this.Linkedin_STORE_NAME,
        { keyPath: 'id', autoIncrement: true }
      );

      // usersStore.createIndex("name", "name", { unique : false });
    }.bind(this);
  },
  updateDb: function() {
    //TODO
    this.initDb(this.DB_NAME, ++this.DB_VERSION);
  },
  addData: function(storeName, data) {
    // console.log(this);
    // var users = [{
    //   id : '001',
    //   name : '刘亦菲',
    //   age : 18
    // },{
    //   id : '002',
    //   name : '杨幂',
    //   age : 19
    // },{
    //   id : '005',
    //   name : '柳岩',
    //   age : 20,
    //   ohter: 123
    // }];

    let store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);

    for (let i = 0, l = data.length; i < l; i++) {
      let req= store.add(data[i]);

      req.onsuccess = function (evt) {
        // console.log("addData success:", evt.target.result);
      };
      req.onerror = function (evt) {
        console.error("addData error:", evt.target.errorCode || evt.target.error);
      };
    }
  },
  updateData: function(storeName, data) {
    var store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);

    var req = store.put(data);

    // var req = store.put({
    //   id : '001',
    //   name : '刘亦菲-小龙女',
    //   age : 18
    // });
    req.onsuccess = function (evt) {
      // console.log("updateData success");
    };
    req.onerror = function (evt) {
      console.error("updateData error:", evt.target.errorCode || evt.target.error);
    };
  },
  getData: function(storeName, index) {
    let store = this.db.transaction(storeName).objectStore(storeName);

    let req = store.get(index);
    req.onsuccess = function (evt) {
      let res = evt.target.result;
      // console.log(res);
    };
    req.onerror = function (evt) {
      console.error("getData error:", evt.target.errorCode || evt.target.error);
    };
  },
  getAllData: function(storeName,callback) {
    let store = this.db.transaction(storeName).objectStore(storeName);

    let req = store.getAll();
    req.onsuccess = function (evt) {
      let res = evt.target.result;
      // console.log(res);
      callback(res);
    };
    req.onerror = function (evt) {
      console.error("getData error:", evt.target.errorCode || evt.target.error);
    };
  },
  delData: function(storeName, index) {
    let store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);

    let req = store.delete(index);
    req.onsuccess = function (evt) {
      console.log("delData success");
    };
    req.onerror = function (evt) {
      console.error("delData error:", evt.target.errorCode || evt.target.error);
    };
  },
  clearData: function(storeName) {
    console.log(storeName);

    var store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);

    var req = store.clear();
    req.onsuccess = function (evt) {
      console.log(`clear ${storeName} success`);
    };
    req.onerror = function (evt) {
      console.error("clearData error:", evt.target.errorCode || evt.target.error);
    };
  },
  openCursor: function(storeName){
    let store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);
    let req = store.openCursor();

    req.onsuccess = function (evt) {
      let cursor = evt.target.result;
      if(cursor){ //必要检查
        let value = cursor.value;
        console.log(value);
        if(value.name == '杨幂'){
          value.age = 16;
          cursor.update(value); //修改数据(必须是读写模式)
        }
        if(value.name == '柳岩'){
          cursor.delete();  //删除当前项
        }
        cursor.continue(); //移动到下一项
      }
    };
    req.onerror = function(evt) {
      console.error("openCursor error:", evt.target.errorCode || evt.target.error);
    };
  },
  updateByCursor: function(storeName, ajaxRequest) {
    let db = this.db,
        READ_WRITE = this.READ_WRITE;
    console.log(1);

    return new Promise(function(resolve, reject){
      console.log(2);

      let store = db.transaction(storeName, READ_WRITE).objectStore(storeName);
      let req = store.openCursor();
      console.log(3);

      req.onsuccess = async function (evt) {
        console.log(4);

        let cursor = evt.target.result;
        if(cursor){ //必要检查
          let value = cursor.value;
          console.log(cursor);

          if (value.company_id) {
            console.log(5);
            let res = await ajaxRequest(value.company_id);
            // let res = {abc:'123'};
            console.log(6);

            // ajaxRequest(value.company_id).then(res=>{
            //   console.log(61);
            //   Object.assign(value, res);
            //   cursor.update(value);
            //   console.log(62);
            // });

            Object.assign(value, res);
            cursor.update(value);

            console.log(7);
          }

          console.log(8);

          cursor.continue(); //移动到下一项
        } else {
          resolve(true);
          console.log(10);
        }

       console.log(9);


        // resolve(true);
      };
    });
  },
  indexGetData: function(storeName){
    //使用索引，总是得到键值最小的那个
    let store = this.db.transaction(storeName, this.READ_WRITE).objectStore(storeName);
    let index = store.index("name");
    let req = index.get("杨幂");

    req.onsuccess = function(evt) {
      console.log("indexGet success" , evt.target.result);
    };
    req.onerror = function(evt) {
      console.error("indexGet error:", evt.target.errorCode || evt.target.error);
    };
  },
  indexOpenCursor: function(storeName){
    let store = db.transaction(storeName, this.READ_WRITE).objectStore(storeName);
    let index = store.index("name");
    let req = index.openCursor();

    req.onsuccess = function(evt) {
      let cursor = evt.target.result;
      if(cursor){ //必要检查
        let value = cursor.value;
        console.log(value);
        cursor.continue(); //移动到下一项
      }
    };
    req.onerror = function(evt) {
      console.error("openCursor error:", evt.target.errorCode || evt.target.error);
    };
  }
};

var sql = new DB();

sql.initDb(sql.DB_NAME, sql.DB_VERSION);


/*
// var DB_NAME = 'DEMO';
// var DB_VERSION = 1; //使用正整数，别用浮点型
// var db;
// var READ_WRITE = 'readwrite';
// var READ_ONLY = 'readonly';


function initDb() {
  console.log("initDb ...");
  var req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onsuccess = function (evt) {
    db = evt.target.result;
    console.log("initDb opened");
  };
  req.onerror = function (evt) {
    console.error("initDb error:", evt.target.errorCode || evt.target.error);
  };

  //增加数据库版本号时,会触发onupgradeneeded事件(会在onsuccess之前被调用)
  req.onupgradeneeded = function (evt) {
    console.log("initDb.onupgradeneeded");
    var db = evt.currentTarget.result;
    //ObjectStore必须在onupgradeneeded里创建，其他地方将会创建失败
    var usersStore = db.createObjectStore("users", { keyPath : "id" });
    usersStore.createIndex("name", "name", { unique : false });
  };
}

initDb();

function addData(){
  var users = [{
    id : '001',
    name : '刘亦菲',
    age : 18
  },{
    id : '002',
    name : '杨幂',
    age : 19
  },{
    id : '005',
    name : '柳岩',
    age : 20
  }];

  var tx = db.transaction("users", READ_WRITE);
  var store = tx.objectStore("users");
  var i = 0, len = users.length;
  while(i < len){
    var req= store.add(users[i++]);
    req.onsuccess = function (evt) {
      console.log("addData success:", evt.target.result);
    };
    req.onerror = function (evt) {
      console.error("addData error:", evt.target.errorCode || evt.target.error);
    };
  }
}

function updateData(){
  var tx = db.transaction("users", READ_WRITE);
    var store = tx.objectStore("users");
  var req = store.put({
    id : '001',
    name : '刘亦菲-小龙女',
    age : 18
  });
  req.onsuccess = function (evt) {
    console.log("updateData success");
  };
  req.onerror = function (evt) {
    console.error("updateData error:", evt.target.errorCode || evt.target.error);
  };
}

function getData(){
  var tx = db.transaction("users");
    var store = tx.objectStore("users");
  var req = store.get("001");
  req.onsuccess = function (evt) {
    var res = evt.target.result;
    console.log(res);
  };
  req.onerror = function (evt) {
    console.error("getData error:", evt.target.errorCode || evt.target.error);
  };
}

function delData(){
  var tx = db.transaction("users", READ_WRITE);
    var store = tx.objectStore("users");
  var req = store.delete("001");
  req.onsuccess = function (evt) {
    console.log("delData success");
  };
  req.onerror = function (evt) {
    console.error("delData error:", evt.target.errorCode || evt.target.error);
  };
}

function clearData(){
  var tx = db.transaction("users", READ_WRITE);
  var store = tx.objectStore("users");
  var req = store.clear();
  req.onsuccess = function (evt) {
    console.log("clearData success");
  };
  req.onerror = function (evt) {
    console.error("clearData error:", evt.target.errorCode || evt.target.error);
  };
}

function openCursor(){
  let store = db.transaction("users", READ_WRITE).objectStore("users");
  let req = store.openCursor();

  req.onsuccess = function (evt) {
    let cursor = evt.target.result;
    if(cursor){ //必要检查
      let value = cursor.value;
      console.log(value);
      if(value.name == '杨幂'){
        value.age = 16;
        cursor.update(value); //修改数据(必须是读写模式)
      }
      if(value.name == '柳岩'){
        cursor.delete();  //删除当前项
      }
      cursor.continue(); //移动到下一项
    }
  };
  req.onerror = function (evt) {
    console.error("openCursor error:", evt.target.errorCode || evt.target.error);
  };
}

//使用索引，总是得到键值最小的那个
function indexGetData(){
  let store = db.transaction("users", READ_WRITE).objectStore("users");
  let index = store.index("name");
  let req = index.get("杨幂");

  req.onsuccess = function (evt) {
    console.log("indexGet success" , evt.target.result);
  };
  req.onerror = function (evt) {
    console.error("indexGet error:", evt.target.errorCode || evt.target.error);
  };
}

function indexOpenCursor(){
  let store = db.transaction("users", READ_WRITE).objectStore("users");
  let index = store.index("name");
  let req = index.openCursor();

  req.onsuccess = function (evt) {
    let cursor = evt.target.result;
    if(cursor){ //必要检查
      let value = cursor.value;
      console.log(value);
      cursor.continue(); //移动到下一项
    }
  };
  req.onerror = function (evt) {
    console.error("openCursor error:", evt.target.errorCode || evt.target.error);
  };
}

function indexNames(){
  var tx = db.transaction("users", READ_WRITE);
    var store = tx.objectStore("users");
  var indexNames = store.indexNames;
  var index, i = 0, len = indexNames.length;
  while(i < len){
    index = store.index(indexNames[i++]);
    console.log(index);
  }
}
*/