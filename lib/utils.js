var mongoose = require('mongoose');
var _Promise = mongoose.Promise.ES6;

module.exports = {};

/**
 * Promify
 * @param {Function} [callback]
 * @param {Function} fn - Function to execute
 * @returns {Promise|undefined}
 */
module.exports.run = function (callback, fn) {
  if (typeof callback === 'function') {
    try {
      fn(
        function (result) {
          callback(undefined, result);
        },
        function (reason) {
          callback(reason);
        }
      );
    } catch (err) {
      callback(err);
    }
  } else {
    return new _Promise(fn);
  }
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
 * Return updated fields to undefined
 * @param {Object} document
 * @param {Object} mapping
 * @returns {Array}
 */
module.exports.getUndefineds = function serialize(document, mapping) {
  var field, result = [];
  for (field in mapping.properties) {
    if (mapping.properties.hasOwnProperty(field)) {
      if (document[field] === undefined && document.isModified(field)) {
        result.push(field);
      }
    }
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
        if (object[field] !== undefined) {
          val = serialize.call(object, object[field], mappingData.properties[field]);
          if (val !== undefined) {
            serialized[field] = val;
          }
        }
      }
    }
    if (!Object.keys(serialized).length && (typeof object !== 'object' || object instanceof mongoose.Types.ObjectId)) {
      return ;
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
    if (name === 'model') {
      return document.id;
    }

    if (name === 'ObjectID') {
      return document.toString();
    }

    if (name === 'Date') {
      return new Date(document).toJSON();
    }
  }

  return document;
};
