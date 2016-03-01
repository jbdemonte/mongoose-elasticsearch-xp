var _Promise = require('mongoose').Promise.ES6;

module.exports = {};

/**
 * Create a deferred based on a callback function
 * @param {function} [callback]
 * @returns {Object} result
 * @returns {Function} result.resolve
 * @returns {Function} result.reject
 * @returns {Function} result.callback
 * @returns {Object} [result.promise]
 */
module.exports.defer = function (callback) {
  var defer = {};
  if (typeof callback === 'function') {
    defer.resolve = function (result) {
      callback(undefined, result);
    };
    defer.reject = function (reason) {
      callback(reason);
    };
    defer.callback = callback;
  } else {
    defer.promise = new _Promise(function (resolve, reject) {
      defer.resolve = resolve;
      defer.reject = reject;
    });
    defer.callback = function (err, result) {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(result);
      }
    };
  }
  return defer;
};

/**
 * Lower case first character
 * @param {String} str
 * @returns {String}
 */
module.exports.lcFirst = function (str) {
  return str ? str[0].toLowerCase() + str.substr(1) : '';
};

/**
 * Create an object with the same keys / values
 * @param {Object} source
 * @returns {Object}
 */
module.exports.highClone = function (source) {
  var result = {};
  if (source) {
    Object.keys(source).forEach(function (key) {
      result[key] = source[key];
    });
  }
  return result;
};

/**
 * Generate the serialised object to send to ElasticSearch
 * @param {Object} document - mongoose document
 * @param {Object} mapping
 * @returns {Object}
 */
module.exports.serialize = function serialize(document, mapping) {
  var name;

  function _serializeObject(object, mappingData) {
    var serialized = {},
      field, val;
    for (field in mappingData.properties) {
      if (mappingData.properties.hasOwnProperty(field)) {
        val = serialize.call(object, object[field], mappingData.properties[field]);
        if (val !== undefined) {
          serialized[field] = val;
        }
      }
    }
    return serialized;
  }

  if (mapping.properties && document) {
    if (Array.isArray(document)) {
      return document.map(function (object) {
        return _serializeObject(object, mapping);
      });
    }
    return _serializeObject(document, mapping);
  }

  if (document && typeof document === 'object') {
    name = document.constructor.name;
    if (name === 'ObjectID') {
      return document.toString();
    }

    if (name === 'Date') {
      return new Date(document).toJSON();
    }
  }

  return document;
};
