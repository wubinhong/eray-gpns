/**************************************************************************
 * <p>Title: gpns-rcver</p>
 * <p>Description: gpns由gpns-rcver及gpns-sender组成，此项目为gpns-rcver
 * 负责接收消息及pushAdd列表，并将消息发送 给gpns-sender的相关子进程</p>

 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-12
 ***************************************************************************/
var YSendServer = require('./ysend-server').YSendServer,
    YRcvServer = require('./yrcv-server').YRcvServer,
    logger = require('../common/cnode-base').CNodeBase.prototype.logger,
    config = require('../config/index.js');
var MSG_PUSHADDS_QUEUE = [];    // 存储待处理的msgPushAdds的列表的队列，每次新接收到的msgPushAdds放到队尾
// parameters for child socket server
var senderChildMsgSocketServerParams = {
    MSG_PUSHADDS_QUEUE: MSG_PUSHADDS_QUEUE,
    PORT: config.gpns.rcver.msg_socket_server.port,
    SEND_MSG_TO_PUSHADDS_PER: config.gpns.rcver.msg_push.pushadds_per,
    SEND_MSG_PUSH_DELAY: config.gpns.rcver.msg_push.push_delay
};
// parameters for rcver server
var RCVER_SERVER_CONF = {
    PORT: config.gpns.rcver.http_server.port,
    // send server instance reference
    SEND_SERVER: null,
    // msg and pushadds object queue
    MSG_PUSHADDS_QUEQUE: MSG_PUSHADDS_QUEUE
}

function exit() {
    logger.error('gpns-rcver[%s]: stopping..., exit -1', process.pid);
    setTimeout(function () {
        process.exit(-1);
    }, 1000);
}

// 启动服务
logger.info('launching gpns-rcver[%s]...', process.pid);
var sendSvr = new YSendServer(senderChildMsgSocketServerParams);
sendSvr.setOnClose(exit);
sendSvr.start();

RCVER_SERVER_CONF.SEND_SERVER = sendSvr;
var rcvSvr = new YRcvServer(RCVER_SERVER_CONF);
rcvSvr.setOnClose(exit);
rcvSvr.start();

process.on('uncaughtException', function (err) {	// 处理异步回调中的异常
    logger.error('gpns-rcver[%s]: err=%s', process.pid, err.stack);
});
