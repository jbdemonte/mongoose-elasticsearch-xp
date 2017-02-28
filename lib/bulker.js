var EventEmitter = require('events').EventEmitter;

module.exports = Bulker;

/**
 * Bulk buffer handler
 * @param {Object} client - Elasticsearch client
 * @param {Object} [options] - bulk options
 * @param {Number} [options.delay=1000] - delay before sending the buffer when buffer is not full
 * @param {Number} [options.size=1000] - buffer size before sending without waiting delay
 * @inherits NodeJS EventEmitter http://nodejs.org/api/events.html#events_class_events_eventemitter
 * @event `error`: Emitted when bulk return an error.
 * @event `sent`: Emitted when bulk has sent a buffer.
 */
function Bulker(client, options) {
  options = options || {};

  var timeout;
  var self = this;
  var delay = options.delay || 1000;
  var size = options.size || 1000;
  var buffer = [];

  self.push = function() {
    var sending = false;
    if (arguments.length) {
      buffer.push.apply(buffer, arguments);
      sending = buffer.length >= size;
      if (sending) {
        self.flush();
      } else {
        self.delay();
      }
    }
    return sending;
  };

  self.delay = function() {
    clearTimeout(timeout);
    timeout = setTimeout(
      function() {
        self.flush();
      },
      delay
    );
  };

  self.filled = function() {
    return !!buffer.length;
  };

  self.flush = function() {
    var len = buffer.length;
    clearTimeout(timeout);
    if (len) {
      client.bulk({ body: buffer }, function(err) {
        if (err) {
          self.emit('error', err);
        } else {
          self.emit('sent', len);
        }
      });
      buffer = [];
    }
  };
}

Bulker.prototype = Object.create(EventEmitter.prototype);
Bulker.prototype.constructor = Bulker;
