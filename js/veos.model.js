/*jshint browser: true, devel: true */
/*global Backbone, _, jQuery */

window.veos = (function(veos) {
  var self = {};

  var ushahidi = {};

  // ushahidi.baseURL = window.location.protocol + "://" + window.location.host + 
  //   (window.location.port ? ':' + window.location.port : '');
  
  ushahidi.baseURL = "http://veos.surveillancerights.ca";
  // ushahidi.baseURL = "http://localhost:3000"


  /*** Report ***/

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  self.Report = Backbone.Model.extend({
    url : function() {
      var base = ushahidi.baseURL + '/reports';
      if (this.isNew()) 
        return base + '.json';
      else
        return base + '/' + this.id + '.json';
    }
  });

  self.Reports = Backbone.Collection.extend({
      model: self.Report,
      url: ushahidi.baseURL + '/reports.json'
  });

  veos.model = self;
  return veos;
})(window.veos || {});