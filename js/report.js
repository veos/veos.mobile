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


    var reports = new veos.model.Reports();  // creates the "reports" collection proxy object
    // retrieves all of the reports from the server
    reports.fetch({
      success: function () {
        console.log(reports.get(20).attributes.incident_title);
      },
      error: function () {
        // is there an actual error code I should be using here?
        alert('Unable to access database. Please confirm you are connected to the internet and try again. Alternatively, the VEOS server may be down')
      }
    });
  


    return self;
})(window.report || {});
