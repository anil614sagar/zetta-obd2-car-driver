var util = require('util');
var Device = require('zetta-device');
var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
var PIDS = require('./obdPids.js');
var queue = [];
var obd2Queries = [];

var Obd2 = module.exports = function(address, channel, name) {
  Device.call(this);
  this.address = address;
  this.channel = channel;
  this.deviceName = name;
  this.receivedData = '';
  this.temp = 0;
  this.rpm = 0;
  this.speed = 0;
};

util.inherits(Obd2, Device);

Obd2.prototype.init = function(config) {
  config
    .type('obd2')
    .name(this.deviceName)
    .when('disconnected', { allow: ['connect'] })
    .when('connected', { allow: ['disconnect', 'start-monitors'] })
    .map('connect', this.connect)
	  .map('start-monitors', this.startMonitors)
    .map('disconnect', this.disconnect)
    .map('stop-monitors', this.stopMonitors)
	  .state('disconnected')
    .monitor('temp')
    .monitor('rpm')
    .monitor('speed');
};

Obd2.prototype.connect = function(cb) {
  var self = this;
  this.state = 'connected';
  btSerial.connect(self.address, self.channel, function () {

    // Reset the router
    self.write('ATZ');
    //Turns off extra line feed and carriage return
    self.write('ATL0');
    //Disable spaces in the output
    self.write('ATS0');
    //Turn off headers and checksum to be sent.
    self.write('ATH0');
    //Turn off echo.
    self.write('ATE0');
    //Turn adaptive timing to 2.
    self.write('ATAT2');
    //Set the protocol to automatic.
    self.write('ATSP0');

    btSerial.on('data', function (data) {
      var currentString, indexOfEnd, arrayOfCommands;
      currentString = self.receivedData + data.toString('utf8'); // making sure it's a utf8 string

      arrayOfCommands = currentString.split('>');

      var forString;
      if(arrayOfCommands.length < 2) {
          self.receivedData = arrayOfCommands[0];
      } else {
          for(var commandNumber = 0; commandNumber < arrayOfCommands.length; commandNumber++) {
              forString = arrayOfCommands[commandNumber];
              if(forString === '') {
                  continue;
              }

              var multipleMessages = forString.split('\r');
              for(var messageNumber = 0; messageNumber < multipleMessages.length; messageNumber++) {
                  var messageString = multipleMessages[messageNumber];
                  if(messageString === '') {
                      continue;
                  }
                  var reply;
                  console.log(messageString);
                  reply = self.parseOBDResponse(messageString);
				          if (reply.pid == '0C') {
					          self.rpm = reply.value;
				          } else if(reply.pid == '05') {
					          self.temp = reply.value;
				          } else if(reply.pid == '0D') {
					          self.speed = reply.value;
				          }
                  //Event dataReceived.
                  //self.emit('dataReceived', reply);
                  self.receivedData = '';
              }
          }
      }
    });

    btSerial.on('failure', function(error) {
      //self.emit('error', 'Error with OBD-II device: ' + error);
    });

  }, function (err) { //Error callback!
        //self.emit('error', 'Error with OBD-II device: ' + err);
  });

  this.btSerial = btSerial; //Save the connection in obd2 object.

  // Run Queries to setup ELM327 device
  var intervalWriter = setInterval(function (){
       if (queue.length > 0) {
            try {
                self.btSerial.write(new Buffer(queue.shift(), "utf-8"), function(err, count) {
                    if(err)
                        console.log('error', err);
                });
            } catch (err) {
              console.log('error', 'Error while writing: ' + err);
              console.log('error', 'OBD-II Listeners deactivated, connection is probably lost.');
              clearInterval(intervalWriter);
            }
      }
    }, 2000);

  // Run Queries to get values from OBD2
  var intervalQueryWriter = setInterval(function (){
       if (obd2Queries.length > 0) {
            try {
                self.btSerial.write(new Buffer(obd2Queries.shift(), "utf-8"), function(err, count) {
                    if(err)
                        console.log('error', err);
                });
            } catch (err) {
              console.log('error', 'Error while writing: ' + err);
              console.log('error', 'OBD-II Listeners deactivated, connection is probably lost.');
              clearInterval(intervalQueryWriter);
            }
      }
    }, 200);

  cb();
};

