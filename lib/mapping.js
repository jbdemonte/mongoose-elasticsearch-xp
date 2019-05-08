'use strict';

const utils = require('./utils');

module.exports = {};

module.exports.generate = generate;

/**
 * Generate mapping
 * @param {Object} schema - mongoose schema
 * @param {integer} [version]
 * @returns {Object}
 */
function generate(schema, version) {
  const mapping = {};
  const typeKey = getTypeKey(schema);
  const explicit = hasExplicit(schema, typeKey);
  const defaultTypes = getDefault(version);

  Object.keys(schema.paths).forEach(name => {
    // ignore _id because is used as index
    if (name === '_id') {
      return;
    }

    const path = schema.paths[name];
    const type = utils.getType(path);
    const options = getOptions(path, typeKey);

    if (
      explicit &&
      isEmbedded(type) &&
      !{}.hasOwnProperty.call(options, 'es_indexed')
    ) {
      options.es_indexed = hasExplicit(path.schema, typeKey);
    }

    if (explicit && !options.es_indexed) {
      return;
    }

    let current = mapping;
    const names = name.split('.');

    // handle plain object
    if (names.length > 1) {
      names.forEach((name, index) => {
        if (index === names.length - 1) {
          // last item is the target
          current = current[name] = { type };
        } else {
          if (!current[name]) {
            current[name] = { type: 'object', properties: {} };
          }
          current = current[name].properties;
        }
      });
    } else {
      current = mapping[name] = { type };
    }

    if (options.es_type && typeof options.es_type === 'object') {
      current.type = 'object';
      current.properties = generateESTypeMapping(options.es_type);
    } else {
      if (!{}.hasOwnProperty.call(options, 'es_value') || !options.es_type) {
        if (isEmbedded(type)) {
          current.type = 'object';
          current.properties = generate(path.schema, version);
        }
        if (defaultTypes[type]) {
          current.type = defaultTypes[type];
        }
      }

      // propagate es_ options from schema to mapping
      Object.keys(options).forEach(key => {
        if (key !== 'es_indexed' && key.substr(0, 3) === 'es_') {
          current[key.substr(3)] = options[key];
        }
      });
    }

    if ({}.hasOwnProperty.call(options, 'es_value')) {
      current.value =
        typeof options.es_value === 'function'
          ? options.es_value
          : function() {
              return options.es_value;
            };
    }
  });

  delete mapping[schema.get('versionKey')];

  if (schema.options && schema.options.es_extend) {
    Object.assign(
      mapping,
      generateESTypeMapping(schema.options.es_extend, true)
    );
  }

  return mapping;
}

function isEmbedded(type) {
  return type === 'embedded' || type === 'array'; // || type === 'mixed';
}

function getTypeKey(schema) {
  return schema.options.typeKey || 'type';
}

function hasExplicit(schema, typeKey) {
  return schema && schema.paths
    ? Object.keys(schema.paths).some(name => {
        if (name === '_id') {
          return; // eslint-disable-line
        }
        const path = schema.paths[name];
        const type = utils.getType(path);
        if (isEmbedded(type)) {
          if (hasExplicit(path.schema, getTypeKey(path.schema))) {
            return true;
          }
        }
        return {}.hasOwnProperty.call(getOptions(path, typeKey), 'es_indexed');
      })
    : false;
}

function getOptions(path, typeKey) {
  if (
    Array.isArray(path.options[typeKey]) &&
    path.options[typeKey].length === 1 &&
    path.options[typeKey][0].ref
  ) {
    return path.options[typeKey][0];
  }
  return path.options;
}

function generateESTypeMapping(content, esExtendMode) {
  const properties = {};
  // browse properties
  Object.keys(content).forEach(key => {
    if (content[key] && typeof content[key] === 'object') {
      // only browse well formed object
      properties[key] = {};
      if (content[key].es_type && typeof content[key].es_type === 'object') {
        properties[key].type = 'object';
        properties[key].properties = generateESTypeMapping(
          content[key].es_type,
          esExtendMode
        );
      } else {
        Object.keys(content[key]).forEach(subkey => {
          const targetSubkey = subkey.replace(/^es_/, ''); // remove plugin prefix
          let value = content[key][subkey];
          const original = value;

          // build a function to be ignored in the mapping sent
          if (subkey === 'es_value' && esExtendMode) {
            value = function(_, context) {
              // serialised function of es_value handle prototype (value, context) where value is always undefined in options.es_extend feature
              return typeof original === 'function'
                ? original(context.document)
                : original;
            };
          }

          properties[key][targetSubkey] = value;
        });
      }
    }
  });
  return properties;
}

/**
 * Return default type mapping depending on Elasticsearch version
 * @param {number} version
 * @return {object}
 */
function getDefault(version) {
  if (version === 2) {
    return {
      objectid: 'string',
      number: 'double',
      mixed: 'object',
    };
  }
  if (version === 5 || version === 6) {
    return {
      objectid: 'keyword',
      number: 'double',
      mixed: 'object',
      string: 'text',
    };
  }
  if (version === 7) {
    return {
      objectid: 'keyword',
      number: 'long',
      mixed: 'object',
      string: 'text',
    };
  }
}
