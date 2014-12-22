/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, unused: false, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, Android, google */

window.veos = (function(veos) {
  var self = veos;
  self.amendingInst = false;

  // Adding a global object to hold the current geolocation watch ID
  // This allows us in veos.map.js to avoid having several watches added
  self.geolocWatchId = null;

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

      // this intercepts the pagehide event of the map view
      .delegate("#overview-map-page", "pagehide", function(ev) {
        // Now this is a hack as so often to fix other hacks
        // markersArray avoids redrawing of pins on the map if we
        // pan or zoom. However, returning to the map will result in
        // all pins that are in the marker array missing on the map. No redraw.
        console.log("Hiding Map and destroying markersArray");
        veos.markersArray = [];
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

      .delegate("#installations-list-page", "pagehide", function(ev) {
        // The InstallationList View that is instantiated during the pageshow of #installations-list-page
        // attaches a scroll listener that should only be active as long as we are on the list view.
        // calling backbone's remove() on the view we remove the view from the DOM and stop listening to any bound event
        jQuery(window).off('scroll');
      })

    /** report-selection.html (report-selection-page) **/
      .delegate("#report-selection-page", "pageshow", function(ev) {
        var MAX_DISTANCE_TO_INST = 0.15;
        // fetch installations ordered by closest to furthest
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
          },
          reset:true
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

/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, _,google */

(function(veos) {
  var self = {};

  self.convertGeolocToGmapLatLng = function (geoloc) {
    if (geoloc instanceof google.maps.LatLng) {
      return geoloc; // TODO: should be _.clone() this just to be safe?
    } else {
      return new google.maps.LatLng(geoloc.coords.latitude, geoloc.coords.longitude);
    }
  };

  self.Map = function (mapDiv, initLoc) {
    console.log("initializing map in " + mapDiv);

    if (veos.isAndroid()) {
      // we're in the Android app
      jQuery('.web-only').addClass('hidden');
      jQuery('.android-only').removeClass('hidden');
    } else {
      // we're in a regular browser
      jQuery('.web-only').removeClass('hidden');
      jQuery('.android-only').addClass('hidden');
    }

    var center;
    var zoom;
    if (!initLoc) {
      center = new google.maps.LatLng(43.6621614579938, -79.39527873417967);
      zoom = 4;
    } else {
      center = veos.map.convertGeolocToGmapLatLng(initLoc);
      zoom = 16;
    }

    var mapOptions = {
      zoom: zoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      center: center,
      streetViewControl: false,
      zoomControl: true, // changed this back to true - pinch zoom not working on some phones (note ZoomControl must be set to +/- or will not show up on Android 3.0 and later)
      zoomControlOptions: {
          style: google.maps.ZoomControlStyle.SMALL
      }
    };

    jQuery(mapDiv).empty(); // empty out the div in case it was previously used to init another map...

    var mapElement = jQuery(mapDiv)[0];

    var gmap = new google.maps.Map(mapElement, mapOptions);

    jQuery(document).bind("pageshow", function (ev) {
        console.log("Triggering gmaps resize for page ", ev.target);
        google.maps.event.trigger(gmap, 'resize');
    });

    this.gmap = gmap;

    google.maps.event.addListener(gmap, 'dragend', function() {
      console.log('dragend triggered');
      var center = gmap.getCenter();
      veos.installations.updateLocation(center.lat(), center.lng());
      veos.installations.fetch({reset:true});
    });

    google.maps.event.addListener(gmap, 'zoom_changed', function() {
      console.log('zoom_changed triggered');
      var zoom = gmap.getZoom();
      veos.installations.updateMaxDistance(80000/(Math.pow(2, zoom)));      // BASED ON http://stackoverflow.com/questions/8717279/what-is-zoom-level-15-equivalent-to
      veos.installations.fetch({reset:true});
    });

    google.maps.event.addListener(gmap, 'center_changed', function() {
      console.log('center_changed');
      var center = gmap.getCenter();
      veos.installations.updateLocation(center.lat(), center.lng());
      veos.installations.fetch({reset:true});
    });

  };

  self.Map.prototype = {

  };


  /**
    Shows the current location marker and continuously updates its
    position based on incoming GPS data.
  **/
  self.Map.prototype.startFollowing = function () {
    var map = this;

    // clearing watch with globally stored ID
    if (veos.geolocWatchId) {
      navigator.geolocation.clearWatch(veos.geolocWatchId);
    }


    console.log("Started following user...");


    // This implementation is missing an error hanlder and most important the options
    // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation.watchPosition
    veos.geolocWatchId = navigator.geolocation.watchPosition(function (geoloc) {
      jQuery(veos).trigger('haveloc', geoloc);

      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
      var accuracy = geoloc.coords.accuracy;

      if (!map.currentLocMarker) {
        map.currentLocMarker = new google.maps.Marker({
          position: glatlng,
          //draggable: true,
          //icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          icon: 'http://maps.google.com/mapfiles/ms/micons/man.png',
          //icon: 'http://www.google.com/mapfiles/arrow.png',
          title: "You are here",
          zIndex: 99999 // half assed attempt at making sure the dude is on top
        });

        var infowindow = new google.maps.InfoWindow({
          content: "<p><b>You are here!</b></p>"
        });

        google.maps.event.addListener(map.currentLocMarker, 'click', function() {
          infowindow.open(map.gmap, map.currentLocMarker);
        });

        map.currentLocRadius = new google.maps.Circle({
          center: glatlng,
          radius: accuracy,
          map: map.gmap,
          fillColor: '#6991FD',
          fillOpacity: 0.4,
          strokeColor: 'black',
          strokeOpacity: 0.0, // 0.8,
          strokeWeight: 1
        });

        map.gmap.setZoom(16);             // sets zoom back to default level (relevant if user does not gps and !initLoc in line 21)

        map.currentLocMarker.setMap(map.gmap);

        map.gmap.panTo(glatlng);
      }

      // this would reframe the map to the accuracy circle
      //self.gmap.fitBounds(self.currentLocRadius.getBounds());


      map.currentLocMarker.setPosition(glatlng);
      map.currentLocRadius.setCenter(glatlng);
      map.currentLocRadius.setRadius(accuracy);
    },
    function (err) {
      console.warn('ERROR(' + err.code + '): ' + err.message);
      if (err.code === 1) {
        veos.alert("We are unable to locate you, because geolocation has been denied");
      } else if (err.code === 2) {
        // currently unhandled (we can't produce this with our phones)
        console.warn("This error should be handled somehow");
      } else if (err.code === 3) {
        veos.alert("Your device is currently unable to determine location");
      } else {
        console.warn("Unknown error code");
      }
    },
    // https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions
    // We do low accuracy to save batter, timeout till we get a result of 15 seconds and we accept any cached result (switched to true)
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: Infinity
    }

    );
  };

  /**
    Stops updating the current location marker.
  **/
  self.Map.prototype.stopFollowing = function () {
    console.log("Stopped following user...");
    navigator.geolocation.clearWatch(veos.geolocWatchId);
  };

  /**
    Removes the current location marker from the map.
  **/
  self.Map.prototype.clearCurrentLocation = function () {
    console.log("Resetting current location...");
    this.currentLocMarker.setMap(null);
  };


  /**
    Adds markers for a collection of Installations.
    @param installations veos.model.Installations
  **/
  self.Map.prototype.addInstallationMarkers = function (installations) {
    console.log("Adding "+installations.length+" installation markers to map...");

    // var installationCountMsg = humane.create({ timeout: 3000 });
    //installationCountMsg.log("Total # of installations reported: " + installations.length);


    var map = this;
    if (veos.markersArray === undefined) {
      veos.markersArray = [];
    }

    map.infowindow = new google.maps.InfoWindow({
      // do you seriously need a plugin for styling infowindows?!?! Puke
      // http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/docs/examples.html
      // http://code.google.com/p/google-maps-utility-library-v3/wiki/Libraries
    });

    installations.each(function(i) {
      if (!_.findWhere(veos.markersArray, {"id": i.id})) {
        var latLng = new google.maps.LatLng(i.get('loc_lat'), i.get('loc_lng'));
        var buttonText = "";

        var compliancePinOn;
        var compliancePinOff;
        var compliancePin;
        if (i.get('compliance_level') === 'compliant') {
          compliancePinOn = '/images/pin-green-on.png';
          compliancePinOff = '/images/pin-green-off.png';
        } else if (i.get('compliance_level') === 'min_compliant') {
          compliancePinOn = '/images/pin-yellow-green-on.png';
          compliancePinOff = '/images/pin-yellow-green-off.png';
        } else if (i.get('compliance_level') === 'low_compliant') {
          compliancePinOn = '/images/pin-yellow-on.png';
          compliancePinOff = '/images/pin-yellow-off.png';
        } else if (i.get('compliance_level') === 'non_compliant') {
          compliancePinOn = '/images/pin-red-on.png';
          compliancePinOff = '/images/pin-red-off.png';
        } else {
          compliancePin = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        }

        var marker = new google.maps.Marker({
          id: i.id,
          position: latLng,
          icon: compliancePinOn,
          iconUnselected: compliancePinOff,
          iconSelected: compliancePinOn,
          title: i.get('owner_name') || "Unknown Owner"
        });

        // duplicating html from InstallationList (veos.view.js) for popup content
        var mapPopupContent;

        if (i.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + i.get('owner_name') + "</span><br/><span class='trunc-address'>" + i.getTruncatedLocDescription() + "</span>";
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='trunc-address'>" + i.getTruncatedLocDescription() + "</span>";
        }

        var thumb = "";
        if (i.has('photos') && i.get('photos').length > 0) {
          var photoID = i.get('photos')[0].id;
          thumb = "<img class='photo photo-"+photoID+"' />";
        }

        mapPopupContent = "<a class='styled-link-text' href=installation-details.html?id="+i.id+">"+thumb+buttonText+"</a>";

        // binding a popup click event to the marker
        google.maps.event.addListener(marker, 'click', function() {
          injectThumbnail(i);
          map.infowindow.setContent(mapPopupContent);
          map.infowindow.open(map.gmap, marker);
          highlightOwnerPins(marker, i.get('owner_name'));
        });

        // binding a click event that triggers when the infowindow is closed
        google.maps.event.addListener(map.infowindow, 'closeclick', function() {
          _.each(veos.markersArray, function(m) {
            m.setIcon(m.iconSelected);
          });
        });

        marker.setMap(map.gmap);
        veos.markersArray.push(marker);
      }
    });
  };

  var closeMarker = function() {
    console.log('it triggered');
  };

  self.Map.prototype.clearInstallationMarkers = function() {
    // deletes everything in the markersArray
    console.log('clearing all markers...');
    _.each(veos.markersArray, function(i) {
      i.setMap(null);
    });
    // this may not be necessary (they're going to get overwritten by addInstallationMarkers immediately), but seems safer
    veos.markersArray = [];
  };

  var injectThumbnail = function(installation) {
    if (installation.has('photos') && installation.get('photos').length > 0) {
      var photoID = installation.get('photos')[0].id;

      console.log('Trying to retrieve photo thumb URL for photo with ID: '+photoID);

      var thumbPhoto = new veos.model.Photo({id: photoID});

      var photoFetchSuccess = function (model, response) {
        console.log("We made it and are about to retrieve Photo thumb URL");
        var img = jQuery('.photo-'+model.id);
        img.attr('src', model.thumbUrl());
      };

      var photoFetchError = function (model, response) {
        console.error("Fetching photo model for Installation List failed with error: " +response);
      };

      thumbPhoto.fetch({success: photoFetchSuccess, error: photoFetchError});
    }
   };


  var highlightOwnerPins = function(marker, ownerName) {
    // clear the markers (set back to initial state)
    _.each(veos.markersArray, function(m) {
      m.setIcon(m.iconUnselected);
    });

    // set the clicked marker as selected (necessary because the _.each will only catch markers with known owner_names)
    marker.setIcon(marker.iconSelected);

    var ownerInstallations = new veos.model.Installations();

    var ownerSuccess = function (model, response) {
      ownerInstallations.each(function(i) {
        console.log('related installation ids: ' + i.get('id'));

        // this is very inefficient, but working (will ping once for *each* match... lots of duplicate higlights)
        // can we use pluck or filter or find here? Or even better, can we count on the fact that all ownerInstallations have the same name?
        _.each(veos.markersArray, function(m) {
          // if the owner_names match
          if (m.title === i.get('owner_name')) {
            console.log('found one: ' + i.get('owner_name'));
            m.setIcon(m.iconSelected);
            m.setZIndex(1000);                 // move this marker to the front, does not seem to need to be cleared
          }
        });

      });
    };

    ownerInstallations.fetch({
      success: ownerSuccess,
      data: {owner_name: ownerName}
    });
  };

  /**
    Adds a draggable report marker, used for refining report location.
  **/
  self.Map.prototype.addReportRefinerMarker = function (report, geoloc) {
    var map = this;

    var drawMarker = function(geoloc) {
      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);

      var marker = new google.maps.Marker({
        position: glatlng,
        draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title: "Report location"
      });

      // adding an event listener to retrieve location once marker is dragged
      google.maps.event.addListener(marker, 'dragend', function (event) {
        console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
        report.set({
          loc_lat_from_user: event.latLng.lat(),
          loc_lng_from_user: event.latLng.lng()
        });
      });

      marker.setMap(map.gmap);

      map.gmap.setCenter(glatlng);

      google.maps.event.addListenerOnce(map.gmap, 'tilesloaded', function () {
        map.gmap.panTo(glatlng);
      });
    };

    if (geoloc) {
      drawMarker(geoloc);
    } else {
      navigator.geolocation.getCurrentPosition(function (geoloc) {
        drawMarker(geoloc);
      }, null, {enableHighAccuracy: true});
    }

  };


  self.generateStaticMapURL = function(geoloc) {
    var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);

    var url = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" +
      glatlng.lat() + "," + glatlng.lng();

    // add the current location as red pin to the map
    url += "&markers=color:blue%7C" + glatlng.lat() + "," + glatlng.lng();

    return url;
  };


  // perform a reverse geolocation lookup (convert latitude and longitude into a street address)
  self.lookupAddressForLoc = function(geoloc, successCallback) {
    console.log("Looking up address for ", geoloc);
    var geocoder = new google.maps.Geocoder();
    var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);

    geocoder.geocode({'latLng': glatlng}, function(results, status) {
      if (status === google.maps.GeocoderStatus.OK) {
        if (results[0]) {
          console.log("Reverse geocoding for: ", glatlng, " returned this address: ", results[0].formatted_address);
          successCallback(results[0]);
        }
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  };

  // lookup geolocation for a given street address
  self.lookupLocForAddress = function(address, successCallback) {
    console.log("Looking up loc for address ", address);
    var geocoder = new google.maps.Geocoder();

    geocoder.geocode({'address': address}, function(results, status) {
      if (status === google.maps.GeocoderStatus.OK) {
        var lat = results[0].geometry.location.lat();
        var lng = results[0].geometry.location.lng();

        console.log("Reverse geocoding for address: " + address + " returned this latitute: " + lat + " and longitude: " + lng);
        successCallback(lat, lng);
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  };

  veos.map = self;
})(window.veos);

/*jshint sub:true, debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*global Backbone, _, jQuery, Android, FileTransfer, FileUploadOptions, google */

(function(veos) {
  var model = {};

  // model.baseURL = window.location.protocol + "://" + window.location.host +
  //   (window.location.port ? ':' + window.location.port : '');
  //model.baseURL = "http://backend.veos.ca";
  //model.baseURL = "http://veos.surveillancerights.ca";
  //model.baseURL = "http://192.168.222.108:3000";
  //model.baseURL = "http://192.168.43.221:3000";

  // need full URL for photo uploads to work with reverse proxying
  model.baseURL = location.protocol + "//" + location.host + "/backend";

  // model.baseURL = "http://backend.dev.surveillancerights.ca";

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  /**
   * Does recursive magic on the given 'attrs' object, renaming
   * each property given in 'nested' array from "myprop" to "myprop_attributes".
   * This is done to make Rails' accepts_nested_attributes_for happy.
   **/
  function wrapNested(nested, attrs) {
    _.each(nested, function (k) {
      if (k instanceof Array) {
        if (attrs[k[0]]) {
          wrapNested(k[1], attrs[k[0]]);
        }
        k = k[0];
      }

      if (attrs[k]) {
        attrs[k+"_attributes"] = attrs[k];
        delete attrs[k];
      }
    });
  }

  var Base = Backbone.Model.extend({
    initialize: function (attributes, options) {
      this.bind("error", this.defaultErrorHandler);
    },
    toJSON: function() {
      var attrs = _.clone( this.attributes ); // WARNING: shallow clone only!

      wrapNested(this.nested, attrs);

      var wrap = {};
      wrap[this.singular] = attrs;
      return wrap;
    },
    url: function () {
      var base = model.baseURL + '/' + this.plural;
      if (this.isNew()) {
        return base + '.json';
      }
      else {
        return base + '/' + this.id + '.json';
      }
    },
    defaultErrorHandler: function (model, response, opts) {
      console.error("Error on "+this.singular+" model: " + JSON.stringify(model) + " --- " + JSON.stringify(response));

      var msg;

      // FIXME: a 422 response over cross domain will for some reason return status 0... catching it like this here
      //        could result in bogus error reporting.
      if (response.status === 422 || response.status === 0) {
        msg = "Sorry, there is a problem in your "+this.singular+". Please check your input and try again.";
        var errors = {};
        try {
          errors = JSON.parse(response.responseText).errors;
        } catch (err) {
          console.error("Couldn't parse response text: "+response.responseText+ " ("+err+")");
        }

        var errContainer = jQuery("#error-message-container");

        _.each(errors, function(v, k) {
          var errField = jQuery("*[name='"+k+"'].field");

          if (errField.is(':checkbox, :radio')) {
            errField = errField.parent();
          }

          errField.addClass("error");
          jQuery('*[for='+errField.attr('id')+']').addClass("error");
          errField.one('change focus', function() {
            errField.removeClass("error");
            jQuery('*[for='+errField.attr('id')+']').removeClass("error");
          });


          if (errContainer.length !== 0) {
            var humanFieldName = k.replace(/_/, ' ');
            errContainer.append("<li><strong>"+humanFieldName+"</strong> "+v+"</li>");
          }
        });

        if (errContainer.length !== 0) {
          errContainer.show();
        }

      } else if (response.status >= 500 && response.status < 600) {
        msg = "Our apologies, the server responded with an error. There may be a problem with the system.";
      } else {
        msg = "Sorry, there was an error while performing this action. The server may be temporarily unavailable.";
      }

      jQuery('html, body').animate({ scrollTop: 0 }, 0);

      veos.alert(msg, "Error");
    }
  });


  /*** Report ***/

  model.Report = Base.extend({
    singular: "report",
    plural: "reports",
    nested: ['tags', ['photos', ['tags']], ['installation', ['organization']]],
    defaults: {
      'owner_identifiable': true
    },

    // validate: function(attrs) {
    //   console.log("Validating the model...");

    //   var validationObj = {};

    //   // not checking all 'required' fields since it's pretty conditional requirements for now (if B but not A, then...), and there are only 3
    //   // better to check using attrs, if possible, rather than the fields using jQuery

    //   // owner_name or owner_identifiable must be filled
    //   if (!(attrs.owner_name)) {
    //     if (jQuery('#unidentified-owner-checkbox').is(':checked')) {
    //       console.log('passing validation...');
    //     } else {
    //       alert('Owner name must be filled in or marked as unidentifiable');
    //     }
    //   }

    //   // if owner_name is filled, owner_type must be filled
    //   if (!(attrs.owner_type)) {
    //     if (attrs.owner_name) {
    //       alert('Owner type must be filled out if owner can be identified');
    //     }
    //   }

    //   // _.all(jQuery("input.required").val(), funciton (v) { return v != "" })
    // },

    attachPhoto: function (photo, successCallback) {
      var report = this;
      photo.save({'report_id': report.id}, {success: function () {
        if (!report.photos) {
          report.photos = [];
        }

        report.photos.push(photo);
        photo.report = report; // in case we need to later refer to the report we're attached to from the photo

        report.updatePhotosAttribute();

        photo.on('change sync', report.updatePhotosAttribute, report);

        console.log("Photo "+photo.id+" attached to report "+ report.id);

        if (successCallback) {
          successCallback(report, photo);
        }
      }});
    },

    removePhoto: function (fingerprint) {
      var report = this;

      // this shouldn't really happen...
      if (!report.photos) {
        report.photos = [];
      }

      var photo = _.find(report.photos, function (p) {
        return p.get('image_fingerprint') === fingerprint;
      });

      if (!photo) {
        console.error("Tried to remove a photo with fingerprint '"+fingerprint+"' but this report has no such photo. Attached photos are:",report.photos);
        throw "Tried to remove a photo that doesn't exist in this report!";
      }

      report.photos.splice(_.indexOf(report.photos, photo), 1);
      report.updatePhotosAttribute();
    },

    updatePhotosAttribute: function () {
      if (!this.photos) {
        this.photos = [];
      }

      var photos = [];

      _.each(this.photos, function (photo) {
        photos.push(photo.toJSON()['photo']);
      });

      this.set('photos', photos);
      this.trigger('change');
    },

    addTag: function (tag, tagType) {
      var tags = this.get('tags');
      if (!tags) {
        tags = [];
      }

      tags.push({tag: tag, tag_type: tagType});

      this.set('tags', tags);
      this.trigger('change');
    },

    removeTag: function (tag, tagType) {
      var tags = this.get('tags');

      var t;
      while (this.findTag(tag, tagType)) {
        t = this.findTag(tag, tagType);
        tags.splice(_.indexOf(tags, t), 1);
      }

      this.trigger('change');
    },

    setTags: function (tags, tagType) {
      var ts = _.reject(this.get('tags'), function (t) {
        return t.tag_type === tagType;
      });
      ts = _.uniq(ts, false, function (t) {
        return [t.tag, t.tag_type];
      });
      _.each(_.uniq(tags), function (t) {
        ts.push({tag: t, tag_type: tagType});
      });

      this.set('tags', ts);
    },

    findTag: function (tag, tagType) {
      var tags = this.get('tags');

      return _.find(tags, function (t) {
        return t.tag === tag && t.tag_type === tagType;
      });
    },

    // return attached photos as Photo model objects
    getPhotos: function () {
      return _.map(this.get('photos'), function (data) { return new model.Photo(data);});
    },

    getLatLng: function() {
      if (this.get('loc_lat_from_user')) {
        console.log('In getLatLng() returning loc from user. Lat: '+this.get('loc_lat_from_user')+' Lng: '+this.get('loc_lng_from_user')+'');
        return new google.maps.LatLng(this.get('loc_lat_from_user'), this.get('loc_lng_from_user'));
      } else if (this.get('loc_lat_from_gps')) {
        console.log('In getLatLng() returning loc from GPS. Lat: '+this.get('loc_lat_from_gps')+' Lng: '+this.get('loc_lng_from_gps')+'');
        return new google.maps.LatLng(this.get('loc_lat_from_gps'), this.get('loc_lng_from_gps'));
      } else {
        return null;
      }
    },

    getLocDescription: function() {
      return this.get('loc_description_from_user') || this.get('loc_description_from_google') || "";
    }
  });

  model.Reports = Backbone.Collection.extend({
      model: model.Report,
      url: model.baseURL + '/reports.json'
  });

  /*** Installation ***/

  model.Installation = Base.extend({
    singular: "installation",
    plural: "installations",

    getLocDescription: function() {
      return this.get('loc_description') || "";
    },

    getTruncatedLocDescription: function() {
      var locText = this.get('loc_description') || "";
      return locText.substring(0,24) + '...';
    },

    startAmending: function () {
      var newReport = new model.Report();
      newReport.fetch({url: model.baseURL + '/installations/' + this.id + '/amend.json'});
      return newReport;
    }

  });

  model.Installations = Backbone.PageableCollection.extend({
      model: model.Installation,
      url: model.baseURL + '/installations.json'
  });

  model.PagedNearbyInstallations = Backbone.PageableCollection.extend({
      initialize: function (nearLat, nearLng) {
        this.nearLat = nearLat;
        this.nearLng = nearLng;
        // Since we want people to be able to scroll to any installation
        // no matter how fare away we set maxDist to half of the circumference of the earth
        this.maxDist = 20000;
      },
      model: model.Installation,
      url: function () {
        return model.baseURL + '/installations/near.json?lat=' + this.nearLat + '&lng=' + this.nearLng + '&max_dist=' + this.maxDist;
      }
  });

  model.NearbyInstallations = Backbone.Collection.extend({
      initialize: function (nearLat, nearLng, maxDist) {
        this.nearLat = nearLat;
        this.nearLng = nearLng;
        this.maxDist = maxDist;
      },
      updateLocation: function (nearLat, nearLng, maxDist) {
        this.nearLat = nearLat;
        this.nearLng = nearLng;
        if (maxDist) {this.maxDist = maxDist;}
      },
      updateMaxDistance: function(maxDist) {
        this.maxDist = maxDist;
      },
      model: model.Installation,
      url: function () {
        return model.baseURL + '/installations/near.json?lat=' + this.nearLat + '&lng=' + this.nearLng + '&max_dist=' + this.maxDist + '&per_page=500';
      }
  });

  /*** Organization ***/

  model.Organization = Base.extend({
    singular: "organization",
    plural: "organizations"
  });

  /*** Photo ***/

  model.Photo = Base.extend({
    singular: "photo",
    plural: "photos",
    nested: ['tags'],

    captureFromCamera: function () {
      this.capture("camera");
    },

    captureFromGallery: function () {
      this.capture("gallery");
    },

    // used for desktop browser uploads
    captureFromFile: function (file) {
      this.imageFile = file;
      this.captureSuccess();
    },

    captureSuccess: function () {
      var photo = this;
      photo.trigger('image_capture');
    },

    capture: function (from) {
      var photo = this;

      if (from === "camera") {
        console.log("Trying to select photo from gallery...");
      } else if (from === "gallery") {
        console.log("Trying to capture photo from camera...");
      } else {
        throw "Trying to capture from unknown source!";
      }

      // NOTE: scope needs to be global for it to be callable inside android

      window.androidUploadStart = function () {
        photo.trigger('image_upload_start');
      };

      window.androidUploadError = function () {
        photo.trigger('image_upload_error');
      };

      window.androidUploadSuccess = function (id) {
        console.log("Image uploaded successfully.");

        photo.set('id', id);
        console.log("Photo model in Photo.capture.androidUploadSuccess:"+ JSON.stringify(photo.toJSON(), null, 2));
        photo.fetch({
          success: function () {
            console.log("Assigned id to photo: "+photo.id);
            console.log("Photo model in Photo.capture.androidUploadSuccess.fetch:"+ JSON.stringify(photo.toJSON(), null, 2));
            photo.trigger('image_upload_finish');
          }
        });
      };

      window.androidCaptureSuccess = function () {
        photo.captureSuccess();
      };

      // need to pass callback funciton name as string so that
      // it can be executed on the Android side

      if (from === "camera") {
        console.log("Telling Android to get the photo from Camera. Will send to URL: "+this.url());
        Android.getPhotoFromCamera(this.url(), 'window.androidCaptureSuccess');
      } else if (from === "gallery") {
        console.log("Telling Android to get the photo from Gallery. Will send to URL: "+this.url());
        Android.getPhotoFromGallery(this.url(), 'window.androidCaptureSuccess');
      }
    },

    upload: function () {
      var photo = this;

      // if (!photo.imageURL) {
      //   throw new Error("Cannot upload photo because it does not have an imageURL! You need to capture an image before uploading.");
      // }
      if (!photo.imageFile) {
        throw new Error("Cannot upload photo because it does not have a imageFile property! You need to capture an image before uploading.");
      }

      console.log("Uploading photo: "+photo.imageFile.name);
      photo.trigger('image_upload_start');

      // var options = new FileUploadOptions();
      // options.fileKey = "photo[image]";
      // options.fileName = photo.imageURL.substr(photo.imageURL.lastIndexOf('/')+1);
      // options.mimeType = "image/jpeg";
      // chunkedMode false uses more memory and might lead to crashes after some pictures
      // chunkedMode true can lead to a situation where no data is transmitted to the server
      // this seems to be fixed by setting the 6th value in transfer.upload to true (acceptSelfSignedCert)
      // while I am not sure how that affects a unencrypted http connection it seems to work
      // Sep 11, 2012 doesn't seem to work so set to false
      // options.chunkedMode = false;

      var success = function (data) {
        console.log("Image uploaded successfully; "+data.image_file_size+" bytes uploaded.");

        photo.set('id', data.id);

        console.log("Assigned id to photo: "+data.id);

        photo.set(data);

        photo.trigger('image_upload_finish', data);
      };

      var failure = function (error) {
        console.error("Image upload failed: " + JSON.stringify(error));
        photo.trigger('image_upload_error', error);
      };

      // WARNING: This uses XHR2 to upload the file. This is not supported by older browsers.
      //          See http://caniuse.com/xhr2 and http://stackoverflow.com/questions/4856917/jquery-upload-progress-and-ajax-file-upload/4943774#4943774
      var formData = new FormData();
      formData.append('photo[image]', photo.imageFile);

      jQuery.ajax({
        url: photo.url(),
        type: 'POST',
        // xhr: function () {
        //   myXhr = $.ajaxSettings.xhr();
        //   if(myXhr.upload){ // if upload property exists
        //       myXhr.upload.addEventListener('progress', progressHandlingFunction, false); // progressbar
        //   }
        //   return myXhr;
        // },
        success: success,
        error: failure,
        data: formData,
        cache: false,
        contentType: false,
        processData: false
      }, 'json');
    },

    addTag: function (tag) {
      var tags = this.get('tags');
      if (!tags) {
        tags = [];
      }

      tags.push({tag: tag});

      this.set('tags', tags);
      this.trigger('change');
    },

    removeTag: function (tag) {
      var tags = this.get('tags');

      var t;
      while (this.findTag(tag)) {
        t = this.findTag(tag);
        if (t.id) {
          t._destroy = true;
        } else {
          tags.splice(_.indexOf(tags, t), 1);
        }
      }

      this.trigger('change');
    },

    setTags: function (tags) {
      var ts = [];
      this.set('tags', ts);
      _.each(tags, function (t) {
        ts.push({tag: t});
      });
    },

    findTag: function (tag) {
      var tags = this.get('tags');

      return _.find(tags, function (t) {
        return t.tag === tag && !t._destroy;
      });
    },

    thumbUrl: function () {
      if (veos.isAndroid()) {
        return model.baseURL + "/" + this.get('thumb_url');
      } else {
        return model.baseURL + "/" + this.get('big_thumb_url');
      }
    },

    bigUrl: function () {
      return model.baseURL + "/" + this.get('big_url');
    },

    originalUrl: function () {
      return model.baseURL + "/" + this.get('original_url');
    }
  });


  veos.model = model;
})(window.veos);

/*jshint debug:true, noarg:true, noempty:true, eqeqeq:false, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true, unused:false */
/*global Backbone, _, jQuery, Android, FileTransfer, FileUploadOptions, google, device */

(function(veos) {
  var self = {};

  var addLoader = function (container) {
    var loader = jQuery("<div class='loading'><img src='images/loading-64.gif' alt='Loading...' /><p>Loading...</p></div>");
    jQuery(container).append(loader);
    return loader;
  };

  /**
    ReportForm
    Wires report.html for editing a Report object.
  **/
  self.ReportForm = Backbone.View.extend({
    events: {
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);
        this.model.setTags(f.val(), f.attr('name'));
        console.log("Setting "+f.attr("name")+" to "+f.val());
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#report-sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#report-sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },

      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        veos.currentPhoto.captureFromCamera();
        veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
      },

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        veos.currentPhoto.captureFromGallery();
        veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
      },


      'change #photo-from-hard-drive': function (ev) {
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        var fileInput = this.$el.find('#photo-from-hard-drive');

        veos.currentPhoto.on('image_capture', function (ev, photo) {
          veos.currentPhoto.upload();
          veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
        });

        veos.currentPhoto.captureFromFile(fileInput[0].files.item(0));
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      var report = this.model;

      //var self = this;
      console.log("Initializing ReportForm...");

      // this.model.on('change', _.bind(this.updateChangedFields, this));         doing this all in the render now - better, and 'changed fields' is useless due to refining map

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });

      // setup autocomplete
      var ownerNameField = this.$el.find("input[name='owner_name']");
      ownerNameField.autocomplete({
          method: 'GET', // allows POST as well
          icon: 'arrow-r', // option to specify icon
          target: this.$el.find('#owner-name-suggestions'), // the listview to receive results
          source: veos.model.baseURL + '/installations/autocomplete_owner_name.json', // URL return JSON data
          callback: function (ev) {
            report.set('owner_name', jQuery(ev.currentTarget).text());
            ownerNameField.autocomplete('clear');
          }, // optional callback function fires upon result selection
          //link: 'target.html?term=', // link to be attached to each result
          minLength: 1, // minimum length of search string
          transition: 'none',// page transition, default is fade
          matchFromStart: true // search from start, or anywhere in the string
      });
    },

    submit: function () {
      // clear out previous server generated error messages and highlights
      // generally redundant, but necessary due to owner_identifiable, which affects multiple otherwise unrelated fields
      jQuery('#error-message-container li').not('.error-message-header').remove();
      jQuery('label').removeClass('error');
      jQuery('.field').removeClass('error');
      // jQuery('ui-radio').removeClass('error');

      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      if (typeof device != 'undefined' && device.uuid) {
        self.model.set('contributor_id', device.uuid);
      } else {
        // backend changed and does MD5 hashing on contributor_id now so it need to be a string and not null
        self.model.set('contributor_id', '');
      }

      self.model.save(null, {
        complete: function () {
          // replace failure with msg here?
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          var report = self.model;
          var successCounter = 0;     // needed to know when we went through all the attached pictures

          console.log("Report saved successfully with id "+report.id);

          // This function is called later on in the success once all is done
          // deletes objects and bounces us back to overview map
          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
            veos.currentPhotos = []; // Armin: Clear the currentPhotos array to avoid duplicate errors
            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };

          var images = jQuery('.photo-list-item');    // get all images that were taken
          var photoCount = images.length;             // count how many pictures are attached
          console.log("Total count of photos attached: " +photoCount);

          // no photos attached so we are done (call doneSubmit)
          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }

          // go through all pictures and attach them to the report
          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // create a Photo model using the id
            var photo = new veos.model.Photo({id: photoModel.photo.id});

            // once photo model is available (via fetch) we attach the photo to the report
            var photoFetchSuccess = function (model, response) {
              console.log("We made it and are about tot attach Photos");

              report.attachPhoto(model, function () {
                successCounter++;
                if (successCounter === photoCount) {
                  console.log("All photos attached!");
                  doneSubmit();
                  return;
                }
              });
            };

            // TODO: think about this since it delets all input on error and returns to map
            function photoFetchError (model, response) {
              console.error("Fetching photo model " + model.id +" failed with error: " +response);
              veos.alert("Error fetching Photo data during Report submission!");
              delete veos.currentReport;
              delete veos.reportForm;
              jQuery.mobile.changePage("overview-map.html");
            }

            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          });
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }
      });
    },

    cancel: function () {
      console.log("Cancelling report...");
      this.clear();
      delete veos.reportForm;
      delete veos.currentReport;
      delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
      veos.currentPhotos = []; // Armin: Clear the currentPhotos array to avoid duplicate errors
      return true; // will now redirect to clicked element's href
    },

    clear: function () {
      console.log("Clearing ReportForm...");

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
      var geoloc;
      if (this.model.getLatLng()) {
        console.log("Using location from report model...", this.model.getLatLng());
        geoloc = this.model.getLatLng();
      } else if (veos.lastLoc) {
        console.log("Using last known location...", veos.lastLoc);
        geoloc = veos.lastLoc;
      } else {
        console.warn("Location unavailable... cannot update fields that depend on location.");
        return;
      }

      this.updateMapThumbnailFromLoc(geoloc);
      this.updateAddressFromLoc(geoloc);
    },

    updateMapThumbnailFromLoc: function (geoloc) {
      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
      var staticMapURL = veos.map.generateStaticMapURL(glatlng);
      var mapThumbnail = jQuery(this.$el.find('.map-thumbnail'));
      mapThumbnail.attr('src', staticMapURL);
      jQuery(".map-thumbnail-container .waiting").hide();
    },

    updateAddressFromLoc: function (geoloc) {
      var self = this;
      veos.map.lookupAddressForLoc(geoloc, function (address) {
        self.model.set('loc_description_from_google', address.formatted_address);
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
      });
    },

    updateLocFromAddress: function (address) {
      var self = this;
      veos.map.lookupLocForAddress(address, function (lat, lng) {
        self.model.set('loc_lat_from_user', lat);
        self.model.set('loc_lng_from_user', lng);
        self.updateMapThumbnailFromLoc(new google.maps.LatLng(lat, lng));
      });
    },

    renderPhotos: function () {
      var photoContainer = this.$el.find('#photos');
      var report = this.model;

      // if (veos.currentPhoto) {
        _.each(veos.currentPhotos, function (p) {
          if (p.id !== null) { // trying to avoid that empty picture is added
            // create the Photo model for the current photo ID
            var photo = new veos.model.Photo({id: p.id});
            // associate a PhotoView with the Photo model
            var photoView = new PhotoView({model: photo, el: photoContainer});

            var photoFetchSuccess = function (model, response) {
              console.log("Add the photo model to the report photos collection");
              if (!report.photos) {
                report.photos = [];
              }
              report.photos.push(model);
            };

            // TODO: think about this since it delets all input on error and returns to map
            var photoFetchError = function (model, response) {
              console.error("Fetching photo model for Installation List failed with error: " +response);
              veos.alert("Problem fetching photo model data. This might create problems later on");
            };

            // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          }
        });
      // }
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportForm!");
      var self = this;

      var purposesArray = [];
      var propertiesArray = [];
      var spacesArray = [];

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      // replaces changedFields() - we can't rely this.model.changed because we need to render after returning from refiningMap
      _.each(this.model.attributes, function(v, k) {
        if (k === "tags") {
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          if (spacesArray.length > 0) {
            self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
            jQuery('#surveilled-space').selectmenu('refresh', 'true');
          }
          if (propertiesArray.length > 0) {
            self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
            jQuery('#sign-properties').selectmenu('refresh', 'true');
          }
          if (purposesArray.length > 0) {
            self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
            jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
          }
        } else if (k === "has_sign") {
          if (self.model.get(k)) {
            jQuery('#sign-yes').attr("checked",true).checkboxradio("refresh");
          } else if (!self.model.get(k)) {
            jQuery('#sign-no').attr("checked",true).checkboxradio("refresh");
          }
        }
         else {
          self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
        }
      });

      // brutal. Tell me why we're bother with backbone when all jQuery does is fight it?
      if (self.model.get('owner_identifiable')) {
        jQuery('#unidentified-owner-checkbox').attr("checked",false).checkboxradio("refresh");      // who the hell comes up with this syntax?!? Good lord
      } else {
        jQuery('#unidentified-owner-checkbox').attr("checked",true).checkboxradio("refresh");
      }

      jQuery('#owner-type').selectmenu('refresh');                          // why doesn't this work with classes? Would be much cleaner. Also refresh, really?
      jQuery('#sign-visibility').selectmenu('refresh');

      // updating the text on the accordion headers
      if (veos.currentReport.get('camera_count') || (spacesArray.length > 0)) {
        jQuery('.camera-add-edit-text').text('Edit');
      } else {
        jQuery('.camera-add-edit-text').text('Add');
      }
      if (veos.currentReport.get('sign_visibility') || veos.currentReport.get('sign_text') || (propertiesArray.length > 0) || (purposesArray.length > 0)) {
        jQuery('.sign-add-edit-text').text('Edit');
      } else {
        jQuery('.sign-add-edit-text').text('Add');
      }

      self.updateLocFields();
      self.renderPhotos();

      // ok, this is obviously insane - but if anyone can find a better way to keep the multi-selects from growing off the screen (on the phone, please let me know)
      // and this doesn't actually work well with screen rotation (since it doesn't rerender)
      // TODO!
      // see also ReportEdit version
      var multiWidth = jQuery(window).width() * 4/5;
      jQuery('.ui-select').width(multiWidth);
    }
  });




// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //



  // this really should be an extension of the ReportForm view above - massive duplication


  self.ReportEditForm = Backbone.View.extend({
    events: {
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);

        this.model.setTags(f.val(), f.attr('name'));
        console.log("Setting "+f.attr("name")+" to "+f.val());
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#report-sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#report-sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },
      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        veos.currentPhoto.captureFromCamera();
        veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
      },

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        veos.currentPhoto.captureFromGallery();
        veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
      },

      'change #photo-from-hard-drive': function (ev) {
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        var fileInput = this.$el.find('#photo-from-hard-drive');

        veos.currentPhoto.on('image_capture', function (ev, photo) {
          veos.currentPhoto.upload();
          veos.currentPhotos.push(veos.currentPhoto); // add currentPhoto to array to not lose photos during location change
        });

        veos.currentPhoto.captureFromFile(fileInput[0].files.item(0));
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      //var self = this;
      console.log("Initializing ReportForm...");

      // FIXME [matt]: this should bind to render(), which should in turn update any changed fields to match the model.
      // [colin]: all done in render now, for reasons explain there
      //this.model.on('change', _.bind(this.updateChangedFields, this));

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      if (typeof device != 'undefined' && device.uuid) {
        self.model.set('contributor_id', device.uuid);
      } else {
        // backend changed and does MD5 hashing on contributor_id now so it need to be a string and not null
        self.model.set('contributor_id', '');
      }

      // if we're editing, that means the new version should not be flagged, right?
      self.model.set('flagged', null);
      self.model.set('flagged_on', null);

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          console.log("Report saved successfully with id "+self.model.id);

          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            delete veos.currentInstallation;        // unique to editReport's view
            delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
            veos.currentPhotos = []; // Armin: Clear the currentPhotos array to avoid duplicate errors

            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };

          var report = self.model;
          var successCounter = 0;
          //var photoTotalCount = self.model.getPhotos().length;

          var images = jQuery('.photo-list-item');
          var photoCount = images.length;
          console.log("Total count of photos attached: " +photoCount);

          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }

          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // check if photo in DOM already exists in installation
            var existingPhoto = null;
            existingPhoto = _.find(veos.currentInstallation.get('photos'), function (p) {
              var existingPhotoId = p.id;
              var domPhotoId = photoModel.photo.id;
              return existingPhotoId === domPhotoId;
            });


            // if photo already exists do not add the photo to the report again
            if (existingPhoto) {
              console.log('Photo with ID: '+photoModel.photo.id+' already exits');
              successCounter++;
              if (successCounter === photoCount) {
                console.log("All photos attached!");
                doneSubmit();
                return;
              }
            } else {
              console.log('Attach the new photo');
              // create a Photo model using the id
              var photo = new veos.model.Photo({id: photoModel.photo.id});

              // once photo model is available (via fetch) we attach the photo to the report
              var photoFetchSuccess = function (model, response) {
                console.log("We made it and are about tot attach Photos");

                report.attachPhoto(model, function () {
                  successCounter++;
                  if (successCounter === photoCount) {
                    console.log("All photos attached!");
                    doneSubmit();
                    return;
                  }
                });
              };

              // TODO: think about this since it delets all input on error and returns to map
              var photoFetchError = function (model, response) {
                console.error("Fetching photo model " + model.id +" failed with error: " +response);
                veos.alert("Error fetching Photo data during Report submission!");
                delete veos.currentReport;
                delete veos.reportForm;
                jQuery.mobile.changePage("overview-map.html");
              };

              photo.fetch({success: photoFetchSuccess, error: photoFetchError});
            }
          });
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }
      });
    },

    cancel: function () {
      console.log("Cancelling report...");
      this.clear();
      delete veos.reportForm;
      delete veos.currentReport;
      delete veos.currentInstallation;        // unique to editReport's view
      delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
      veos.currentPhotos = []; // Armin: Clear the currentPhotos array to avoid duplicate errors

      return true; // will now redirect to clicked element's href
    },

    clear: function () {
      console.log("Clearing ReportForm...");

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
      var geoloc;
      if (this.model.getLatLng()) {
        console.log("Using location from report model...", this.model.getLatLng());
        geoloc = this.model.getLatLng();
      } else if (veos.currentInstallation) {
        //self.lastLoc = new google.maps.LatLng(43.6621614579938, -79.39527873417967);
        console.log("Using location from saved installation's latest report", veos.currentInstallation);
        geoloc = new google.maps.LatLng(veos.currentInstallation.get('loc_lat'), veos.currentInstallation.get('loc_lng'));
      } else {
        console.warn("Location unavailable... cannot update fields that depend on location.");
        return;
      }

      this.updateMapThumbnailFromLoc(geoloc);
      this.updateAddressFromLoc(geoloc);
    },

    updateMapThumbnailFromLoc: function (geoloc) {
      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
      var staticMapURL = veos.map.generateStaticMapURL(glatlng);
      var mapThumbnail = jQuery(this.$el.find('.map-thumbnail'));
      mapThumbnail.attr('src', staticMapURL);
      jQuery(".map-thumbnail-container .waiting").hide();
    },

    updateAddressFromLoc: function (geoloc) {
      var self = this;
      veos.map.lookupAddressForLoc(geoloc, function (address) {
        self.model.set('loc_description_from_google', address.formatted_address);
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
      });
    },

    updateLocFromAddress: function (address) {
      var self = this;
      veos.map.lookupLocForAddress(address, function (lat, lng) {
        self.model.set('loc_lat_from_user', lat);
        self.model.set('loc_lng_from_user', lng);
        self.updateMapThumbnailFromLoc(new google.maps.LatLng(lat, lng));
      });
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportEditForm!");
      var self = this;

      var purposesArray = [];
      var propertiesArray = [];
      var spacesArray = [];

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      // replaces changedFields() - we can't rely this.model.changed because we need to render after returning from refiningMap
      _.each(this.model.attributes, function(v, k) {
        if (k === "tags") {
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          if (spacesArray.length > 0) {
            self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
            jQuery('#surveilled-space').selectmenu('refresh', 'true');
          }
          if (propertiesArray.length > 0) {
            self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
            jQuery('#sign-properties').selectmenu('refresh', 'true');
          }
          if (purposesArray.length > 0) {
            self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
            jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
          }
        } else if (k === "has_sign") {
          if (self.model.get(k)) {
            jQuery('#sign-yes').attr("checked",true).checkboxradio("refresh");
            console.log('true');
          } else if (!self.model.get(k)) {
            jQuery('#sign-no').attr("checked",true).checkboxradio("refresh");
            console.log('false');
          }
        }
         else {
          self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
        }
      });

      // brutal. Tell me why we're bother with backbone when all jQuery does is fight it?
      if (self.model.get('owner_identifiable')) {
        jQuery('#unidentified-owner-checkbox').attr("checked",false).checkboxradio("refresh");      // who the hell comes up with this syntax?!? Good lord
      } else {
        jQuery('#unidentified-owner-checkbox').attr("checked",true).checkboxradio("refresh");
      }

      jQuery('#owner-type').selectmenu('refresh');                          // why doesn't this work with classes? Would be much cleaner. Also refresh, really?
      jQuery('#sign-visibility').selectmenu('refresh');

      // updating the text on the accordion headers
      if (veos.currentReport.get('camera_count') || (spacesArray.length > 0)) {
        jQuery('.camera-add-edit-text').text('Edit');
      } else {
        jQuery('.camera-add-edit-text').text('Add');
      }
      if (veos.currentReport.get('sign_visibility') || veos.currentReport.get('sign_text') || (propertiesArray.length > 0) || (purposesArray.length > 0)) {
        jQuery('.sign-add-edit-text').text('Edit');
      } else {
        jQuery('.sign-add-edit-text').text('Add');
      }

      self.updateLocFields();
      self.renderPhotos();

      // see ReportEdit for explanation (uggggg)
      var multiWidth = jQuery(window).width() * 4/5;
      jQuery('.ui-select').width(multiWidth);
    },

    renderPhotos: function () {
      var photoContainer = this.$el.find('#photos');
      var report = this.model;

      // we are in edit mode so currentInstallation should be filled otherwise we should not be here
      if (veos.currentInstallation) {
        _.each(veos.currentInstallation.get('photos'), function (p) {
          // create the Photo model for the current photo ID
          var photo = new veos.model.Photo({id: p.id});
          // associate a PhotoView with the Photo model
          var photoView = new PhotoView({model: photo, el: photoContainer});

          var photoFetchSuccess = function (model, response) {
            console.log("Add the photo model to the report photos collection");
            if (!report.photos) {
              report.photos = [];
            }
            report.photos.push(model);
          };

          // TODO: think about this since it delets all input on error and returns to map
          var photoFetchError = function (model, response) {
            console.error("Fetching photo model for Installation List failed with error: " +response);
            veos.alert("Problem fetching photo model data. This might create problems later on");
          };

          // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
          photo.fetch({success: photoFetchSuccess, error: photoFetchError});
        });
      }

      //if (veos.currentPhoto) {
        _.each(veos.currentPhotos, function (p) {
          if (p.id !== null) { // trying to avoid that empty picture is added
            // create the Photo model for the current photo ID
            var photo = new veos.model.Photo({id: p.id});
            // associate a PhotoView with the Photo model
            var photoView = new PhotoView({model: photo, el: photoContainer});

            var photoFetchSuccess = function (model, response) {
              console.log("Add the photo model to the report photos collection");
              if (!report.photos) {
                report.photos = [];
              }
              report.photos.push(model);
            };

            // TODO: think about this since it delets all input on error and returns to map
            var photoFetchError = function (model, response) {
              console.error("Fetching photo model for Installation List failed with error: " +response);
              veos.alert("Problem fetching photo model data. This might create problems later on");
            };

            // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          }
        });
      //}
    }

  });



// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //




  var PhotoView = Backbone.View.extend({
    // solving missing options problem after update of Backbone past 1.0
    // http://stackoverflow.com/questions/19325323/backbone-1-1-0-views-reading-options
    initialize: function (options) {
      var view = this;
      view.options = options || {};

      this.model.on('image_upload image_upload_finish change sync', this.render, this);

      this.model.on('image_upload_start', function () {
        jQuery.mobile.showPageLoadingMsg();
        jQuery('.ui-loader h1').text('Uploading photo...');
      }, this);

      this.model.on('image_upload_error', function (err) {
        veos.alert("Image upload failed: " + JSON.stringify(err));
        jQuery.mobile.hidePageLoadingMsg();
      }, this);
    },

    render: function () {
      //var photoDetails;
      console.log("Rendering PhotoView...");
      //this.$el.text(JSON.stringify(this.model.toJSON(), null, 2));
      console.log("Photo model in PhotoView.render:"+ JSON.stringify(this.model.toJSON(), null, 2));
      console.log("Photo url: "+this.model.thumbUrl());

      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        // img = jQuery("<img style='display: block' class='photo-list-item' id='photo-"+this.model.id+"' onclick='veos.showModal("+this.model.id+")'/>"); // might make more sense to pass in this.model?
        img = jQuery("<img class='photo-list-item' id='photo-"+this.model.id+"'/>");
        //img.attr('data-model', this.model);
        img.attr('data-model', JSON.stringify(this.model.toJSON()));

        var href = location.href;
        var photoDetails = jQuery('<a />');

        // Only add a link to details (big picture) if on installation-details page
        if (href.match(/installation-details.html/)) {
          // wrap a link around the picture
          // temporarily disabled for beta release
          if (veos.isAndroid()) {
            photoDetails = jQuery('<a data-role="button" href="#"></a>');
            var photo = this.model;
            photoDetails.click(function (ev) {
              ev.preventDefault();
              Android.viewPhoto(photo.bigUrl());
            });
          } else {
            photoDetails = jQuery('<a data-role="button" href="photo-details.html?photoId='+this.model.id+'&installationId='+this.options.installationId+'"></a>');
          }
        }

        photoDetails.append(img);

        this.$el.append(photoDetails);
      }
      img.attr('src', this.model.thumbUrl());
      img.attr('alt', this.model.get('notes'));

      jQuery.mobile.hidePageLoadingMsg();
    }
  });







  /**
    PhotoDetailsView
    Shows the photo details page that allows users to add tags and a note to a picture.
  **/
  self.PhotoDetailsView = Backbone.View.extend({
    events: {
      'click #submit-photo-details': function (ev) {
        alert("submitting clicked");

      }
      // ,

      // 'click #submit-photo-details': 'submit'//,
      //'click #cancel-report': 'cancel'
    },

    initialize: function () {
      var view = this;

      this.model.on('change sync', this.render, this);
    },

    render: function () {
      console.log("Rendering PhotoDetailsView...");
      console.log("Photo url: "+this.model.bigUrl());
      // check if image already exists in DOM (shouldn't at this point)
      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        img = jQuery("<img class='photo-details-item' id='photo-"+this.model.id+"' />");
        //img.attr('data-model', this.model);
        // img.attr('data-model', JSON.stringify(this.model.toJSON()));

        this.$el.append(img);
      }
      // adding URL and alt
      img.attr('src', this.model.bigUrl());
      img.attr('alt', this.model.get('notes'));

      // setting the Photo ID in the page header
      var headerPhotoId = jQuery('#photo-details-page .photo-id');
      headerPhotoId.text(this.model.id);

      jQuery.mobile.hidePageLoadingMsg();
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          console.log("Photo detailes saved successfully with id "+self.model.id);
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }
      });
    }
  });







  /**
   *  Show on row in Installation List
   */
  self.InstallationListRow = Backbone.View.extend({
    initialize: function () {

    },

    render: function () {
      var installation = this.model;

      var buttonText = '';
      var ownerName;
      if (installation.get('owner_name')) {
        buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
      } else {
        buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
      }

      var complianceLevel;
      if (installation.get('compliance_level')) {
        if (installation.get('compliance_level') === 'non_compliant') {
          complianceLevel = "<span class='compliance no-sign-color'></span>";
        } else if (installation.get('compliance_level') === 'low_compliant') {
          complianceLevel = "<span class='compliance missing-info-color'></span>";
        } else if (installation.get('compliance_level') === 'min_compliant') {
          complianceLevel = "<span class='compliance min-compliant-color'></span>";
        } else if (installation.get('compliance_level') === 'compliant') {
          complianceLevel = "<span class='compliance compliant-color'></span>";
        } else {
          complianceLevel = "<span class='compliance-unknown'></span>";
        }
      }

      var thumb = "";

      // the installations.json now contains photo URL so this got easier and much faster
      if (installation.has('photos') && installation.get('photos').length > 0) {
        var photosOfInstallation = installation.get('photos');
        var photo = _.first(photosOfInstallation);
        var photoID = photo.id;
        var thumbUrl = veos.model.baseURL + photo.thumb_url;

        //console.log('Retrieve photo thumb URL: '+thumbUrl+' for photo with ID: '+photoID);
        thumb = "<img class='list-picture photo-"+photoID+"' src='"+thumbUrl+"' />";
      }

      var item = jQuery("<a class='relative' href='installation-details.html?id="+installation.get('id')+"'>"+complianceLevel+thumb+buttonText+"</a>");
      // item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
      // item.attr('data-installationId', installation.get('id'));
      var li = jQuery("<li />");
      li.append(item);

      return li;
    }
  });

  /**
    InstallationList
    Shows a list of Installations.
  **/
  self.InstallationList = Backbone.View.extend({
    MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    instCounter: 0,    // used to keep track of the number of installations currently displayed (can't use length any more since pagination)

    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        // veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
        // var id = jQuery(ev.target).attr('data-installationId');
        // alert(id);
      },
      'click .load-more-installations': 'loadMoreInstallations'
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.PagedNearbyInstallations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));

      this.collection.on('add', _.bind(this.addOne, self));

      // WARNING: This scroll viewer triggers all the time unless you turn
      // the listener off, which we do in pagehide
      // Not sure if this ia a hack since it works nicely. Uses only plain jQuery to
      // trigger the function loading more data
      // From here: http://stackoverflow.com/questions/3898130/how-to-check-if-a-user-has-scrolled-to-the-bottom
      jQuery(window).scroll(function() {
        if (jQuery(window).scrollTop() + jQuery(window).height() === jQuery(document).height()) {
          self.loadMoreInstallations();
        }
      });
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="main"]'));
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    addOne: function(inst) {
      var instRow = new veos.view.InstallationListRow({model: inst});
      // this.$el.append(instRow.render().el);
      var list = this.$el.find('.installations-list');
      list.append(instRow.render());
      list.listview('refresh');

      this.instCounter++;
      // adding installation count to page
      jQuery('.installation-count').text(this.instCounter);
    },

    loadMoreInstallations: function() {
      var view = this;

      view.collection.getNextPage();
    },

    render: function () {
      var view = this;

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {

        view.addOne(installation);
        // var buttonText = '';
        // var ownerName;
        // if (installation.get('owner_name')) {
        //   buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        // } else {
        //   buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        // }

        // var complianceLevel;
        // if (installation.get('compliance_level')) {
        //   if (installation.get('compliance_level') === 'non_compliant') {
        //     complianceLevel = "<span class='compliance no-sign-color'></span>";
        //   } else if (installation.get('compliance_level') === 'low_compliant') {
        //     complianceLevel = "<span class='compliance missing-info-color'></span>";
        //   } else if (installation.get('compliance_level') === 'min_compliant') {
        //     complianceLevel = "<span class='compliance min-compliant-color'></span>";
        //   } else if (installation.get('compliance_level') === 'compliant') {
        //     complianceLevel = "<span class='compliance compliant-color'></span>";
        //   } else {
        //     complianceLevel = "<span class='compliance-unknown'></span>";
        //   }
        // }

        // var thumb = "";

        // // the installations.json now contains photo URL so this got easier and much faster
        // if (installation.has('photos') && installation.get('photos').length > 0) {
        //   var photosOfInstallation = installation.get('photos');
        //   var photo = _.first(photosOfInstallation);
        //   var photoID = photo.id;
        //   var thumbUrl = veos.model.baseURL + photo.thumb_url;

        //   //console.log('Retrieve photo thumb URL: '+thumbUrl+' for photo with ID: '+photoID);
        //   thumb = "<img class='list-picture photo-"+photoID+"' src='"+thumbUrl+"' />";
        // }

        // var item = jQuery("<a class='relative' href='installation-details.html?id="+installation.get('id')+"'>"+complianceLevel+thumb+buttonText+"</a>");
        // // item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        // // item.attr('data-installationId', installation.get('id'));
        // var li = jQuery("<li />");
        // li.append(item);

        // list.append(li);
        // list.listview('refresh');
      });
    }
  });


  /**
    InstallationList for Report creation
    Shows a list of Installations.
  **/
  self.InstallationListReport = Backbone.View.extend({
    //MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km

    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
        // var id = jQuery(ev.target).attr('data-installationId');
        // alert(id);
      },

      // I assume this is limited to this view (page) and won't be clearing currentReport all over the place
      'click .add-report-button': function (ev) {
        console.log("clearing currentReport for extra safety");
        delete veos.currentReport;
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Installations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="main"]'));
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    render: function () {
      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {
        var buttonText = '';
        var ownerName;
        if (installation.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        }

        var complianceLevel;
        if (installation.get('compliance_level')) {
          if (installation.get('compliance_level') === 'non_compliant') {
            complianceLevel = "<span class='compliance no-sign-color'></span>";
          } else if (installation.get('compliance_level') === 'low_compliant') {
            complianceLevel = "<span class='compliance missing-info-color'></span>";
          } else if (installation.get('compliance_level') === 'min_compliant') {
            complianceLevel = "<span class='compliance min-compliant-color'></span>";
          } else if (installation.get('compliance_level') === 'compliant') {
            complianceLevel = "<span class='compliance compliant-color'></span>";
          } else {
            complianceLevel = "<span class='compliance-unknown'></span>";
          }
        }

        var thumb = "";

        // if photos are attached to the installation retrieve the thumb URL of the first photo via Photo model
        if (installation.has('photos') && installation.get('photos').length > 0) {
          var photoID = installation.get('photos')[0].id;
          thumb = "<img class='list-picture photo-"+photoID+"' />";

          console.log('Trying to retrieve photo thumb URL for photo with ID: '+photoID);

          var thumbPhoto = new veos.model.Photo({id: photoID});

          var photoFetchSuccess = function (model, response) {
            console.log("We made it and are about to retrieve Photo thumb URL");
            var img = jQuery('.photo-'+model.id);
            img.attr('src', model.thumbUrl());
          };

          // TODO: think about this since it delets all input on error and returns to map
          var photoFetchError = function (model, response) {
            console.error("Fetching photo model for Installation List failed with error: " +response);
          };

          thumbPhoto.fetch({success: photoFetchSuccess, error: photoFetchError});
        }

        // create the URL to load report.html in edit mode with prefilled data
        // the installationId is retrieved in veos.js .delegate and used to load a installation model
        // and render the ReportEditForm view
        // Adding a referrer so that the cancel button can lead back to installation details page / This is to fix bug 68.1
        var item = jQuery("<a class='relative' href=report.html?installationId="+ installation.get('id') +"&ref=report-selection>"+complianceLevel+thumb+buttonText+"</a>");
        // instead of setting fresh=true in the url and changing that to false later on we use a global variable (and we all love them)
        veos.amendingInst = true;
        // item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        // item.attr('data-installationId', installation.get('id'));
        var li = jQuery("<li />");
        li.append(item);

        list.append(li);
        list.listview('refresh');
      });
    }
  });




  self.InstallationDetails = Backbone.View.extend({
    events: {
      'click .flag-button': function (ev) {
        var view = this;
        console.log("opening flag dialogue");

        view.flagReport();
      }
    },

    initialize: function () {
      var view = this;

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Insts too?
      view.model.on('change sync', _.bind(view.render, view));
    },

    flagReport: function () {
      var response = confirm('Do you want to flag this report as inappropriate?');
      if (response) {
        var reportId = veos.currentInstallation.get('latest_report').id;
        var flaggedReport = new veos.model.Report({id: reportId});

        var reportSuccess = function (model, response) {
          model.set('flagged', true);
          model.set('flagged_on', new Date());
          model.save();

          console.log('Report ' + model.get('id') + ' flagged');
          veos.alert("This report has been flagged as inappropriate");
        };
        var reportError = function (model, response) {
          console.error("Error fetching report model with message: "+response);
          veos.alert("Error fetching report details");
        };

        flaggedReport.fetch({success: reportSuccess, error: reportError});

      } else {
        console.log('Cancelled...');
      }
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="content"]'));
      // FIXME: this looks ugly
      this.loader.css({
        position: 'absolute',
        top: '30%',
        width: '100%'
      });
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    createPointDetailsMap: function(installation) {
      // note: higher zoom level
      var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + installation.get('loc_lat') + "," + installation.get('loc_lng');
      staticMapCriteria += "&markers=size:small%7C" + installation.get('loc_lat') + ',' + installation.get('loc_lng');

      var mapThumbnail = jQuery('<img class="map-thumbnail" />');
      mapThumbnail.attr('src', staticMapCriteria);
      var thumbnailContainer = this.$el.find('.map-thumbnail-container');
      thumbnailContainer.html(mapThumbnail);
    },

    showPictures: function(installation) {
      console.log('Showing pictures...');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      _.each(installation.get('photos'), function (p) {
        var photo = new veos.model.Photo({id: p.id});

        function photoSuccess (model, response) {
          // var img = jQuery('<img />');
          // img.attr('src', model.thumbUrl());
          // photoContainer.append(img);

          var photoView = new PhotoView({model: model, el: photoContainer, installationId: installation.get('id')});
          photoView.render();
        }

        function photoError (model, response) {
          console.error("Error fetching photo model with message: "+response);
          veos.alert("Error fetching photo details");
        }

        photo.fetch({success: photoSuccess, error: photoError});
      });
    },

    render: function () {
      var self = this;
      var installation = this.model;

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      // create the URL to load report.html in edit mode with prefilled data
      // the installationId is retrieved in veos.js .delegate and used to load a installation model
      // and render the ReportEditForm view
      var editButton = jQuery('#installation-details-page .edit-button');
      // Adding a referrer so that the cancel button can lead back to installation details page / This is to fix bug 68.1
      editButton.attr('href', 'report.html?installationId='+installation.get('id')+'&ref=installation-details');
      // instead of setting fresh=true in the url and changing that to false later on we use a global variable (and we all love them)
      veos.amendingInst = true;

      var complianceButton = jQuery('#installation-details-page .compliance-banner');
      complianceButton.attr('href', 'privacy-compliance.html?installationId='+installation.get('id'));

      if (installation.get('compliance_level')) {
        if (installation.get('compliance_level') === 'non_compliant') {
          complianceButton.find('.ui-btn-text').text('Not compliant: no sign');
          complianceButton.find('.ui-btn-inner').addClass('no-sign-color');
          complianceButton.find('.ui-btn-inner').addClass('white');
        } else if (installation.get('compliance_level') === 'low_compliant') {
          complianceButton.find('.ui-btn-text').text('Not compliant');
          complianceButton.find('.ui-btn-inner').addClass('missing-info-color');
        } else if (installation.get('compliance_level') === 'min_compliant') {
          complianceButton.find('.ui-btn-text').text('Minimally compliant');
          complianceButton.find('.ui-btn-inner').addClass('min-compliant-color');
        } else if (installation.get('compliance_level') === 'compliant') {
          complianceButton.find('.ui-btn-text').text('Fully compliant');
          complianceButton.find('.ui-btn-inner').addClass('compliant-color');
        } else {
          console.log('this should never happen - no compliance level somehow?');
        }
      }

      if (this.loader) {
        this.hideLoader();
      }

      this.createPointDetailsMap(installation);

      // TODO: The showPictures function will only add pictures and not reflect pictures getting less
      // maybe we can reuse the PhotoView.render function??
      // this condition is always true - Matt, do you want to fix? There are workarounds on our end (as below)
      if (installation.has('photos')) {
        self.showPictures(installation);

        if (installation.get('photos').length === 0) {
          this.$el.find('.photo-count').text("no photos");
          jQuery('.photos-container').trigger('collapse');
        } else {
          this.$el.find('.photo-count').text(installation.get('photos').length);
        }
      }

      var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      var ownerName;


      _.each(installation.attributes, function(v, k) {
        // base case for filling in the fields
        self.$el.find('.field[name="'+k+'"]').text(installation.get(k));

        // for nested stuff that isn't photos (latest report, tags, etc)
        if (k === "latest_report") {
          _.each(v, function(subv, subk) {
            if (subk === "has_sign") {
              if (installation.get('latest_report')[subk] === true) {
                self.$el.find('.field[name="has_sign"]').text('observed');
              } else {
                self.$el.find('.field[name="has_sign"]').text('not observed');
              }
            } else if (subk === "created_at") {
              // can we have the post create a Date object like in CK, would deuglify these slices
              self.$el.find('.field[name="created_at"]').text(subv.slice(11, -1) + ', ' + subv.slice(0, -10));
            } else {
              // this is the case for all of the latest report stuff (ie most stuff)
              if (subv) {
                self.$el.find('.field[name="'+subk+'"]').text(installation.get('latest_report')[subk]);
              } else {
                self.$el.find('.field[name="'+subk+'"]').text("not reported");
              }
            }
          });
        }
        else if (k === "tags") {
          var purposesString = '';
          var propertiesString = '';
          var spacesString = '';
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesString += i.tag + ', ';
            } else if (i.tag_type === "sign_properties") {
              propertiesString += i.tag + ', ';
            } else if (i.tag_type === "surveilled_space") {
              spacesString += i.tag + ', ';
            } else {
              console.log("unknown tag type");
            }
          });

          if (purposesString.length === 0) {
            self.$el.find('*[name="sign_stated_purpose"].field').text("not reported");
          } else {
            self.$el.find('*[name="sign_stated_purpose"].field').text(purposesString.slice(0, -2));
          }
          if (propertiesString.length === 0) {
            self.$el.find('*[name="sign_properties"].field').text("not reported");
          } else {
            self.$el.find('*[name="sign_properties"].field').text(propertiesString.slice(0, -2));
          }
          if (spacesString.length === 0) {
            self.$el.find('*[name="surveilled_space"].field').text("not reported");
          } else {
            self.$el.find('*[name="surveilled_space"].field').text(spacesString.slice(0, -2));
          }
        }

        // TODO: sloppy (overwriting, removing previous elements) - redo me
        if (installation.has('owner_name')) {
          self.$el.find('.field[name="owner_name"]').text(installation.get('owner_name'));
        } else {
          self.$el.find('.field[name="owner_name"]').text('Unknown Owner');
          // removes previously added blank owner type
          self.$el.find('.field[name="owner_type"]').text('');
        }

      });

    }
  });

  self.PrivacyComplianceView = Backbone.View.extend({
    initialize: function () {
      var self = this;

      // this can be removed, right? Nothing on this page will ever change
      this.model.on('change sync', _.bind(this.render, self));
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="content"]'));
      // FIXME: this looks ugly
      this.loader.css({
        position: 'absolute',
        top: '30%',
        width: '100%'
      });
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    render: function () {
      var self = this;
      var installation = this.model;

      if (this.loader) {
        this.hideLoader();
      }

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').addClass('hidden');
        this.$el.find('.android-only').removeClass('hidden');
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').removeClass('hidden');
        this.$el.find('.android-only').addClass('hidden');
      }

      var backButton = jQuery('#privacy-compliance-page .back-button');
      backButton.attr('href', 'installation-details.html?id='+installation.get('id'));

      jQuery('.compliance-text').hide();

      var complianceButton = jQuery('#privacy-compliance-page .compliance-banner');
      if (installation.get('compliance_level')) {
        if (installation.get('compliance_level') === 'non_compliant') {
          complianceButton.find('.ui-btn-text').text('Not compliant: no sign');
          complianceButton.find('.ui-btn-inner').addClass('no-sign-color');
          complianceButton.find('.ui-btn-inner').addClass('white');
          jQuery('#no-sign-text').show();
        } else if (installation.get('compliance_level') === 'low_compliant') {
          complianceButton.find('.ui-btn-text').text('Not compliant');
          complianceButton.find('.ui-btn-inner').addClass('missing-info-color');
          jQuery('#missing-info-text').show();
        } else if (installation.get('compliance_level') === 'min_compliant') {
          complianceButton.find('.ui-btn-text').text('Minimally compliant');
          complianceButton.find('.ui-btn-inner').addClass('min-compliant-color');
          jQuery('#min-compliant-text').show();
        } else if (installation.get('compliance_level') === 'compliant') {
          complianceButton.find('.ui-btn-text').text('Fully compliant');
          complianceButton.find('.ui-btn-inner').addClass('compliant-color');
          jQuery('#compliant-text').show();
        } else {
          console.log('this should never happen - no compliance level?');
        }
      }

      var ownerName;
      if (installation.has('owner_name')) {
        self.$el.find('.field[name="owner_name"]').text(installation.get('owner_name'));
      } else {
        self.$el.find('.field[name="owner_name"]').text('Unknown Owner');
        jQuery('#privacy-compliance-page .owner-name').addClass('unknown');
      }

      self.$el.find('.field[name="owner_type"]').text(installation.get('owner_type'));
      self.$el.find('.field[name="address"]').text(installation.get('loc_description'));

    }
  });

  veos.view = self;
})(window.veos);
