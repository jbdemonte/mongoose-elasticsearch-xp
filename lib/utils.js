'use strict';

const mongoose = require('mongoose');

const _Promise = mongoose.Promise.ES6 || global.Promise;

module.exports = {};

/**
 * Promify
 * @param {Function} [callback]
 * @param {Function} fn - Function to execute
 * @returns {Promise|undefined}
 */
module.exports.run = function(callback, fn) {
  if (typeof callback === 'function') {
    try {
      fn(
        result => {
          callback(undefined, result);
        },
        reason => {
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
module.exports.lcFirst = function(str) {
  return str ? str[0].toLowerCase() + str.substr(1) : '';
};

/**
 * Create an object with the same keys / values
 * @param {Object} source
 * @returns {Object}
 */
module.exports.highClone = function(source) {
  const result = {};
  if (source) {
    Object.keys(source).forEach(key => {
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
module.exports.getUndefineds = function getUndefineds(document, mapping) {
  let field;
  const result = [];
  for (field in mapping.properties) {
    if ({}.hasOwnProperty.call(mapping.properties, field)) {
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
 * @param {Object} [main] - main mongoose document
 * @returns {Object}
 */
module.exports.serialize = function serialize(document, mapping, main) {
  let name;

  main = main || document; // eslint-disable-line

  function _serializeObject(object, mappingData) {
    const serialized = {};
    Object.keys(mappingData.properties).forEach(field => {
      let value;
      const property = mappingData.properties[field];
      try {
        if ({}.hasOwnProperty.call(property, 'value')) {
          value =
            typeof property.value === 'function'
              ? property.value(object[field], {
                  document: main,
                  container: object,
                  field,
                })
              : property.value;
        } else if (object[field] !== undefined) {
          value = serialize.call(object, object[field], property, main);
        }
        if (value !== undefined) {
          serialized[field] = value;
        }
      } catch (err) {
        // do nothing
      }
    });
    if (
      !Object.keys(serialized).length &&
      (typeof object !== 'object' || object instanceof mongoose.Types.ObjectId)
    ) {
      return;
    }
    return serialized;
  }

  if (mapping.properties && document) {
    if (Array.isArray(document)) {
      return document.map(object => _serializeObject(object, mapping));
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

/**
 * Return the Type of a schema path
 * @param {object} path
 * @return {string}
 */
module.exports.getType = function getType(path) {
  return (path.caster && path.caster.instance
    ? path.caster.instance
    : path.instance
  ).toLowerCase();
};
