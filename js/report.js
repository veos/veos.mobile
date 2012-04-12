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


  function createMapThumbnail (currentLocation, reportsCollection) {
    // creating static map that is centered around the current location
    var staticMapCriteria = "https://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + currentLocation.coords.latitude + "," + currentLocation.coords.longitude;
    
    // add the current location as red pin to the map
    staticMapCriteria += "&markers=color:red%7C" +currentLocation.coords.latitude + "," + currentLocation.coords.longitude;

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
    thumbnailContainer.append(mapThumbnail);
  }

  function lookupLocationAddress (location) {
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

  // creating the map thumbnail
  navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);
  
  function geolocationSuccess (currentLocation) {
    // do reverse geolocation address lookup with lat-lng
    lookupLocationAddress(currentLocation);

    var r = new veos.model.Reports();

    // adding listener for backbone.js reset event
    r.on('reset', function(collection) {
      createMapThumbnail(currentLocation, collection);
    });
    // fetching will trigger reset event
    r.fetch();
  }

  function geolocationFailure (errorMessage) {
    alert('There was a problem determining your location due to: ' + error.message);
  }


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
*/