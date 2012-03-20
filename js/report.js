/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
  loopfunc: true, bitwise: true, curly: true, indent: 4, maxerr:50, white:false */

window.report = (function(report) {
    var self = report;

    // Functions for report.html
    // take a picture
    self.capturePhoto = function () {
        console.log('before camera call');
        // Take picture using device camera and retrieve image as base64-encoded string
        navigator.camera.getPicture(onPhotoDataSuccess, onFail, {
          quality: 50
        });
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

    // Called when a photo is successfully retrieved
    var onPhotoDataSuccess = function (imageData) {
      alert('on succcess');
      // Uncomment to view the base64 encoded image data
      /*console.log(imageData);

      // Get image handle
      var firstImage = document.getElementById('photo-preview');

      alert('image ' + firstImage);


      // Unhide image elements
      //smallImage.style.display = 'block';

      // Show the captured photo
      // The inline CSS rules are used to resize the image
      //
      firstImage.src = "data:image/jpeg;base64," + imageData;*/
    };

    var onFail = function (message) {
      //alert('Failed because: ' + message);
      alert('on fail');
    };

    return self;
})(window.report || {});