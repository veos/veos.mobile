/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, unused: false, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, Android, google */

window.veos = (function(veos) {
  var self = veos;
  self.amendingInst = false;

  var initLastLoc = function () {
    // There are rare occations where the phone doesn't return location information when inside
    // a building (could be a user setting or just a temporary glitch on the phone - happened to Armin serveral times)
    // Should this be the case the callback "haveloc" is never triggered and self.lastLoc stays undefined
    // which leads to an error in .delegate("#report-selection-page" because undefined.coords doesn't work
    // as a result the user get's stuck on the page with buttons not working
    self.lastLoc = JSON.parse('{"coords": {"latitude": 43.6621614579938,"longitude": -79.39527873417967}}');
    //self.lastLoc.coords.latitude = 43.6621614579938;
    //lastLoc.coords.longitude = 79.39527873417967;
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

    self.currentPhotos = []; // Armin: empty array to hold photo objects during report add/change

    if (window.location.pathname === "/") {
      console.log("Redirecting to /app.html");
      window.location.href = "/app.html";
      return;
    }

    // important to do in order to avoid undefined error later on
    initLastLoc();

    jQuery(self).bind('haveloc', function (ev, geoloc) {
      console.log("Got updated gps location: ", geoloc);
      self.lastLoc = geoloc;
    });

    jQuery(document)

    /** overview-map.html (overview-map-page) **/
      .delegate("#overview-map-page", "pageshow", function(ev) {
        //if (!veos.map.overviewMap) {
          veos.map.overviewMap = new veos.map.Map('#overview-map-canvas');
        //}
        //var map = new veos.map.Map('#overview-map-canvas');

        // Google Analytics
        // self.analytics(ev);

        // TODO - FIX THIS HARDCODED NONSENSE. BACKEND CHANGES REALLY MESSED US UP

        // if we have a geographic location for the user...
        if (typeof geoloc !== "undefined") {
          jQuery(self).one('haveloc', function (ev, geoloc) {
            veos.installations = new veos.model.NearbyInstallations(geoloc.coords.latitude, geoloc.coords.longitude, 2);
            veos.installations.on('reset', function(collection) {
              veos.map.overviewMap.addInstallationMarkers(collection);
            });
            veos.installations.fetch({reset:true});
          });
        } else {
          veos.installations = new veos.model.NearbyInstallations(43.6621614579938, -79.39527873417967, 2);
          veos.installations.on('reset', function(collection) {
            veos.map.overviewMap.addInstallationMarkers(collection);
          });
          veos.installations.fetch({reset:true});
        }

        // start following user
        veos.map.overviewMap.startFollowing();
      })

    /** report.html (report-page) **/
      .delegate("#report-page", "pageshow", function(ev) {
        var installationId = 0;
        var editReport = false;
        var ref = '';

        // Google Analytics
        // self.analytics(ev);

        if (window.location.href.match("[\\?&]installationId=(\\d+)")) {
          installationId = window.location.href.match("[\\?&]installationId=(\\d+)")[1];

          // we know that we edit report and we want to change the cancel button if referrer available
          if (installationId > 0) {
            editReport = true;

            if (window.location.href.match("[\\&&]ref=(\\w+-\\w+)")) {
              ref = window.location.href.match("[\\&&]ref=(\\w+-\\w+)")[1];
              // change href in the cancel button to referrer (ref) from URL
              jQuery('#cancel-report').attr('href', ref+'.html?id='+installationId);
            }
          }
        }

        // if the location has been changed by the user (ie loca_lat_from_gps exists), we want the accordion to be open to show the change
        // also - gross
        if (self.currentReport) {
          if (self.currentReport.has('loc_lat_from_gps')) {
            jQuery('#report-location-container').trigger('expand');
          }
        }

        // edit report
        // if (self.currentInstallation) {
        if (editReport) {
          if (self.amendingInst) {
            self.amendingInst = false;
            console.log('Fetching model for installation '+installationId+'...');
            var installation = new veos.model.Installation({id: installationId});

            var installationSuccess = function (model, response) {
              self.currentInstallation = model; // used to set initial location for EditReport
              self.currentReport = model.startAmending();

              self.reportForm = new self.view.ReportEditForm({el: '#report-page', model: self.currentReport});
              self.currentReport.on('change', self.reportForm.render, self.reportForm);

              jQuery('#report-header-text').text('Edit the Installation');
            };

            var installationError = function (model, response) {
              console.error("Error fetching installation model with message: "+response);
              veos.alert("Error fetching installation details");
            };

            installation.fetch({success: installationSuccess, error: installationError});
          } else {
            console.log('Called again - prob after multi picker');
          }
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

            // Armin: Fixing bug where loc_description_from_google is now set in view
            // I think this is due to missing change listener triggering render (did this like we do it above for the editing)
            self.reportForm = new self.view.ReportForm({el: '#report-page', model: self.currentReport});
            self.currentReport.on('change', self.reportForm.render, self.reportForm);
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
      })


    /** refine-location.html (refine-location-page) **/
      .delegate("#refine-location-page", "pageshow", function(ev) {
        if (!veos.reportForm) {
          console.error("Cannot refine location because there is no report currently in progress.");
          jQuery.mobile.changePage("report.html");
          return;
        }

        var refinerMap;
        var refinerLoc;

        // Google Analytics
        // self.analytics(ev);

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
        // var installations = new veos.model.Installations();

        // fetch instalations ordered by closest to furthest without Max distance
        var installations = new veos.model.PagedNearbyInstallations(self.lastLoc.coords.latitude, self.lastLoc.coords.longitude);           // TODO I'm pretty sure this is not the right way to access these

        var view = new veos.view.InstallationList({
          el: ev.target,
          collection: installations
        });

        view.showLoader();
        installations.fetch({
          success: function () {view.hideLoader();},
          reset:true
        });
      })

    /** report-selection.html (report-selection-page) **/
      .delegate("#report-selection-page", "pageshow", function(ev) {
        var MAX_DISTANCE_TO_INST = 0.15;
        // fetch instalations ordered by closest to furthest
        var nearbyInstallations = new veos.model.NearbyInstallations(self.lastLoc.coords.latitude, self.lastLoc.coords.longitude, MAX_DISTANCE_TO_INST);           // TODO I'm pretty sure this is not the right way to access these

        // Google Analytics
        // self.analytics(ev);

        var view = new veos.view.InstallationListReport({
          el: ev.target,
          collection: nearbyInstallations
        });

        view.showLoader();
        nearbyInstallations.fetch({
          success: function () {
            view.hideLoader();
            // could go in the view, but is non-dynamic, and better to do it as early as possible
            if (nearbyInstallations.length > 0) {
              jQuery('.report-selection-dynamic-text').text("The following installations are within " + MAX_DISTANCE_TO_INST*1000 + "m of your current location. If you see an installation listed here that you wish to revise, select it. Otherwise, choose New Installation.");
            } else {
              jQuery('.report-selection-dynamic-text').text("There are no installations within " + MAX_DISTANCE_TO_INST*1000 + "m of your current location. Please choose New Installation.");
            }
          }
        });
      })

    /** installation-details.html (installation-details-page) **/
      .delegate("#installation-details-page", "pageshow", function(ev) {
        console.log("Showing details page at "+window.location.href);
        var installationId = window.location.href.match("[\\?&]id=(\\d+)")[1];
        console.log("Showing details for installation "+installationId);

        // Google Analytics
        // self.analytics(ev);

        self.currentInstallation = new veos.model.Installation({id: installationId});

        var view = new veos.view.InstallationDetails({
          el: ev.target,
          model: self.currentInstallation
        });

        view.showLoader();
        view.model.fetch();
      })

    /** photo-details.html (photo-details-page) **/
      .delegate("#photo-details-page", "pageshow", function(ev) {
        console.log("Showing photo details page at "+window.location.href);

        // Google Analytics
        // self.analytics(ev);

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

        // Google Analytics
        // self.analytics(ev);

        var view = new veos.view.PrivacyComplianceView({
          el: ev.target,
          model: installation
        });

        view.showLoader();
        view.model.fetch();
      });

  };

  // self.analytics = function (ev) {
  //   try {
  //     veos._gaq.push( ['_trackPageview', ev.target.id] );
  //     console.log('Recorded Google Analytics data for page: ' + ev.target.id);
  //   } catch(err) {
  //     console.err('Unable to record Google Analytics data for page: ' + ev.target.id);
  //   }
  // }

  // Piwik page analytics
  // self.setUpPiwik = function() {
  //   var pkBaseURL = "//piwik.surveillancerights.ca/";
  //   //document.write(unescape("%3Cscript src='" + pkBaseURL + "piwik.js' type='text/javascript'%3E%3C/script%3E"));

  //   try {
  //     self.piwikTracker = Piwik.getTracker(pkBaseURL + "piwik.php", 1);
  //     self.piwikTracker.trackPageView();
  //     self.piwikTracker.enableLinkTracking();
  //   } catch( err ) {}
  // };

  return self;
})(window.veos || {});
