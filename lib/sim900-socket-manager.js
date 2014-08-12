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

   uartCommander(this._uart, function() {

      var incomingSocketID = -1;

      wait(/\+RECEIVE,(\d+),(\d+)/);
      perform(function(line, match, socketId){
         incomingSocketID = +socketId;
      });
      consumeBytes('$2');
      perform(function(data){
         self.emit('data', incomingSocketID, data);
      })
   });

   uartCommander(this._uart, function() {
      timeout(-1);
      wait(/(\d+), CLOSED/);
      perform(function(line, match, socketId){
         self.emit('close', +socketId);
      });
   })
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
};

SIM900SocketManager.prototype._addToPool = function(socket) {
   for(var i = 0; i < MAX_SOCKETS; i++) {
      if (!this._sockets[i]) {
         socket.id = i;
         this._sockets[i] = socket;
         return true;
      }
   }
   return false;
};

SIM900SocketManager.prototype._removeFromPool = function(socket) {
   if (socket.id) {
      this._sockets[socket.id] = '';
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
         if (socket.state == 'idle') {
            result = socket;
            break;
         }
      }
   }
   return result;
};

Object.defineProperty(SIM900SocketManager, 'localIP', {
   get: function() {
      return this._localIP;
   },
   writable: false
});


module.exports = SIM900SocketManager;