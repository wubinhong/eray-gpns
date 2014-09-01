/**************************************************************************
 * <p>Title: test case for rcver's http server API</p>
 * <p>Description: a test case for rcver's API</p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-04-13
 ***************************************************************************/
var http = require('http'), util = require('util'), fs = require('fs');
var cNodeBase = require('../common/cnode-base');

/**
 * 构造函数
 * @constructor
 */
function APIRcver(rcvServerIp, rcvServerPort) {
    this.SERVER_IP = rcvServerIp;
    this.SERVER_PORT = rcvServerPort;
    this.SERVER_PATH_GET_IP = '/gpns/sender/get-ip.do';
    this.SERVER_PATH_MSG_PUSH = '/gpns/msg/push.do';
    this.PATH_SENDER_CHILD_SOCKET_DESTROY = '/gpns/sender/child/socket/destroy.do';
    this.PATH_MONITOR_RCVER_INFO = '/gpns/monitor/rcver-info.do';
}
util.inherits(APIRcver, cNodeBase.CNodeBase);

/**
 * 推送消息
 * @param query 例子：'{"msg":{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"},"pushAdds":["pushadd0","pushadd1","pushadd2","pushadd3"],"expiredTime":1397721235000}'
 */
APIRcver.prototype.pushMsg = function (path, query) {
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
    thisObj.info('==> %s --> http://%s:%s%s', query, options.host, options.port, path);
    req.write(query);
    req.end();
};
/**
 * 批量测试GPNS的消息推送接口
 */
APIRcver.prototype.pushBatch = function (batch, total) {
    var thisObj = this;
    var expiredTime = new Date();
    expiredTime.setHours(expiredTime.getHours() + 1);
    var query = {
        msg: {
            "id": 1234, "type": 1, "title": "天气提醒", "content": util.format('【%s】-格格哟，今天晴天，适合出游', new Date()),
            "detail": "<a>http:www.google.com</a>"
        },
        pushAdds: [],
        "expiredTime": expiredTime
    }
    var delay = 0;
    for (var k = 0; k < total; k += batch) {
        query.pushAdds.length = 0   // empty the array
        for (var i = k; i < k + batch; i++) {
            query.pushAdds.push("pushadd" + i);
        }
        thisObj.pushMsg(thisObj.SERVER_PATH_MSG_PUSH, JSON.stringify(query));
    }
};
/**
 * 向指定pushadds推送一条测试消息
 * @param pushAdds {Array} 要推送的pushaAdds列表
 */
APIRcver.prototype.push = function (pushAdds) {
    // single message
    var now = new Date();
    var query = {
        msg: {
            "id": 1237, "type": 1, "title": "天气提醒哦", "content": util.format('【%s】-格格哟，今天晴天，适合出游', now.format(now.PATTERN.LONG)),
            "detail": "<a>http:www.google.com</a>"
        },
        pushAdds: pushAdds,
        "expiredTime": now.setHours(now.getHours() + 1)
    }
    this.pushMsg(this.SERVER_PATH_MSG_PUSH, JSON.stringify(query));
}
/**
 * get gpns-sender's ip
 */
APIRcver.prototype.getIp = function () {
    var query = {
        pushAdd: '1350436022172342'
    };
    this.pushMsg(this.SERVER_PATH_GET_IP, JSON.stringify(query));
};
/**
 * test case for gpns-rcver's client socket destroy api
 */
APIRcver.prototype.senderChildSocketDestroy = function () {
    var query = {
        pushAdd: 'pushadd0',
        exclude: '127.0.0.1:56529'
    };
    this.pushMsg(this.PATH_SENDER_CHILD_SOCKET_DESTROY, JSON.stringify(query));
};
/**
 * test case for getting gpns-rcver info
 */
APIRcver.prototype.monitorRcverInfo = function () {
    var query = {};
    this.pushMsg(this.PATH_MONITOR_RCVER_INFO, JSON.stringify(query));
};

/**
 * 启动程序
 */
APIRcver.prototype.start = function () {
    // push a test msg to pushadds
//    this.push(['pushadd0']);
//    this.push(['pushadd0', 'pushadd1', '042915221123201']);
//    this.push(['101616564451701']);
    // batch message push
//    this.pushBatch(1000, 5000);
//    this.getIp();
//    this.senderChildSocketDestroy();
    this.monitorRcverInfo();
};
// 启动
/**
 * test case for http server of gpns-rcver
 */
//new APIRcver('gpns.weather.com.cn', 80).start();
new APIRcver('127.0.0.1', 8080).start();
