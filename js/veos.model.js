/*jshint browser: true, devel: true */
/*global Backbone, _, jQuery */

window.veos = (function(veos) {
  var self = {};

  var ushahidi = {};

  // ushahidi.baseURL = window.location.protocol + "://" + window.location.host + 
  //   (window.location.port ? ':' + window.location.port : '');
  
  ushahidi.baseURL = "http://veos.surveillancerights.ca";
  //ushahidi.baseURL = "http://localhost:8000/veos"

  /*** Report ***/

  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'delete': 'DELETE',
    'read':   'GET'
  };

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  self.Report = Backbone.Model.extend({
    idAttribute: "incident_id",

    url: function() {
      if (this.isNew()) 
        // Ushahidi API sucks (can't handle photo uploads, for example), so we hack by
        // posting directly to the HTML form receiver
        return ushahidi.baseURL + '/api?task=report';
      else
        return ushahidi.baseURL + '/api?task=incidents&by=incidentid&id='+encodeURIComponent(this.id);
    },
    parse: function(resp, xhr) {
      if (resp.code || (resp.payload.success === 'false')) {
        var err;
        if (resp.error && resp.error.code)
          err = resp.error;
        else
          err = resp;
        console.error(err.message, err.code);
        this.trigger('error', this, err);
      } else {
        return resp.payload.incidents[0];
      }
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

      if (!options.data && model && (method == 'create' || method == 'update')) {
        // see http://stackoverflow.com/a/5976031/233370
        params.contentType = 'application/x-www-form-urlencoded';
        params.data = _.clone(this.attributes);

        if (method == 'create')
          params.data.task = 'report'; // report param in URL doesn't seem to work, so need to do it here
      }

      // Don't process data on a non-GET request.
      // if (params.type !== 'GET' && !Backbone.emulateJSON) {
      //   params.processData = false;
      // }

      // Make the request, allowing the user to override any Ajax options.
      switch (method) {
        case 'create':
        case 'read':
          return jQuery.ajax(_.extend(params, options));
        default:
          throw new Error('Cannot "'+method+'" this object because this operation is not implemented.');
      }
    }
  });

  self.Reports = Backbone.Collection.extend({
      url: function() {
          return ushahidi.baseURL + '/api?task=incidents';
      },
      model: self.Report
  });

  veos.model = self;
  return veos;
})(window.veos || {});