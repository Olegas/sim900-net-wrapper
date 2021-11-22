var inherits = require("util").inherits;
var EventEmitter = require("events").EventEmitter;
var SIM900Socket = require('./sim900-socket'),
   uartCommander = require('uart-commander');

var MAX_SOCKETS = 8;

function SIM900SocketManager(options) {
   EventEmitter.apply(this, arguments);

   this._sockets = [];
   this._pending = [];
   this._uart = options.uart;
   this._localIP = options.localIP;

   var self = this;
/*
   this._receiveCommander = uartCommander(this._uart, function() {

      var incomingSocketID = -1;

      timeout();
      rawmode();
      label('start');
      wait(/\+RECEIVE,(\d+),(\d+):\r\n/);
      perform(function(line, match, socketId, num){
         console.log('Consuming data for ' + socketId);
         incomingSocketID = +socketId;
      });
      consumeBytes('$2');
      perform(function(data){
         console.log('CONSUMED!');
         self.emit('data', incomingSocketID, data);
      });
      goto('start');
   });
   */
/*
   this._closeCommander = uartCommander(this._uart, function() {
      timeout();
      linemode();
      wait(/(\d+), CLOSED/);
      perform(function(line, match, socketId){
         console.log('CLOSING SOCKET ' + socketId);
         self.emit('close', +socketId);
      });
   })
   */
}

inherits(SIM900SocketManager, EventEmitter);

SIM900SocketManager.prototype.createSocket = function() {
   return this._reuseSocket() || this._createSocket();
};

SIM900SocketManager.prototype._createSocket = function() {
   var socket = new SIM900Socket({
      uart: this._uart,
      manager: this
   });

   socket.on('close', this._removeFromPool.bind(this, socket));

   if (!this._addToPool(socket)) {
      this._pending.push(socket);
   }

   return socket;
};

SIM900SocketManager.prototype._addToPool = function(socket) {
   for(var i = 0; i < MAX_SOCKETS; i++) {
      if (!this._sockets[i]) {
         socket.setId(i);
         this._sockets[i] = socket;
         return true;
      }
   }
   return false;
};

SIM900SocketManager.prototype._removeFromPool = function(socket) {
   if (socket.getId() >= 0) {
      this._sockets[socket.getId()] = '';
      this._checkPending();
   }
};

SIM900SocketManager.prototype._checkPending = function() {
   if (this._pending.length > 0) {
      var pendingSocket = this._pending[0];
      if (this._addToPool(pendingSocket)) {
         this._pending.shift();
      }
   }
};

SIM900SocketManager.prototype._reuseSocket = function() {
   var socket, result;
   for(var i = 0; i < this._sockets.length; i++) {
      socket = this._sockets[i];
      if (socket) {
         if (socket.getState() == 'idle') {
            result = socket;
            break;
         }
      }
   }
   return result;
};

SIM900SocketManager.prototype.destroy = function() {
   this._receiveCommander.end();
   this._closeCommander.end();
};

Object.defineProperty(SIM900SocketManager.prototype, 'localIP', {
   get: function() {
      return this._localIP;
   },
   writable: false
});


module.exports = SIM900SocketManager;