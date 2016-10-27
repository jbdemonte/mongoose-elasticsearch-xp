module.exports = {};

module.exports.generate = generate;

var defaultTypes = {
  objectid: 'string',
  number: 'double',
  mixed: 'object'
};

/**
 * Generate mapping
 * @param {Object} schema - mongoose schema
 * @returns {Object}
 */
function generate(schema) {
  var mapping = {};
  var explicit = hasExplicit(schema);

  Object.keys(schema.paths).forEach(function (name) {

    // ignore _id because is used as index
    if (name === '_id') {
      return;
    }

    var path = schema.paths[name];
    var type = (path.caster && path.caster.instance ? path.caster.instance : path.instance).toLowerCase();

    if (explicit && isEmbedded(type) && (!path.options.hasOwnProperty('es_indexed'))) {
      path.options.es_indexed = hasExplicit(path.schema);
    }

    if (explicit && !path.options.es_indexed) {
      return;
    }

    var current = mapping;
    var names = name.split('.');

    // handle plain object
    if (names.length > 1) {
      names.forEach(function (name, index) {
        if (index === names.length - 1) { // last item is the target
          current = current[name] = {type: type};
        } else {
          if (!current[name]) {
            current[name] = {type: 'object', properties: {}};
          }
          current = current[name].properties;
        }
      });
    } else {
      current = mapping[name] = {type: type};
    }

    if (path.options.es_type && typeof path.options.es_type === 'object') {
      current.type = 'object';
      current.properties = generateESTypeMapping(path.options.es_type);
    } else {
      if (!path.options.es_cast || !path.options.es_type) {
        if (isEmbedded(type)) {
          current.type = 'object';
          current.properties = generate(path.schema);
        }
        if (defaultTypes[type]) {
          current.type = defaultTypes[type];
        }
      }

      // propagate es_ options from schema to mapping
      Object.keys(path.options).forEach(function (key) {
        if (key !== 'es_indexed' && key.substr(0, 3) === 'es_') {
          current[key.substr(3)] = path.options[key];
        }
      });
    }

  });

  delete mapping[schema.get('versionKey')];

  if (schema.options && schema.options.es_fields) {
    Object.assign(mapping, generateESTypeMapping(schema.options.es_fields, true));
  }

  return mapping;
}

function isEmbedded(type) {
  return type === 'embedded' || type === 'array' || type === 'mixed';
}

function hasExplicit(schema) {
  return schema && schema.paths ? Object.keys(schema.paths).some(function (name) {
    if (name === '_id') {
      return;
    }
    var path = schema.paths[name];
    var type = (path.caster && path.caster.instance ? path.caster.instance : path.instance).toLowerCase();
    if (isEmbedded(type)) {
      if (hasExplicit(path.schema)) {
        return true;
      }
    }
    return path.options.hasOwnProperty('es_indexed');
  }) : false;
}

function generateESTypeMapping(content, esCompleteMode) {
  var properties = {};
  // browse properties
  Object.keys(content).forEach(function (key) {
    if (content[key] && typeof content[key] === 'object') { // only browse well formed object
      properties[key] = {};
      if (content[key].es_type && typeof content[key].es_type === 'object') {
        properties[key].type = 'object';
        properties[key].properties = generateESTypeMapping(content[key].es_type, esCompleteMode);
      } else {
        Object.keys(content[key]).forEach(function (subkey) {
          var targetSubkey = subkey.replace(/^es\_/, ''); // remove plugin prefix
          var value = content[key][subkey];
          var original = value;

          // build a function to be ignored in the mapping sent
          if (subkey === 'es_value' && esCompleteMode) {
            value = function (_, context) {
              // serialised function of es_value handle prototype (value, context) where value is always undefined in options.es_fields feature
              return typeof original === 'function' ? original(context.document) : original;
            };
          }

          properties[key][targetSubkey] = value;
        });
      }
    }
  });
  return properties;
}