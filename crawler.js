//加载依赖
var cheerio = require('cheerio');
var fs = require('fs');
var http = require('http');
var iconv = require('iconv-lite');
var settings = require('./settings.js');

//常量定义
var hostname = settings.hostname;
var imageFolder = settings.imageFolder;
var options = {
 hostname: hostname,
 port: 80
};

var INFO = settings.INFO;

//全局对象
var $;
var studentNumber;
var thisStudent = {};


/*
 * 初始化一个爬虫实例
 *
 * @param {string} stuNo 学号
 * @param {function} callback 当学生信息处理完成时调用的函数
 */
exports.parseStudent = function(stuNo, callback){

  //判断其为合法学号
  if (stuNo.length != 8) {
    return null;
  }
  studentNumber = stuNo;

  console.log(settings);

  //获得html源码
  var cookie = settings.cookie.join(stuNo + ';');
  options.headers = {
    'Cookie': cookie
  };
  options.path = settings.path;

  var html = '';
  var req = http.request(options, function(res) {
   res.setEncoding('binary');
   res.on('data', function (chunk) {
    html += chunk;
   });

   res.on('end', function(){
    //转换编码
    html = iconv.decode(html, 'gbk');

    //若学号信息超出范围
    if (!html) {
        callback({
            "message": "student doesn't exist",
            "stuNo": stuNo
        });
        return false;
    }

    //初始化cheerio实例，用于提取数据
    $ = cheerio.load(html);

    //获取学生详细信息
    thisStudent.baseInfo = getBaseInfo(null, null, stuNo);
    thisStudent.studyHistory = getInfoRow("#tdId_study", {"0": "begin", "1": "end", "2": "school"}, 3, 0, stuNo);
    thisStudent.family = getInfoRow("#tdId_family", {"0": "name", "1": "relation", "2": "work", "4": "cell"}, 2, 0, stuNo);
    thisStudent.classHistory = getInfoRow("#tdId_study", {"0": "class_name", "4": "score", "5": "school_year"}, 2, 1, stuNo);
    thisStudent.awards = getInfoRow("#tdId_bearinfo", {"0": "award_name", "2": "money"}, 2, 4, stuNo);

    //将当前学生对象返回
    callback(thisStudent);
   });

  });

  req.end();
};




/*
 * 用于清理抓HTML数据，获取基本信息
 *
 * @param {string} category 要抓取信息的id，含#号
 * @param {function} callback 基本信息获取完成后调用的函数
 * @param {string} stuNo 学号
 * @return {object}
 */
function getBaseInfo(category, callback, stuNo){

  category = category || "#tdId_baseinfo";
  if (typeof category !== "string") {
    return null;
  }

  var info = [];
  $(".heertable td", category).each(function(i, v){

    //处理头像
    var avatar;
    if(avatar = $(v).find("img").attr('src')){
      getImage(avatar, stuNo);
      return true;
    }

    var text = $(v).text().trim().replace(/：$/g, '');
    if (text !== '') {
      info.push(text);
    }
    else{
      //若当前td内容为空，则抛弃上一个td中的内容
      info.pop();
    }
  });

  // console.log(info);

  var returnInfo = {};
  for (var i = 0; i < info.length; i+=2) {
    //在 INFO 数组中的数据才需要记录
    if (!!INFO[info[i]]) {
        returnInfo[INFO[info[i]]] = info[i+1];
    }
  }

  return returnInfo;
}

/*
 * 用于清理抓HTML数据，获取家庭成员信息
 *
 * @param {string} category 要抓取信息的id，含#号
 * @param {object} key {位置（数字）: 名称}
 * @param {int} offset 真实数据所在tr的偏移量，从0开始
 * @param {int} parentOffset id分支下的第几个table，默认为0
 * @param {string} stuNo 学号
 * @return {array}
 */
function getInfoRow(category, key, offset, parentOffset, stuNo){

  if (typeof category !== "string") {
    return null;
  }

  var info = [];
  parentOffset = parentOffset || 0;

  var dataSource = $(".heertable", category).eq(parentOffset).find("tr");

  for(var i=offset, l=dataSource.length; i<l; ++i){

    //用来标记当前行数据是否有效
    var dumpFlag = false;

    var newItem = [];
    for(var index in key){
      var text = dataSource.eq(i).children("td").eq(index).text();
      //若是无效数据
      if (text.match(/没有数据/)) {
        dumpFlag = true;
        break;
      }
      newItem.push(text);
    }

    if (!dumpFlag) {
        newItem.push(stuNo);
        info.push(newItem);
    }
  }

  return info;
}

/*
 * 提取图片，若存在则返回文件名，不存在则保存后返回文件名
 *
 * @param {string} path 图片地址，不含hostname
 * @param {string} filename 要储存的图片名
 * @return {string}
 */
function getImage(path, filename){

  if (typeof path !== "string") {
    return false;
  }

  //若图像已经存在，则返回文件名
  if (fs.existsSync(imageFolder + filename)) {
    //console.log('image for ' + filename + ' existed');
    return filename;
  }

  options.path = path;

  var req = http.request(options, function(res){

    //初始化数据！！！
    var binImage = '';

    res.setEncoding('binary');
    res.on('data', function(chunk){
      binImage += chunk;
    });

    res.on('end', function(){

      if (!binImage) {
        console.log('image data is null');
        return null;
      }

      fs.writeFile(imageFolder + filename, binImage, 'binary', function(err){
        if (err) {
          console.log('image writing error:' + err.message);
          return null;
        }
        else{
          console.log('image ' + filename + ' saved');
          return filename;
        }
      });
    });

    res.on('error', function(e){
      console.log('image downloading response error:' + e.message);
      return null;
    });
  });

  req.end();

}


