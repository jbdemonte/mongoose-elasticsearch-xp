var generateMapping = require('./lib/mapping').generate;
var client = require('./lib/client');
var utils = require('./lib/utils');


module.exports = function (schema, options) {
  // clone main level of options (does not clone deeper)
  options = utils.highClone(options);

  /**
   * Retrieve model options to ElasticSearch
   * static function
   * returns {Object}
   */
  function esOptions() {
    if (!options.index) {
      options.index = this.collection.name;
    }
    if (!options.type) {
      options.type = utils.lcFirst(this.modelName);
    }

    if (!options.client) {
      options.client = client(options);
    }

    if (!options.mapping) {
      options.mapping = Object.freeze({
        properties: generateMapping(this.schema)
      });
    }

    return utils.highClone(options);
  }

  schema.statics.esOptions = esOptions;
  schema.statics.esCreateMapping = createMapping;
  schema.statics.esRefresh = refresh;
  schema.statics.esSearch = search;

  schema.methods.esIndex = indexDoc;
  schema.methods.esRemove = removeDoc;

  schema.post('save', postSave);
  schema.post('findOneAndUpdate', postSave);

  schema.post('remove', postRemove);
  schema.post('findOneAndRemove', postRemove);
};


/**
 * Map the model on ElasticSearch
 * static function
 * @param {Object} [settings]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function createMapping(settings, callback) {
  if (arguments.length < 2) {
    callback = settings;
    settings = {};
  }

  var defer = utils.defer(callback);
  var esOptions = this.esOptions();

  var mapping = {};
  mapping[esOptions.type] = esOptions.mapping;

  esOptions.client.indices.exists({index: esOptions.index}, function (err, exists) {
    if (err) {
      return defer.reject(err);
    }
    if (exists) {
      return esOptions.client.indices.putMapping(
        {
          index: esOptions.index,
          type: esOptions.type,
          body: mapping
        },
        defer.callback
      );
    }
    return esOptions.client.indices.create(
      {
        index: esOptions.index,
        body: settings
      },
      function (err) {
        if (err) {
          return defer.reject(err);
        }
        esOptions.client.indices.putMapping(
          {
            index: esOptions.index,
            type: esOptions.type,
            body: mapping
          },
          defer.callback
        );
      }
    );
  });

  return defer.promise;
}

/**
 * Explicitly refresh the model index on ElasticSearch
 * static function
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function refresh(callback) {
  var esOptions = this.schema.statics.esOptions();
  var defer = utils.defer(callback);
  esOptions.client.indices.refresh({index: esOptions.index, type: esOptions.type}, defer.callback);
  return defer.promise;
}

/**
 * Perform a search query on ElasticSearch
 * static function
 * @param {Object|string} [query]
 * @param {Object} [options]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function search(query, options, callback) {
  if (typeof query === 'function') {
    callback = query;
    options = {};
    query = {};
  }
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  query = query || {};
  options = options || {};

  var esOptions = this.schema.statics.esOptions();
  var params = {
    index: esOptions.index,
    type: esOptions.type
  };
  var defer = utils.defer(callback);

  if (typeof query === 'string') {
    params.q = query;
  } else {
    params.body = query.query ? query : {query: query};
  }
  esOptions.client.search(params, defer.callback);

  return defer.promise;
}

/**
 * Index the current document on ElasticSearch
 * document function
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function indexDoc(callback) {
  var esOptions = this.schema.statics.esOptions();
  var defer = utils.defer(callback);

  esOptions.client.index(
    {
      index: esOptions.index,
      type: esOptions.type,
      id: this._id.toString(),
      body: utils.serialize(this, esOptions.mapping)
    },
    defer.callback
  );

  return defer.promise;
}

/**
 * Remove the current document from ElasticSearch
 * document function
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function removeDoc(callback) {
  var esOptions = this.schema.statics.esOptions();
  var defer = utils.defer(callback);
  deleteByMongoId(esOptions, this, defer.callback, 3);
  return defer.promise;
}

/**
 * Delete one document on ElasticSearch
 * Internal
 * @param {Object} options
 * @param {Object} document
 * @param {Function} callback
 * @param {Number} retry
 */
function deleteByMongoId(options, document, callback, retry) {
  options.client.delete(
    {
      index: options.index,
      type: options.type,
      id: document._id.toString()
    },
    function (err) {
      if (err && err.message.indexOf('404') > -1) {
        if (retry && retry > 0) {
          setTimeout(function () {
            deleteByMongoId(options, document, callback, retry - 1);
          }, 500);
        } else {
          callback(err);
        }
      } else {
        callback(err);
      }
    }
  );
}

/**
 * Post save document handler
 * internal
 * @param {Object} doc
 */
function postSave(doc) {
  if (doc) {
    doc.esIndex(function (err, res) {
      doc.emit('es-indexed', err, res);
    });
  }
}

/**
 * Post remove document handler
 * internal
 * @param {Object} doc
 */
function postRemove(doc) {
  if (doc) {
    doc.esRemove(function (err, res) {
      doc.emit('es-removed', err, res);
    });
  }
}