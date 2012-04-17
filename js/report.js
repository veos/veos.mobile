/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
  loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

window.report = (function(report) {
  var self = report;

  function createMapThumbnail (currentLat, currentLon, reportsCollection) {
    // creating static map that is centered around the current location
    var staticMapCriteria = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + currentLat + "," + currentLon;
    
    // add the current location as red pin to the map
    staticMapCriteria += "&markers=color:red%7C" + currentLat + "," + currentLon;

    // TODO: limit number of markers?
    reportsCollection.each(function(report, iterator) {
      // in the first iteration set the color of markers to blue and add the first element
      // note: %7C is the notation for |
      if (iterator === 0) {
        staticMapCriteria += "&markers=size:tiny%7Ccolor:blue%7C" + report.get('latitude') + ',' + report.get('longitude');
      }
      // add all additional elements with same marker style
      else {
        staticMapCriteria += "%7C" + report.get('latitude') + ',' + report.get('longitude');
      }
    });

    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', staticMapCriteria);
    
    var thumbnailContainer = jQuery('#report-page .map-thumbnail-container');
    thumbnailContainer.empty();
    thumbnailContainer.append(mapThumbnail);

    // add listener which leads to overlay map (for refining location)
    mapThumbnail.click(function() {
      document.location = "#refine-location-page";    // is this the right way to do this?
    });
  }

  // this is a near duplicate of a function in veos.map.js. Any way to use functions from the closure?
  var createRefiningMap = function (currentLat, currentLon, collection) {
    console.log("Initializing Google Map...");
    var userSelectedLat = null;
    var userSelectedLon = null;

    var currentLatLng = new google.maps.LatLng(currentLat,currentLon);

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
      userSelectedLat = event.latLng.lat();
      userSelectedLon = event.latLng.lng();
    });

    jQuery('#refine-location-button').click(function() {
      createDynamicPageElements(userSelectedLat, userSelectedLon);
      document.location="#report-page";
    });

    // adding the marker to the map
    marker.setMap(map);

    //adding other installation markers drawn from DB
    addInstallationMarkers(map, collection);
  };

  // a near duplicate of a veos.map.js function
  var addInstallationMarkers = function(map, collection) {
      // adding markers for each point in the DB (we'll want to limit this at some point to decrease load time)
    var r = new veos.model.Reports();
    // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
    r.on('reset', function(collection) {
      r.each(function(report) {
        var latLng = new google.maps.LatLng(report.get('latitude'),report.get('longitude'));
        var marker = new google.maps.Marker({
          position: latLng,
          title: report.get('location_name')
        });
        marker.setMap(map);
      });
    });
    // @triggers reset on the collection
    r.fetch();
  };

  // perform a reverse geolocation lookup (convert latitude and longitude into a street address)
  function lookupAddressForLatLng (lat, lon) {
    var geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng(lat, lon);
    
    geocoder.geocode({'latLng': latlng}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[0]) {
          console.log("Reverse geocoding for lat: " + lat + " lng: " + lon + " returned this address: " + results[0].formatted_address);
          jQuery('#location-address').val(results[0].formatted_address);
        }
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  }

  // lookup longitude and latitude for a given street address
  self.lookupLatLngForAddress = function (address) {
  //function lookupLatLngForAddress (address) {
    var geocoder = new google.maps.Geocoder();
    //var address = address;
    
    geocoder.geocode({'address': address}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        console.log("Reverse geocoding for address: " + address + " returned this latitute: " + results[0].geometry.location.Ya + " and longitude: " + results[0].geometry.location.Za);
        
        var r = new veos.model.Reports();
        // adding listener for backbone.js reset event
        r.on('reset', function(collection) {
          createMapThumbnail(results[0].geometry.location.Ya, results[0].geometry.location.Za, collection);
        });
        // fetching will trigger reset event
        r.fetch();
        
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  };

  var createDynamicPageElements = function (lat, lon) {
    // do reverse geolocation address lookup with lat-lng
    lookupAddressForLatLng(lat, lon);

    var r = new veos.model.Reports();

    // adding listener for backbone.js reset event
    r.on('reset', function(collection) {
      // create static map for reports page
      createMapThumbnail(lat, lon, collection);
      // create the live map where the user can refine their location
      createRefiningMap(lat, lon, collection);
    });
    // fetching will trigger reset event
    r.fetch();    
  };

  self.init = function() {
    // retrieve the current position of the phone
    navigator.geolocation.getCurrentPosition(function geolocationSuccess (currentLocation) {
      createDynamicPageElements(currentLocation.coords.latitude, currentLocation.coords.longitude);
    },
      function geolocationFailure () {
        alert('There was a problem determining your location due to: ' + error.message);
    });
  };

  return self;
})(window.report || {});






// Google Maps notes:
/*  
-parameters static for now, but to be pulled from DB
-types of params we might want to use: lat/long, string (ie, "Toronto, On")
-markers are pins that we want to insert for each installation. We may want to set marker styles if there are multiple types of locations, ie src="http://maps.googleapis.com/maps/api/staticmap?center=43.668135,-79.398347&markers=size:small%7Ccolor:blue%7C43.669135,-79.399347&markers=43.658135,-79.388347&zoom=13&size=200x200&scale=2&sensor=true"
-set 'scale=2' for mobile devices
-docs claim we need 'sensor=true', but I doubt it
-for more details, see https://developers.google.com/maps/documentation/staticmaps/

 variables defined in the string for now, abstract and move when ready
<img src="http://maps.googleapis.com/maps/api/staticmap?zoom=13&size=200x200&scale=2&sensor=true" + 
center=current_position + &
markers=installation_1_ll + &
markers=installation_2_ll" />
etc.



Marker icon notes:
http://www.geocodezip.com/v3_markers_colored.html
http://www.geocodezip.com/v3_markers_normal_colored.html
http://www.geocodezip.com/v3_markers_normal_colored_infowindows.html

    var marker = new google.maps.Marker({
        position: currentLatLng,
        draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title:"Current position"
    });

We may need vectors or something, these icons are shite - even the standard maps icon is jagged. Maybe Janette?
*/
