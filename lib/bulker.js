'use strict';

const EventEmitter = require('events').EventEmitter;

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
  options = options || {}; // eslint-disable-line

  let timeout;
  let flushing = false;
  const self = this;
  const delay = options.delay || 1000;
  const size = options.size || 1000;
  let buffer = [];

  self.push = function() {
    let sending = false;
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
    timeout = setTimeout(() => {
      self.flush();
    }, delay);
  };

  self.filled = function() {
    return !!buffer.length;
  };

  self.isFlushing = function() {
    return flushing;
  };

  self.flush = function() {
    const len = buffer.length;
    clearTimeout(timeout);
    if (len) {
      flushing = true;
      client.bulk(
        { body: buffer },
        (err, { body, statusCode, headers, warnings }) => {
          flushing = false;
          if (err) {
            self.emit('error', err);
          } else {
            self.emit('sent', len);
          }
        }
      );
      buffer = [];
    }
  };
}

Bulker.prototype = Object.create(EventEmitter.prototype);
Bulker.prototype.constructor = Bulker;
