/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
  loopfunc: true, bitwise: true, curly: true, indent: 4, maxerr:50, white:false */

window.report = (function(report) {
    var self = report;

    // Called when a photo is successfully retrieved
    function cameraSuccess (imageURI) {
      console.log("Got image: ", imageURI);

      // Get image handle
      var firstImage = document.getElementById('photo-preview');


      // Unhide image elements
      //smallImage.style.display = 'block';

      // Show the captured photo
      // The inline CSS rules are used to resize the image
      //
      //firstImage.src = "data:image/jpeg;base64," + imageData;
      firstImage.src = imageURI;
    };

    function cameraError (message) {
      //alert('Failed because: ' + message);
      console.warn('Photo capture failed.');
    };

    

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

    return self;
})(window.report || {});