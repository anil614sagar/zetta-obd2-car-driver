var Scout = require('zetta-scout');
var util = require('util');
var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
var Obd2 = require('./obd2');

var Obd2Scout = module.exports = function(searchString) {
  this.searchString = searchString || 'OBD';
  Scout.call(this);
};

util.inherits(Obd2Scout, Scout);

Obd2Scout.prototype.init = function(cb) {
  btSerial.on('found', this._obdDiscovered.bind(this));
  btSerial.on('finished', function() {
    console.log('No suitable devices found');
  });
  btSerial.inquire();
  cb();
};

Obd2Scout.prototype._obdDiscovered = function(address, name) {
  var self = this;

  var search = new RegExp(this.searchString.replace(/\W/g, ''), 'gi');

  var addrMatch = !this.searchString || address.replace(/\W/g, '').search(search) != -1;
  var nameMatch = !this.searchString || name.replace(/\W/g, '').search(search) != -1;

  if (addrMatch || nameMatch) {
    btSerial.removeAllListeners('finished');
    btSerial.removeAllListeners('found');

    console.log('Found device: ' + name + ' (' + address + ')');

    var query = self.server.where({ type: 'obd2', uuid: address });

    btSerial.findSerialPortChannel(address, function(channel) {
      console.log('Found device channel: ' + channel);

      self.server.find(query, function(err, results) {
        if (results.length) {
          var obd2 = self.provision(results[0], Obd2, address, channel, name);
          connect(obd2);
        } else {
          var obd2 = self.discover(Obd2, address, channel, name);
          connect(obd2);
        }
      });
    }, function(err) {
      console.log("Error finding serialport: " + err);
    });
  } else {
    console.log('Ignoring device: ' + name + ' (' + address + ')');
  }
  var connect = function(obd2) {
    console.log('connecting to obd2 ....')
    obd2.call('connect', function(err) {});
  };
};
