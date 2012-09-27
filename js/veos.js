/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, Android, google, Piwik */

window.veos = (function(veos) {
  var self = veos;

  var initLastLoc = function () {
    if (typeof(google) === 'undefined') {
      console.log("'google' is not defined... maps api probably not loaded yet... waiting 500 ms before trying again");
      setTimeout(initLastLoc, 500); // wait until google stuff is loaded
    } else {
      if (!self.lastLoc) {
        console.log("veos.lastLoc not initialized... setting to default location")
        self.lastLoc = new google.maps.LatLng(43.6621614579938, -79.39527873417967); // FIXME: default hard-coded to toronto; maybe make it based on last report?
      }
    }
  };

  self.isAndroid = function () {
    return typeof(Android) !== 'undefined';
  };

  self.alert = function (msg, title) {
    if (veos.isAndroid()) {
      Android.showToast(msg);
    } else {
      alert(msg, title);
    }
  };

  /**
    Initializes the whole app. This needs to be called at the bottom of every VEOS page.
  **/
  self.init = function () {
    console.log("INITIALIZING VEOS!");

    if (window.location.pathname === "/") {
      console.log("Redirecting to /app.html");
      window.location.href = "/app.html";
      return;
    }

    jQuery(self).bind('haveloc', function (ev, geoloc) {
      console.log("Got updated gps location: ", geoloc);
      self.lastLoc = geoloc;
    });

    jQuery(document)

    /** overview-map.html (overview-map-page) **/
      .delegate("#overview-map-page", "pageshow", function() {
        //if (!veos.map.overviewMap) {
          veos.map.overviewMap = new veos.map.Map('#overview-map-canvas');
        //}
        //var map = new veos.map.Map('#overview-map-canvas');

        // add all installation markers
        var installations = new veos.model.Installations();
        installations.on('reset', function(collection) {
          veos.map.overviewMap.addInstallationMarkers(collection);
        });
        installations.fetch();

        // start following user
        veos.map.overviewMap.startFollowing();
      })

    /** report.html (report-page) **/
      .delegate("#report-page", "pageshow", function(ev) {
        var installationId = 0;

        if (window.location.href.match("[\\?&]installationId=(\\d+)")) {
          installationId = window.location.href.match("[\\?&]installationId=(\\d+)")[1];
        }

        // edit report
        // if (self.currentInstallation) {
        if (installationId > 0) {
          var installation = new veos.model.Installation({id: installationId});

          var installationSuccess = function (model, response) {
            self.currentInstallation = model;                       // used to set initial location for EditReport
            self.currentReport = model.startAmending();
            self.reportForm = new self.view.ReportEditForm({model: self.currentReport, el: '#report-page'});
            jQuery('#report-header-text').text('Editing the Installation');

            // self.reportForm is used a globally accessibly variable - don't change the its name
            self.reportForm.render();
          };

          var installationError = function (model, response) {
            console.error("Error fetching installation model with message: "+response);
            veos.alert("Error fetching installation details");
          };

          installation.fetch({success: installationSuccess, error: installationError});
        }
        // new report
        else {
          if (!self.currentReport) {
            self.currentReport = new veos.model.Report();

            if (veos.lastLoc) {
              var initLoc = veos.map.convertGeolocToGmapLatLng(veos.lastLoc);
              self.currentReport.set('loc_lng_from_gps', initLoc.lng());
              self.currentReport.set('loc_lat_from_gps', initLoc.lat());
            }
            //else {
              // if we're coming straight from the splash page, we need to locate the user. I think this is the place to do it (bug 33)
            //}
          }

          if (!self.reportForm) {
            self.reportForm = new veos.view.ReportForm({
              el: ev.target,
              model: self.currentReport
            });
          }

          if (!self.reportForm.$el.data('initialized')) {
            console.log("Pointing ReportForm to "+ev.target);
            self.reportForm.setElement(ev.target);
            self.reportForm.$el.data('initialized', true);
          }       
          
          self.reportForm.render();          
        }

        // this needs to go in here to make the refined map work, I believe. But it may also be causing the wierd viewport issues
        //report.init();
      })

  
    /** refine-location.html (refine-location-page) **/
      .delegate("#refine-location-page", "pageshow", function() {
        if (!veos.reportForm) {
          console.error("Cannot refine location because there is no report currently in progress.");
          jQuery.mobile.changePage("report.html");
          return;
        }

        var refinerMap;
        var refinerLoc;

        // if the user has made a change to the address bar, use that location
        if (veos.currentReport.get('loc_lat_from_user') && veos.currentReport.get('loc_lng_from_user')) {
          refinerLoc = new google.maps.LatLng(veos.currentReport.get('loc_lat_from_user'), veos.currentReport.get('loc_lng_from_user'));
          refinerMap = new veos.map.Map('#refine-location-canvas', refinerLoc);
        }
        // default case - user has not made any changes to location yet
        else if (veos.lastLoc) {
          refinerLoc = veos.lastLoc;
          refinerMap = new veos.map.Map('#refine-location-canvas', refinerLoc);
        }
        // should never occur
        else {
          console.log("Cannot refine location because there is no lat/lng");
        }

        refinerMap.addReportRefinerMarker(self.reportForm.model, refinerLoc);
      })

    /** installations-list.html (installations-list-page) **/
      .delegate("#installations-list-page", "pageshow", function(ev) {
        var installations = new veos.model.Installations();

        var view = new veos.view.InstallationList({
          el: ev.target,
          collection: installations
        });
        
        view.showLoader();
        installations.fetch({
          success: function () {view.hideLoader();}
        });
      })              

    /** report-selection.html (report-selection-page) **/
      .delegate("#report-selection-page", "pageshow", function(ev) {
        // fetch instalations ordered by closest to furtherest 
        var nearbyInstallations = new veos.model.NearbyInstallations(self.lastLoc.coords.latitude, self.lastLoc.coords.longitude, 0.15);           // TODO I'm pretty sure this is not the right way to access these

        var view = new veos.view.InstallationListReport({
          el: ev.target,
          collection: nearbyInstallations
        });
        
        view.showLoader();
        nearbyInstallations.fetch({
          success: function () {view.hideLoader();}
        });
      })

    /** installation-details.html (installation-details-page) **/
      .delegate("#installation-details-page", "pageshow", function(ev) {
        console.log("Showing details page at "+window.location.href);
        var installationId = window.location.href.match("[\\?&]id=(\\d+)")[1];
        console.log("Showing details for installation "+installationId);

        var installation = new veos.model.Installation({id: installationId});

        var view = new veos.view.InstallationDetails({
          el: ev.target,
          model: installation
        });
        
        view.showLoader();  
        view.model.fetch();             // I don't think this is right - the whole 'view doesn't call this stuff on itself' (should be moved to the init in view?)
      })

    /** photo-details.html (photo-details-page) **/
      .delegate("#photo-details-page", "pageshow", function(ev) {
        console.log("Showing photo details page at "+window.location.href);
        // retrieve installationId from URL
        var installationId = window.location.href.match("[\\?&]installationId=(\\d+)")[1];
        // and set it in the href of the back button
        var backButton = jQuery('.photo-details-page-back-button');
        backButton.attr('href', 'installation-details.html?id='+installationId);

        // retrieve photoId from URL
        var photoId = window.location.href.match("[\\?&]photoId=(\\d+)")[1];
        console.log("Showing details for photo "+photoId);

        // where to render picture into
        var photoContainer = jQuery('.photo-container');
        // Photo model for given Photo ID (from URL)
        var photo = new veos.model.Photo({id: photoId});
        // PhotoDetailsView renders the picture and aditional information
        var view = new veos.view.PhotoDetailsView({
          el: photoContainer,
          model: photo
        });
        
        // view.showLoader();  
        view.model.fetch();
      })

    /** privacy-compliance.html (privacy-compliance-page) **/
      .delegate("#privacy-compliance-page", "pageshow", function(ev) {
        var installationId = window.location.href.match("[\\?&]installationId=(\\d+)")[1];
        var installation = new veos.model.Installation({id: installationId});

        var view = new veos.view.PrivacyComplianceView({
          el: ev.target,
          model: installation
        });
        
        view.showLoader();  
        view.model.fetch();
      });      
  };

  // Piwik page analytics
  self.setUpPiwik = function() {
    var pkBaseURL = "//piwik.surveillancerights.ca/";
    //document.write(unescape("%3Cscript src='" + pkBaseURL + "piwik.js' type='text/javascript'%3E%3C/script%3E"));

    try {
      self.piwikTracker = Piwik.getTracker(pkBaseURL + "piwik.php", 1);
      self.piwikTracker.trackPageView();
      self.piwikTracker.enableLinkTracking();
    } catch( err ) {}
  };

  return self;
})(window.veos || {});