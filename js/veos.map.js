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
      // TODO: FIX ME
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
      veos.installations.fetch();
    });

    google.maps.event.addListener(gmap, 'zoom_changed', function() {
      console.log('zoom_changed triggered');
      var zoom = gmap.getZoom();
      veos.installations.updateMaxDistance(80000/(Math.pow(2, zoom)));      // BASED ON http://stackoverflow.com/questions/8717279/what-is-zoom-level-15-equivalent-to
      veos.installations.fetch();
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

    var map = this;

    // TODO: for this to work we need a backend call to find out how many installations exist
    // var installationCountMsg = humane.create({ timeout: 3000 });
    //installationCountMsg.log("Total # of installations reported: " + installations.length);

    installations.each(function(i) {
      map.addInstallationMarker(i);
    });
  };

  self.Map.prototype.addInstallationMarker = function (i) {
    var map = this;
    if (veos.markersArray === undefined) {
      veos.markersArray = [];
    }

    if (!map.infowindows) {
      map.infowindow = new google.maps.InfoWindow({
        // do you seriously need a plugin for styling infowindows?!?! Puke
        // http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/docs/examples.html
        // http://code.google.com/p/google-maps-utility-library-v3/wiki/Libraries
      });
    }

    if (!_.findWhere(veos.markersArray, {"id": i.id})) {
      console.log("adding marker for", i.id);
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

      mapPopupContent = jQuery('<a class="styled-link-text">'+thumb+buttonText+'</a>');
      mapPopupContent.click(function () { veos.goToInstallationDetails(i.id); });

      // binding a popup click event to the marker
      google.maps.event.addListener(marker, 'click', function() {
        injectThumbnail(i);
        map.infowindow.setContent(mapPopupContent[0]);
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
  };

  // NOTE: I think these can both be removed - but commented out for now

  // var closeMarker = function() {
  //   console.log('it triggered');
  // };

  // self.Map.prototype.clearInstallationMarkers = function() {
  //   // deletes everything in the markersArray
  //   console.log('clearing all markers...');
  //   _.each(veos.markersArray, function(i) {
  //     i.setMap(null);
  //   });
  //   // this may not be necessary (they're going to get overwritten by addInstallationMarkers immediately), but seems safer
  //   veos.markersArray = [];
  // };

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
