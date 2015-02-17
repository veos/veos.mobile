/*jshint sub:true, debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*global Backbone, _, jQuery, Android, FileTransfer, FileUploadOptions, google */

(function(veos) {
  var model = {};

  // model.baseURL = window.location.protocol + "://" + window.location.host +
  //   (window.location.port ? ':' + window.location.port : '');
  //model.baseURL = "http://backend.veos.ca";
  //model.baseURL = "http://veos.surveillancerights.ca";
  //model.baseURL = "http://192.168.222.108:3000";
  //model.baseURL = "http://192.168.43.221:3000";

  // need full URL for photo uploads to work with reverse proxying
  model.baseURL = location.protocol + "//" + location.host + "/backend";

  // model.baseURL = "http://backend.dev.surveillancerights.ca";

  jQuery.support.cors = true; // enable cross-domain AJAX requests

  /**
   * Does recursive magic on the given 'attrs' object, renaming
   * each property given in 'nested' array from "myprop" to "myprop_attributes".
   * This is done to make Rails' accepts_nested_attributes_for happy.
   **/
  function wrapNested(nested, attrs) {
    _.each(nested, function (k) {
      if (k instanceof Array) {
        if (attrs[k[0]]) {
          wrapNested(k[1], attrs[k[0]]);
        }
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
      var attrs = _.clone( this.attributes ); // WARNING: shallow clone only!

      wrapNested(this.nested, attrs);

      var wrap = {};
      wrap[this.singular] = attrs;
      return wrap;
    },
    url: function () {
      var base = model.baseURL + '/' + this.plural;
      if (this.isNew()) {
        return base + '.json';
      }
      else {
        return base + '/' + this.id + '.json';
      }
    },
    defaultErrorHandler: function (model, response, opts) {
      console.error("Error on "+this.singular+" model: " + JSON.stringify(model) + " --- " + JSON.stringify(response));

      var msg;

      // FIXME: a 422 response over cross domain will for some reason return status 0... catching it like this here
      //        could result in bogus error reporting.
      if (response.status === 422 || response.status === 0) {
        msg = "Sorry, there is a problem in your "+this.singular+". Please check your input and try again.";
        var errors = {};
        try {
          errors = JSON.parse(response.responseText).errors;
        } catch (err) {
          console.error("Couldn't parse response text: "+response.responseText+ " ("+err+")");
        }

        var errContainer = jQuery("#error-message-container");

        _.each(errors, function(v, k) {
          var errField = jQuery("*[name='"+k+"'].field");

          if (errField.is(':checkbox, :radio')) {
            errField = errField.parent();
          }

          errField.addClass("error");
          jQuery('*[for='+errField.attr('id')+']').addClass("error");
          errField.one('change focus', function() {
            errField.removeClass("error");
            jQuery('*[for='+errField.attr('id')+']').removeClass("error");
          });


          if (errContainer.length !== 0) {
            var humanFieldName = k.replace(/_/, ' ');
            errContainer.append("<li><strong>"+humanFieldName+"</strong> "+v+"</li>");
          }
        });

        if (errContainer.length !== 0) {
          errContainer.show();
        }

      } else if (response.status >= 500 && response.status < 600) {
        msg = "Our apologies, the server responded with an error. There may be a problem with the system.";
      } else {
        msg = "Sorry, there was an error while performing this action. The server may be temporarily unavailable.";
      }

      jQuery('html, body').animate({ scrollTop: 0 }, 0);

      veos.alert(msg, "Error");
    }
  });


  /*** Report ***/

  model.Report = Base.extend({
    singular: "report",
    plural: "reports",
    nested: ['tags', ['photos', ['tags']], ['installation', ['organization']]],
    defaults: {
      'owner_identifiable': true
    },

    // validate: function(attrs) {
    //   console.log("Validating the model...");

    //   var validationObj = {};

    //   // not checking all 'required' fields since it's pretty conditional requirements for now (if B but not A, then...), and there are only 3
    //   // better to check using attrs, if possible, rather than the fields using jQuery

    //   // owner_name or owner_identifiable must be filled
    //   if (!(attrs.owner_name)) {
    //     if (jQuery('#unidentified-owner-checkbox').is(':checked')) {
    //       console.log('passing validation...');
    //     } else {
    //       alert('Owner name must be filled in or marked as unidentifiable');
    //     }
    //   }

    //   // if owner_name is filled, owner_type must be filled
    //   if (!(attrs.owner_type)) {
    //     if (attrs.owner_name) {
    //       alert('Owner type must be filled out if owner can be identified');
    //     }
    //   }

    //   // _.all(jQuery("input.required").val(), funciton (v) { return v != "" })
    // },

    attachPhoto: function (photo, successCallback) {
      var report = this;
      photo.save({'report_id': report.id}, {success: function () {
        if (!report.photos) {
          report.photos = [];
        }

        report.photos.push(photo);
        photo.report = report; // in case we need to later refer to the report we're attached to from the photo

        report.updatePhotosAttribute();

        photo.on('change sync', report.updatePhotosAttribute, report);

        console.log("Photo "+photo.id+" attached to report "+ report.id);

        if (successCallback) {
          successCallback(report, photo);
        }
      }});
    },

    removePhoto: function (fingerprint) {
      var report = this;

      // this shouldn't really happen...
      if (!report.photos) {
        report.photos = [];
      }

      var photo = _.find(report.photos, function (p) {
        return p.get('image_fingerprint') === fingerprint;
      });

      if (!photo) {
        console.error("Tried to remove a photo with fingerprint '"+fingerprint+"' but this report has no such photo. Attached photos are:",report.photos);
        throw "Tried to remove a photo that doesn't exist in this report!";
      }

      report.photos.splice(_.indexOf(report.photos, photo), 1);
      report.updatePhotosAttribute();
    },

    updatePhotosAttribute: function () {
      if (!this.photos) {
        this.photos = [];
      }

      var photos = [];

      _.each(this.photos, function (photo) {
        photos.push(photo.toJSON()['photo']);
      });

      this.set('photos', photos);
      this.trigger('change');
    },

    addTag: function (tag, tagType) {
      var tags = this.get('tags');
      if (!tags) {
        tags = [];
      }

      tags.push({tag: tag, tag_type: tagType});

      this.set('tags', tags);
      this.trigger('change');
    },

    removeTag: function (tag, tagType) {
      var tags = this.get('tags');

      var t;
      while (this.findTag(tag, tagType)) {
        t = this.findTag(tag, tagType);
        tags.splice(_.indexOf(tags, t), 1);
      }

      this.trigger('change');
    },

    setTags: function (tags, tagType) {
      var ts = _.reject(this.get('tags'), function (t) {
        return t.tag_type === tagType;
      });
      ts = _.uniq(ts, false, function (t) {
        return [t.tag, t.tag_type];
      });
      _.each(_.uniq(tags), function (t) {
        ts.push({tag: t, tag_type: tagType});
      });

      this.set('tags', ts);
    },

    findTag: function (tag, tagType) {
      var tags = this.get('tags');

      return _.find(tags, function (t) {
        return t.tag === tag && t.tag_type === tagType;
      });
    },

    // return attached photos as Photo model objects
    getPhotos: function () {
      return _.map(this.get('photos'), function (data) { return new model.Photo(data);});
    },

    getLatLng: function() {
      if (this.get('loc_lat_from_user')) {
        console.log('In getLatLng() returning loc from user. Lat: '+this.get('loc_lat_from_user')+' Lng: '+this.get('loc_lng_from_user')+'');
        return new google.maps.LatLng(this.get('loc_lat_from_user'), this.get('loc_lng_from_user'));
      } else if (this.get('loc_lat_from_gps')) {
        console.log('In getLatLng() returning loc from GPS. Lat: '+this.get('loc_lat_from_gps')+' Lng: '+this.get('loc_lng_from_gps')+'');
        return new google.maps.LatLng(this.get('loc_lat_from_gps'), this.get('loc_lng_from_gps'));
      } else {
        return null;
      }
    },

    getLocDescription: function() {
      return this.get('loc_description_from_user') || this.get('loc_description_from_google') || "";
    }
  });

  model.Reports = Backbone.Collection.extend({
      model: model.Report,
      url: model.baseURL + '/reports.json'
  });

  /*** Installation ***/

  model.Installation = Base.extend({
    singular: "installation",
    plural: "installations",

    getLocDescription: function() {
      return this.get('loc_description') || "";
    },

    getTruncatedLocDescription: function() {
      var locText = this.get('loc_description') || "";
      return locText.substring(0,24) + '...';
    },

    startAmending: function () {
      var newReport = new model.Report();
      newReport.fetch({url: model.baseURL + '/installations/' + this.id + '/amend.json'});
      return newReport;
    }

  });

  model.Installations = Backbone.Collection.extend({
      model: model.Installation,
      url: model.baseURL + '/installations.json'
  });

  // model.PagedNearbyInstallations = Backbone.PageableCollection.extend({
  //     initialize: function (nearLat, nearLng) {
  //       this.nearLat = nearLat;
  //       this.nearLng = nearLng;
  //       // Since we want people to be able to scroll to any installation
  //       // no matter how fare away we set maxDist to half of the circumference of the earth
  //       this.maxDist = 20000;
  //     },
  //     model: model.Installation,
  //     url: function () {
  //       return model.baseURL + '/installations/near.json?lat=' + this.nearLat + '&lng=' + this.nearLng + '&max_dist=' + this.maxDist;
  //     }
  // });

  model.NearbyInstallations = Backbone.Collection.extend({
      initialize: function (nearLat, nearLng, maxDist) {
        this.nearLat = nearLat;
        this.nearLng = nearLng;
        this.maxDist = maxDist;
      },
      updateLocation: function (nearLat, nearLng, maxDist) {
        this.nearLat = nearLat;
        this.nearLng = nearLng;
        if (maxDist) {this.maxDist = maxDist;}
      },
      fetchMore: function () {
        var PER_PAGE = 30;
        var pageToFetch = Math.floor(this.length / PER_PAGE) + 1;

        var lat = veos.geo.lastLoc.coords.latitude;
        var lng = veos.geo.lastLoc.coords.longitude;

        this.fetch({
          data: {
            page: pageToFetch,
            per_page: PER_PAGE,
            lat: lat,
            lng: lng,
            max_dist: 24000
          },
          remove: false,
          reset: false // probably not needed, but just in case...
        });
      },
      updateMaxDistance: function(maxDist) {
        this.maxDist = maxDist;
      },
      summary: function (success, failure) {
        jQuery.get(veos.model.baseURL+"/installations/summary").done(success).fail(failure);
      },
      model: model.Installation,
      url: function () {
        return model.baseURL + '/installations/near.json?lat=' + this.nearLat + '&lng=' + this.nearLng + '&max_dist=' + this.maxDist + '&per_page=500';
      }
  });

  /*** Organization ***/

  model.Organization = Base.extend({
    singular: "organization",
    plural: "organizations"
  });

  /*** Photo ***/

  model.Photo = Base.extend({
    singular: "photo",
    plural: "photos",
    nested: ['tags'],

    captureFromCamera: function () {
      this.capture("camera");
    },

    captureFromGallery: function () {
      this.capture("gallery");
    },

    // used for desktop browser uploads
    captureFromFile: function (file) {
      this.imageFile = file;
      this.captureSuccess();
    },

    captureSuccess: function () {
      var photo = this;
      photo.trigger('image_capture');
    },

    capture: function (from) {
      var photo = this;

      if (from === "camera") {
        console.log("Trying to select photo from gallery...");
      } else if (from === "gallery") {
        console.log("Trying to capture photo from camera...");
      } else {
        throw "Trying to capture from unknown source!";
      }

      // NOTE: scope needs to be global for it to be callable inside android

      window.androidUploadStart = function () {
        photo.trigger('image_upload_start');
      };

      window.androidUploadError = function () {
        photo.trigger('image_upload_error');
      };

      window.androidUploadSuccess = function (id) {
        console.log("Image uploaded successfully.");

        photo.set('id', id);
        console.log("Photo model in Photo.capture.androidUploadSuccess:"+ JSON.stringify(photo.toJSON(), null, 2));
        photo.fetch({
          success: function () {
            console.log("Assigned id to photo: "+photo.id);
            console.log("Photo model in Photo.capture.androidUploadSuccess.fetch:"+ JSON.stringify(photo.toJSON(), null, 2));
            photo.trigger('image_upload_finish');
          }
        });
      };

      window.androidCaptureSuccess = function () {
        photo.captureSuccess();
      };

      // need to pass callback funciton name as string so that
      // it can be executed on the Android side

      if (from === "camera") {
        console.log("Telling Android to get the photo from Camera. Will send to URL: "+this.url());
        Android.getPhotoFromCamera(this.url(), 'window.androidCaptureSuccess');
      } else if (from === "gallery") {
        console.log("Telling Android to get the photo from Gallery. Will send to URL: "+this.url());
        Android.getPhotoFromGallery(this.url(), 'window.androidCaptureSuccess');
      }
    },

    upload: function () {
      var photo = this;

      // if (!photo.imageURL) {
      //   throw new Error("Cannot upload photo because it does not have an imageURL! You need to capture an image before uploading.");
      // }
      if (!photo.imageFile) {
        throw new Error("Cannot upload photo because it does not have a imageFile property! You need to capture an image before uploading.");
      }

      console.log("Uploading photo: "+photo.imageFile.name);
      photo.trigger('image_upload_start');

      // var options = new FileUploadOptions();
      // options.fileKey = "photo[image]";
      // options.fileName = photo.imageURL.substr(photo.imageURL.lastIndexOf('/')+1);
      // options.mimeType = "image/jpeg";
      // chunkedMode false uses more memory and might lead to crashes after some pictures
      // chunkedMode true can lead to a situation where no data is transmitted to the server
      // this seems to be fixed by setting the 6th value in transfer.upload to true (acceptSelfSignedCert)
      // while I am not sure how that affects a unencrypted http connection it seems to work
      // Sep 11, 2012 doesn't seem to work so set to false
      // options.chunkedMode = false;

      var success = function (data) {
        console.log("Image uploaded successfully; "+data.image_file_size+" bytes uploaded.");

        photo.set('id', data.id);

        console.log("Assigned id to photo: "+data.id);

        photo.set(data);

        photo.trigger('image_upload_finish', data);
      };

      var failure = function (error) {
        console.error("Image upload failed: " + JSON.stringify(error));
        photo.trigger('image_upload_error', error);
      };

      // WARNING: This uses XHR2 to upload the file. This is not supported by older browsers.
      //          See http://caniuse.com/xhr2 and http://stackoverflow.com/questions/4856917/jquery-upload-progress-and-ajax-file-upload/4943774#4943774
      var formData = new FormData();
      formData.append('photo[image]', photo.imageFile);

      jQuery.ajax({
        url: photo.url(),
        type: 'POST',
        // xhr: function () {
        //   myXhr = $.ajaxSettings.xhr();
        //   if(myXhr.upload){ // if upload property exists
        //       myXhr.upload.addEventListener('progress', progressHandlingFunction, false); // progressbar
        //   }
        //   return myXhr;
        // },
        success: success,
        error: failure,
        data: formData,
        cache: false,
        contentType: false,
        processData: false
      }, 'json');
    },

    addTag: function (tag) {
      var tags = this.get('tags');
      if (!tags) {
        tags = [];
      }

      tags.push({tag: tag});

      this.set('tags', tags);
      this.trigger('change');
    },

    removeTag: function (tag) {
      var tags = this.get('tags');

      var t;
      while (this.findTag(tag)) {
        t = this.findTag(tag);
        if (t.id) {
          t._destroy = true;
        } else {
          tags.splice(_.indexOf(tags, t), 1);
        }
      }

      this.trigger('change');
    },

    setTags: function (tags) {
      var ts = [];
      this.set('tags', ts);
      _.each(tags, function (t) {
        ts.push({tag: t});
      });
    },

    findTag: function (tag) {
      var tags = this.get('tags');

      return _.find(tags, function (t) {
        return t.tag === tag && !t._destroy;
      });
    },

    thumbUrl: function () {
      if (veos.isAndroid()) {
        return model.baseURL + "/" + this.get('thumb_url');
      } else {
        return model.baseURL + "/" + this.get('big_thumb_url');
      }
    },

    bigUrl: function () {
      return model.baseURL + "/" + this.get('big_url');
    },

    originalUrl: function () {
      return model.baseURL + "/" + this.get('original_url');
    }
  });


  veos.model = model;
})(window.veos);
