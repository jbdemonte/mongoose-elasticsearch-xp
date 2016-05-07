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
      options.type = utils.lcFirst(this.modelName || this.constructor.modelName);
    }

    if (!options.index || !options.type) {
      throw new Error(options.index ? 'Missing model name to build ES type' : 'Missing collection name to build ES index');
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
  schema.statics.esCount = count;

  schema.methods.esOptions = esOptions;
  schema.methods.esIndex = indexDoc;
  schema.methods.esUnset = unsetFields;
  schema.methods.esRemove = removeDoc;

  schema.pre('save', preSave);
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
  if (typeof settings === 'function') {
    callback = settings;
    settings = null;
  }
  var self = this;
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();

    settings = settings || esOptions.mappingSettings || {};

    var mapping = {};
    mapping[esOptions.type] = esOptions.mapping;

    esOptions.client.indices.exists({index: esOptions.index}, function (err, exists) {
      if (err) {
        return reject(err);
      }
      if (exists) {
        return esOptions.client.indices.putMapping(
          {
            index: esOptions.index,
            type: esOptions.type,
            body: mapping
          },
          function (err, result) {
            return err ? reject(err) : resolve(result);
          }
        );
      }
      return esOptions.client.indices.create(
        {
          index: esOptions.index,
          body: settings
        },
        function (err) {
          if (err) {
            return reject(err);
          }
          esOptions.client.indices.putMapping(
            {
              index: esOptions.index,
              type: esOptions.type,
              body: mapping
            },
            function (err, result) {
              return err ? reject(err) : resolve(result);
            }
          );
        }
      );
    });
  });
}

/**
 * Explicitly refresh the model index on ElasticSearch
 * static function
 * @param {Object} [options]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function refresh(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  var self = this;
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    var refreshDelay = options.refreshDelay === false ? 0 : options.refreshDelay || esOptions.refreshDelay;
    esOptions.client.indices.refresh({
      index: esOptions.index,
      type: esOptions.type
    },
    function (err, result) {
      setTimeout(function () {
        return err ? reject(err) : resolve(result);
      }, refreshDelay);
    });
  });
}

/**
 * Perform a count query on ElasticSearch
 * static function
 * @param {Object|string} query
 * @param {Object} [options]
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function count(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  query = query || {};
  options = options || {};
  var self = this;
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    var countOnly = options.countOnly === false ? false : options.countOnly || esOptions.countOnly;
    var params = {
      index: esOptions.index,
      type: esOptions.type
    };
    if (typeof query === 'string') {
      params.q = query;
    } else {
      params.body = query.query ? query : {query: query};
    }
    esOptions.client.count(params, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(countOnly ? result.count : result);
      }
    });
  });
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
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    var hydrate = options.hydrate === false ? false : options.hydrate || esOptions.hydrate;
    var idsOnly = options.idsOnly === false ? false : options.idsOnly || esOptions.idsOnly;

    var params = {
      index: esOptions.index,
      type: esOptions.type
    };

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
        return reject(err);
      }

      if (!hydrate && !idsOnly) {
        return resolve(result);
      }

      var ids = result.hits.hits.map(function (hit) {
        return mongoose.Types.ObjectId(hit._id);
      });

      if (idsOnly) {
        return resolve(ids);
      }

      var select = hydrate.select || null;
      var opts = hydrate.options || null;
      var docsOnly = hydrate.docsOnly || false;

      if (!result.hits.total) {
        return resolve(docsOnly ? [] : result);
      }


      self.find({_id: {$in: ids}}, select, opts, function (err, users) {
        if (err) {
          return reject(err);
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
        return resolve(result);
      });

    });
  });
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
  return utils.run(callback, function (resolve, reject) {
    var esOptions = model.esOptions();
    var batch = esOptions.bulk && esOptions.bulk.batch ? esOptions.bulk.batch : 50;
    var stream = model.find(conditions || {}, projection, options).batchSize(batch).stream();
    var bulker = esOptions.bulker || new Bulker(esOptions.client);
    var streamClosed = false;

    function finalize() {
      bulker.removeListener('error', onError);
      bulker.removeListener('sent', onSent);
      esOptions.client.indices.refresh(
        {index: esOptions.index},
        function (err, result) {
          return err ? reject(err) : resolve(result);
        }
      );
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
  });
}

/**
 * Index the current document on ElasticSearch
 * document function
 * @param {Boolean|Object} [update] default false
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function indexDoc(update, callback) {
  var self = this;
  if (typeof update === 'function') {
    callback = update;
    update = false;
  }
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    var body = utils.serialize(self, esOptions.mapping);
    if (update && update.unset) {
      (typeof update.unset === 'string' ? [update.unset] : update.unset).forEach(function (field) {
        body[field] = null;
      });
    }
    esOptions.client[update ? 'update' : 'index'](
      {
        index: esOptions.index,
        type: esOptions.type,
        id: self._id.toString(),
        body: update ? {doc: body}: body
      },
      function (err, result) {
        return err ? reject(err) : resolve(result);
      }
    );
  });
}

/**
 * Unset some fields from the current document
 * @param {String|Array} fields to unset
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function unsetFields(fields, callback) {
  var self = this;
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    var body;

    if (typeof fields === 'string') {
      fields = [fields];
    }

    if (esOptions.script) {
      body = {
        script: fields.map(function (field) {
          return 'ctx._source.remove("' + field + '")';
        }).join(';')
      };
    } else {
      body = {doc: {}};
      fields.forEach(function (field) {
        body.doc[field] = null;
      });
    }

    esOptions.client.update(
      {
        index: esOptions.index,
        type: esOptions.type,
        id: self._id.toString(),
        body: body
      },
      function (err, result) {
        return err ? reject(err) : resolve(result);
      }
    );
  });
}

/**
 * Remove the current document from ElasticSearch
 * document function
 * @param {Function} [callback]
 * @returns {Promise|undefined}
 */
function removeDoc(callback) {
  var self = this;
  return utils.run(callback, function (resolve, reject) {
    var esOptions = self.esOptions();
    deleteByMongoId(
      esOptions,
      self,
      function (err, result) {
        return err ? reject(err) : resolve(result);
      },
      3
    );
  });
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
 * Pre save document handler
 * internal
 * @param {Function} next
 */
function preSave(next) {
  this._mexp = {
    wasNew: this.isNew
  };
  if (!this.isNew) {
    this._mexp.unset = utils.getUndefineds(this, this.esOptions().mapping);
  }
  next();
}

/**
 * Post save document handler
 * internal
 * @param {Object} doc
 */
function postSave(doc) {
  if (doc) {
    var data = doc._mexp;
    var esOptions = this.esOptions();
    delete doc._mexp;
    if (!esOptions.filter || esOptions.filter(doc)) {
      doc
        .esIndex(data.wasNew ? false : {unset: data.unset})
        .then(function (res) {
          if (esOptions.script && data.unset && data.unset.length) {
            return doc.esUnset(data.unset);
          }
          return res;
        })
        .then(function (res) {
          doc.emit('es-indexed', undefined, res);
          doc.constructor.emit('es-indexed', undefined, res);
        })
        .catch(function (err) {
          doc.emit('es-indexed', err);
          doc.constructor.emit('es-indexed', err);
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
      doc.constructor.emit('es-removed', err, res);
    });
  }
}