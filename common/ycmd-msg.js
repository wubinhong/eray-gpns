/***********************************************************************
 * <p>Title: 服务器与客户端之间通信的消息格式</p>
 * <p>Description: YMsg为消息解析器</p>
 * <p>Company: eraymobile </p>
 *
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-02
 ***********************************************************************/

/**
 * 子进程内部 commander与executor的通信格式
 *
 * @param type 通信类型, {@link ECmdType}
 * @param content 通信内容
 */
function YCmdMsg(type, content) {
    this.type = type;				// 通信类型
    this.content = content;			// 通信内容
}

/**
 * 将字符串解析为此对象的属性
 * @param msg
 */
YCmdMsg.prototype.decode = function (msg) {
    var obj = JSON.parse(msg);
    if (obj.type || obj.type == 0) this.type = obj.type;
    if (obj.content || obj.content == 0) this.content = obj.content;
};

/**
 * 将消息对象转为字符串
 *
 * @return 消息对象的字符串表示
 */
YCmdMsg.prototype.encode = function () {
    return JSON.stringify(this);
};

/**
 * 子进程内部 commander与executor的通信类型
 */
var ECmdType = {
    errRtn: 0,

    cmdSendHeartBeat: 1,			// commander命令executor发送心跳包
    cmdSendHeartBeatRtn: 2,			// executor发送心跳包完毕，通知commander

    cmdSendMsg: 3,					// commander命令executor发送消息
    cmdSendMsgRtn: 4,				// executor发送消息完毕，通知commander

    cmdDestroySocket: 5,            // commander命令executor销毁socket
    cmdDestroySocketRtn: 6          // executor销毁socket完毕，通知commander
};

exports.YCmdMsg = YCmdMsg;
exports.ECmdType = ECmdType;