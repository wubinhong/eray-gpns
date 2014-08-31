/**************************************************************************
 * <p>Title: test case for sender</p>
 * <p>Description: analyze utils for sender</p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-04-13
 ***************************************************************************/
var fs = require('fs'), readline = require('readline'), stream = require('stream'), util = require('util');
var cNodeBase = require('../common/cnode-base');

/**
 * 构造函数
 * @constructor
 */
function AnalySender() {

}
util.inherits(AnalySender, cNodeBase.CNodeBase);

AnalySender.prototype.readlineTest = function () {
    var thisObj = this;
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('What do you think of node.js?\r\n', function (answer) {
        thisObj.info('Thank you for your valuable feedback: %s', answer);
        rl.close();
    });
};
/**
 * 从logger日志中提取出socket随时间的变化率
 */
AnalySender.prototype.extractSocketPools = function () {
//    var instream = fs.createReadStream('d:/eray/data/gpns/logger/socket/child-3/50000.log');
    var instream = fs.createReadStream('d:/eray/data/gpns/logger/socket-inter/child-3/10000.log');
    var outstream = new stream;
    outstream.readable = true;
    outstream.writable = true;
    var rl = readline.createInterface({
        input: instream,
        output: outstream,
        terminal: false
    });
    rl.on('line', function (line) {
//        console.info(line);
        if(line.indexOf('socket pool:') != -1) {
            var arr = line.split(' ');
            var date = [arr[0], arr[1]].join(' ');
            var soketPool = JSON.parse(arr[arr.length - 1]);
            // output
//            console.log(date);
            console.log(soketPool['total']);
//            console.log(util.format('%s;%s;%s', arr[0], arr[1], soketPool['total']));
        }
    });
};

/**
 * 启动程序
 */
AnalySender.prototype.start = function () {
    this.extractSocketPools();
};
// 启动
var apiRcver = new AnalySender();
apiRcver.start();
