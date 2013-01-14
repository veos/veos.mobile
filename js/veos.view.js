/*jshint debug:true, noarg:true, noempty:true, eqeqeq:false, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true unused:false */
/*global Backbone, _, jQuery, Android, FileTransfer, FileUploadOptions, google, device */

(function(veos) {
  var self = {};

  var addLoader = function (container) {
    var loader = jQuery("<div class='loading'><img src='images/loading-64.gif' alt='Loading...' /><p>Loading...</p></div>");
    jQuery(container).append(loader);
    return loader;
  };

  /**
    ReportForm
    Wires report.html for editing a Report object.
  **/
  self.ReportForm = Backbone.View.extend({
    events: {
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);
        this.model.setTags(f.val(), f.attr('name'));
        console.log("Setting "+f.attr("name")+" to "+f.val());
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },          
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#report-sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },  
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#report-sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },

      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        veos.currentPhoto.captureFromCamera();
      }, 

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        
        veos.currentPhoto.captureFromGallery();
      },


      'change #photo-from-hard-drive': function (ev) {
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        var fileInput = this.$el.find('#photo-from-hard-drive');

        veos.currentPhoto.on('image_capture', function (ev, photo) {
          veos.currentPhoto.upload();
        });

        veos.currentPhoto.captureFromFile(fileInput[0].files.item(0));
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      var report = this.model;

      //var self = this;
      console.log("Initializing ReportForm...");

      // this.model.on('change', _.bind(this.updateChangedFields, this));         doing this all in the render now - better, and 'changed fields' is useless due to refining map

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });

      // setup autocomplete
      var ownerNameField = this.$el.find("input[name='owner_name']");
      ownerNameField.autocomplete({
          method: 'GET', // allows POST as well
          icon: 'arrow-r', // option to specify icon
          target: this.$el.find('#owner-name-suggestions'), // the listview to receive results
          source: veos.model.baseURL + '/installations/autocomplete_owner_name.json', // URL return JSON data
          callback: function (ev) { 
            report.set('owner_name', jQuery(ev.currentTarget).text()); 
            ownerNameField.autocomplete('clear');
          }, // optional callback function fires upon result selection
          //link: 'target.html?term=', // link to be attached to each result
          minLength: 1, // minimum length of search string
          transition: 'none',// page transition, default is fade
          matchFromStart: true // search from start, or anywhere in the string
      });
    },

    submit: function () {
      // clear out previous server generated error messages and highlights
      // generally redundant, but necessary due to owner_identifiable, which affects multiple otherwise unrelated fields
      jQuery('#error-message-container li').not('.error-message-header').remove();
      jQuery('label').removeClass('error');
      jQuery('.field').removeClass('error');
      // jQuery('ui-radio').removeClass('error');

      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      if (typeof device != 'undefined' && device.uuid) {
        self.model.set('contributor_id', device.uuid);
      } else {
        // backend changed and does MD5 hashing on contributor_id now so it need to be a string and not null
        self.model.set('contributor_id', '');
      }

      self.model.save(null, {
        complete: function () {
          // replace failure with msg here?
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          var report = self.model;    
          var successCounter = 0;     // needed to know when we went through all the attached pictures
          
          console.log("Report saved successfully with id "+report.id);
          
          // This function is called later on in the success once all is done
          // deletes objects and bounces us back to overview map
          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };
          
          var images = jQuery('.photo-list-item');    // get all images that were taken
          var photoCount = images.length;             // count how many pictures are attached
          console.log("Total count of photos attached: " +photoCount);

          // no photos attached so we are done (call doneSubmit)
          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }
          
          // go through all pictures and attach them to the report
          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // create a Photo model using the id
            var photo = new veos.model.Photo({id: photoModel.photo.id});

            // once photo model is available (via fetch) we attach the photo to the report
            var photoFetchSuccess = function (model, response) {
              console.log("We made it and are about tot attach Photos");

              report.attachPhoto(model, function () {
                successCounter++;
                if (successCounter === photoCount) {
                  console.log("All photos attached!");
                  doneSubmit();
                  return;
                }
              });
            };

            // TODO: think about this since it delets all input on error and returns to map
            function photoFetchError (model, response) {
              console.error("Fetching photo model " + model.id +" failed with error: " +response);
              veos.alert("Error fetching Photo data during Report submission!");
              delete veos.currentReport;
              delete veos.reportForm;
              jQuery.mobile.changePage("overview-map.html");
            }

            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          });
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }        
      });
    },

    cancel: function () {
      console.log("Cancelling report...");
      this.clear();
      delete veos.reportForm;
      delete veos.currentReport;
      delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
      return true; // will now redirect to clicked element's href
    },

    clear: function () {
      console.log("Clearing ReportForm...");

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
      var geoloc;
      if (this.model.getLatLng()) {
        console.log("Using location from report model...", this.model.getLatLng());
        geoloc = this.model.getLatLng();
      } else if (veos.lastLoc) {
        console.log("Using last known location...", veos.lastLoc);
        geoloc = veos.lastLoc;
      } else {
        console.warn("Location unavailable... cannot update fields that depend on location.");
        return;
      }

      this.updateMapThumbnailFromLoc(geoloc);
      this.updateAddressFromLoc(geoloc);
    },

    updateMapThumbnailFromLoc: function (geoloc) {
      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
      var staticMapURL = veos.map.generateStaticMapURL(glatlng);
      var mapThumbnail = jQuery(this.$el.find('.map-thumbnail'));
      mapThumbnail.attr('src', staticMapURL);
      jQuery(".map-thumbnail-container .waiting").hide();
    },

    updateAddressFromLoc: function (geoloc) {
      var self = this;
      veos.map.lookupAddressForLoc(geoloc, function (address) {
        self.model.set('loc_description_from_google', address.formatted_address);
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
      });
    },

    updateLocFromAddress: function (address) {
      var self = this;
      veos.map.lookupLocForAddress(address, function (lat, lng) {
        self.model.set('loc_lat_from_user', lat);
        self.model.set('loc_lng_from_user', lng);
        self.updateMapThumbnailFromLoc(new google.maps.LatLng(lat, lng));
      });
    },

    renderPhotos: function () {
      var photoContainer = this.$el.find('#photos');
      var report = this.model;

      if (veos.currentPhoto) {
        _.each(veos.currentPhoto, function (p) {
          if (p.id != null) { // trying to avoid that empty picture is added
            // create the Photo model for the current photo ID
            var photo = new veos.model.Photo({id: p.id});
            // associate a PhotoView with the Photo model
            var photoView = new PhotoView({model: photo, el: photoContainer});

            var photoFetchSuccess = function (model, response) {
              console.log("Add the photo model to the report photos collection");
              if (!report.photos) {
                report.photos = [];
              }
              report.photos.push(model);
            };

            // TODO: think about this since it delets all input on error and returns to map
            var photoFetchError = function (model, response) {
              console.error("Fetching photo model for Installation List failed with error: " +response);
              veos.alert("Problem fetching photo model data. This might create problems later on");
            };

            // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          }
        });
      }
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportForm!");
      var self = this;

      var purposesArray = [];
      var propertiesArray = [];
      var spacesArray = [];      

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }

      // replaces changedFields() - we can't rely this.model.changed because we need to render after returning from refiningMap
      _.each(this.model.attributes, function(v, k) {
        if (k === "tags") {
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          if (spacesArray.length > 0) {
            self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
            jQuery('#surveilled-space').selectmenu('refresh', 'true');
          }
          if (propertiesArray.length > 0) {
            self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
            jQuery('#sign-properties').selectmenu('refresh', 'true');
          }
          if (purposesArray.length > 0) {
            self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
            jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
          }
        } else if (k === "has_sign") {
          if (self.model.get(k)) {
            jQuery('#sign-yes').attr("checked",true).checkboxradio("refresh"); 
            console.log('true');
          } else if (!self.model.get(k)) {
            jQuery('#sign-no').attr("checked",true).checkboxradio("refresh"); 
            console.log('false');
          }
        }
         else {
          self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
        }
      });

      jQuery('#owner-type').selectmenu('refresh');                          // why doesn't this work with classes? Would be much cleaner. Also refresh, really?
      jQuery('#sign-visibility').selectmenu('refresh');

      // updating the text on the accordion headers
      if (veos.currentReport.get('camera_count') || (spacesArray.length > 0)) {
        jQuery('.camera-add-edit-text').text('Edit');
      } else {
        jQuery('.camera-add-edit-text').text('Add');
      }
      if (veos.currentReport.get('sign_visibility') || veos.currentReport.get('sign_text') || (propertiesArray.length > 0) || (purposesArray.length > 0)) {
        jQuery('.sign-add-edit-text').text('Edit');
      } else {
        jQuery('.sign-add-edit-text').text('Add');
      }

      self.updateLocFields();
      self.renderPhotos();

      // ok, this is obviously insane - but if anyone can find a better way to keep the multi-selects from growing off the screen (on the phone, please let me know)
      // and this doesn't actually work well with screen rotation (since it doesn't rerender)
      // TODO!
      // see also ReportEdit version
      var multiWidth = jQuery(window).width() * 4/5;
      jQuery('.ui-select').width(multiWidth);
    }
  });




// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //



  // this really should be an extension of the ReportForm view above - massive duplication


  self.ReportEditForm = Backbone.View.extend({
    events: {
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);

        this.model.setTags(f.val(), f.attr('name'));
        console.log("Setting "+f.attr("name")+" to "+f.val());        
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },          
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#report-sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },  
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#report-sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },
      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
 
        veos.currentPhoto.captureFromCamera();
      },

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        
        veos.currentPhoto.captureFromGallery();
      },

      'change #photo-from-hard-drive': function (ev) {
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});

        var fileInput = this.$el.find('#photo-from-hard-drive');

        veos.currentPhoto.on('image_capture', function (ev, photo) {
          veos.currentPhoto.upload();
        });

        veos.currentPhoto.captureFromFile(fileInput[0].files.item(0));
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      //var self = this;
      console.log("Initializing ReportForm...");

      // FIXME [matt]: this should bind to render(), which should in turn update any changed fields to match the model.
      // [colin]: all done in render now, for reasons explain there
      //this.model.on('change', _.bind(this.updateChangedFields, this));

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      if (typeof device != 'undefined' && device.uuid) {
        self.model.set('contributor_id', device.uuid);
      } else {
        // backend changed and does MD5 hashing on contributor_id now so it need to be a string and not null
        self.model.set('contributor_id', '');
      }

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          console.log("Report saved successfully with id "+self.model.id);
          
          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            delete veos.currentInstallation;        // unique to editReport's view
            delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports

            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };

          var report = self.model;
          var successCounter = 0;
          //var photoTotalCount = self.model.getPhotos().length;

          var images = jQuery('.photo-list-item');
          var photoCount = images.length;
          console.log("Total count of photos attached: " +photoCount);

          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }
          
          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // check if photo in DOM already exists in installation
            var existingPhoto = null;
            existingPhoto = _.find(veos.currentInstallation.get('photos'), function (p) {
              var existingPhotoId = p.id;
              var domPhotoId = photoModel.photo.id;
              return existingPhotoId === domPhotoId;
            }); 

           
            // if photo already exists do not add the photo to the report again
            if (existingPhoto) {
              console.log('Photo with ID: '+photoModel.photo.id+' already exits');
              successCounter++;
              if (successCounter === photoCount) {
                console.log("All photos attached!");
                doneSubmit();
                return;
              }
            } else {
              console.log('Attach the new photo');
              // create a Photo model using the id
              var photo = new veos.model.Photo({id: photoModel.photo.id});

              // once photo model is available (via fetch) we attach the photo to the report
              var photoFetchSuccess = function (model, response) {
                console.log("We made it and are about tot attach Photos");

                report.attachPhoto(model, function () {
                  successCounter++;
                  if (successCounter === photoCount) {
                    console.log("All photos attached!");
                    doneSubmit();
                    return;
                  }
                });
              };

              // TODO: think about this since it delets all input on error and returns to map
              var photoFetchError = function (model, response) {
                console.error("Fetching photo model " + model.id +" failed with error: " +response);
                veos.alert("Error fetching Photo data during Report submission!");
                delete veos.currentReport;
                delete veos.reportForm;
                jQuery.mobile.changePage("overview-map.html");
              };

              photo.fetch({success: photoFetchSuccess, error: photoFetchError});
            }
          });
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }
      });
    },

    cancel: function () {
      console.log("Cancelling report...");
      this.clear();
      delete veos.reportForm;
      delete veos.currentReport;
      delete veos.currentInstallation;        // unique to editReport's view
      delete veos.currentPhoto; // Armin: I do believe this is necessary to avoid picture showing up on other reports
      return true; // will now redirect to clicked element's href
    },

    clear: function () {
      console.log("Clearing ReportForm...");

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
      var geoloc;
      if (this.model.getLatLng()) {
        console.log("Using location from report model...", this.model.getLatLng());
        geoloc = this.model.getLatLng();
      } else if (veos.currentInstallation) {
        //self.lastLoc = new google.maps.LatLng(43.6621614579938, -79.39527873417967);
        console.log("Using location from saved installation's latest report", veos.currentInstallation);
        geoloc = new google.maps.LatLng(veos.currentInstallation.get('loc_lat'), veos.currentInstallation.get('loc_lng'));
      } else {
        console.warn("Location unavailable... cannot update fields that depend on location.");
        return;
      }

      this.updateMapThumbnailFromLoc(geoloc);
      this.updateAddressFromLoc(geoloc);
    },

    updateMapThumbnailFromLoc: function (geoloc) {
      var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
      var staticMapURL = veos.map.generateStaticMapURL(glatlng);
      var mapThumbnail = jQuery(this.$el.find('.map-thumbnail'));
      mapThumbnail.attr('src', staticMapURL);
      jQuery(".map-thumbnail-container .waiting").hide();
    },

    updateAddressFromLoc: function (geoloc) {
      var self = this;
      veos.map.lookupAddressForLoc(geoloc, function (address) {
        self.model.set('loc_description_from_google', address.formatted_address);
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
      });
    },

    updateLocFromAddress: function (address) {
      var self = this;
      veos.map.lookupLocForAddress(address, function (lat, lng) {
        self.model.set('loc_lat_from_user', lat);
        self.model.set('loc_lng_from_user', lng);
        self.updateMapThumbnailFromLoc(new google.maps.LatLng(lat, lng));
      });
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportEditForm!");
      var self = this;

      var purposesArray = [];
      var propertiesArray = [];
      var spacesArray = [];      

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }      

      // replaces changedFields() - we can't rely this.model.changed because we need to render after returning from refiningMap
      _.each(this.model.attributes, function(v, k) {
        if (k === "tags") {
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          if (spacesArray.length > 0) {
            self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
            jQuery('#surveilled-space').selectmenu('refresh', 'true');
          }
          if (propertiesArray.length > 0) {
            self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
            jQuery('#sign-properties').selectmenu('refresh', 'true');
          }
          if (purposesArray.length > 0) {
            self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
            jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
          }         
        } else if (k === "has_sign") {
          if (self.model.get(k)) {
            jQuery('#sign-yes').attr("checked",true).checkboxradio("refresh"); 
            console.log('true');
          } else if (!self.model.get(k)) {
            jQuery('#sign-no').attr("checked",true).checkboxradio("refresh"); 
            console.log('false');
          }
        }
         else {
          self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
        }
      });

      jQuery('#owner-type').selectmenu('refresh');                          // why doesn't this work with classes? Would be much cleaner. Also refresh, really?
      jQuery('#sign-visibility').selectmenu('refresh');

      // updating the text on the accordion headers
      if (veos.currentReport.get('camera_count') || (spacesArray.length > 0)) {
        jQuery('.camera-add-edit-text').text('Edit');
      } else {
        jQuery('.camera-add-edit-text').text('Add');
      }
      if (veos.currentReport.get('sign_visibility') || veos.currentReport.get('sign_text') || (propertiesArray.length > 0) || (purposesArray.length > 0)) {
        jQuery('.sign-add-edit-text').text('Edit');
      } else {
        jQuery('.sign-add-edit-text').text('Add');
      }

      self.updateLocFields();
      self.renderPhotos();

      // see ReportEdit for explanation (uggggg)
      var multiWidth = jQuery(window).width() * 4/5;
      jQuery('.ui-select').width(multiWidth);      
    },

    renderPhotos: function () {
      var photoContainer = this.$el.find('#photos');
      var report = this.model;

      // we are in edit mode so currentInstallation should be filled otherwise we should not be here
      if (veos.currentInstallation) {
        _.each(veos.currentInstallation.get('photos'), function (p) {
          // create the Photo model for the current photo ID
          var photo = new veos.model.Photo({id: p.id});
          // associate a PhotoView with the Photo model
          var photoView = new PhotoView({model: photo, el: photoContainer});

          var photoFetchSuccess = function (model, response) {
            console.log("Add the photo model to the report photos collection");
            if (!report.photos) {
              report.photos = [];
            }
            report.photos.push(model);
          };

          // TODO: think about this since it delets all input on error and returns to map
          var photoFetchError = function (model, response) {
            console.error("Fetching photo model for Installation List failed with error: " +response);
            veos.alert("Problem fetching photo model data. This might create problems later on");
          };

          // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
          photo.fetch({success: photoFetchSuccess, error: photoFetchError});
        });
      }

      if (veos.currentPhoto) {
        _.each(veos.currentPhoto, function (p) {
          if (p.id != null) { // trying to avoid that empty picture is added
            // create the Photo model for the current photo ID
            var photo = new veos.model.Photo({id: p.id});
            // associate a PhotoView with the Photo model
            var photoView = new PhotoView({model: photo, el: photoContainer});

            var photoFetchSuccess = function (model, response) {
              console.log("Add the photo model to the report photos collection");
              if (!report.photos) {
                report.photos = [];
              }
              report.photos.push(model);
            };

            // TODO: think about this since it delets all input on error and returns to map
            var photoFetchError = function (model, response) {
              console.error("Fetching photo model for Installation List failed with error: " +response);
              veos.alert("Problem fetching photo model data. This might create problems later on");
            };

            // fetch the model data from the backend (this should trigger PhotoView render and show the picture)
            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          }
        });
      }
    }

  });



// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //
// **************************************************************************************************************** //




  var PhotoView = Backbone.View.extend({
    initialize: function () {
      var view = this;

      this.model.on('image_upload image_upload_finish change sync', this.render, this);

      this.model.on('image_upload_start', function () {
        jQuery.mobile.showPageLoadingMsg();
        jQuery('.ui-loader h1').text('Uploading photo...');
      }, this);

      this.model.on('image_upload_error', function (err) {
        veos.alert("Image upload failed: " + JSON.stringify(err));
        jQuery.mobile.hidePageLoadingMsg();
      }, this);
    },

    render: function () {
      //var photoDetails;
      console.log("Rendering PhotoView...");
      //this.$el.text(JSON.stringify(this.model.toJSON(), null, 2));
      console.log("Photo url: "+this.model.thumbUrl());

      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        // img = jQuery("<img style='display: block' class='photo-list-item' id='photo-"+this.model.id+"' onclick='veos.showModal("+this.model.id+")'/>"); // might make more sense to pass in this.model?
        img = jQuery("<img class='photo-list-item' id='photo-"+this.model.id+"'/>");
        //img.attr('data-model', this.model);
        img.attr('data-model', JSON.stringify(this.model.toJSON()));
        
        var href = location.href;
        var photoDetails = jQuery('<a />');

        // Only add a link to details (big picture) if on installation-details page
        if (href.match(/installation-details.html/)) {
          // wrap a link around the picture
          // temporarily disabled for beta release
          if (veos.isAndroid()) {
            photoDetails = jQuery('<a data-role="button" href="#"></a>');
            var photo = this.model;
            photoDetails.click(function (ev) {
              ev.preventDefault();
              Android.viewPhoto(photo.bigUrl());
            });
          } else {
            photoDetails = jQuery('<a data-role="button" href="photo-details.html?photoId='+this.model.id+'&installationId='+this.options.installationId+'"></a>');
          }
        }

        photoDetails.append(img);

        this.$el.append(photoDetails);
      }
      img.attr('src', this.model.thumbUrl());
      img.attr('alt', this.model.get('notes'));

      jQuery.mobile.hidePageLoadingMsg();
    }
  });







  /**
    PhotoDetailsView
    Shows the photo details page that allows users to add tags and a note to a picture.
  **/
  self.PhotoDetailsView = Backbone.View.extend({
    events: {
      'click #submit-photo-details': function (ev) {
        alert("submitting clicked");
        
      }
      // ,

      // 'click #submit-photo-details': 'submit'//,
      //'click #cancel-report': 'cancel'
    },

    initialize: function () {
      var view = this;

      this.model.on('change sync', this.render, this);
    },

    render: function () {
      console.log("Rendering PhotoDetailsView...");
      console.log("Photo url: "+this.model.bigUrl());
      // check if image already exists in DOM (shouldn't at this point)
      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        img = jQuery("<img class='photo-details-item' id='photo-"+this.model.id+"' />");
        //img.attr('data-model', this.model);
        // img.attr('data-model', JSON.stringify(this.model.toJSON()));

        this.$el.append(img);
      }
      // adding URL and alt
      img.attr('src', this.model.bigUrl());
      img.attr('alt', this.model.get('notes'));

      // setting the Photo ID in the page header
      var headerPhotoId = jQuery('#photo-details-page .photo-id');
      headerPhotoId.text(this.model.id);

      jQuery.mobile.hidePageLoadingMsg();
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          console.log("Photo detailes saved successfully with id "+self.model.id);
        },
        failure: function(model, response) {
          console.log('Error submitting: ' + response);
          // check for error codes from Matt
          // highligh different required fields based on error codes
        }
      });
    }
  });







  /**
    InstallationList
    Shows a list of Installations.
  **/
  self.InstallationList = Backbone.View.extend({
    MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    
    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        // veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
        // var id = jQuery(ev.target).attr('data-installationId');
        // alert(id);
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Installations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));   
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="main"]'));
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    render: function () {
      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }

      // adding installation count to page
      jQuery('.installation-count').text(this.collection.length);

      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {
        var buttonText = '';
        var ownerName;
        if (installation.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        }
        
        var complianceLevel;
        if (installation.get('compliance_level')) {
          if (installation.get('compliance_level') === 'no_sign') {
            complianceLevel = "<span class='compliance no-sign-color'></span>";
          } else if (installation.get('compliance_level') === 'missing_info') {
            complianceLevel = "<span class='compliance missing-info-color'></span>";
          } else if (installation.get('compliance_level') === 'min_compliant') {
            complianceLevel = "<span class='compliance min-compliant-color'></span>";
          } else if (installation.get('compliance_level') === 'compliant') {
            complianceLevel = "<span class='compliance compliant-color'></span>";
          } else {
            complianceLevel = "<span class='compliance-unknown'></span>";
          }
        }
        
        var thumb = "";
        
        // the installations.json now contains photo URL so this got easier and much faster
        if (installation.has('photos') && installation.get('photos').length > 0) {
          var photosOfInstallation = installation.get('photos');
          var photo = _.first(photosOfInstallation);
          var photoID = photo.id;
          var thumbUrl = veos.model.baseURL + photo.thumb_url;
            
          //console.log('Retrieve photo thumb URL: '+thumbUrl+' for photo with ID: '+photoID);
          thumb = "<img class='list-picture photo-"+photoID+"' src='"+thumbUrl+"' />";
        }

        var item = jQuery("<a class='relative' href='installation-details.html?id="+installation.get('id')+"'>"+complianceLevel+thumb+buttonText+"</a>");
        // item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        // item.attr('data-installationId', installation.get('id'));
        var li = jQuery("<li />");
        li.append(item);

        list.append(li);
        list.listview('refresh');
      });
    }
  });


  /**
    InstallationList for Report creation
    Shows a list of Installations.
  **/
  self.InstallationListReport = Backbone.View.extend({
    //MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    
    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
        // var id = jQuery(ev.target).attr('data-installationId');
        // alert(id);
      },

      // I assume this is limited to this view (page) and won't be clearing currentReport all over the place
      'click .add-report-button': function (ev) {
        console.log("clearing currentReport for extra safety");
        delete veos.currentReport;
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Installations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));   
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="main"]'));
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    render: function () {
      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }

      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {
        var buttonText = '';
        var ownerName;
        if (installation.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/><span class='loc_description'>" + installation.getLocDescription() + "</span>";
        }        

        var complianceLevel;
        if (installation.get('compliance_level')) {
          if (installation.get('compliance_level') === 'no_sign') {
            complianceLevel = "<span class='compliance no-sign-color'></span>";
          } else if (installation.get('compliance_level') === 'missing_info') {
            complianceLevel = "<span class='compliance missing-info-color'></span>";
          } else if (installation.get('compliance_level') === 'min_compliant') {
            complianceLevel = "<span class='compliance min-compliant-color'></span>";
          } else if (installation.get('compliance_level') === 'compliant') {
            complianceLevel = "<span class='compliance compliant-color'></span>";
          } else {
            complianceLevel = "<span class='compliance-unknown'></span>";
          }
        }        
        
        var thumb = "";

        // if photos are attached to the installation retrieve the thumb URL of the first photo via Photo model
        if (installation.has('photos') && installation.get('photos').length > 0) {
          var photoID = installation.get('photos')[0].id;
          thumb = "<img class='list-picture photo-"+photoID+"' />";
          
          console.log('Trying to retrieve photo thumb URL for photo with ID: '+photoID);

          var thumbPhoto = new veos.model.Photo({id: photoID});

          var photoFetchSuccess = function (model, response) {
            console.log("We made it and are about to retrieve Photo thumb URL");
            var img = jQuery('.photo-'+model.id);
            img.attr('src', model.thumbUrl());
          };

          // TODO: think about this since it delets all input on error and returns to map
          var photoFetchError = function (model, response) {
            console.error("Fetching photo model for Installation List failed with error: " +response);
          };

          thumbPhoto.fetch({success: photoFetchSuccess, error: photoFetchError});
        }

        // create the URL to load report.html in edit mode with prefilled data
        // the installationId is retrieved in veos.js .delegate and used to load a installation model
        // and render the ReportEditForm view
        // Adding a referrer so that the cancel button can lead back to installation details page / This is to fix bug 68.1
        var item = jQuery("<a class='relative' href=report.html?installationId="+ installation.get('id') +"&ref=report-selection>"+complianceLevel+thumb+buttonText+"</a>");
        // instead of setting fresh=true in the url and changing that to false later on we use a global variable (and we all love them)
        veos.amendingInst = true;
        // item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        // item.attr('data-installationId', installation.get('id'));
        var li = jQuery("<li />");
        li.append(item);

        list.append(li);
        list.listview('refresh');
      });
    }
  });




  self.InstallationDetails = Backbone.View.extend({
    events: {
      'click .flag-button': function (ev) {
        var view = this;
        console.log("opening flag dialogue");

        view.flagReport();
      }
    },

    initialize: function () {
      var view = this;

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Insts too?
      view.model.on('change sync', _.bind(view.render, view));
    },

    flagReport: function () {
      var response = confirm('Do you want to flag this report as inappropriate?');
      if (response) {
        var reportId = veos.currentInstallation.get('latest_report').id
        var flaggedReport = new veos.model.Report({id: reportId});

        var reportSuccess = function (model, response) {
          model.set('flagged', true);
          model.set('flagged_on', new Date());
          model.save();

          console.log('Report ' + model.get('id') + ' flagged');
          veos.alert("This report has been flagged as inappropriate");
        };
        var reportError = function (model, response) {
          console.error("Error fetching report model with message: "+response);
          veos.alert("Error fetching report details");
        };

        flaggedReport.fetch({success: reportSuccess, error: reportError});

      } else {
        console.log('Cancelled...');
      }
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="content"]'));
      // FIXME: this looks ugly
      this.loader.css({
        position: 'absolute',
        top: '30%',
        width: '100%'
      });
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    createPointDetailsMap: function(installation) {
      // note: higher zoom level
      var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=14&size=200x100&scale=2&sensor=true&center=" + installation.get('loc_lat') + "," + installation.get('loc_lng');
      staticMapCriteria += "&markers=size:small%7C" + installation.get('loc_lat') + ',' + installation.get('loc_lng');
      
      var mapThumbnail = jQuery('<img class="map-thumbnail" />');
      mapThumbnail.attr('src', staticMapCriteria);    
      var thumbnailContainer = this.$el.find('.map-thumbnail-container');
      thumbnailContainer.append(mapThumbnail);
    },

    showPictures: function(installation) {
      console.log('Showing pictures...');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      _.each(installation.get('photos'), function (p) {
        var photo = new veos.model.Photo({id: p.id});

        function photoSuccess (model, response) {
          // var img = jQuery('<img />');
          // img.attr('src', model.thumbUrl());
          // photoContainer.append(img);

          var photoView = new PhotoView({model: model, el: photoContainer, installationId: installation.get('id')});
          photoView.render();
        }

        function photoError (model, response) {
          console.error("Error fetching photo model with message: "+response);
          veos.alert("Error fetching photo details");
        }

        photo.fetch({success: photoSuccess, error: photoError});
      });
    },

    render: function () {
      var self = this;
      var installation = this.model;

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }      

      // create the URL to load report.html in edit mode with prefilled data
      // the installationId is retrieved in veos.js .delegate and used to load a installation model
      // and render the ReportEditForm view
      var editButton = jQuery('#installation-details-page .edit-button');
      // Adding a referrer so that the cancel button can lead back to installation details page / This is to fix bug 68.1
      editButton.attr('href', 'report.html?installationId='+installation.get('id')+'&ref=installation-details');
      // instead of setting fresh=true in the url and changing that to false later on we use a global variable (and we all love them)
      veos.amendingInst = true;

      var complianceButton = jQuery('#installation-details-page .compliance-banner');
      complianceButton.attr('href', 'privacy-compliance.html?installationId='+installation.get('id'));

      if (installation.get('compliance_level')) {
        if (installation.get('compliance_level') === 'no_sign') {
          complianceButton.find('.ui-btn-text').text('Not compliant: no sign');
          complianceButton.find('.ui-btn-inner').addClass('no-sign-color');
          complianceButton.find('.ui-btn-inner').addClass('white');
        } else if (installation.get('compliance_level') === 'missing_info') {
          complianceButton.find('.ui-btn-text').text('Not compliant');
          complianceButton.find('.ui-btn-inner').addClass('missing-info-color');
        } else if (installation.get('compliance_level') === 'min_compliant') {
          complianceButton.find('.ui-btn-text').text('Minimally compliant');
          complianceButton.find('.ui-btn-inner').addClass('min-compliant-color');
        } else if (installation.get('compliance_level') === 'compliant') {
          complianceButton.find('.ui-btn-text').text('Fully compliant');
          complianceButton.find('.ui-btn-inner').addClass('compliant-color');
        } else {
          console.log('this should never happen - no compliance level somehow?');
        }
      }

      if (this.loader) {
        this.hideLoader();
      }

      this.createPointDetailsMap(installation);

      // TODO: The showPictures function will only add pictures and not reflect pictures getting less
      // maybe we can reuse the PhotoView.render function??
      // this condition is always true - Matt, do you want to fix? There are workarounds on our end (as below)
      if (installation.has('photos')) {
        self.showPictures(installation);

        if (installation.get('photos').length === 0) {
          this.$el.find('.photo-count').text("no photos");
          jQuery('.photos-container').trigger('collapse');
        } else {
          this.$el.find('.photo-count').text(installation.get('photos').length);
        }        
      }
      
      var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      var ownerName;

      
      _.each(installation.attributes, function(v, k) {
        // base case for filling in the fields
        self.$el.find('.field[name="'+k+'"]').text(installation.get(k));

        // for nested stuff that isn't photos (latest report, tags, etc)
        if (k === "latest_report") {
          _.each(v, function(subv, subk) {
            if (subk === "has_sign") {
              if (installation.get('latest_report')[subk] === true) {
                self.$el.find('.field[name="has_sign"]').text('observed');
              } else {
                self.$el.find('.field[name="has_sign"]').text('not observed');
              }
            } else if (subk === "created_at") {
              // can we have the post create a Date object like in CK, would deuglify these slices
              self.$el.find('.field[name="created_at"]').text(subv.slice(11, -1) + ', ' + subv.slice(0, -10));
            } else {
              // this is the case for all of the latest report stuff (ie most stuff)
              if (subv) {
                self.$el.find('.field[name="'+subk+'"]').text(installation.get('latest_report')[subk]);
              } else {
                self.$el.find('.field[name="'+subk+'"]').text("not reported");
              }
            }
          });
        }
        else if (k === "tags") {
          var purposesString = '';
          var propertiesString = '';
          var spacesString = '';
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesString += i.tag + ', ';
            } else if (i.tag_type === "sign_properties") {
              propertiesString += i.tag + ', ';
            } else if (i.tag_type === "surveilled_space") {
              spacesString += i.tag + ', ';
            } else {
              console.log("unknown tag type");
            }
          });

          if (purposesString.length === 0) {
            self.$el.find('*[name="sign_stated_purpose"].field').text("not reported");
          } else {
            self.$el.find('*[name="sign_stated_purpose"].field').text(purposesString.slice(0, -2));
          }
          if (propertiesString.length === 0) {
            self.$el.find('*[name="sign_properties"].field').text("not reported");
          } else {
            self.$el.find('*[name="sign_properties"].field').text(propertiesString.slice(0, -2));
          }
          if (spacesString.length === 0) {
            self.$el.find('*[name="surveilled_space"].field').text("not reported");
          } else {
            self.$el.find('*[name="surveilled_space"].field').text(spacesString.slice(0, -2));
          }
        }

        // TODO: sloppy (overwriting, removing previous elements) - redo me
        if (installation.has('owner_name')) {
          self.$el.find('.field[name="owner_name"]').text(installation.get('owner_name'));
        } else {
          self.$el.find('.field[name="owner_name"]').text('Unknown Owner');
          // removes previously added blank owner type
          self.$el.find('.field[name="owner_type"]').text('');
        }

      });

    }
  });

  self.PrivacyComplianceView = Backbone.View.extend({
    initialize: function () {
      var self = this;

      // this can be removed, right? Nothing on this page will ever change
      this.model.on('change sync', _.bind(this.render, self));
    },

    showLoader: function () {
      this.loader = addLoader(this.$el.find('[role="content"]'));
      // FIXME: this looks ugly
      this.loader.css({
        position: 'absolute',
        top: '30%',
        width: '100%'
      });
    },

    hideLoader: function () {
      this.loader.remove();
      delete this.loader;
    },

    render: function () {
      var self = this;
      var installation = this.model;

      if (this.loader) {
        this.hideLoader();
      }

      if (veos.isAndroid()) {
        // we're in the Android app
        this.$el.find('.web-only').hide();
        this.$el.find('.android-only').show();
      } else {
        // we're in a regular browser
        this.$el.find('.web-only').show();
        this.$el.find('.android-only').hide();
      }      

      var backButton = jQuery('#privacy-compliance-page .back-button');
      backButton.attr('href', 'installation-details.html?id='+installation.get('id'));

      jQuery('.compliance-text').hide();

      var complianceButton = jQuery('#privacy-compliance-page .compliance-banner');
      if (installation.get('compliance_level')) {
        if (installation.get('compliance_level') === 'no_sign') {
          complianceButton.find('.ui-btn-text').text('Not compliant: no sign');
          complianceButton.find('.ui-btn-inner').addClass('no-sign-color');
          complianceButton.find('.ui-btn-inner').addClass('white');
          jQuery('#no-sign-text').show();
        } else if (installation.get('compliance_level') === 'missing_info') {
          complianceButton.find('.ui-btn-text').text('Not compliant');
          complianceButton.find('.ui-btn-inner').addClass('missing-info-color');
          jQuery('#missing-info-text').show();
        } else if (installation.get('compliance_level') === 'min_compliant') {
          complianceButton.find('.ui-btn-text').text('Minimally compliant');
          complianceButton.find('.ui-btn-inner').addClass('min-compliant-color');
          jQuery('#min-compliant-text').show();
        } else if (installation.get('compliance_level') === 'compliant') {
          complianceButton.find('.ui-btn-text').text('Fully compliant');
          complianceButton.find('.ui-btn-inner').addClass('compliant-color');
          jQuery('#compliant-text').show();
        } else {
          console.log('this should never happen - no compliance level?');
        }
      }

      var ownerName;
      if (installation.has('owner_name')) {
        self.$el.find('.field[name="owner_name"]').text(installation.get('owner_name'));
      } else {
        self.$el.find('.field[name="owner_name"]').text('Unknown Owner');
        jQuery('#privacy-compliance-page .owner-name').addClass('unknown');
      }  
      
      self.$el.find('.field[name="owner_type"]').text(installation.get('owner_type'));
      self.$el.find('.field[name="address"]').text(installation.get('loc_description'));

    }
  });

  veos.view = self;
})(window.veos);