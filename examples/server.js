var zetta = require('zetta');
var obd2 = require('../index');

zetta()
  .name('Zetta-Car')
  .use(obd2, 'OBD')
  .listen(1330, function(){
     console.log('Zetta is running..');
});
