/***********************************************************************
 * <p>Title: HTTP服务器API接口通信消息格式</p>
 * <p>Description: YHttpMsg为消息解析器</p>
 * <p>Company: eraymobile </p>
 *
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-05-21
 ***********************************************************************/
/**
 * msg status
 */
var MSG_STATUS = {
    SUCCESS: 'SUCCESS',		// 成功
    FAILURE: 'FAILURE',		// 失败
    ERROR: 'ERROR'			// 服务器发送错误
};

/**
 * http返回信息的格式
 * @param status 状态，{@link MSG_STATUS}
 * @param msg 返回失败或是成功信息
 * @param data 返回数据
 * @constructor
 */
function YHttpMsg(status, msg, data) {
//    this.status = status;
    if(status!=null && typeof status!='undefined') this.status = status;
    if(msg!=null && typeof msg!='undefined') this.msg = msg;
    if(data!=null && typeof data!='undefined') this.data = data;
}
/**
 * 获取对象的字符串表示
 * @returns 返回对象的字符串表示
 */
YHttpMsg.prototype.encode = function () {
    return JSON.stringify(this);
};

exports.YHttpMsg = YHttpMsg;
exports.MSG_STATUS = MSG_STATUS;