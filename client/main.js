/**************************************************************************
 * <p>Title: launch entrance for a large number of client sockets simulation</p>
 * <p>Description: this module is make for GPNS's payload simulation</p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-02-22
 ***************************************************************************/
// distributed property configuration
var DIST_GPNS_RCVER_API = 'http://gpns.weather.com.cn/gpns/sender/get-ip.do';
//var DIST_GPNS_RCVER_API = 'http://192.168.2.191:8080/gpns/sender/get-ip.do';
//var DIST_GPNS_SENDER_IP = 'app.weather.com.cn';
var DIST_GPNS_SENDER_IP = '61.4.184.159';   // F5 SOCKET PROXY ip
// two option: API | FIX_IP, if API, then DIST_GPNS_RCVER_API need to be specified, or DIST_GPNS_SENDER_IP need to be spcified.
var DIST_MODE = 'API';
// ========================================================================

var cNodeUtil = require('../common/cnode-base.js').cNodeUtil,
    logger = cNodeUtil.logger;

var GParam = {
    start: 0,    //每个socket对应的pushAdd='pushadd'+number，number的起止值=start
    limit: 4,     // 每个进程产生多少个socket
    GPNS_RCVER_API: DIST_GPNS_RCVER_API,
    GPNS_SENDER_IP: DIST_GPNS_SENDER_IP,
    GPNS_MODE: DIST_MODE,
    GPNS_SENDER_PORT: 80    // this parameter will take effect only when {@link GPNS_MODE='API'}
};

logger.info('launching socket-client[%s]...', process.pid);

for (var i = 0; i < 5; i++) {

    var cProcess = cNodeUtil.createChild('./tmobileclient-child.js', GParam);   // 创建新的子进程
    GParam.start += GParam.limit;

    logger.info('create new child process[%s]', cProcess.pid);

    cProcess.on('message', function (data) {
        logger.info(this.pid + ':' + data);
    });
    cProcess.on('exit', function (code, signal) {
        logger.error('child[' + this.pid + '] exit');
    });
    cProcess.on('disconnect', function (code, signal) {
        logger.warn('child[' + this.pid + '] disconnect');
    });
    cProcess.on('error', function (err) {
        logger.error('child[' + this.pid + '] err=' + err.stack);
    });
}
