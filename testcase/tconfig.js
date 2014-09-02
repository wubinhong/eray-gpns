/**************************************************************************
 * <p>Title: config</p>
 * <p>Description: test for config module which include two running mode: development | production,
 * for more information, https://coderwall.com/p/zi4coa</p>
 * @author   wubinhong
 * @version  1.00
 * @date     2014-09-02
 ***************************************************************************/
var config = require('../config/index.js');
console.log(config.session.secret);
console.log(config.app);
console.log(config.app.cluster);


