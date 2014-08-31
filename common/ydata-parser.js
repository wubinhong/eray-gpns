/***********************************************************************
 * <p>Title: 处理socket通信的信息格式的工具类，及数据解析器</p>
 * <p>Description: socket通信存在如下现象：
        <li>A方发送数据，两次，B方一次接收；
        <li>A方发送数据，一次，B方分两次接收。<br>
 * 基于此，我们需要给每次发送的数据一个结束符，以便接
 * 收方解析</p>
 * <p>Company: eraymobile </p>
 *
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-12
 ***********************************************************************/


/**
 * 解析一个有意义的信息的工具类
 */
function UData(){}

/**
 * 每条消息的结束符
 */
UData.endChar = '#';

/**
 * 解析接收到数据
 *
 * @param data 多条或一条msg
 * @param delEndChar 是否删除每条msg的结束符，true：删除；false：不删除
 * @return 一个Array对象，每个元素是一条msg
 */
UData.parse = function(data, delEndChar){
	var r = [];
	
	var dArr = data.split(UData.endChar);
	for(var i=0; i<dArr.length; i++){
		if(dArr[i]!=''){
			if(delEndChar){
				r.push(dArr[i]);
			} else{
				r.push(dArr[i]+UData.endChar);
			}
		}
	}

	return r;
};


/**
 * 不断缓存接收数据，迭代解析的数据解析器，
 */
function YDataParser(){
	this.data = '';
}

/**
 * 缓存接收到数据
 *
 * @param data 要缓存的数据
 */
YDataParser.prototype.push = function(data){
	this.data += data;
};

/**
 * 解析缓存的数据，返回一条信息msg，如果没有返回null
 *
 * @param delEndChar 是否删除每条msg的结束符，true：删除；false：不删除
 * @return 返回一条信息msg
 */
YDataParser.prototype.popNextMsg = function(delEndChar){
	var r = null;
	var idx = this.data.indexOf(UData.endChar);
	if(idx>-1){
		r = this.data.substring(0, idx);
		if(r=='') r = null;
		else if(!delEndChar)
			r += UData.endChar;
		
		this.data = this.data.substring(idx+1);

	}

	return r;
};




exports.UData = UData;
exports.YDataParser = YDataParser;