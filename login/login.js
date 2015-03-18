var cookie = require('cookie');
var Delegate = require('dom-delegate');
var qs = require('querystring');

var isMobile = navigator.userAgent.match(/Mobile/i);

/**
 * Override login links, including those added dynamically
 * @param {object} fanclub - universe /api/v1/fanclub data
 * @param {object} scope - DOM node to scope links to
 */

function linkify (fanclub, scope) {
  var delegate = new Delegate(scope || document.body);

  delegate.on('click', 'a', function (event) {
    var url = event.target.getAttribute('href');

    if (url.match('login')) {
      event.preventDefault();
      prompt(fanclub, url);
    }
  });
}

/**
 * Open a login prompt in a popup to minimize user disorientation,
 * with an exception for mobile devices where window.close doesn't work
 * @param {object} fanclub - universe /api/v1/fanclub data
 * @param {string|object} [options] - login URL or configuration object
 * @param {string} options.url - login URL
 * @param {string} options.* - Universe configuration parameters to passthrough
 */

function prompt (fanclub, options) {

  if (isMobile) {
    window.location = config(fanclub, options).url;
  } else {
    var login = config(fanclub, options, true);

    // Set desired final destination in a cookie to preserve through intermediary redirects
    document.cookie = cookie.serialize('redirect', login.redirect, {
      path: '/login/reload'
    });

    popup(login.url);
  }

};

/**
 * Creates config object, sets login URL from Universe instance if not defined
 * @private
 * @param {string|object} options - login URL or configuration object
 */

function config (fanclub, options, popup) {

  var options = (typeof options === 'string' && options.match(/\?/))
    ? qs.parse(options.split('?').pop())
    : {};

  var loginUrl = fanclub.links.login;

  if (!options.redirect || !options.redirect.match(/^https?:\/\//)) {
    var redirect = (!options.redirect || options.redirect[0] === '/')
      ? ''
      : '/' + options.redirect;

    options.redirect = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + redirect;
  }

  if (popup) options.popup = 1;

  return {
    url: loginUrl + '?' + qs.stringify(options),
    redirect: options.redirect
  }
}

/**
 * Open a small popup window centered within the parent window
 * @private
 * @param {string} url
 */

function popup (url) {
  var screenTop = window.screenTop || window.screenY;
  var screenLeft = window.screenLeft || window.screenX;

  var options = {
    width: 560,
    height: 385,
    resizable: 0,
    menubar: 0,
    location: 0,
    toolbar: 0,
    personalbar: 0,
    status: 0,
    scrollbars: 0
  };

  // Center popup
  options.top = screenTop + ((window.innerHeight - options.height) / 2);
  options.left = screenLeft + ((window.innerWidth - options.width) / 2);

  window.open(url, 'universeLogin', qs.stringify(options).replace(/&/g, ','));
};

module.exports = {
  linkify: linkify,
  prompt: prompt
};