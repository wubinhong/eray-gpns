/**************************************************************************
 * <p>Title: test case for sender's http server API</p>
 * <p>Description: a test case for rcver's API</p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-04-13
 ***************************************************************************/
var http = require('http'), util = require('util');
var cNodeBase = require('../common/cnode-base');

/**
 * 构造函数
 * @constructor
 */
function APISender(serverIp, serverPort) {
    this.SERVER_IP = serverIp;
    this.SERVER_PORT = serverPort;

    // get socket pool info
    this.SERVER_PATH_SOOCKET_INFO = '/child/socket/info.do';
    // get sum total of socket pool
    this.SERVER_PATH_SOOCKET_TOTAL = '/child/socket/total.do';

}
util.inherits(APISender, cNodeBase.CNodeBase);

/**
 * 推送消息
 * @param query 例子：'{"msg":{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"},"pushAdds":["pushadd0","pushadd1","pushadd2","pushadd3"],"expiredTime":1397721235000}'
 */
APISender.prototype.post = function (path, query) {
    var thisObj = this;
    var options = {
        headers: {
            'custom': 'Custom Header Demo works'
        },
        method: 'POST',
        host: thisObj.SERVER_IP,
        port: thisObj.SERVER_PORT,
        path: path
    };
    var req = http.request(options, function (resp) {
        var str = '';
        resp.on('data', function (chunk) {
            str += chunk;
        });
        resp.on('end', function (chunk) {
            thisObj.info(str);
        });
    });
    thisObj.info('==> [%s:%s%s]: %s', options.host, options.port, path, query);
    req.write(query);
    req.end();
};
/**
 * 向指定pushadds推送一条测试消息
 * @param pushAdds {Array} 要推送的pushaAdds列表
 */
APISender.prototype.getSocketInfo = function () {
    var query = '';
    this.post(this.SERVER_PATH_SOOCKET_INFO, query);
}
/**
 * get gpns-sender's ip
 */
APISender.prototype.getSocketTotal = function () {
    var query = '';
    this.post(this.SERVER_PATH_SOOCKET_TOTAL, query);
};
/**
 * 启动程序
 */
APISender.prototype.start = function () {
    // push a test msg to pushadds
    this.getSocketInfo();
    this.getSocketTotal();
};
// 启动
/**
 * test case for parent process's http server of gpns-sender
 */
//new APISender('127.0.0.1', 7000).start();

// get local ip
var os = require('os')

var interfaces = os.networkInterfaces();
var addresses = [];
for (k in interfaces) {
    for (k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family == 'IPv4' && !address.internal) {
            addresses.push(address.address);
        }
    }
}

console.log(addresses);



