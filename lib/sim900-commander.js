var uartCommander = require('uart-commander'),
    inherits = require("util").inherits,
    EventEmitter = require("events").EventEmitter,
    SIM900SocketManager = require('./sim900-socket-manager');

function SIM900Commander(options) {

   var self = this;

   this._localIP = '';

   if (options.debug) {
      require('./uart-debugger')(options.uart);
   }

   uartCommander(options.uart, function(){
      any('ERROR', function(){
         goto('start');
      });
      ctrlz();
      ctrlz();
      ctrlz();
      ctrlz();
      linemode();
      timeout();
      at('Z');
      wait('OK');
      at('+CIPSHUT');
      wait('ERROR', 'SHUT OK');
      at('+CGATT=1');
      wait('OK');
      at('+CIPMUX=1');
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
            uart: options.uart,
            localIP: match
         });

         var net = require('net');

         net.Socket = function() {
            return socketManager.createSocket();
         };

         net.connect = net.createConnection = function(port, host, listener) {
            var socket = socketManager.createSocket();
            socket.connect(port, host, listener);

            return socket;
         };

         self.emit('ready');

      });

   });

}

inherits(SIM900Commander, EventEmitter);

module.exports = SIM900Commander;

