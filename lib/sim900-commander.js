var uartCommander = require('uart-commander'),
    inherits = require("util").inherits,
    EventEmitter = require("events").EventEmitter,
    SIM900SocketManager = require('./sim900-socket-manager');

function SIM900Commander(options) {

   var self = this;

   this._uart = options.uart;
   this._localIP = '';

   uartCommander(options.uart, function(){
      ctrlz();
      linemode();
      at('Z');
      wait('OK');
      at('+CIPMUX=1');
      wait('OK');
      at('+CGATT=1');
      wait('OK');
      at('+CSTT="' + options.apn + '","' + (options.login || '') + '","' + (options.password || '') + '"');
      wait('OK');
      at('+CIICR ');
      wait('OK');
      at('+CIFSR');
      wait(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      rawmode();
      perform(function(line, match){
         var socketManager = new SIM900SocketManager({
            uart: self._uart,
            localIP: match
         });

         var net = require('net');

         net.Socket = function() {
            return socketManager.createSocket();
         };

         net.connect = net.createConnection = function(options, listener) {
            var socket = socketManager.createSocket();
            socket.connect(options.port, options.host, listener);
            return socket;
         }
      });

   })

}

inherits(SIM900Commander, EventEmitter);

module.exports = SIM900Commander;

