'use strict';

const { Client } = require('@elastic/elasticsearch');

module.exports = function(options) {
  let opts = options;

  if (Array.isArray(options.hosts)) {
    opts = options.hosts;
  }
  const newOpts = {
    node: `${opts.protocol || 'http'}://${opts.host ||
      '127.0.0.1'}:${opts.port || 9200}`,
  };
  newOpts.auth = opts.auth || null;

  const client = new Client(newOpts);

  if (opts.log) {
    client.on('error', (err, result) => {
      if (err) {
        opts.log(err);
      }
    });
  }

  return client;
};
