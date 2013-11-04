/*
 * 抓取BJUT学生信息测试版
 *
 * @author 杨森<jasonslyvia@gmail.com>
 * @version 0.0.1
 */

var bjutParser = require('./crawler.js');
var bjutSQL = require('./storage.js');
var async = require('async');


var baseStuNo = 10010001;
var LIMIT = 19999999;
fetchClass(baseStuNo);
/*================================================

学号抓取思路：

 1. 按学号逐个抓取
 2. 若学号不存在则跳到下一个班
 3. 若班不存在则班号加10， 即若10080301不存在，则从10081001开始
    (判断班不存在：该班1号即无法抓取)
 4.抓到 LIMIT 为止，大于该数则 10 级抓取完毕

================================================*/
function fetchClass(startNo){
  async.eachSeries(range(startNo, startNo + 98), crawlStudent, function(err){
    //出现错误则说明该班已经全部爬完
    if (err) {

      var stuNo = err.stuNo;
      //该班1号学生不存在，说明该班不存在，班号加10继续
      //但要除过部分学院不含00班
      if (stuNo.substr(-2) == '01' && stuNo.substr(-3) != '001') {

        //获取班号的个位，如100801的个位为1，为了班号加10
        var classNo = stuNo.substr(5,1);
        baseStuNo += (100 * (10 - parseInt(classNo, 10)));
        if (baseStuNo >= LIMIT) {
          return true;
        }
        fetchClass(baseStuNo);
      }
      //否则说明该学生不存在，班号加1继续
      else{
        baseStuNo += 100;
        if (baseStuNo >= LIMIT) {
          return false;
        }
        fetchClass(baseStuNo);
      }
    }
    else{
      console.log('all done!');
    }

  });
}


var studentArr = [];
function crawlStudent(stuNo, callback){

  bjutSQL.doesExist(stuNo, function(exist){
    if (exist) {
      //若该学生已经在数据库中，则调用回调函数爬取下一个学生
      console.log(stuNo + " existed!");
      callback();
    }
    else{
      //若数据库中不存在，先获取学生的信息
      bjutParser.parseStudent(stuNo, function(result){

        //若该学生抓取错误，则在回调中传err错误对象，爬下一个班
        if (result.message) {
          console.log(result.stuNo + ' ' + result.message);

          callback({
            "message": "student number out of range",
            "stuNo": result.stuNo
          });
        }

        //否则将学生对象放在一个数组中供bjutSQL逐个储存
        else{
          studentArr.push(result);

          //无论储存是否成功，继续爬取下一个学生
          callback();
          storeStudent();
        }
      });
    }
  });
}

function storeStudent(callback){
  var student = studentArr.pop();
  if (!!student) {
    bjutSQL.storeStudent(student, storeStudent);
  }
}

function range(begin, end){
  var arr = [];
  for(var i=begin; i<=end; ++i){
    arr.push(i.toString().length == 8 ? i.toString() : '0'+i.toString());
  }
  return arr;
}