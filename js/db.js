
var DB = function() {
  this.DB_NAME = 'Jobsites';
  this.Indeed_STORE_NAME = 'indeed_store';
  this.Glassdoor_STORE_NAME = 'glassdoor_store';
  this.DB_VERSION = 1; //使用正整数，别用浮点型
  this.db;
  this.READ_WRITE = 'readwrite';
  this.READ_ONLY = 'readonly';
};

DB.prototype = {
  constructor: DB, //DB
  initDb: function() {
    console.log("initDb ...");
    console.log(this);
    var req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

    req.onsuccess = function (evt) {
      this.db = evt.target.result;
      console.log(this);
      console.log(this.db);
      console.log("initDb opened");
    }.bind(this);
    req.onerror = function (evt) {
      console.error("initDb error:", evt.target.errorCode || evt.target.error);
    };

    //增加数据库版本号时,会触发onupgradeneeded事件(会在onsuccess之前被调用)
    req.onupgradeneeded = function (evt) {
      console.log("initDb.onupgradeneeded");
      this.db = evt.currentTarget.result;
      //ObjectStore必须在onupgradeneeded里创建，其他地方将会创建失败
      // var usersStore = this.db.createObjectStore("users", { keyPath : "id" });

      var indeedStore = this.db.createObjectStore(
        this.Indeed_STORE_NAME,
        { keyPath: 'id', autoIncrement: true }
      );

      var glassdoorStore = this.db.createObjectStore(
        this.Glassdoor_STORE_NAME,
        { keyPath: 'id', autoIncrement: true }
      );

      // usersStore.createIndex("name", "name", { unique : false });
    }.bind(this);
  },
  addData: function(storeName) {
    console.log(this);
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
      age : 20,
      ohter: 123
    }];

    var store = this.db.transaction(storeName, READ_WRITE).objectStore(storeName);

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
  },
  updateData: function() {
    var tx = this.db.transaction("users", READ_WRITE);
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
  },
  getData: function() {
    var tx = this.db.transaction("users");
      var store = tx.objectStore("users");
    var req = store.get("001");
    req.onsuccess = function (evt) {
      var res = evt.target.result;
      console.log(res);
    };
    req.onerror = function (evt) {
      console.error("getData error:", evt.target.errorCode || evt.target.error);
    };
  },
  delData: function() {
    var tx = this.db.transaction("users", READ_WRITE);
      var store = tx.objectStore("users");
    var req = store.delete("001");
    req.onsuccess = function (evt) {
      console.log("delData success");
    };
    req.onerror = function (evt) {
      console.error("delData error:", evt.target.errorCode || evt.target.error);
    };
  },
  clearData: function() {
    var tx = this.db.transaction("users", READ_WRITE);
    var store = tx.objectStore("users");
    var req = store.clear();
    req.onsuccess = function (evt) {
      console.log("clearData success");
    };
    req.onerror = function (evt) {
      console.error("clearData error:", evt.target.errorCode || evt.target.error);
    };
  }
};

var sql = new DB();

sql.initDb();


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

// initDb();

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
  var store = db.transaction("users", READ_WRITE).objectStore("users");

  store.openCursor().onsuccess = function (evt) {
    var cursor = evt.target.result;
    if(cursor){ //必要检查
      var value = cursor.value;
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

function indexGetData(){
  var store = db.transaction("users", READ_WRITE).objectStore("users");
  var index = store.index("name");
  var req = index.get("杨幂");
  req.onsuccess = function (evt) {
    console.log("indexGet success" , evt.target.result);
  };
  req.onerror = function (evt) {
    console.error("indexGet error:", evt.target.errorCode || evt.target.error);
  };
}

function indexOpenCursor(){
  var tx = db.transaction("users", READ_WRITE);
    var store = tx.objectStore("users");
  var index = store.index("name");
  var req = index.openCursor();
  req.onsuccess = function (evt) {
    var cursor = evt.target.result;
    if(cursor){ //必要检查
      var value = cursor.value;
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