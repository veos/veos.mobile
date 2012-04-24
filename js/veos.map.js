/*jshint browser: true, devel: true */

window.veos = (function(veos) {
  var self = {};

  self.createMap = function(lat, lng, map) {
    // if map = overview-map-canvas, create the overview-map, else if map = refining-map-canvas, create refining map
    // each have different types of events (click vs drag)
    var refining = null;
    if (map === "#overview-map-canvas") {
      refining = false;
    } else if (map === "#refining-map-canvas") {
      refining = true;
    } else {
      console.log('not sure where to put the map');
    }

    var currentLatLng = new google.maps.LatLng(lat,lng);

    var myOptions = {
      center: currentLatLng,
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP //HYBRID is also an option?
    };

    var map = new google.maps.Map(jQuery(map)[0], myOptions);
    //var map = new google.maps.Map(map, myOptions);

    // for the overview map page
    if (refining === false) {
      // adding a marker for the current location as determined by the browser/phone
      var marker = new google.maps.Marker({
        position: currentLatLng,
        //draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title:"Current position"
      });

      // creating a new popup window (we can add way more formatting here, see https://developers.google.com/maps/documentation/javascript/overlays#InfoWindows)
      var infowindow = new google.maps.InfoWindow({
        content: "<p><b>You are here</b></p>"
      });

      // adding the listener for the previously created marker that binds the popup window
      google.maps.event.addListener(marker, 'click', function() {
        infowindow.open(map,marker);
      });

      // To add the marker to the map, call setMap();
      marker.setMap(map);
    }
    // for the reports map page
    else if (refining === true) {
      // adding a marker for the current location as determined by the browser/phone
      var marker = new google.maps.Marker({
        position: currentLatLng,
        draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title:"Current position"
      });

      // adding an event listener to retrieve location once marker is dragged
      google.maps.event.addListener(marker, 'dragend', function (event) {
        console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
      });
      marker.setMap(map);
    } else {
      console.log('we got the wrong map canvas');
    }

    addInstallationMarkers(map);
  };

  // I have a feeling someone else (Matt) is working on the same thing here... will continue once this is determined
  self.createRefiningMap = function (lat, lon) {
    console.log("Initializing Google Map...");

    var currentLatLng = new google.maps.LatLng(lat, lon);

    var myOptions = {
      center: currentLatLng,
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    var map = new google.maps.Map(document.getElementById("refining-map-canvas"), myOptions);

    // adding a marker for the current location as determined by the browser/phone
    var marker = new google.maps.Marker({
      position: currentLatLng,
      draggable: true,
      icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      title:"Current position"
    }); 

    // adding an event listener to retrieve location once marker is dragged
    google.maps.event.addListener(marker, 'dragend', function (event) {
      console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
      //alert('lat ' + event.latLng.lat() + ' lng ' + event.latLng.lng());
      userDefinedLat = event.latLng.lat();
      userDefinedLon = event.latLng.lng();
    });

/*    jQuery('#refine-location-button').click(function() {
      report.createDynamicPageElements(userDefinedLat, userDefinedLon, true);
      jQuery.mobile.changePage("report.html", { transition: "slideup"})
    });*/

    // adding the marker to the map
    marker.setMap(map);

    //adding other installation markers drawn from DB
    addInstallationMarkers(map);
  };

  var addInstallationMarkers = function(map) {
      // adding markers for each point in the DB (we'll want to limit this at some point to decrease load time)
    var r = new veos.model.Reports();
    // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
    r.on('reset', function(collection) {
      r.each(function(report) {
        var latLng = new google.maps.LatLng(report.get('loc_lat_from_gps'),report.get('loc_lng_from_gps'));
        var marker = new google.maps.Marker({
          position: latLng,
          title: report.get('owner_name')
        });
        // creating a new popup window that contains the location_name string (TODO: change to more relevant info)
        var infowindow = new google.maps.InfoWindow({
          content: '<b><p>' + report.get('owner_name') + '</b></p>'    // we might want to pretty thisup at some point
        });
        // binding a popup click event to the marker
        google.maps.event.addListener(marker, 'click', function() {
          infowindow.open(map,marker);
        });        
        marker.setMap(map);
      });
    });
    // @triggers reset on the collection
    r.fetch();
  }

  self.generateStaticMap = function(lat, lng, reportsCollection) {
    var staticMapCriteria = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + lat + "," + lng;
    
    // add the current location as red pin to the map
    staticMapCriteria += "&markers=color:red%7C" + lat + "," + lng;

    if (reportsCollection !== undefined) {
      reportsCollection.each(function(report, iterator) {
        // in the first iteration set the color of markers to blue and add the first element
        // note: %7C is the notation for |
        if ( (report.get('loc_lat_from_user') || report.get('loc_lat_from_gps'))
          && (report.get('loc_lng_from_user') || report.get('loc_lng_from_gps')) ) {
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
            staticMapCriteria += "&markers=size:tiny%7Ccolor:blue%7C" + tempLat + ',' + tempLng;
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
      console.warn('reportsCollection is undefined, so there are no reports yet?')
    }

    return staticMapCriteria;
  }

/*  var createPointDetailsMap = function(report) {
    var latLng = chooseGPSType(report);
    // note: higher zoom level
    var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=17&size=150x150&scale=2&sensor=true&center=" + latLng.lat + "," + latLng.lng;
    staticMapCriteria += "&markers=size:small%7C" + latLng.lat + ',' + latLng.lng;
    
    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', staticMapCriteria);    
    var thumbnailContainer = jQuery('#point-details-page .map-thumbnail-container');
    thumbnailContainer.append(mapThumbnail);  
  }*/

  self.retrieveLatLng = function(report) {
    // return user-defined GPS if it exists, otherwise return device-defined GPS
    var lat = null;
    var lng = null;
    if (report.get('loc_lat_from_user')) {
      lat = report.get('loc_lat_from_user');
    } else {
      lat = report.get('loc_lat_from_gps');
      console.log('gps');
    }
    if (report.get('loc_lng_from_user')) {
      lng = report.get('loc_lng_from_user');
    } else {
      lng = report.get('loc_lng_from_gps');
    }

    return { lat: lat, lng: lng };
  }  

  var geolocationFailureHandler = function() {
    alert('Unable to retrieve your current GPS location, please enable GPS and reload!');
  };

  self.init = function() {
    console.log("Initializing Google Map...")

    // retrieve the current position of the phone
    navigator.geolocation.getCurrentPosition(function geolocationSuccess(currentLocation) {
      lat = currentLocation.coords.latitude;
      lng = currentLocation.coords.longitude;
      self.createMap(lat, lng, "#overview-map-canvas");
    }, function geolocationFailure () {
        alert('There was a problem determining your location due to: ' + error.message);
    });

  };

  //self.createMap = createMap;
  self.addInstallationMarkers = addInstallationMarkers;

  veos.map = self;
  return veos;
})(window.veos || {});