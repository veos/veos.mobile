/*jshint browser: true, devel: true */
/*globals jQuery, google */

(function(veos) {
  var self = {};

  self.convertGeolocToGmapLatLng = function (geoloc) {
    if (geoloc instanceof google.maps.LatLng) {
      return geoloc; // TODO: should be _.clone() this just to be safe?
    } else {
      return new google.maps.LatLng(geoloc.coords.latitude, geoloc.coords.longitude);
    }
  }

  self.Map = function (mapDiv, initLoc) {
    console.log("initializing map in " + mapDiv);

    var center;
    var zoom;
    if (!initLoc) {
      center = new google.maps.LatLng(43.6621614579938, -79.39527873417967);
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
      zoomControl: false // use pinch-zoom instead, controls are too small to use on phone
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
    navigator.geolocation.clearWatch(this.posWatcher);
  };

  /** 
    Removes the current location marker from the map.
  **/
  self.Map.prototype.clearCurrentLocation = function () {
    this.currentLocMarker.setMap(null);
  };


  /**
    Adds markers for a collection of Reports.
    @param reports veos.model.Reports
  **/
  self.Map.prototype.addReportMarkers = function (reports) {
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
      mapPopupContent = '<p><b> ' + (r.get('owner_name') || "Unknown Owner") + ' </b> - Camera</p>';      // TEMPORARY TODO
      /*if (r.get('camera')) {
        mapPopupContent = '<p><b> ' + (r.get('owner_name') || "Unknown Owner") + ' </b> - Camera</p>';
      } else if (r.get('sign')) {
        mapPopupContent = '<p><b> ' + (r.get('owner_name') || "Unknown Owner") + ' </b> - Sign</p>';
      }*/



      // binding a popup click event to the marker
      google.maps.event.addListener(marker, 'click', function() {
        map.infowindow.setContent(mapPopupContent);
        map.infowindow.open(map.gmap, marker);
      });
      marker.setMap(map.gmap);
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