/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*global Backbone, _, jQuery, Camera, FileTransfer, FileUploadOptions, google */

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
        veos.captureImage('camera', veos.currentPhoto);
      }, 

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('gallery', veos.currentPhoto);
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      var report = this.model;

      //var self = this;
      console.log("Initializing ReportForm...");

      this.model.on('change', _.bind(this.updateChangedFields, this));

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
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      if (typeof device != 'undefined' && device.uuid)
        self.model.set('contributor_id', device.uuid);

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

    updateChangedFields: function () {
      console.log("updating changed fields in ReportForm: "+_.keys(this.model.changed).join(", "));
      var self = this;
      _.each(this.model.changed, function(v, k) {
        self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
      });

      // TODO: handle other non-trivial fields like report type, photo, etc.
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportForm!");
      var self = this;
      _.each(this.model.attributes, function(v, k) {
        self.$el.find('.field[name="'+k+'"]').val(self.model.get(k));
      });
      self.updateLocFields();

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
        jQuery('#installation-details-sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },  
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#installation-details-sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },
      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('camera', veos.currentPhoto);
      }, 

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('gallery', veos.currentPhoto);
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      //var self = this;
      console.log("Initializing ReportForm...");

      // FIXME [matt]: this should bind to render(), which should in turn update any changed fields to match the model.
      this.model.on('change', _.bind(this.updateChangedFields, this));

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

      if (typeof device != 'undefined' && device.uuid)
        self.model.set('contributor_id', device.uuid);

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

    updateChangedFields: function () {
      console.log("updating changed fields in ReportForm: "+_.keys(this.model.changed).join(", "));
      var self = this;
      _.each(this.model.changed, function(v, k) {                 // this whole thing needs to be checked over. These refreshes seem wrong. Also, the following 15 lines are 'verbose'... I can only assume Matt will rewrite this in 3 lines
        if (k === "tags") {
          var purposesArray = [];
          var propertiesArray = [];
          var spacesArray = [];
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
          self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
          self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
          self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
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

      jQuery('#surveilled-space').selectmenu('refresh', 'true');
      jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
      jQuery('#sign-properties').selectmenu('refresh', 'true');

      // TODO: handle other non-trivial fields like , photo, etc.
    },

    /**
      Triggers full update of all dynamic elements in the report page.
    **/
    render: function () {
      console.log("rendering ReportForm!");
      var self = this;

      _.each(this.model.attributes, function(v, k) {
        self.$el.find('.field[name="'+k+'"]').val(self.model.get(k));
      });
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
      var photoDetails;
      console.log("Rendering PhotoView...");
      //this.$el.text(JSON.stringify(this.model.toJSON(), null, 2));
      console.log("Photo url: "+this.model.thumbUrl());

      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        // img = jQuery("<img style='display: block' class='photo-list-item' id='photo-"+this.model.id+"' onclick='veos.showModal("+this.model.id+")'/>"); // might make more sense to pass in this.model?
        img = jQuery("<img class='photo-list-item' id='photo-"+this.model.id+"'/>");
        //img.attr('data-model', this.model);
        img.attr('data-model', JSON.stringify(this.model.toJSON()));
        
        // wrap a link around the picture
        // temporarily disabled for beta release
        //photoDetails = jQuery('<a data-role="button" href="photo-details.html?photoId='+this.model.id+'"></a>');
        //photoDetails.append(img);

        this.$el.append(img);
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
        img = jQuery("<img class='photo-list-item' id='photo-"+this.model.id+"' />");
        //img.attr('data-model', this.model);
        // img.attr('data-model', JSON.stringify(this.model.toJSON()));

        this.$el.append(img);
      }
      // adding URL and alt
      img.attr('src', this.model.thumbUrl());
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
          if (installation.get('compliance_level') === 1) {
            complianceLevel = "<span class='compliance low'></span>";
          } else if (installation.get('compliance_level') === 2) {
            complianceLevel = "<span class='compliance medium'></span>";
          } else if (installation.get('compliance_level') === 3) {
            complianceLevel = "<span class='compliance high'></span>";
          } else {
            complianceLevel = "<span class='compliance-unknown'></span>";
          }
        }
        
        var thumb = "";
        var obj = installation.get('photos');
        

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
          if (installation.get('compliance_level') === 1) {
            complianceLevel = "<span class='compliance low'></span>";
          } else if (installation.get('compliance_level') === 2) {
            complianceLevel = "<span class='compliance medium'></span>";
          } else if (installation.get('compliance_level') === 3) {
            complianceLevel = "<span class='compliance high'></span>";
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
        var item = jQuery("<a class='relative' href=report.html?installationId="+ installation.get('id') +">"+complianceLevel+thumb+buttonText+"</a>");
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
    Extending InstallationList for report-selection.html TODO - not working
  **/
  // self.InstallationSelectionList = self.InstallationList.extend({
  //   'click a.arrowbutton': function () {
  //     // go to editable version of installation-list.html
  //   }
  // });

  // self.InstallationViewList = self.InstallationList.extend({
  //   'click a.arrowbutton': function () {
  //     // go to installation-list.html
  //   }
  // });

  // self.InstallationSelectionListView = self.InstallationList.extend({
  //   initialize: function () {
  //     this.events['click .ui-btn'] = function(ev) {
  //       alert("clicked some-other thing");
  //     };
  //     this.delegateEvents();
  //   }
  // });

  self.InstallationDetails = Backbone.View.extend({
    initialize: function () {
      var self = this;

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Insts too?
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

    createPointDetailsMap: function(installation) {
      // note: higher zoom level
      var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=17&size=150x150&scale=2&sensor=true&center=" + installation.get('loc_lat') + "," + installation.get('loc_lng');
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

          var photoView = new PhotoView({model: model, el: photoContainer});
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

      // create the URL to load report.html in edit mode with prefilled data
      // the installationId is retrieved in veos.js .delegate and used to load a installation model
      // and render the ReportEditForm view
      var editButton = jQuery('#installation-details-page .edit-button');
      editButton.attr('href', 'report.html?installationId='+installation.get('id'));

      if (this.loader) {
        this.hideLoader();
      }

      this.createPointDetailsMap(installation);

      // TODO: The showPictures function will only add pictures and not reflect pictures getting less
      // maybe we can reuse the PhotoView.render function??
      if (installation.has('photos')) {
        self.showPictures(installation);
      }
      
      var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      var ownerName;
      if (installation.has('owner_name')) {
        self.$el.find('.field[name="owner_name"]').val(installation.get('owner_name'));
      } else {
        self.$el.find('.field[name="owner_name"]').val('Unknown Owner');
      }
      
      _.each(installation.attributes, function(v, k) {
        // base case for filling in the fields
        self.$el.find('.field[name="'+k+'"]').val(installation.get(k));

        // for nested stuff that isn't photos (latest report, tags, etc)
        if (k === "latest_report") {
          _.each(v, function(subv, subk) {
            if (subk === "has_sign") {
              if (installation.get('latest_report')[subk] === true) {
                self.$el.find('.field[name="has_sign"]').val('yes');
              } else {
                self.$el.find('.field[name="has_sign"]').val('no');
              }
            } else {
              self.$el.find('.field[name="'+subk+'"]').val(installation.get('latest_report')[subk]);  
            }
          });
        }
        else if (k === "tags") {
          var purposesArray = [];
          var propertiesArray = [];
          var spacesArray = [];
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
          self.$el.find('*[name="sign_stated_purpose"].field').val(purposesArray);
          self.$el.find('*[name="sign_properties"].field').val(propertiesArray);
          self.$el.find('*[name="surveilled_space"].field').val(spacesArray);
        }


        
      });

    }
  });

  veos.view = self;
})(window.veos);