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
  }


  /*self.getPicture = function () {
      console.log('before camera call');
      // Take picture using device camera and retrieve image as base64-encoded string
      navigator.camera.getPicture(onPhotoDataSuccess, onFail, {
        quality: 50,
        sourceType: Camera.Picture.SourceType.PHOTOLIBRARY,
        destinationType: Camera.DestinationType.FILE_URI
      });
      alert('after camera call');
      console.log('after camera call');
  };*/

  // creating the map thumbnail
  navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);
  
  function geolocationSuccess (currentLocation) {
    var r = new veos.model.Reports();  // creates the "reports" collection proxy object
    // retrieves all of the reports from the server
    r.fetch({
      success: function () {
        var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=13&size=200x200&scale=2&sensor=true&center=" + currentLocation.coords.latitude + "," + currentLocation.coords.longitude;
        
        // TODO: limit number of markers?
        r.each(function(report) {
          staticMapCriteria += "&markers=" + report.get('latitude') + ',' + report.get('longitude');
        });

        var mapThumbnail = jQuery('<img class="map-thumbnail" />');
        mapThumbnail.attr('src', staticMapCriteria);
        
        var thumbnailContainer = jQuery('#report-page .map-thumbnail-container');
        thumbnailContainer.append(mapThumbnail);

        //TODO: adding reverse geocoding to #locationAddress. See https://developers.google.com/maps/documentation/javascript/geocoding

      },
      error: function () {
        // is there an actual error code I should be using here?
        alert('Unable to access database. Please confirm you are connected to the internet and try again. Alternatively, the VEOS server may be down')
      }
    });
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