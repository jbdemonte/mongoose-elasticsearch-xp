var generateMapping = require('./lib/mapping').generate;
var client = require('./lib/client');
var utils = require('./lib/utils');
var Bulker = require('./lib/bulker');
var mongoose = require('mongoose');


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

    if (options.bulk) {
      options.bulker = new Bulker(options.client, options.bulk);
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
  schema.statics.esSynchronize = synchronize;

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
  var esOptions = this.esOptions();
  var defer = utils.defer(callback);
  esOptions.client.indices.refresh({index: esOptions.index, type: esOptions.type}, defer.callback);
  return defer.promise;
}

/**
 * Perform a search query on ElasticSearch
 * static function
 * @param {Object|string} query
 * @param {Object} [options]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function search(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  query = query || {};
  options = options || {};

  var self = this;
  var esOptions = self.esOptions();
  var hydrate = options.hydrate === false ? false : options.hydrate || esOptions.hydrate;

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
  if (hydrate) {
    params._source = false;
  }
  esOptions.client.search(params, function (err, result) {
    if (err) {
      return defer.reject(err);
    }
    if (!hydrate) {
      return defer.resolve(result);
    }
    if (!result.hits.total) {
      return defer.resolve(result);
    }

    var ids = result.hits.hits.map(function (hit) {
      return mongoose.Types.ObjectId(hit._id);
    });

    var select = hydrate.select || null;
    var opts = hydrate.options || null;
    var docsOnly = hydrate.docsOnly || false;


    self.find({_id: {$in: ids}}, select, opts, function (err, users) {
      if (err) {
        return defer.reject(err);
      }
      var userByIds = {};
      users.forEach(function (user) {
        userByIds[user._id] = user;
      });
      if (docsOnly) {
        result = ids.map(function (id) {
          return userByIds[id];
        });
      } else {
        result.hits.hits.forEach(function (hit) {
          hit.doc = userByIds[hit._id];
        });
      }
      return defer.resolve(result);
    });

  });

  return defer.promise;
}

/**
 * Synchronize the collection with ElasticSearch
 * static function
 * @param {Object} [conditions]
 * @param {String} [projection]
 * @param {Object} [options]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function synchronize(conditions, projection, options, callback) {
  if (typeof conditions === 'function') {
    callback = conditions;
    conditions = {};
    projection = null;
    options = null;
  } else if (typeof projection === 'function') {
    callback = projection;
    projection = null;
    options = null;
  } else if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  var model = this;
  var defer = utils.defer(callback);
  var esOptions = this.esOptions();
  var batch = esOptions.bulk && esOptions.bulk.batch ? esOptions.bulk.batch : 50;
  var stream = this.find(conditions || {}, projection, options).batchSize(batch).stream();
  var bulker = esOptions.bulker || new Bulker(esOptions.client);
  var streamClosed = false;

  function finalize() {
    bulker.removeListener('error', onError);
    bulker.removeListener('sent', onSent);
    esOptions.client.indices.refresh({index: esOptions.index}, defer.callback);
  }

  function onError(err) {
    model.emit('es-bulk-error', err);
    if (streamClosed) {
      finalize();
    } else {
      stream.resume();
    }
  }

  function onSent(len) {
    model.emit('es-bulk-sent', len);
    if (streamClosed) {
      finalize();
    } else {
      stream.resume();
    }
  }

  bulker.on('error', onError);
  bulker.on('sent', onSent);

  stream.on('data', function (doc) {
    stream.pause();
    var sending;
    if (!esOptions.filter || esOptions.filter(doc)) {
      sending = bulker.push(
        {index: {_index: esOptions.index, _type: esOptions.type, _id: doc._id.toString()}},
        utils.serialize(doc, esOptions.mapping)
      );
      model.emit('es-bulk-data', doc);
    } else {
      model.emit('es-bulk-filtered', doc);
    }
    if (!sending) {
      stream.resume();
    }
  });

  stream.on('close', function () {
    streamClosed = true;
    if (bulker.filled()) {
      bulker.flush();
    } else {
      finalize();
    }
  });

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
    var esOptions = this.schema.statics.esOptions();
    if (!esOptions.filter || esOptions.filter(doc)) {
      doc.esIndex(function (err, res) {
        doc.emit('es-indexed', err, res);
      });
    } else {
      postRemove(doc);
    }
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