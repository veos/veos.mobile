/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, unused: false, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, Android, google */

window.veos = (function(veos) {
  var self = veos;
  self.amendingInst = false;

  // Adding a global object to hold the current geolocation watch ID
  // This allows us in veos.map.js to avoid having several watches added
  self.geolocWatchId = null;


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

  self.goToOverviewMap = function () {
    jQuery.mobile.changePage("#overview-map-page");
  };

  self.goToInstallationList = function () {
    jQuery.mobile.changePage("#installations-list-page");
  }

  self.goToInstallationDetails = function (installationId) {
    veos.currentInstallationId = installationId;
    veos.amendingInst = false;
    veos.view.showGlobalLoader();
    jQuery.mobile.changePage("#installation-details-page", {chageHash: true});
    history.pushState({installationId: installationId}, "Installation Details",
      "#installations/"+installationId+"/details");
  };

  self.goToPhotoDetails = function (installationId, photoId) {
    veos.currentInstallationId = installationId;
    veos.currentPhotoId = photoId;
    jQuery.mobile.changePage("#photo-details-page", {chageHash: true});
    history.pushState({installationId: installationId, photoId: photoId}, "Photo Detail",
      "#installations/"+installationId+"/photos/"+photoId);
  };

  self.goToInstallationReportAmend = function (installationId) {
    veos.currentInstallationId = installationId;
    veos.amendingInst = true;
    jQuery.mobile.changePage("#report-page", {chageHash: true});
    history.pushState({installationId: installationId}, "Amend Installation Report",
      "#installations/"+installationId+"/report/amend");
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

    var defaultLat = self.geo.DEFAULT_POS.coords.latitude;
    var defaultLng = self.geo.DEFAULT_POS.coords.longitude;

    self.installations = new veos.model.NearbyInstallations([], {
      nearLat: defaultLat,
      nearLng: defaultLng,
      maxDist: 2
    });

    // set up the map view

    veos.map.overviewMap = new veos.map.Map('#overview-map-canvas');

    jQuery(veos.geo).on('haveloc', function (ev, geoloc) {
      veos.installations.updateLocation(geoloc.coords.latitude, geoloc.coords.longitude);
      veos.map.overviewMap.setMyLocation(geoloc);
    });

    veos.installations.on('add', function(installation) {
      veos.map.overviewMap.addInstallationMarker(installation);
      jQuery('.installation-count').text(this.size());
    });

    veos.installations.on('reset', function(collection) {
      veos.map.overviewMap.addInstallationMarkers(collection);
    });

    jQuery(veos.geo).one('haveloc', function (ev, geoloc) {
      console.log("haveloc... updating location on installations collection and fetching");
      veos.installations.fetch({
        success: function () { },
        remove: false,
        reset: false
      });
    });

    self.geo.startFollowing();

    // TODO: move this into the view
    veos.installations.summary(function (data) {
      console.log("GOT TOTAL", data)
      jQuery('.installation-count-total').text(data.total_installation_count);
    });

    jQuery(document)

    /** overview-map.html (overview-map-page) **/
      .delegate("#overview-map-page", "pageshow", function(ev) {
        console.log("Fetching installations because we're in the overview-map-page");
        veos.installations.fetch({
          success: function () { },
          remove: false,
          reset: false
        });
      })

      // this intercepts the pagehide event of the map view
      .delegate("#overview-map-page", "pagehide", function(ev) {
        // Now this is a hack as so often to fix other hacks
        // markersArray avoids redrawing of pins on the map if we
        // pan or zoom. However, returning to the map will result in
        // all pins that are in the marker array missing on the map. No redraw.
        //console.log("Hiding Map and destroying markersArray");
        //veos.markersArray = [];
      })

    /** report.html (report-page) **/
      .delegate("#report-page", "pageshow", function(ev) {
        var installationId = veos.currentInstallationId;
        var ref = '';

        // Google Analytics
        // self.analytics(ev);

        // we know that we edit report and we want to change the cancel button if referrer available
        if (veos.amendingInst) {
          var cancelButton = jQuery('#cancel-report');
          cancelButton.off('click'); // remove any previously bound click handlers
          cancelButton.on('click', function () { veos.goToInstallationDetails(installationId); });
        }

        // if the location has been changed by the user (ie loca_lat_from_gps exists), we want the accordion to be open to show the change
        // also - gross
        if (self.currentReport) {
          if (self.currentReport.has('loc_lat_from_gps')) {
            jQuery('#report-location-container').trigger('expand');
          }
        }

        // edit report
        // if (self.currentInstallation) {{
        if (self.amendingInst) {
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
        } else { // new report
          if (!self.currentReport) {
            self.currentReport = new veos.model.Report();

            if (veos.geo.lastLoc) {
              var initLoc = veos.map.convertGeolocToGmapLatLng(veos.geo.lastLoc);
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
          jQuery.mobile.changePage("#report-page");
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
        else if (veos.geo.lastLoc) {
          refinerLoc = veos.geo.lastLoc;
          refinerMap = new veos.map.Map('#refine-location-canvas', refinerLoc);
        }
        // should never occur
        else {
          console.log("Cannot refine location because there is no lat/lng");
        }

        refinerMap.addReportRefinerMarker(self.reportForm.model, refinerLoc);
      })

      .delegate("#installations-list-page", "pageinit", function (ev) {
        self.installationListView = new veos.view.InstallationList({
          el: jQuery('#installations-list-page')[0],
          collection: self.installations
        });

        // some installations may have been loaded before this pageinit, so
        // lets bring the list up to date
        self.installationListView.render();
      })
      .delegate("#installations-list-page", "pageshow", function(ev) {
        veos.installationListView
          .enableAutoLoadMoreOnScroll();
      })
      .delegate("#installations-list-page", "pagehide", function(ev) {
        veos.installationListView
          .disableAutoLoadMoreOnScroll();
      })

    /** report-selection.html (report-selection-page) **/
      .delegate("#report-selection-page", "pageshow", function(ev) {
        var MAX_DISTANCE_TO_INST = 0.15;
        // fetch installations ordered by closest to furthest
        var lastLoc = self.geo.lastLoc;
        var nearbyInstallations = new veos.model.NearbyInstallations([], {
          nearLat: lastLoc.coords.latitude,
          nearLng: lastLoc.coords.longitude, 
          maxDist: MAX_DISTANCE_TO_INST
        });

        // Google Analytics
        // self.analytics(ev);

        var view = new veos.view.InstallationListReport({
          el: ev.target,
          collection: nearbyInstallations
        });

        nearbyInstallations.fetch({
          success: function () {
            veos.view.hideGlobalLoader();
            // could go in the view, but is non-dynamic, and better to do it as early as possible
            if (nearbyInstallations.length > 0) {
              jQuery('.report-selection-dynamic-text').text("The following installations are within " + MAX_DISTANCE_TO_INST*1000 + "m of your current location. If you see an installation listed here that you wish to revise, select it. Otherwise, choose New Installation.");
            } else {
              jQuery('.report-selection-dynamic-text').text("There are no installations within " + MAX_DISTANCE_TO_INST*1000 + "m of your current location. Please choose New Installation.");
            }
          },
          reset:true
        });
      })


      .delegate("#installation-details-page", "pageinit", function(ev) {
        self.installationDetailView = new veos.view.InstallationDetails({
          el: ev.target,
          model: new veos.model.Installation()
        });
      })
      .delegate("#installation-details-page", "pageshow", function(ev) {
        var installationId = veos.currentInstallationId;
        console.log("Showing details page at "+window.location.href);
        //var installationId = window.location.href.match("[\\?&]id=(\\d+)")[1];
        console.log("Showing details for installation "+installationId);

        var view = self.installationDetailView;
        view.model.set({id: self.currentInstallationId}, {silent: true});

        view.dontRender = true;
        view.model.fetch({success: function () {
          view.dontRender = false;
        }});
      })
      .delegate("#installation-details-page", "pagehide", function(ev) {
        // clear the pictures now so they don't show up briefly when we switch
        // to another installation
        self.installationDetailView.resetPictures();

        self.installationDetailView.unbind();
      })

    /** photo-details.html (photo-details-page) **/
      .delegate("#photo-details-page", "pageshow", function(ev) {
        console.log("Showing photo details page at "+window.location.href);

        // Google Analytics
        // self.analytics(ev);

        // retrieve installationId from URL
        //var installationId = window.location.href.match("[\\?&]installationId=(\\d+)")[1];
        var installationId = veos.currentInstallationId;
        // and set it in the href of the back button
        var backButton = jQuery('.photo-details-page-back-button');
        backButton.off('click'); // remove any previously bound click handlers
        backButton.on('click', function () { veos.goToInstallationDetails(installationId); });

        var photoId = veos.currentPhotoId;

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
