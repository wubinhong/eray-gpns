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
    logger = require('../common/cnode-base').CNodeBase.prototype.logger;
// golobal variables configuration
var GStore = {

    MSG_PUSHADDS_QUEUE: []		// 存储待处理的msgPushAdds的列表的队列，每次新接收到的msgPushAdds放到队尾
};
// parameters for child socket server
var senderChildMsgSocketServerParams = {
    MSG_PUSHADDS_QUEUE: GStore.MSG_PUSHADDS_QUEUE,
    PORT: 9000, // listen port for child socket server
    SEND_MSG_TO_PUSHADDS_PER: 100,  // 每次发送给gpns-sender的每个子进程的pushAdd的个数
    SEND_MSG_START_LATE: 1000   // yrcv-server接收到消息后多少ms，开始循环检测是否有msgPushs要发送，当发送完消息后结束循环
};
// parameters for rcver server
var RCVER_SERVER_CONF = {
    // 接收msg的http的服务的端口
    PORT: 8080,
    // send server instance reference
    SEND_SERVER: null,
    // msg and pushadds object queue
    MSG_PUSHADDS_QUEQUE: GStore.MSG_PUSHADDS_QUEUE
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
