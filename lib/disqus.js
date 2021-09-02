function loadComments (shortname, universejs) {
  var placeholder = document.getElementById('disqus_thread');
  if (!placeholder) return;

  var identifier = placeholder.getAttribute('data-disqus-identifier');
  if (!identifier) throw new Error('Disqus placeholder must specify a thread ID with a data-disqus-identifier attribute');

  var host = placeholder.getAttribute('data-disqus-domain');
  if (!host) throw new Error('Disqus placeholder must specify a domain with a data-disqus-domain attribute');

  universejs.get('/disqus', function (error, data) {
    if (error) throw new Error('Could not get Disqus SSO data from Universe');

    // https://help.disqus.com/en/articles/1717084-javascript-configuration-variables
    var disqus_config = function () {
      this.page.remote_auth_s3 = data.remote_auth_s3;
      this.page.api_key = data.api_key;
      this.page.identifier = identifier;
      this.page.url = host + window.location.pathname + window.location.search; // TODO: remove unwanted query params to create canonical URL
      this.page.title = placeholder.getAttribute('data-disqus-title') || document.title;
    };

    // https://help.disqus.com/en/articles/1717138-why-are-the-same-comments-showing-up-on-multiple-pages
    if (host === window.location.origin) {
      var disqus = document.createElement('script');
      disqus.type = 'text/javascript';
      disqus.async = true;
      disqus.src = '//' + shortname + '.disqus.com/embed.js';
      disqus.setAttribute('data-timestamp', +new Date());
      (document.head || document.body).appendChild(disqus);
    } else {
      var debug_config = {shortname, page: {}};
      disqus_config.apply(debug_config);
      delete debug_config.page.remote_auth_s3;
      delete debug_config.page.api_key;
      placeholder.innerHTML = 'Disqus comments are only loaded in production (' + host + '), to prevent threads from being created with dev/staging URLs. The comments on this page will be loaded with the following config:<pre>' + JSON.stringify(debug_config, null, 2) + '</pre>';
    }
  });
}

module.exports = loadComments;