/**
 * Writes a message to the bluetooth device
 * @this {Obd2}
 * @param {string} message
 * @param {number} replies The number of replies that are expected. Default = 0. 0 --> infinite
 * AT Messages --> Zero replies!!
 */

Obd2.prototype.write = function (message, replies) {
    if(replies === undefined) {
        replies = 0;
    }
    if (this.state == 'connected') {
        if(queue.length < 256) {
            if(replies !== 0) {
                queue.push(message + replies + '\r');
            } else {
                queue.push(message + '\r');
            }
        } else {
            console.log('error', 'Queue-overflow!');
        }
    } else {
        console.log('error', 'Bluetooth device is not connected.');
    }
};

/**
 * Writes a message to the bluetooth device
 * @this {Obd2}
 * @param {string} message
 * @param {number} replies The number of replies that are expected. Default = 0. 0 --> infinite
 * AT Messages --> Zero replies!!
 */

Obd2.prototype.writeQuery = function (message, replies) {
    if(replies === undefined) {
        replies = 0;
    }
    if (this.state == 'connected') {
        if(obd2Queries.length < 256) {
            if(replies !== 0) {
              obd2Queries.push(message + replies + '\r');
            } else {
              obd2Queries.push(message + '\r');
            }
        } else {
            console.log('error', 'Queue-overflow!');
        }
    } else {
        console.log('error', 'Bluetooth device is not connected.');
    }
};

Obd2.prototype.disconnect = function(cb) {
  this.state = 'disconnected';
  var self = this;
  btSerial.close();
  cb();
};

Obd2.prototype.startMonitors = function(cb) {
  var self = this;

  pollerInterval = setInterval(function () {
      self.writeQuery('0104');
      self.writeQuery('0105');
		  self.writeQuery('010C');
      self.writeQuery('010D');
  }, 2000);

  cb();
};


Obd2.prototype.parseOBDResponse = function(hexString) {
	var reply,
	    byteNumber,
	    valueArray;

	reply = {};
	if (hexString === "NO DATA" || hexString === "OK" || hexString === "?") { //No data or OK is the response.
	    reply.value = hexString;
	    return reply;
	}

	hexString = hexString.replace(/ /g, ''); //Whitespace trimming
	valueArray = [];

	for (byteNumber = 0; byteNumber < hexString.length; byteNumber += 2) {
	    valueArray.push(hexString.substr(byteNumber, 2));
	}

  // 40 is added to mode value in response.
	if (valueArray[0] === "41") {
	    reply.mode = valueArray[0];
	    reply.pid = valueArray[1];
	    for (var i = 0; i < PIDS.length; i++) {
	        if(PIDS[i].pid == reply.pid) {
	            var numberOfBytes = PIDS[i].bytesReturned;
	            reply.name = PIDS[i].name;
              reply.unit = PIDS[i].unit;
	            switch (numberOfBytes)
	            {
	                case 1:
	                    reply.value = PIDS[i].convertToReadable(valueArray[2]);
	                    break;
	                case 2:
	                    reply.value = PIDS[i].convertToReadable(valueArray[2], valueArray[3]);
	                    break;
	                case 4:
	                    reply.value = PIDS[i].convertToReadable(valueArray[2], valueArray[3], valueArray[4], valueArray[5]);
	                    break;
	                case 8:
	                    reply.value = PIDS[i].convertToReadable(valueArray[2], valueArray[3], valueArray[4], valueArray[5], valueArray[6], valueArray[7], valueArray[8], valueArray[9]);
	                    break;
	            }
	            break; // Value is converted, break out of the for loop.
	        }
	    }
	}
	return reply;
}
