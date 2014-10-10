var API_URLS = {
  test_in:    'http://localhost:8081/i/api/v1', // With a logged in user
  test_out:   'http://localhost:8081/o/api/v1', // With no logged in user
  staging:    'https://staging.services.sparkart.net/api/v1',
  production: 'https://services.sparkart.net/api/v1'
};

var SolidusClient = require('solidus-client');
var Resource = require('solidus-client/lib/resource');

var Universe = function(options) {
  if (!(this instanceof Universe)) return new Universe(options);

  SolidusClient.call(this, options);

  options || (options = {});
  this.environment = options.environment || 'production';
  this.key         = options.key;
};

Universe.prototype = Object.create(SolidusClient.prototype);

Universe.prototype.ready = function(callback) {
  var self = this;

  self.context.universe || (self.context.universe = {});

  getFanclub.call(self, function(fanclub) {
    self.context.universe.fanclub = fanclub;

    getCustomer.call(self, function(customer) {
      self.context.universe.customer = customer;

      callback();
    });
  });
};

Universe.prototype.render = function() {
  expandResourcesEndpoints.call(this, arguments[0]);
  return SolidusClient.prototype.render.apply(this, arguments);
};

Universe.prototype.post = function(endpoint, data, callback) {
  var resource = new Resource(this.resource(endpoint));
  if (resource.requestType() == 'jsonp') {
    resource.options.query || (resource.options.query = {});
    resource.options.query._method = 'POST';
  }

  resource.post(data, function(err, response) {
    callback(err, response ? response.data : null);
  });
};

Universe.prototype.resource = function(endpoint) {
  return {
    url: resourceUrl.call(this, endpoint),
    query: {
      key: this.key
    },
    with_credentials: true
  };
};

Universe.prototype.jsonpResource = function(endpoint) {
  return {
    url: resourceUrl.call(this, endpoint),
    jsonp: true
  };
};

// PRIVATE

var getFanclub = function(callback) {
  if (this.context.resources && this.context.resources.fanclub) {
    callback(this.context.resources.fanclub.fanclub);
  } else {
    this.getResource(this.resource('/fanclub'), null, function(err, data) {
      // TODO: what to do with errors?
      callback(data ? data.fanclub : null);
    });
  }
};

var getCustomer = function(callback) {
  var self = this;
  self.getResource(self.jsonpResource('/account/status'), null, function(err, data) {
    // TODO: what to do with errors?
    if (data && data.logged_in) {
      self.getResource(self.resource('/account'), null, function(err, data) {
        // TODO: what to do with errors?
        callback(data ? data.customer : null);
      });
    } else {
      callback();
    }
  });
};

var expandResourcesEndpoints = function(view) {
  if (!view || typeof view !== 'object') return;

  for (var name in view.resources) {
    var resource = view.resources[name];
    if (typeof resource === 'string' && resource[0] === '/') {
      resource = this.resource(resource);
    } else if (resource !== null && typeof resource === 'object' && typeof resource.url === 'string' && resource.url[0] === '/') {
      resource.url = resourceUrl.call(this, resource.url);
    }
    view.resources[name] = resource;
  }
};

var resourceUrl = function(endpoint) {
  return (API_URLS[this.environment] || API_URLS['production']) + endpoint;
};

module.exports = Universe;
