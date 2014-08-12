var Duplex = require('stream'),
    uartCommander = require('uart-commander'),
    inherits = require('util').inherits;

function SIM900Socket(options) {
   Duplex.apply(this, arguments);

   this._uart = options.uart;
   this._index = -1;
   this._state = 'uninitialized';

   this._readBuffer = [];
   this._readBuffering = true;
   this._localIP = options.manager.localIP;

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

SIM900Socket.prototype.connect = function(port, host, listener){

   var idx = this.id, self = this;

   if (idx == -1) {
      // FIXME add deferred processing
      throw 'Invalid state. Socket is uinitialized';
   }

   if (typeof port == 'string') {
      this.emit('error', 'Connect to unix socket in unsupported');
      this.emit('close', true);
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

      uartCommander(this._uart, function(){
         on('timeout', function(){
            self.emit('error', 'timeout');
            self.emit('close', true)
         });
         at('+CIPSTART=' + idx + ',"TCP","' + host + '","' + port + '"');
         wait('OK');
         timeout(10000);
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
         })
      })
   }
};
SIM900Socket.prototype.destroy = function(){
   this._readBuffer.length = 0;
   this._readBuffering = true;
};
SIM900Socket.prototype.setTimeout = function(){};

SIM900Socket.prototype.setNoDelay = function(){
   console.warn("Ignoring call to setNoDelay. TCP_NODELAY socket option not supported.");
};

SIM900Socket.prototype.setKeepAlive = function(){};

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

SIM900Socket.prototype._write = function(chunk, encoding, callback){
   if (this._state == 'uninitialized') {
      throw 'Invalid state. No id set';
   }
   var idx = this.id,
      self = this;
   uartCommander(this._uart, function(){
      on('timeout', callback);
      at('+CIPSEND=' + idx + ',' + chunk.length);
      write(chunk);
      timeout(10000);
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
   return new RegExp('(?:' + this.id + ',' + op + ' (OK|FAIL)|\\+CME ERROR ([^\\n]+))$')
};

Object.defineProperty(SIM900Socket, 'bufferSize', {
   get: function() {

   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'remoteAddress', {
   get: function() {

   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'remotePort', {
   get: function() {

   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'localAddress', {
   get: function() {
      return this._localIP;
   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'localPort', {
   get: function() {
      return 0;
   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'bytesRead', {
   get: function() {
      return 0;
   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'bytesWritten', {
   get: function() {
      return 0;
   },
   writable: false
});

// Own properties

Object.defineProperty(SIM900Socket, 'state', {
   get: function() {
      return this._state;
   },
   writable: false
});

Object.defineProperty(SIM900Socket, 'id', {
   get: function() {
      return this._index;
   },
   set: function(id) {
      if (this._index == -1) {
         this._index = id;
         this._state = 'idle';
      } else {
         throw 'Socket already has an index';
      }
   }
});

module.exports = SIM900Socket;
