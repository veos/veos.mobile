/*jshint browser: true, devel: true */
/*global Backbone, _ */

window.veos = (function(veos) {
  var self = {};

  var ushahidi = {};

  // ushahidi.baseURL = window.location.protocol + "://" + window.location.host + 
  //   (window.location.port ? ':' + window.location.port : '');
  
  // ushahidi.baseURL = "http://veos.surveillancerights.ca";

  ushahidi.baseURL = "http://localhost:8000/veos"

  /*** Report ***/

  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'delete': 'DELETE',
    'read':   'GET'
  };

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  Backbone.emulateJSON = false;

  self.Report = Backbone.Model.extend({
    url: function() {
      if (this.isNew()) 
        return ushahidi.baseURL + '/api?task=report';
      else
        return ushahidi.baseURL + '/api?task=incidents&by=incidentid&id='+encodeURIComponent(this.id);
    },
    sync: function(method, model, options) {
      var type = methodMap[method];

      options = options || {};

      // Default JSON-request options.
      var params = {type: type, dataType: 'json'};

      // Ensure that we have a URL.
      if (!options.url) {
        params.url = this.url();
      }

      // Ensure that we have the appropriate request data.
      if (!options.data && model && (method == 'create' || method == 'update')) {
        params.contentType = 'application/json';
        params.data = JSON.stringify(model.toJSON());
      }

      // For older servers, emulate JSON by encoding the request into an HTML-form.
      if (Backbone.emulateJSON) {
        params.contentType = 'application/x-www-form-urlencoded';
        params.data = params.data ? {model: params.data} : {};
      }

      // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
      // And an `X-HTTP-Method-Override` header.
      if (Backbone.emulateHTTP) {
        if (type === 'PUT' || type === 'DELETE') {
          if (Backbone.emulateJSON) params.data._method = type;
          params.type = 'POST';
          params.beforeSend = function(xhr) {
            xhr.setRequestHeader('X-HTTP-Method-Override', type);
          };
        }
      }

      // Don't process data on a non-GET request.
      if (params.type !== 'GET' && !Backbone.emulateJSON) {
        params.processData = false;
      }

      // Make the request, allowing the user to override any Ajax options.
      switch (method) {
        case 'read':
        case 'create':
          return jQuery.ajax(_.extend(params, options));
          break;
        default:
          throw new Error('Cannot "'+method+'" this object because this operation is not implemented.');
      }
    }
  });

  self.Reports = Backbone.Collection.extend({
      model: self.Report
  });

  veos.model = self;
  return veos;
})(window.veos || {});