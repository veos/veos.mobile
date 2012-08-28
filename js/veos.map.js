/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, google */

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

    var center;
    var zoom;
    if (!initLoc) {
      center = new google.maps.LatLng(43.6621614579938, -79.39527873417967);            // TODO map should be zoomed out (zoom = 3) under some conditions (when not near insts?)
      zoom = 3;
    } else {
      center = veos.map.convertGeolocToGmapLatLng(initLoc);
      zoom = 13;
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
  };

  self.Map.prototype = {
    
  };

 
  /**
    Shows the current location marker and continuously updates its
    position based on incoming GPS data.
  **/
  self.Map.prototype.startFollowing = function () {
    var map = this;

    console.log("Started following user...");
    map.posWatcher = navigator.geolocation.watchPosition(function (geoloc) {
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

        map.gmap.setZoom(13);             // sets zoom back to default level (relevant if user does not gps and !initLoc in line 21)

        map.currentLocMarker.setMap(map.gmap);

        map.gmap.panTo(glatlng);
      }

      // this would reframe the map to the accuracy circle
      //self.gmap.fitBounds(self.currentLocRadius.getBounds());

      
      map.currentLocMarker.setPosition(glatlng);
      map.currentLocRadius.setCenter(glatlng);
      map.currentLocRadius.setRadius(accuracy);
    });
  };

  /** 
    Stops updating the current location marker.
  **/
  self.Map.prototype.stopFollowing = function () {
    console.log("Stopped following user...");
    navigator.geolocation.clearWatch(this.posWatcher);
  };

  /** 
    Removes the current location marker from the map.
  **/
  self.Map.prototype.clearCurrentLocation = function () {
    console.log("Resetting current location...");
    this.currentLocMarker.setMap(null);
  };


  /**
    Adds markers for a collection of Reports.           LEGACY CODE (I think - we want installations showing, not reports, right?)
    @param reports veos.model.Reports
  **/
/*  self.Map.prototype.addReportMarkers = function (reports) {
    console.log("Adding "+reports.length+" report markers to map...");

    var map = this;

    map.infowindow = new google.maps.InfoWindow({
    });

    reports.each(function(r) {
      var latLng = r.getLatLng();

      var marker = new google.maps.Marker({
        position: latLng,
        title: r.get('owner_name') || "Unknown Owner"
      });

      var mapPopupContent;
      mapPopupContent = '<p><b> ' + (r.get('owner_name') || "Unknown Owner") + ' </b> - Camera</p>';

      // binding a popup click event to the marker
      google.maps.event.addListener(marker, 'click', function() {
        map.infowindow.setContent(mapPopupContent);
        map.infowindow.open(map.gmap, marker);
      });
      marker.setMap(map.gmap);
    });
  };*/



  /**
    Adds markers for a collection of Installations.
    @param installations veos.model.Installations
  **/
  self.Map.prototype.addInstallationMarkers = function (installations) {
    console.log("Adding "+installations.length+" installation markers to map...");

    var map = this;
    var markersArray = [];

    map.infowindow = new google.maps.InfoWindow({
    });

    installations.each(function(i) {
      var latLng = new google.maps.LatLng(i.get('loc_lat'), i.get('loc_lng'));
      var buttonText = "";

      var compliancePin;
      if (i.get('compliance_level') === 3) {
        compliancePin = '/images/pin-green-full.png';
      } else if (i.get('compliance_level') === 2) {
        compliancePin = '/images/pin-yellow-full.png';
      } else if (i.get('compliance_level') === 1) {
        compliancePin = '/images/pin-red-full.png';
      } else {
        compliancePin = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      }

      var marker = new google.maps.Marker({
        position: latLng,
        icon: compliancePin,        
        title: i.get('owner_name') || "Unknown Owner"
      });

      // duplicating html from InstallationList (veos.view.js)
      var mapPopupContent;
      //mapPopupContent = '<p><b> ' + (i.get('owner_name') || "<i>Unknown Owner</i>") + ' </b></p>' + i.getLocDescription();    // TODO - pretty this up, maybe truncate Addr with ellipses?

/*                var complianceLevel;                   TODO - do we really want this? It's duplicate info here, since the pin already shows more info
      if (installation.get('compliance_level_override')) {
        complianceLevel = "<span class='compliance-"+installation.get('compliance_level_override')+"'></span>";
      } else if (installation.get('compliance_level')) {
        complianceLevel = "<span class='compliance-"+installation.get('compliance_level')+"'></span>";
      } else {
        complianceLevel = "<span class='compliance-unknown'></span>";
      }*/

      if (i.get('owner_name')) {
        buttonText = "<span class='owner_name'>" + i.get('owner_name') + "</span><br/><span class='trunc-address'>" + i.getTruncatedLocDescription() + "</span>";
      } else {
        buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='trunc-address'>" + i.getTruncatedLocDescription() + "</span>";
      }

      var thumb = "";
      if (i.has('photos') && i.get('photos').length > 0) {
        var photoID = i.get('photos')[0].id;
        thumb = "<img class='list-picture photo-"+photoID+"' />";
      }  

      mapPopupContent = "<a href=installation-details.html?id="+i.id+">"+thumb+buttonText+"</a>";

      // binding a popup click event to the marker
      google.maps.event.addListener(marker, 'click', function() {
        injectThumbnail(i);
        map.infowindow.setContent(mapPopupContent);
        map.infowindow.open(map.gmap, marker);
        highlightOwnerPins(markersArray, i.get('owner_name'));
      });
      marker.setMap(map.gmap);
      markersArray.push(marker);
    });
  };

  // var injectThumbnail = function(installation) {
  //   if (installation.has('photos') && installation.get('photos').length > 0) {
  //     var photoID = installation.get('photos')[0].id;
  //     // thumb = "<img class='list-picture photo-"+photoID+"' />";
      
  //     console.log('Trying to retrieve photo thumb URL for photo with ID: '+photoID);

  //     var thumbPhoto = new veos.model.Photo({id: photoID});

  //     var photoFetchSuccess = function (model, response) {
  //       console.log("We made it and are about to retrieve Photo thumb URL");
  //       var img = jQuery('.photo-'+model.id);
  //       img.attr('src', model.thumbUrl());
  //       jQuery('.photo-'+model.id).append(img);
  //     };

  //     // TODO: think about this since it delets all input on error and returns to map
  //     var photoFetchError = function (model, response) {
  //       console.error("Fetching photo model for Installation List failed with error: " +response);
  //     };

  //     thumbPhoto.fetch({success: photoFetchSuccess, error: photoFetchError});
  //   }
  //  };


  var highlightOwnerPins = function(markersArray, ownerName) {
    // clear the marker colors
    // _.each(markers)

    console.log(ownerName);

    var ownerInstallations = new veos.model.Installations();
    
    var ownerSuccess = function (model, response) {
      ownerInstallations.each(function(i) {
        console.log('sister installations: ' + i.get('id'));
        //console.log('the array: ' + markersArray);

        // not ideal, but working - would be better to flip the eachs. Also, this will ping once for *each* match... lots of duplicate higlights
        _.each(markersArray, function(marker) {
          if (marker.title == i.get('owner_name')) {
            console.log('found one: ' + i.get('owner_name'));
            marker.setIcon('/images/pin-green-full.png');
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