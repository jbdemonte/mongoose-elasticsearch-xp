# mongoose-elasticsearch-xp

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coverage-image]][coverage-url]

mongoose-elasticsearch-xp is a [mongoose](http://mongoosejs.com/) plugin that can automatically index your models into [elasticsearch](http://www.elasticsearch.org/).
This plugin is compatible with Elasticsearch version 2,5,6 and 7.

- [Prerequisite](#prerequisite)
- [Why this plugin?](#why-this-plugin)
- [Installation](#installation)
- [Setup](#setup)
- [Indexing](#indexing)
  - [Saving a document](#saving-a-document)
  - [Indexing Nested Models](#indexing-nested-models)
  - [Indexing Populated Models](#indexing-populated-models)
  - [Indexing an existing collection](#indexing-an-existing-collection)
  - [Filtered indexing](#filtered-indexing)
  - [Indexing on demand](#indexing-on-demand)
  - [Unsetting fields](#unsetting-fields)
  - [Adding fields](#adding-fields)
  - [Change fields value](#change-fields-value)
  - [Using with mongoose discriminators](#using-with-mongoose-discriminators)
- [Mapping](#mapping)
  - [Creating mappings on-demand](#creating-mappings-on-demand)
- [Queries](#queries)
  - [Hydration](#hydration)
    - [Hydration with population](#hydration-with-population)
  - [Getting only Ids](#getting-only-ids)
- [Count](#count)
  - [Getting only count value](#getting-only-count-value)
- [Refreshing model index](#refreshing-model-index)

## Prerequisite

mongoose-elasticsearch-xp requires:

  - mongoose 4.9.0, 5.0.0 or later
  - @elastic/elasticsearch 7.0 or later

## Why this plugin?

Although mongoosastic is a great tool, it didn't fit my needs. I needed something more flexible and up to date than mongoosastic.  
I started by sending some pull requests to mongoosastic. When I was facing to a full rewrite need, I choosed to start a new project based on the mongoosastic idea / syntax.  
This plugin handle both callback and promise syntaxes. It uses the mongoose Promise which can be [redefined](http://mongoosejs.com/docs/promises.html#plugging-in-your-own-promises-library)

## Installation

The latest version of this package will be as close as possible to the latest `elasticsearch` and `mongoose` packages.

```bash
npm install --save mongoose-elasticsearch-xp
```

## Important

This plugin is configured to work with the latest version (7.x.y).
In order to use it with Elasticsearch 2.x.y, you need to use the `v2` version:

It is **very strongly** recommended to fix your version by using the require with the elastic
to prevent breaking changes

```javascript
var mexp = require('mongoose-elasticsearch-xp').v2;
```

Likewise for `.v5`, `.v6`, and `.v7`, `v5` is default for now.

The examples below use the version 5 syntax.

## Limitation

  - This plugin requires mongoose object to be indexed, not lean object
  - Indexing using findOneAndUpdate requires `{new: true}` as options to be updated, else previous data will be saved

## Setup

### Model.plugin(mongoose-elasticsearch-xp, options)

Options are:

* `index` - the index in Elasticsearch to use. Defaults to the collection name.
* `type`  - the type this model represents in Elasticsearch. Defaults to the model name. It may be a function `(modelName) => typeName`.
* `client` - an existing Elasticsearch `Client` instance.
* `hosts` - an array hosts Elasticsearch is running on.
* `host` - the host Elasticsearch is running on.
* `port` - the port Elasticsearch is running on.
* `auth` - the authentication needed to reach Elasticsearch server. In the standard format of 'username:password'.
* `protocol` - the protocol the Elasticsearch server uses. Defaults to http.
* `hydrate` - whether or not to replace ES source by mongo document.
* `filter` - the function used for filtered indexing.
* `transform` - the function used for transforming a document before indexing it, accepts the document as an argument, expects transformed document to be returned (if returned value is falsy, the original document will be used).
* `idsOnly` - whether or not returning only mongo ids in `esSearch`.
* `countOnly` - whether or not returning only the count value in `esCount`.
* `mappingSettings` - default settings to use with `esCreateMapping`.
* `refreshDelay` - time in ms to wait after `esRefresh`. Defaults to 0.
* `script` - whether or not the inline script are enabled in elasticsearch. Defaults to false.
* `bulk` - options to use when synchronising.
* `bulk.batch` - [batchSize](https://docs.mongodb.com/manual/reference/method/cursor.batchSize/) to use on synchronise options. Defaults to 50.
* `bulk.size` - bulk element count to wait before calling `client.bulk` function. Defaults to 1000.
* `bulk.delay` - idle time to wait before calling the `client.bulk` function. Defaults to 1000.
* `onlyOnDemandIndexing` - whether or not to demand indexing on CRUD operations. If set to true middleware hooks for save, update, delete do not fire. Defaults to false.

To have a model indexed into Elasticsearch simply add the plugin.

```javascript
var mongoose = require('mongoose');
var mexp = require('mongoose-elasticsearch-xp');

var UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    city: String
});

UserSchema.plugin(mexp);

var User = mongoose.model('User', UserSchema);
```

This will by default simply use the collection name as the index while using the model name itself as the type.
So if you create a new User object and save it, you can see it by navigating to http://localhost:9200/users/user/_search
(this assumes Elasticsearch is running locally on port 9200).

The default behavior is all fields get indexed into Elasticsearch.
This can be a little wasteful especially considering that the document is now just being duplicated between mongodb and Elasticsearch so you should consider opting to index only certain fields by specifying `es_indexed` on the fields you want to store:


```javascript
var UserSchema = new mongoose.Schema({
    name: {type: String, es_indexed: true},
    email: String,
    city: String
});

UserSchema.plugin(mexp);

var User = mongoose.model('User', UserSchema);
```

In this case only the name field will be indexed for searching.

Now, by adding the plugin, the model will have a new method called `esSearch` which can be used to make simple to complex searches.  
The `esSearch` method accepts [standard Elasticsearch query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)

```javascript
User
  .esSearch({
    query_string: {
      query: "john"
    }
  })
  .then(function (results) {
    // results here
  });
```

The `esSearch` also handle the full Elasticsearch ...

```javascript
User
  .esSearch({
    bool: {
      must: {
        match_all: {}
      },
      filter: {
        range: {
          age: {lt: 35}
        }
      }
    }
  })
  .then(function ({ body }) {
    // results here
  });
```
... and Lucene syntax:

```javascript
User
  .esSearch("name:john")
  .then(function (results) {
    // results here
  });
```

To connect to more than one host, you can use an array of hosts.

```javascript
MyModel.plugin(mexp, {
  hosts: [
    'localhost: 9200',
    'anotherhost: 9200'
  ]
})
```

Also, you can re-use an existing Elasticsearch `Client` instance

```javascript
var esClient = new Client({node: 'http://localhost:9200'});

MyModel.plugin(mexp, {
  client: esClient
});
```


## Indexing

### Saving a document
The indexing takes place after saving inside the mongodb and is a deferred process.
One can check the end of the indexion catching `es-indexed` event.
This event is emitted both from the document and the model (which make unit tests easier).

```javascript
doc.save(function (err) {
  if (err) throw err;
  /* Document indexation on going */
  doc.on('es-indexed', function (err, res) {
    if (err) throw err;
    /* Document is indexed */
    });
  });
```


### Indexing Nested Models
In order to index nested models you can refer following example.

```javascript
var CommentSchema = new mongoose.Schema({
    title: String,
    body: String,
    author: String
});

var UserSchema = new mongoose.Schema({
    name: {type: String, es_indexed: true},
    email: String,
    city: String,
    comments: {type: [CommentSchema], es_indexed: true}
});

UserSchema.plugin(mexp);

var User = mongoose.model('User', UserSchema);
```


### Indexing Populated Models
To index populated models (`ref` model), it is mandatory to provide a schema to explain what to index in the `es_type` key.
**This plugin will never populate** models by its own, **you have to populate** the models.

```javascript
var CountrySchema = new mongoose.Schema({
    name: String,
    code: String
});

var Country = mongoose.model('Country', CountrySchema);

var CitySchema = new mongoose.Schema({
    name: String,
    pos: {
        type: [Number],
        index: '2dsphere'
    },
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Country'
    }
});

var City = mongoose.model('City', CitySchema);

var UserSchema = new mongoose.Schema({
    name: String,
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
        es_type: {
            name: {
                es_type: 'string'
            },
            pos: {
                es_type: 'geo_point'
            },
            country: {
                es_type: {
                    name: {
                        es_type: 'string'
                    },
                    code: {
                        es_type: 'string'
                    }
                }
            }
        }
    }
});

UserSchema.plugin(mexp);

var User = mongoose.model('User', UserSchema);
```


### Indexing An Existing Collection
Already have a mongodb collection that you'd like to index using this plugin?
No problem! Simply call the `esSynchronize` method on your model to open a mongoose stream and start indexing documents individually.

```javascript
var BookSchema = new mongoose.Schema({
  title: String
});

BookSchema.plugin(mexp);

var Book = mongoose.model('Book', BookSchema);

Book.on('es-bulk-sent', function () {
  console.log('buffer sent');
});

Book.on('es-bulk-data', function (doc) {
  console.log('Adding ' + doc.title);
});

Book.on('es-bulk-error', function (err) {
  console.error(err);
});

Book
  .esSynchronize()
  .then(function () {
    console.log('end.');
  });
```

`esSynchronise` use same parameters as [find](http://mongoosejs.com/docs/api.html#model_Model.find) method or alternatively you can pass a mongoose query instance in order to use any specific methods like `.populate()`.
It allows to synchronize a subset of documents, modifying the default projection...

```javascript
Book
  .esSynchronize({author: 'Arthur C. Clarke'}, '+resume')
  .then(function () {
    console.log('end.');
  });
```

```javascript
// using a mongoose query instance, populating the author `ref`
const query = Book.find({author: 'Arthur C. Clarke'}).populate('author')
Book
  .esSynchronize(query, '+resume')
  .then(function () {
    console.log('end.');
  });
```

### Filtered Indexing

You can specify a filter function to index a model to Elasticsearch based on some specific conditions. If document satisfies conditions it will be added to the elastic index. If not, it will be removed from index.

Filtering function must return True for conditions that will be indexing to Elasticsearch (like Array.filter & unlike moogoosastic.filter)

```javascript
var MovieSchema = new mongoose.Schema({
  title: {type: String},
  genre: {type: String, enum: ['horror', 'action', 'adventure', 'other']}
});

MovieSchema.plugin(mexp, {
  filter: function (doc) {
    return doc.genre === 'action';
  }
});
```

### Transforming a document before indexing

You can specify a function to transform a document before indexing it in ElasticSearch.

```javascript
var MovieSchema = new mongoose.Schema({
  title: {type: String},
  genre: {type: String, enum: ['horror', 'action', 'adventure', 'other']}
});

MovieSchema.plugin(mexp, {
  transform: function (doc) {
    delete doc.genre;
    return doc;
  }
});
```

Instances of Movie model having 'action' as their genre will be indexed to Elasticsearch.

### Indexing On Demand
You can do on-demand indexes using the `esIndex` function

`esIndex([update], [callback])`

```javascript
Dude.findOne({name: 'Jeffrey Lebowski', function (err, dude) {
  dude.awesome = true;
  dude.esIndex(function (err, res) {
    console.log("egads! I've been indexed!");
  });
});
```

`update` parameter allows to update a partial document ([documentation](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-update)).
It is especially useful when dealing with not loaded properties (when setting `select = false` in schema properties).

Note that indexing a model does not mean it will be persisted to
mongodb. Use save for that.

### Unsetting fields
By default, inline scripts are disabled in Elasticsearch. In this case, unsetting fields result in setting fields to `null`.

```javascript
Dude.findOne({name: 'Jeffrey Lebowski', function (err, dude) {
  dude.job = undefined;
  dude.save(); // => job fields will be set to null on Elasticsearch
});
```

If [dynamic-scripting](https://www.elastic.co/guide/en/elasticsearch/reference/2.3/modules-scripting.html#enable-dynamic-scripting) is enabled, setting `script` to true will use `ctx._source.remove` and fields will be removed in Elasticsearch.


### Adding fields
`es_extend` allows to add some fields which does not exist in the mongoose schema.
It is defined in the options of the schema definition.
When adding some fields, `es_type` and `es_value` are mandatories.

```javascript
var UserSchema = new mongoose.Schema(
  {
    name: String
  },
  {
    es_extend: {
      length: {
        es_type: 'integer',
        es_value: function (document) {
          return document.name.length;
        }
      }
    }
  }
);
```

The `es_value` parameter can be either a value or a function returning a value, in this case, here are its parameter:

* `document` is the mongoose document

### Change fields value
`es_value` allows to replace the value of a field. It can be either a value or a function which will return the value to index.
If the type changes, it is mandatory to set the correct `es_type`.

```javascript
var TagSchema = new mongoose.Schema({
  _id: false,
  value: String
});

var UserSchema = new mongoose.Schema({
  name: String,
  xyz: {
    type: Number,
    es_value: 123               // <= whatever the model.xyz value is, the xyz indexed will be 123 in ES
  },
  tags: {
    type: [TagSchema],
    es_type: 'string',          // <= because the type change from a TagSchema (object) to an array of string
    es_value: function (tags) {
      return tags.map(function (tag) {
        return tag.value;
      });
    }
  }
});

UserSchema.plugin(plugin);

var User = mongoose.model('User', UserSchema);

var john = new User({
  name: 'John',
  tags: [
    {value: 'cool'},
    {value: 'green'}
  ]
});

// users index will contain {"name": "John", "xyz": 123, "tags": ["cool", "green"]}

```

When `es_value` is a function, it takes theses parameters:

* `value` the original value
* `context` a context object

context contains:

* `document` the mongoose document
* `container` the container of the original value (which is equal to the `document` when it is not a nested object)
* `field` the key name

### Using with mongoose discriminators

You may save discriminator models' data in different Elasticsearch types with different mappings. To make it possible you should provide `type` option as a function. You will get `modelName` as an argument and must return type name for Elasticsearch.

```js
// define base Schema with base Model
const BaseSchema = new mongoose.Schema({
  name: String,
});
const BaseModel = mongoose.model('Base', BaseSchema);

// define discriminator models
const UserModel = BaseModel.discriminator('User', new mongoose.Schema({
  age: Number,
}));

const AdminModel = BaseModel.discriminator('Admin', new mongoose.Schema({
  access: Boolean,
}));

// add mexp plugin to the base Schema, with `type` as a function
BaseSchema.plugin(mexp, {
  index: 'user',
  type: kind => {
    if (kind === 'User') return 'userType';
    if (kind === 'Admin') return 'adminType';
    return 'base';
  },
});
```


## Mapping

Schemas can be configured to have special options per field. These match with the existing [mapping parameters](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-params.html) defined by Elasticsearch with the only difference being they are all prefixed by `es_`.

So for example. If you wanted to index a book model and have the boost for title set to 2.0 (giving it greater priority when searching) you'd define it as follows:

```javascript
var BookSchema = new mongoose.Schema({
    title: {type: String, es_boost: 2.0},
    author: {type: String, es_null_value: "Unknown Author"},
    publicationDate: {type: Date, es_type: 'date'}
});

```
This example uses a few other mapping fields... such as null_value and type (which overrides whatever value the schema type is, useful if you want stronger typing such as float).

There are various mapping options that can be defined in Elasticsearch. Check out [https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html/](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html) for more information.

### Creating Mappings On Demand

You can do on-demand create a mapping using the `esCreateMapping` function.

Creating the mapping is a one time operation and can be done as follows:

```javascript
var UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    city: String
});

UserSchema.plugin(mexp);

var User = mongoose.model('User', UserSchema);

User
  .esCreateMapping({
    "analysis" : {
      "analyzer": {
        "content": {
          "type": "custom",
          "tokenizer": "whitespace"
        }
      }
    }
  })
  .then(function (mapping) {
    // do neat things here
  });

```

⚠️ For `v7` `analysis` needs to be wrapped in a `settings` object. Please refer to: `test/es7/model-mapping.js`

You'll have to manage whether or not you need to create the mapping, mongoose-elasticsearch-xp will make no assumptions and simply attempt to create the mapping.
If the mapping already exists, an Exception detailing such will be populated in the `err` argument.

## Queries
The full query DSL of Elasticsearch is exposed through the `esSearch` method.
For example, if you wanted to find all people between ages 21 and 30:

```javascript
Person
  .esSearch({
    range: {
      age: {
        from: 21,
        to: 30
      }
    }
  })
  .then(function ({ body }) {
    // all the people who fit the age group are here!
  });

```
See the Elasticsearch [query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html) docs for more information.

You can also specify full query:

```javascript
Person
  .esSearch({
    {
      query: {
        bool: {
          must: {match_all: {}},
          filter: {range: {age: {gte: 35}}}
        }
      },
      sort: [
        {age: {order: "desc"}}
      ]
    }

  })
  .then(function (results) {
    // ...
  });
```

### Hydration
By default objects returned from performing a search will be the objects as is in Elasticsearch.
This is useful in cases where only what was indexed needs to be displayed (think a list of results) while the actual mongoose object contains the full data when viewing one of the results.

However, if you want the results to be actual mongoose objects you can provide {hydrate: true} as the second argument to a search call.

```javascript
User
  .esSearch({query_string: {query: "john"}}, {hydrate: true})
  .then(function (results) {
  // results here
  });
```

To modify default hydratation, provide an object to `hydrate` instead of "true".
`hydrate` accept {select: string, options: object, docsOnly: boolean}

```javascript
User
  .esSearch({query_string: {query: "john"}}, {hydrate: {select: 'name age', options: {lean: true}}})
  .then(function (results) {
    // results here
  });
```

When using hydration, `hits._source` is replaced by `hits.doc`.

If you only want the models, instead of the complete ES results, use the option "docsOnly".

```javascript
User
  .esSearch({query_string: {query: "john"}}, {hydrate: {select: 'name age', docsOnly; true}})
  .then(function (users) {
    // users is an array of User
  });
```

#### Hydration with population

To populate hydrated models, simply use the `populate` key of the `hydrate` object.

Use it the same way mongoose populate works (string, object, array of object).

```javascript
User
  .esSearch(
    {query_string: {query: "john"}},
    {hydrate: {
      populate: {
        path: 'city',
        select: 'name'
      }
    }}
  )
  .then(function (results) {
    // results here
  });
```

When having different populate to handle, you can use an array of populate.
In the example below, two main key are populated `city` and `books`. The sub-key `book.author` is also populated ([mongoose feature](http://mongoosejs.com/docs/populate.html#deep-populate)).

```javascript
User
  .esSearch(
    {query_string: {query: "john"}},
    {hydrate: {
      populate: [
        {
          path: 'city'
        },
        {
          path: 'books',
          populate: {
            path: 'author',
            select: 'name'
          }
        }
      ]
    }}
  )
  .then(function (results) {
    // results here
  });
```


### Getting only Ids
A variant to hydration may be to get only ids instead of the complete Elasticsearch result.
Using `idsOnly` will return the ids cast in mongoose ObjectIds.

```javascript
User
  .esSearch({query_string: {query: "john"}}, {idsOnly: true})
  .then(function (ids) {
  // ids is an array of mongo id
  });
```

## Count
The [count API](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-count.html) is available using the `esCount` function.
It handle the same queries as the `esSearch` method (string query, full query...).

```javascript
User
  .esCount({match: {age: 34}})
  .then(function (result) {
    // result = {
    //    "count" : 1,
    //    "_shards" : {
    //        "total" : 5,
    //        "successful" : 5,
    //        "failed" : 0
    //    }
    // }
  });
```

### Getting only count value
Count result can be simplified to the count value using the `countOnly` options whether in the plugin options or in the function options.

```javascript
User
  .esCount(
    {
      bool: {
        must: {match_all: {}},
        filter: {range: {age: {gte: 35}}}
      }
    },
    {countOnly: true}
  )
  .then(function (count) {
    // count is a number
  })
```


## Refreshing model index
`esRefresh` explicitly refresh the model index by calling [indices-refresh](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-refresh.html).

```javascript
User
  .esRefresh()
  .then(function () {
    // index has been refreshed
  });
```

You also can provide explicit options:

```javascript
User
  .esRefresh({refreshDelay: 1000})
  .then(function () {
    // index has been refreshed, and then, 1000ms has been waited
  });
```

#### Breaking changes for elastic v7.0

[List](https://www.elastic.co/guide/en/elasticsearch/reference/current/breaking-changes-7.0.html#breaking_70_analysis_changes)

1 - Elasticsearch _Type has been removed
2 - Elasticsearch SQL
3 - Index lifecycle management
4 - Standard token filter has been removed
5 - nGram and edgeNGram token filter cannot be used on new indices
    should be replaces by ngram or edge_ngram
6 - Shards number on index creation is now `1` instead of `5`

This library handles types fine for now but keep that in mind that they will be gone for v8.0.

#### Contributing

You will need a *mongodb* running locally either via docker or your own
The tests currently write in a `test` collection.

Ideally you would run: (example for v7)

Your mongodb then,
In one terminal: `npm run docker-v7`
In another: `npm run test-v7`

All the docker images load their own `elasticsearch.yml` config,
In the case of `es7` you might need to edit the line
```yml
network.host: 127.0.0.1
```
for
`network.host: _eth0_` 
in order to test locally (**don't** commit this file change or it will break travis).

[npm-url]: https://npmjs.org/package/mongoose-elasticsearch-xp
[npm-image]: https://badge.fury.io/js/mongoose-elasticsearch-xp.svg

[travis-url]: http://travis-ci.org/jbdemonte/mongoose-elasticsearch-xp
[travis-image]: https://secure.travis-ci.org/jbdemonte/mongoose-elasticsearch-xp.svg?branch=master

[coverage-url]: https://coveralls.io/github/jbdemonte/mongoose-elasticsearch-xp?branch=master
[coverage-image]: https://coveralls.io/repos/github/jbdemonte/mongoose-elasticsearch-xp/badge.svg?branch=master
