/*jshint browser: true, devel: true */
/*global Backbone, _, jQuery, Camera, FileTransfer, FileUploadOptions */

(function(veos) {
  var self = {};

  // self.baseURL = window.location.protocol + "://" + window.location.host + 
  //   (window.location.port ? ':' + window.location.port : '');
  //self.baseURL = "http://backend.veos.ca";
  self.baseURL = "http://veos.surveillancerights.ca";
  //self.baseURL = "http://192.168.222.108:3000";

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  /**
   * Does recursive magic on the given 'attrs' object, renaming
   * each property given in 'nested' array from "myprop" to "myprop_attributes".
   * This is done to make Rails' accepts_nested_attributes_for happy.
   **/
  function wrapNested(nested, attrs) {
    _.each(nested, function (k) {
      if (k instanceof Array) {
        if (attrs[k[0]]) wrapNested(k[1], attrs[k[0]]);
        k = k[0];
      }

      if (attrs[k]) {
        attrs[k+"_attributes"] = attrs[k];
        delete attrs[k];
      }
    });
  }

  var Base = Backbone.Model.extend({
    initialize: function (attributes, options) {
      this.bind("error", this.defaultErrorHandler);
    },
    toJSON: function() {
      var attrs = _.clone( this.attributes );
      
      wrapNested(this.nested, attrs);

      var wrap = {};
      wrap[this.singular] = attrs;
      return wrap;
    },
    url: function () {
      var base = self.baseURL + '/' + this.plural;
      if (this.isNew()) 
        return base + '.json';
      else
        return base + '/' + this.id + '.json';
    },
    defaultErrorHandler: function (model, response, opts) {
      console.error("Error on "+this.singular+" model: ", model, response);
      
      var msg;

      if (response.status === 422)
        msg = "Sorry, there is an error in your "+this.singular+". Please check your input and try again.";
      else if (response.status >= 500 && response.status < 600)
        msg = "Our apologies, the server responded with an error. There may be a problem with the system.";
      else
        msg = "Sorry, there was some sort of error while performing this action. The server may be temporarily unavailable.";

      veos.alert(msg, "Error");
    }
  });


  /*** Report ***/

  self.Report = Base.extend({
    singular: "report",
    plural: "reports",
    nested: [['sign', ['photos']], ['camera', ['photos']]],

    attachPhoto: function (photo, successCallback) {
      if (this.has('sign') && this.get('sign').id) {
        photo.set('of_object_id', this.get('sign').id);
        photo.set('of_object_type', 'Sign');
        photo.save(null, {success: successCallback});
      } else if (this.has('camera') && this.get('camera').id) {
        photo.set('of_object_id', this.get('camera').id);
        photo.set('of_object_type', 'Camera');
        photo.save(null, {success: successCallback});
      } else {
        err = "Cannot attach a photo to this report because it is not yet associated with a Camera or Sign!";
        console.error(err);
        throw new Error(err);
      }
    },

    getLatLng: function() {
      if (this.get('loc_lat_from_user')) {
        return new google.maps.LatLng(this.get('loc_lat_from_user'), this.get('loc_lng_from_user'));
      } else if (this.get('loc_lat_from_gps')) {
        return new google.maps.LatLng(this.get('loc_lat_from_gps'), this.get('loc_lng_from_gps'));
      } else {
        return null;
      }
    },

    getLocDescription: function() {
      return this.get('loc_description_from_user') || this.get('loc_description_from_google') || "";
    }
  });

  self.Reports = Backbone.Collection.extend({
      model: self.Report,
      url: self.baseURL + '/reports.json'
  });

  /*** Sign ***/

  self.Sign = Base.extend({
    singular: "sign",
    plural: "signs",
    nested: ['photos']
  });

  /*** Camera ***/

  self.Camera = Base.extend({
    singular: "camera",
    plural: "cameras",
    nested: ['photos']
  });

  /*** Photo ***/

  self.Photo = Base.extend({
    singular: "photo",
    plural: "photos",

    captureFromCamera: function () {
      this.capture(Camera.PictureSourceType.CAMERA);
    },

    captureFromGallery: function () {
      this.capture(Camera.PictureSourceType.PHOTOLIBRARY);
    },

    capture: function (from) {
      var photo = this;
      var options = {
        quality: 50,
        destinationType: Camera.DestinationType.FILE_URI,
        sourceType: from
      };

      console.log('Capturing photo from source '+from+' with options: ', options);
      navigator.camera.getPicture(
        function (imageURL) { 
          photo.imageURL = imageURL;
          photo.trigger('image_capture', imageURL);
        }, 
        function (error) { 
          console.error("Image capture failed: " + error);
          photo.trigger('image_capture_error', error);
        }, 
        options
      );
    },

    upload: function () {
      var photo = this;

      if (!photo.imageURL)
        throw new Error("Cannot upload photo because it does not have an imageURL! You need to capture an image before uploading.");

      console.log("Uploading photo: "+photo.imageURL)

      var options = new FileUploadOptions();
      options.fileKey = "photo[image]";
      options.fileName = photo.imageURL.substr(photo.imageURL.lastIndexOf('/')+1);
      options.mimeType = "image/jpeg";

      var success = function (res) {
        console.log("Image uploaded successfully; "+res.bytesSent+" bytes sent.");
        
        res.photo = JSON.parse(res.response);
        photo.set('id', res.photo.id);

        console.log("Assigned id to photo: "+photo.id);

        photo.trigger('image_upload', res);
      };

      var failure = function (error) {
        console.error("Image upload failed: " + error);
        photo.trigger('image_upload_error', error);
      };

      var transfer = new FileTransfer();
      transfer.upload(photo.imageURL, photo.url(), success, failure, options);
    }
  });


  veos.model = self;
})(window.veos);