/*jshint browser: true, devel: true */
/*globals jQuery, google */

window.veos = (function(veos) {
  var self = {};

  self.Map = function (mapDiv) {
    var mapOptions = {
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      center: new google.maps.LatLng(43.6481, -79.4042), // FIXME: hard-coded to Toronto,
      streetViewControl: false,
      zoomControl: false // use pinch-zoom instead, controls are too small to use on phone
    };

    var mapElement = jQuery(mapDiv)[0];

    this.gmap = new google.maps.Map(mapElement, mapOptions);
  };

  self.Map.prototype = {
    convertGeolocToGmapLatLong: function (geoloc) {
      return new google.maps.LatLng(geoloc.coords.latitude, geoloc.coords.longitude);
    }
  };

 
  /**
    Shows the current location marker and continuously updates its
    position based on incoming GPS data.
  **/
  self.Map.prototype.startFollowing = function () {
    var self = this;

    self.posWatcher = navigator.geolocation.watchPosition(function (geoloc) {
      var glatlong = self.convertGeolocToGmapLatLong(geoloc);
      var accuracy = geoloc.coords.accuracy;

      if (!self.currentLocMarker) {
        self.currentLocMarker = new google.maps.Marker({
          position: glatlong,
          //draggable: true,
          //icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          icon: 'http://maps.google.com/mapfiles/ms/micons/man.png',
          //icon: 'http://www.google.com/mapfiles/arrow.png',
          title: "You are here"
        });

        var infowindow = new google.maps.InfoWindow({
          content: "<p><b>You are here!</b></p>"
        });

        google.maps.event.addListener(self.currentLocMarker, 'click', function() {
          infowindow.open(self.gmap, self.currentLocMarker);
        });

        self.currentLocRadius = new google.maps.Circle({
            center: glatlong,
            radius: accuracy,
            map: self.gmap,
            fillColor: '#6991FD',
            fillOpacity: 0.4,
            strokeColor: 'black',
            strokeOpacity: 0.0, // 0.8,
            strokeWeight: 1
        });

        self.currentLocMarker.setMap(self.gmap);

        self.gmap.panTo(glatlong);
      }

      // this would reframe the map to the accuracy circle
      //self.gmap.fitBounds(self.currentLocRadius.getBounds());

      
      self.currentLocMarker.setPosition(glatlong);
      self.currentLocRadius.setCenter(glatlong);
      self.currentLocRadius.setRadius(accuracy);
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


  self.Map.prototype.addReportMarkers = function (reports) {
    var self = this;

    reports.each(function(r) {
      var latLng = new google.maps.LatLng(r.get('loc_lat_from_gps'),r.get('loc_lng_from_gps'));
      var marker = new google.maps.Marker({
        position: latLng,
        title: r.get('owner_name')
      });

      var mapPopupContent;
      if (r.get('camera')) {
        mapPopupContent = '<p><b> Camera @ </b>' + r.get('owner_name') + '</p>';
      } else if (r.get('sign')) {
        mapPopupContent = '<p><b> Sign @ </b>' + r.get('owner_name') + '</p>';
      }

      var infowindow = new google.maps.InfoWindow({
        content: mapPopupContent
      });
      
      // binding a popup click event to the marker
      google.maps.event.addListener(marker, 'click', function() {
        infowindow.open(self.gmap, marker);
      });
      marker.setMap(self.gmap);
    });
  };


  // self.createMap = function(lat, lng, map) {
  //   // if map = overview-map-canvas, create the overview-map, else if map = refining-map-canvas, create refining map
  //   // each have different types of events (click vs drag)
  //   var refining = null;
  //   if (map === "#overview-map-canvas") {
  //     refining = false;
  //   } else if (map === "#refining-map-canvas") {
  //     refining = true;
  //   } else {
  //     console.log('not sure where to put the map');
  //   }

  //   var currentLatLng = new google.maps.LatLng(lat,lng);

  //   var myOptions = {
  //     center: currentLatLng,
  //     zoom: 14,
  //     mapTypeId: google.maps.MapTypeId.ROADMAP //HYBRID is also an option?
  //   };

  //   var map = new google.maps.Map(jQuery(map)[0], myOptions);
  //   //var map = new google.maps.Map(map, myOptions);

  //   // for the overview map page
  //   if (refining === false) {
  //     // adding a marker for the current location as determined by the browser/phone
  //     var marker = new google.maps.Marker({
  //       position: currentLatLng,
  //       //draggable: true,
  //       icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  //       title:"Current position"
  //     });

  //     // creating a new popup window (we can add way more formatting here, see https://developers.google.com/maps/documentation/javascript/overlays#InfoWindows)
  //     var infowindow = new google.maps.InfoWindow({
  //       content: "<p><b>You are here</b></p>"
  //     });

  //     // adding the listener for the previously created marker that binds the popup window
  //     google.maps.event.addListener(marker, 'click', function() {
  //       infowindow.open(map,marker);
  //     });

  //     // To add the marker to the map, call setMap();
  //     marker.setMap(map);
  //   }
  //   // for the reports map page
  //   else if (refining === true) {
  //     // adding a marker for the current location as determined by the browser/phone
  //     var marker = new google.maps.Marker({
  //       position: currentLatLng,
  //       draggable: true,
  //       icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  //       title:"Current position"
  //     });

  //     // adding an event listener to retrieve location once marker is dragged
  //     google.maps.event.addListener(marker, 'dragend', function (event) {
  //       console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
  //     });
  //     marker.setMap(map);
  //   } else {
  //     console.log('we got the wrong map canvas');
  //   }

  //   addInstallationMarkers(map);
  // };

  // // I have a feeling someone else (Matt) is working on the same thing here... will continue once this is determined
  // self.createRefiningMap = function (lat, lon) {
  //   console.log("Initializing Google Map...");

  //   var currentLatLng = new google.maps.LatLng(lat, lon);

  //   var myOptions = {
  //     center: currentLatLng,
  //     zoom: 14,
  //     mapTypeId: google.maps.MapTypeId.ROADMAP
  //   };

  //   var map = new google.maps.Map(document.getElementById("refining-map-canvas"), myOptions);

  //   // adding a marker for the current location as determined by the browser/phone
  //   var marker = new google.maps.Marker({
  //     position: currentLatLng,
  //     draggable: true,
  //     icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  //     title:"Current position"
  //   }); 

  //   // adding an event listener to retrieve location once marker is dragged
  //   google.maps.event.addListener(marker, 'dragend', function (event) {
  //     console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
  //     //alert('lat ' + event.latLng.lat() + ' lng ' + event.latLng.lng());
  //     userDefinedLat = event.latLng.lat();
  //     userDefinedLon = event.latLng.lng();
  //   });


  //   // adding the marker to the map
  //   marker.setMap(map);

  //   //adding other installation markers drawn from DB
  //   addInstallationMarkers(map);
  // };

  // var addInstallationMarkers = function(map) {
  //     // adding markers for each point in the DB (we'll want to limit this at some point to decrease load time)
  //   var r = new veos.model.Reports();
  //   // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
  //   r.on('reset', function(collection) {
  //     r.each(function(report) {
        
  //     });
  //   });
  //   // @triggers reset on the collection
  //   r.fetch();
  // }

  self.generateStaticMap = function(lat, lng, reportsCollection) {
    var staticMapCriteria = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + lat + "," + lng;
    
    // add the current location as red pin to the map
    staticMapCriteria += "&markers=color:red%7C" + lat + "," + lng;

    if (reportsCollection !== undefined) {
      reportsCollection.each(function(report, iterator) {
        // in the first iteration set the color of markers to blue and add the first element
        // note: %7C is the notation for |
        if ( (report.get('loc_lat_from_user') || report.get('loc_lat_from_gps')) &&
             (report.get('loc_lng_from_user') || report.get('loc_lng_from_gps')) ) {
          // user refined location should override gps location
          var tempLat = null;
          var tempLng = null;
          if (report.get('loc_lat_from_user')) {
            tempLat = report.get('loc_lat_from_user');
            console.log('user');
          } else {
            tempLat = report.get('loc_lat_from_gps');
            console.log('gps');
          }
          if (report.get('loc_lng_from_user')) {
            tempLng = report.get('loc_lng_from_user');
          } else {
            tempLng = report.get('loc_lng_from_gps');
          }

          if (iterator === 0) {
            staticMapCriteria += "&markers=size:tiny%7Ccolor:red%7C" + tempLat + ',' + tempLng;
          }
          // add all additional elements with same marker style
          else {
            staticMapCriteria += "%7C" + tempLat + ',' + tempLng;
          }
        } else {
          console.log("undefined lat or lng in the DB, skipping this entry");
        }
      });
    }
    else {
      console.warn('reportsCollection is undefined, so there are no reports yet?');
    }

    return staticMapCriteria;
  };


  // self.retrieveLatLng = function(report) {
  //   // return user-defined GPS if it exists, otherwise return device-defined GPS
  //   var lat = null;
  //   var lng = null;
  //   if (report.get('loc_lat_from_user')) {
  //     lat = report.get('loc_lat_from_user');
  //   } else {
  //     lat = report.get('loc_lat_from_gps');
  //     console.log('gps');
  //   }
  //   if (report.get('loc_lng_from_user')) {
  //     lng = report.get('loc_lng_from_user');
  //   } else {
  //     lng = report.get('loc_lng_from_gps');
  //   }

  //   return { lat: lat, lng: lng };
  // }  

  // var geolocationFailureHandler = function() {
  //   alert('Unable to retrieve your current GPS location, please enable GPS and reload!');
  // };

  // self.init = function() {
  //   console.log("Initializing Google Map...")

  //   // retrieve the current position of the phone
  //   navigator.geolocation.getCurrentPosition(function geolocationSuccess(currentLocation) {
  //     lat = currentLocation.coords.latitude;
  //     lng = currentLocation.coords.longitude;
  //     self.createMap(lat, lng, "#overview-map-canvas");
  //   }, function geolocationFailure () {
  //       alert('There was a problem determining your location due to: ' + error.message);
  //   });

  // };

  // //self.createMap = createMap;
  // self.addInstallationMarkers = addInstallationMarkers;

  veos.map = self;
  return veos;
})(window.veos || {});