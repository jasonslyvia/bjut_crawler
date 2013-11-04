//加载依赖
var mysql = require('mysql');
var async = require('async');


//使用数据库线程池
var pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'jason0726',
  database: 'bjut',
  connectionLimit: 15
});

/*
 * 储存一个学生的所有信息
 *
 * @param {object} student 包含学生信息的对象
 * @param {function} callback 当储存完成后执行的回调函数
 */
exports.storeStudent = function (student, callback){

  //从线程池中获得一个连接
  pool.getConnection(function(err, conn){

    if (err) {
      console.log(err);
    }

    var stuNo = student.baseInfo.student_no;
    //检查对应学号学生是否存在
    studentExists(stuNo, function(exists){
      if (exists) {
        conn.release();
        callback({
          "error": false,
          "message": "student " + stuNo + " existed!",
          "stuNo": stuNo
        });
        return true;
      }
      else{

          console.log("inserting " + stuNo);
          //使用async保证全部插入完成后再commit transaction
          async.parallel([
            storeStudent(student.baseInfo, "base_info"),
            storeStudent(student.studyHistory, "study_history", ["begin", "end", "school", "student_no"]),
            storeStudent(student.classHistory, "class_history", ["class_name", "score", "school_year", "student_no"]),
            storeStudent(student.family, "family", ["name", "relation", "work", "cell", "student_no"]),
            storeStudent(student.awards, "awards", ["award_name", "money", "student_no"]),
            function(){
                //释放线程
                conn.release();
                callback({
                  "error": false,
                  "message": "student " + stuNo + " stored!",
                  "stuNo": stuNo
                });
                return true;
            }
          ]);//async任务结束
      }
    });
  });

};


exports.doesExist = function(stuNo, callback){
  studentExists(stuNo, callback);
};

/*
 * 检查某个学号的数据是否已经存在
 *
 * @param {string} stuNo 学号
 * @return {bool}
 */
 function studentExists(stuNo, callback){

  pool.getConnection(function(err, conn){

    conn.query('SELECT 1 FROM base_info WHERE student_no = ?', [stuNo], function(err, result){
      if (err) {
        console.log(err.message);
      }

      conn.release();
      if (result.length) {
        callback(true);
        return true;
      }
      else{
        callback(false);
        return false;
      }
    });
  });

 }

 /*
 * 将学生信息插入数据表
 *
 * @param {object/array} student 学生信息
 * @param {string} table 数据表名
 * @param {array} column(optional) 若需要批量插入，则传本值，并保证 studeng 为数组类型
 * @param {function} callback 插入完成后执行的回调函数
 */
function storeStudent(student, table, column, callback){

  //若不含数据则不插入
  if (Array.isArray(student) && student.length === 0) {
    return null;
  }

  if (typeof column === "object") {
    //批量插入

    pool.getConnection(function(err, conn){
      if (err) {
        console.log("connection error!");
        console.log(err);
      }

      var insertSQL = conn.escape(student);
      var query = 'INSERT INTO ' + table + ' ( ' + column.join(',') + ') VALUES ' +
            insertSQL + ';';
      conn.query(query, function(err, result){
        if (err) {
          console.log(err);
        }
        conn.release();
      });
    });

  }
  else{
    //单次插入
    pool.getConnection(function(err, conn){

      conn.query('INSERT INTO ' + table + ' SET ?', student, function(err, result){
        if (err) {
          console.log(err);
        }
        conn.release();
      });
    });
  }

}
