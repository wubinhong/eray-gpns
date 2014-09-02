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
var YParentProcess = require('./parent.js').YParentProcess,
    logger = require('../common/cnode-base').CNodeBase.prototype.logger, config = require('../config/index.js');

var GPNS_RCVER = config.gpns.rcver;
var GPNS_RCVER_HOST_PORT = GPNS_RCVER.host + ':' + GPNS_RCVER.http_server.port;
var GPNS_SENDER = config.gpns.sender;
var GPNS_SENDER_CHILD = config.gpns.sender.child;
var GPNS_SENDER_HTTP_SERVER = GPNS_SENDER.parent.http_server;

// client socket server's configuration, which will be used to launch a socket server
var CLIENT_SOCKET_SERVER_CONF = {
    PORT: GPNS_SENDER.parent.socket_server.port
};
// gpns-rcver socket server's configuration, which will be used by rcver socket
var HTTP_SERVER_CONF = {
    // rcver socket server's listen prot
    PORT: GPNS_SENDER_HTTP_SERVER.port,
    // the url though which this http server can register to gpns-rcver
    RCVER_REGIST_URL: 'http://' + GPNS_RCVER_HOST_PORT + GPNS_RCVER.http_server.path_sender_regist,
    // deregister this http server to gpns-rcver, before http server stop or parent process exit
    RCVER_DEREGIST_URL: 'http://' + GPNS_RCVER_HOST_PORT + GPNS_RCVER.http_server.path_sender_deregist,
    // rcver's api for destroy gpns-sender-child process's socket with specified pushadd
    RCVER_SOCKET_DESTROY_URL: 'http://' + GPNS_RCVER_HOST_PORT + GPNS_RCVER.http_server.path_sender_child_socket_destroy,
    // get socket pool info
    PATH_SOOCKET_INFO: GPNS_SENDER_HTTP_SERVER.path_child_socket_info,
    // get sum total of socket pool
    PATH_SOOCKET_TOTAL: GPNS_SENDER_HTTP_SERVER.path_child_socket_total

};
// regester info
HTTP_SERVER_CONF.RCVER_REGIST_INFO = {
    HOST: GPNS_SENDER.host,
    CLIENT_SOCKET_SERVER_PORT: CLIENT_SOCKET_SERVER_CONF.PORT,
    HTTP_SERVER_PORT: HTTP_SERVER_CONF.PORT,
    PATH_SOOCKET_TOTAL: HTTP_SERVER_CONF.PATH_SOOCKET_TOTAL,
    PATH_SOOCKET_INFO: HTTP_SERVER_CONF.PATH_SOOCKET_INFO
};
// child process configuration
var CHILD_PROCESS_CONF = {
    CHILD_MAX: GPNS_SENDER_CHILD.max,
    NEW_CHILD_GT_SOCKET_NUMBER: GPNS_SENDER_CHILD.new_child_socket_limit,
    reconnConf: GPNS_SENDER_CHILD.socket_maintain.reconn_conf,
    rcvItvlTimeout: GPNS_SENDER_CHILD.socket_maintain.timeout,
    sendHeartbeatItvl: GPNS_SENDER_CHILD.socket_maintain.heartbeat_period,
    checkHeartbeatPer: GPNS_SENDER_CHILD.socket_maintain.socket_num_per_check,

    gpnsRcverHost: GPNS_RCVER.host, // gpns-rcver的ip
    gpnsRcverPort: GPNS_RCVER.msg_socket_server.port,  // gpns-rcver socket server的监听端口号
    gpnsRcverReconnectItvl: GPNS_SENDER_CHILD.msg_socket.failed_reconn_period,
    sendMsgToPushAddsPer: GPNS_SENDER_CHILD.msg_socket.pushadd_num_per_push,

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
