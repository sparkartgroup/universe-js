var API_URLS = {
  test:        'http://universe-js.test:8081/api/v1',
  development: 'https://dev.services.sparkart.net:11443/api/v1',
  staging:     'https://staging.services.sparkart.net/api/v1',
  production:  'https://services.sparkart.net/api/v1'
};

var SolidusClient = require('solidus-client');
var Resource = require('solidus-client/lib/resource');
var loadComments = require('./lib/disqus');
var linkify = require('./login/login').linkify;

var Universe = function(options) {
  if (!(this instanceof Universe)) return new Universe(options);

  SolidusClient.call(this, options);

  options || (options = {});
  if (options.environment) {
    this.apiUrl = API_URLS[options.environment];
    this.useJWT = true;
  } else {
    this.apiUrl = options.apiUrl;
    this.useJWT = options.useJWT;
  }
  this.key = options.key;
};

Universe.prototype = Object.create(SolidusClient.prototype);

Universe.prototype.init = function(callback) {
  var self = this;
  var data = {};

  getFanclub.call(self, function(err, fanclub) {
    self.fanclub = data.fanclub = fanclub;
    if (err) {
      if (callback) callback(err, data);
      return setTimeout(function() {self.emit('error', err)}, 0);
    }

    getCustomer.call(self, function(err, customer) {
      self.customer = data.customer = customer;
      if (callback) callback(err, data);
      if (!err) setTimeout(function() {self.emit('ready', data)}, 0);
    });
  });
};

Universe.prototype.render = function() {
  expandResourcesEndpoints.call(this, arguments[0]);
  return SolidusClient.prototype.render.apply(this, arguments);
};

Universe.prototype.get = function(endpoint, callback) {
  requestResource.call(this, 'get', endpoint, null, callback);
};

Universe.prototype.post = function(endpoint, payload, callback) {
  requestResource.call(this, 'post', endpoint, payload, callback);
};

Universe.prototype.resource = function(endpoint) {
  const resource = {
    url: resourceUrl.call(this, endpoint),
    query: {
      key: this.key
    },
    headers: {},
    with_credentials: !this.useJWT
  };

  if (this.useJWT && localStorage.getItem('universeAccessToken')) {
    resource.headers.Authorization = 'Bearer ' + localStorage.getItem('universeAccessToken');
  }

  return resource;
};

Universe.prototype.jsonpResource = function(endpoint) {
  return {
    url: resourceUrl.call(this, endpoint),
    jsonp: true
  };
};

Universe.prototype.loadComments = function(shortname) {
  loadComments(shortname, this);
}

Universe.prototype.linkify = function(scope, processor) {
  linkify(this.fanclub, scope, processor, this.useJWT);
}

// PRIVATE

var getFanclub = function(callback) {
  if (this.fanclub || (this.context && this.context.resources && this.context.resources.fanclub)) {
    callback(null, this.fanclub || this.context.resources.fanclub.fanclub);
  } else {
    this.get('/fanclub', function(err, data) {
      callback(err, data ? data.fanclub : null);
    });
  }
};

var getCustomer = function(callback) {
  if (!this.useJWT || localStorage.getItem('universeAccessToken')) {
    // When logged in, add the login time to the /account query, to prevent the
    // browser from serving a cached "logged out" response (and vice-versa)
    this.get(localStorage.getItem('universeLoginTime') ? '/account?t=' + localStorage.getItem('universeLoginTime').toString() : '/account', function(err, data) {
      if (!err && data && !data.customer) localStorage.removeItem('universeLoginTime');
      callback(err, data ? data.customer : null);
    });
  } else {
    callback();
  }
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
  return this.apiUrl + endpoint;
};

var requestResource = function(method, endpoint, payload, callback) {
  const self = this;

  validateTokens.call(self, function(err) {
    function cb(err, response) {callback(err, response ? response.data : undefined)};
    const resource = new Resource(self.resource(endpoint), self.resources_options);
    if (method === 'get') {
      resource.get(cb);
    } else if (method === 'post') {
      if (resource.requestType() == 'jsonp') {
        resource.options.query || (resource.options.query = {});
        resource.options.query._method = 'POST';
      }
      resource.post(payload, cb);
    }
  });
}

var validateTokens = function(callback) {
  if (!this.useJWT) return callback();

  const now = new Date().getTime();

  if (localStorage.getItem('universeAccessToken') && now < (localStorage.getItem('universeAccessTokenExpiration') || 0)) {
    // Valid access token
    return callback();
  } else {
    // Missing or expired access token
    localStorage.removeItem('universeAccessToken');
    localStorage.removeItem('universeAccessTokenExpiration');
  }

  if (!localStorage.getItem('universeRefreshToken') || now >= (localStorage.getItem('universeRefreshTokenExpiration') || 0)) {
    // Missing or expired refresh token
    localStorage.removeItem('universeRefreshToken');
    localStorage.removeItem('universeRefreshTokenExpiration');
    localStorage.removeItem('universeLoginTime');
    return callback(true);
  }

  // Refresh the access token
  const resource = new Resource(this.resource('/refresh'), this.resources_options);
  resource.post({refresh_token: localStorage.getItem('universeRefreshToken')}, function (err, response) {
    if (err) {
      if (response && response.data && response.data.status === 'error') {
        // Invalid refresh token
        localStorage.removeItem('universeRefreshToken');
        localStorage.removeItem('universeRefreshTokenExpiration');
        localStorage.removeItem('universeLoginTime');
      }
      callback(err);
    } else {
      localStorage.setItem('universeAccessToken', response.data.access.access_token);
      localStorage.setItem('universeAccessTokenExpiration', response.data.access.access_token_expiration * 1000);
      localStorage.setItem('universeRefreshToken', response.data.access.refresh_token);
      localStorage.setItem('universeRefreshTokenExpiration', response.data.access.refresh_token_expiration * 1000);
      callback();
    }
  });
}

module.exports = Universe;
