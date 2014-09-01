/**************************************************************************
 * <p>Title: gpns-sender</p>
 * <p>Description: gpns由gpns-rcver及gpns-sender组成，此项目为gpns-sender，
 * 负责接收来自gpns-rcver的消息及pushAdd列表，并将消息发送
 * 给pushAdd的移动客户端，此项目开启一个socket服务，用于保
 * 持与移动客户端的连接</p>

 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-04
 ***************************************************************************/
// distributed property configuration
//var DIST_GPNS_RCVER_HOST = 'gpns-proxy';
var DIST_GPNS_RCVER_HOST = '127.0.0.1';
var DIST_GPNS_RCVER_PORT = 8080;
//var DIST_GPNS_SENDER_HOST = '61.4.184.175';
var DIST_GPNS_SENDER_HOST = '127.0.0.1';
// ========================================================================


var YParentProcess = require('./parent.js').YParentProcess,
    logger = require('../common/cnode-base').CNodeBase.prototype.logger;
// client socket server's configuration, which will be used to launch a socket server
var CLIENT_SOCKET_SERVER_CONF = {
    PORT: 8000      // client socket server's listen port
};
// gpns-rcver socket server's configuration, which will be used by rcver socket
var HTTP_SERVER_CONF = {
    // rcver socket server's listen prot
    PORT: 7000,
    // the url though which this http server can register to gpns-rcver
    RCVER_REGIST_URL: 'http://' + DIST_GPNS_RCVER_HOST + ':' + DIST_GPNS_RCVER_PORT + '/gpns/sender/regist.do',
    // deregister this http server to gpns-rcver, before http server stop or parent process exit
    RCVER_DEREGIST_URL: 'http://' + DIST_GPNS_RCVER_HOST + ':' + DIST_GPNS_RCVER_PORT + '/gpns/sender/deregist.do',
    // rcver's api for destroy gpns-sender-child process's socket with specified pushadd
    RCVER_SOCKET_DESTROY_URL: 'http://' + DIST_GPNS_RCVER_HOST + ':' + DIST_GPNS_RCVER_PORT + '/gpns/sender/child/socket/destroy.do',
    // get socket pool info
    PATH_SOOCKET_INFO: '/child/socket/info.do',
    // get sum total of socket pool
    PATH_SOOCKET_TOTAL: '/child/socket/total.do'

};
// regester info
HTTP_SERVER_CONF.RCVER_REGIST_INFO = {
    HOST: DIST_GPNS_SENDER_HOST,
    CLIENT_SOCKET_SERVER_PORT: CLIENT_SOCKET_SERVER_CONF.PORT,
    HTTP_SERVER_PORT: HTTP_SERVER_CONF.PORT,
    PATH_SOOCKET_TOTAL: HTTP_SERVER_CONF.PATH_SOOCKET_TOTAL,
    PATH_SOOCKET_INFO: HTTP_SERVER_CONF.PATH_SOOCKET_INFO
};
// child process configuration
var CHILD_PROCESS_CONF = {
    CHILD_MAX: 3,   // 最多可创建子进程的个数
    NEW_CHILD_GT_SOCKET_NUMBER: -1, // min(子进程处理的socket的个数)>此值 && 子进程的个数<CHILD_MAX ，创建新的子进程
    reconnConf: {       // 对每个长连接，当没有成功设置心跳包时间间隔时，服务器会重新连接并设置客户端
        interval: 5000, // 两次重连的时间间隔（millisecond）
        count: 3        // 重新连接的最大次数
    },
    rcvItvlTimeout: 120000, // 对每个长连接，如果距离上一次接收到此链接数据的时间大于此值认为连接断掉
    sendHeartbeatItvl: 30000,   // 对每个长连接，发送心跳包的时间间隔（心跳包改为客户端发）
    checkHeartbeatPer: 200, // 每次检测多少个socket
    gpnsRcverHost: DIST_GPNS_RCVER_HOST, // gpns-rcver的ip
    gpnsRcverPort: 9000,  // gpns-rcver的端口号
    gpnsRcverReconnectItvl: 5000,   // gpns-rcver的连接断掉，每隔多少毫秒重连一次
    sendMsgToPushAddsPer: 200,  // 每次发送推送消息给多少个pushAdd
    pathGPNSRcverAPI4SocketDestroy: HTTP_SERVER_CONF.RCVER_SOCKET_DESTROY_URL
};
// other configuration
var OTHER_CONF = {

};

// 启动服务
logger.info('launching gpns-sender[%s]...', process.pid);
var server = new YParentProcess(CLIENT_SOCKET_SERVER_CONF, HTTP_SERVER_CONF, CHILD_PROCESS_CONF, OTHER_CONF);
server.start();
server.scheduleTask();
