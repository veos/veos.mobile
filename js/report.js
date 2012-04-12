/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
  loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

window.report = (function(report) {
  var self = report;

  // Called when a photo is successfully retrieved
  function cameraSuccess (imageURI) {
    console.log("Got image: ", imageURI);

    // create empty image element
    var cameraImage = jQuery('<img />');
    // set image URI of image element
    cameraImage.attr('src', imageURI);
    
    // select div that will hold all image elements added
    var imageList = jQuery('#image-list');
    // add newly created image to image list
    imageList.append(cameraImage);
  }

  function cameraError (message) {
    //alert('Failed because: ' + message);
    console.warn('Photo capture failed.');
  }
  

  // Functions for report.html
  // take a picture
  self.capturePhoto = function () {
    var options = {
      quality: 50,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.CAMERA
    };

    console.log('Capturing photo with options: ' + options);
    // Take picture using device camera and retrieve image as base64-encoded string
    navigator.camera.getPicture(cameraSuccess, cameraError, options);
  };

  self.selectPhoto = function () {
    var options = {
      quality: 50,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.PHOTOLIBRARY
    };

    console.log('Capturing photo with options: ' + options);
    // Take picture using device camera and retrieve image as base64-encoded string
    navigator.camera.getPicture(cameraSuccess, cameraError, options);
  };


  function createMapThumbnail (currentLat, currentLng, reportsCollection) {
    // creating static map that is centered around the current location
    var staticMapCriteria = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + currentLat + "," + currentLng;
    
    // add the current location as red pin to the map
    staticMapCriteria += "&markers=color:red%7C" +currentLat + "," + currentLng;

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
  }

  // perform a reverse geolocation lookup (convert latitude and longitude into a street address)
  function lookupAddressForLatLng (location) {
    var geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng(location.coords.latitude, location.coords.longitude);
    
    geocoder.geocode({'latLng': latlng}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[0]) {
          console.log("Reverse geocoding for lat: " +location.coords.latitude+ " lng: " +location.coords.longitude+ " returned this address: " +results[0].formatted_address);
          jQuery('#locationAddress').val(results[0].formatted_address);
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
    var address = address;
    
    geocoder.geocode({'address': address}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        console.log("Reverse geocoding for address: " +address+ " returned this latitute: " +results[0].geometry.location.Ya+ " and longitude: " +results[0].geometry.location.Za);
        
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
  
  function geolocationSuccess (currentLocation) {
    // do reverse geolocation address lookup with lat-lng
    lookupAddressForLatLng(currentLocation);

    var r = new veos.model.Reports();

    // adding listener for backbone.js reset event
    r.on('reset', function(collection) {
      createMapThumbnail(currentLocation.coords.latitude, currentLocation.coords.longitude, collection);
    });
    // fetching will trigger reset event
    r.fetch();
  }

  function geolocationFailure (errorMessage) {
    alert('There was a problem determining your location due to: ' + error.message);
  }

  // retrieve the GPS location in order to create the map thumbnail
  navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);

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