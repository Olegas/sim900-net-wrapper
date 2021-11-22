var Duplex = require('stream').Duplex,
    uartCommander = require('uart-commander'),
    inherits = require('util').inherits;

function SIM900Socket(options) {
   Duplex.call(this, {});

   this._uart = options.uart;
   this._index = -1;
   this._state = 'uninitialized';

   this._readBuffer = [];
   this._readBuffering = true;
   this._localIP = options.manager.localIP;
   this._port = undefined;
   this._host = undefined;

   this.on('error', function(e) {
      console.log(e);
   });

   options.manager.on('data', function(idxFor, chunk){
      if (idxFor == this._index) {
         if (this._readBuffering) {
            this._readBuffer.push(chunk);
         } else {
            this._readBuffering = !this.push(chunk);
         }
      }
   }.bind(this));

   options.manager.on('end', function(idxFor){
      if (idxFor == this._index) {
         this.emit('end');
         this.emit('close');
         this._state = 'closed';
      }
   }.bind(this));
}

inherits(SIM900Socket, Duplex);

SIM900Socket.prototype._connect = function() {

   var self = this;

   uartCommander(this._uart, function(){
      on('timeout', function(){
         self.emit('error', 'timeout');
         self.emit('close', true)
      });
      rawmode();
      at('+CIPSTART=' + self._index + ',"TCP","' + self._host + '","' + self._port + '"');
      wait('OK');
      timeout();
      // FIXME ignored ALREADY CONNECT error!
      wait(self._mkWaitRegexp('CONNECT'));
      perform(function(line, match, state, cmeError){
         if (state == 'FAIL' || cmeError) {
            self.emit('error', state || cmeError);
            self.emit('close', true);
         } else {
            self._state = 'connected';
            self.emit('connect', self);
         }
      });
   })
};

SIM900Socket.prototype.connect = function(port, host, listener){

   this._port = port;
   this._host = host;

   if (typeof port == 'string') {
      this.emit('error', 'Connect to unix socket in unsupported');
      this.emit('close', true);
      return;
   } else {
      if (typeof host == 'function') {
         listener = host;
         host = '';
      }

      if (!host) {
         host = 'localhost';
      }

      if (typeof listener == 'function') {
         this.on('connect', listener);
      }
   }

   this._host = host;
   this._port = port;

   if (this._state == 'idle') {
      this._connect();
   }
};

SIM900Socket.prototype.destroy = function(){
   this._readBuffer.length = 0;
   this._readBuffering = true;
};

SIM900Socket.prototype.setTimeout = function(){
   console.warn("Ignoring call to setTimeout.");
};

SIM900Socket.prototype.setNoDelay = function(){
   console.warn("Ignoring call to setNoDelay.");
};

SIM900Socket.prototype.setKeepAlive = function(){
   console.warn("Ignoring call to setKeepAlive.");
};

SIM900Socket.prototype.address = function(){
   // We really don't know the port value
   return {
      port: 0,
      family: 'IPv4',
      address: this._localIP
   };
};

SIM900Socket.prototype.unref = function(){};
SIM900Socket.prototype.ref = function(){};

// TODO write to disconnected socket?
SIM900Socket.prototype._write = function(chunk, encoding, callback){
   if (this._state == 'uninitialized') {
      throw 'Invalid state. No id set';
   }
   var idx = this.getId(),
      self = this;
   uartCommander(this._uart, function(){
      on('timeout', callback);
      rawmode();
      timeout();
      at('+CIPSEND=' + idx + ',' + chunk.length);
      wait('>');
      write(chunk);
      wait(self._mkWaitRegexp('SEND'));
      perform(function(line, match, match0, match1){
         if (match0 == 'FAIL' || match1) {
            callback(match0 || match1);
         } else {
            callback();
         }
      })
   })
};

SIM900Socket.prototype._read = function(){
   this._readBuffering = false;
   while(this._readBuffer.length && !this._readBuffering) {
      this._readBuffering = !this.push(this._readBuffer.shift());
   }
};

SIM900Socket.prototype._mkWaitRegexp = function(op) {
   return new RegExp('(?:' + this.getId() + ', ' + op + ' (OK|FAIL)|\\+CME ERROR ([^\\n]+))');
};
/*
Object.defineProperty(SIM900Socket.prototype, 'bufferSize', {
   get: function() {

   }
});

Object.defineProperty(SIM900Socket.prototype, 'remoteAddress', {
   get: function() {
      return this._host;
   }
});

Object.defineProperty(SIM900Socket.prototype, 'remotePort', {
   get: function() {
      return this._port;
   }
});

Object.defineProperty(SIM900Socket.prototype, 'localAddress', {
   get: function() {
      return this._localIP;
   }
});

Object.defineProperty(SIM900Socket.prototype, 'localPort', {
   get: function() {
      return 0;
   }
});

Object.defineProperty(SIM900Socket.prototype, 'bytesRead', {
   get: function() {
      return 0;
   }
});

Object.defineProperty(SIM900Socket.prototype, 'bytesWritten', {
   get: function() {
      return 0;
   }
});
*/
// Own properties

SIM900Socket.prototype.getState = function() {
   return this._state;
};

SIM900Socket.prototype.getId = function() {
   return this._index;
};

SIM900Socket.prototype.setId = function(id) {
   if (this._index == -1) {
      this._index = id;
      this._state = 'idle';
      if (this._host && this._port) {
         this._connect();
      }
   } else {
      throw 'Socket already has an index';
   }
};

module.exports = SIM900Socket;
